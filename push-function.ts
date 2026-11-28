// Supabase Edge Function "push": отправка FCM (звонки и сообщения) на Android-приложение.
// Secrets: FCM_SERVICE_ACCOUNT (весь JSON сервисного аккаунта Firebase), WEBHOOK_SECRET (любая длинная строка).
// В настройках функции отключить "Verify JWT" (JWT звонков проверяется внутри).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SA = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') || '{}');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const T: Record<string, Record<string, string>> = {
  ru: { call: 'Входящий звонок', vcall: 'Входящий видеозвонок', accept: 'Принять', decline: 'Отклонить', image: '📷 Фото', video: '🎬 Видео', voice: '🎤 Голосовое', file: 'Вложение', msg: 'Новое сообщение' },
  kk: { call: 'Кіріс қоңырау', vcall: 'Кіріс бейнеқоңырау', accept: 'Қабылдау', decline: 'Бас тарту', image: '📷 Фото', video: '🎬 Бейне', voice: '🎤 Дауыстық', file: 'Тіркеме', msg: 'Жаңа хабарлама' },
  en: { call: 'Incoming call', vcall: 'Incoming video call', accept: 'Accept', decline: 'Decline', image: '📷 Photo', video: '🎬 Video', voice: '🎤 Voice message', file: 'Attachment', msg: 'New message' },
};
const tr = (lang?: string) => T[lang || 'ru'] || T.ru;

// ---- OAuth для FCM HTTP v1 ----
let tok: { v: string; exp: number } | null = null;
const b64u = (b: ArrayBuffer | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function accessToken() {
  if (tok && tok.exp > Date.now() + 60000) return tok.v;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = SA.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + head + '.' + body + '.' + b64u(sig) });
  const j = await r.json(); tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; return tok.v;
}
async function sendFcm(token: string, data: Record<string, string>, ttl: string) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${SA.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, data, android: { priority: 'HIGH', ttl } } }),
  });
  if (r.status === 404 || r.status === 400) { const t = await r.text(); if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(t)) await sb.from('device_tokens').delete().eq('token', token); return false; }
  return r.ok;
}
async function toUser(uid: string, mk: (lang?: string) => Record<string, string>, ttl: string) {
  const [{ data: toks }, { data: pr }] = await Promise.all([sb.from('device_tokens').select('token').eq('user_id', uid), sb.from('profiles').select('lang').eq('id', uid).maybeSingle()]);
  const data = mk(pr?.lang); let n = 0;
  for (const t of toks || []) if (await sendFcm(t.token, data, ttl)) n++;
  return n;
}
const blocked = async (a: string, b: string) => { const { data } = await sb.from('blocks').select('blocker_id').or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`).limit(1); return !!data?.length; };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const b = await req.json();
    // 1) вебхук на INSERT в messages
    if (b.record && req.headers.get('x-webhook-secret') === Deno.env.get('WEBHOOK_SECRET')) {
      const m = b.record;
      const [{ data: mem }, { data: me }] = await Promise.all([sb.from('conversation_members').select('user_id').eq('conversation_id', m.conversation_id), sb.from('profiles').select('display_name,username').eq('id', m.sender_id).maybeSingle()]);
      const { data: cv } = await sb.from('conversations').select('type,title').eq('id', m.conversation_id).maybeSingle();
      const who = me?.display_name || me?.username || 'KotakApp';
      let sent = 0;
      for (const u of mem || []) {
        if (u.user_id === m.sender_id || (await blocked(u.user_id, m.sender_id))) continue;
        sent += await toUser(u.user_id, (l) => {
          const t = tr(l); const k = m.message_type;
          const text = k === 'image' ? t.image : k === 'video' ? t.video : k === 'voice' ? t.voice : m.content ? String(m.content).slice(0, 120) : t.file;
          return { type: 'msg', conv: String(m.conversation_id), title: cv?.type === 'group' ? `${cv.title}: ${who}` : who, body: text };
        }, '86400s');
      }
      return json({ sent });
    }
    // 2) вызов от клиента (нужен JWT пользователя)
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
    const { data: u } = await sb.auth.getUser(jwt);
    const me = u?.user; if (!me) return json({ error: 'unauthorized' }, 401);
    if (b.type === 'call' || b.type === 'call_end') {
      if (!b.to || !b.cid || b.to === me.id) return json({ error: 'bad' }, 400);
      if (await blocked(me.id, b.to)) return json({ sent: 0 });
      const { data: p } = await sb.from('profiles').select('display_name,username').eq('id', me.id).maybeSingle();
      const name = p?.display_name || p?.username || 'KotakApp';
      const sent = await toUser(b.to, (l) => {
        const t = tr(l);
        return b.type === 'call_end' ? { type: 'call_end', cid: String(b.cid) }
          : { type: 'call', cid: String(b.cid), from: me.id, kind: b.kind === 'video' ? 'video' : 'audio', name, body: b.kind === 'video' ? t.vcall : t.call, accept: t.accept, decline: t.decline };
      }, '45s');
      return json({ sent });
    }
    return json({ error: 'unknown' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
});
