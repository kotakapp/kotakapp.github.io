'use strict';

const $ = id => document.getElementById(id);
const EMOJI = ['👍','❤️','😂','🔥','😮'];
const cfg = window.KOTAK_CONFIG || {};
const client = window.supabase?.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
let me = null, chats = [], current = null, replyTo = null, target = null, channel = null;
let authMode = 'login';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = value => (String(value || '?').trim()[0] || '?').toUpperCase();
const time = value => new Date(value).toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'});
function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove('show'),7000); }
window.addEventListener('unhandledrejection',e=>toast('Ошибка: '+(e.reason?.message||e.reason)));
window.addEventListener('error',e=>toast('Ошибка: '+e.message));
function usernameEmail(username) { return `${username.toLowerCase()}@users.kotakapp.invalid`; }
function validUsername(value) { return /^[a-z0-9_]{3,24}$/.test(value); }
function setAuthMode(mode) {
  authMode=mode;
  $('auth-title').textContent=mode==='login'?'С возвращением':'Создать аккаунт';
  $('auth-hint').textContent=mode==='login'?'Войди в свой аккаунт KotakApp':'Придумай уникальный username и пароль';
  $('auth-submit').textContent=mode==='login'?'Войти':'Зарегистрироваться';
  $('auth-switch').textContent=mode==='login'?'Нет аккаунта? Зарегистрироваться':'Уже есть аккаунт? Войти';
  $('auth-password').autocomplete=mode==='login'?'current-password':'new-password';
  $('auth-error').textContent='';
}
async function authSubmit(event) {
  event.preventDefault();
  if(!client) return $('auth-error').textContent='Не удалось загрузить Supabase. Проверь подключение к интернету.';
  const username=$('auth-username').value.trim().toLowerCase();
  const password=$('auth-password').value;
  if(!validUsername(username)) return $('auth-error').textContent='Username: 3–24 символа, только a-z, 0-9 и _.';
  if(password.length<8) return $('auth-error').textContent='Пароль должен содержать минимум 8 символов.';
  $('auth-submit').disabled=true; $('auth-error').textContent='';
  try {
    if(authMode==='register') {
      const {data,error}=await client.auth.signUp({email:usernameEmail(username),password,options:{data:{username}}});
      if(error) throw error;
      if(!data.session) {
        $('auth-error').textContent='Аккаунт создан. Если включено подтверждение email, отключи Confirm email в Supabase и попробуй снова.';
        return;
      }
    } else {
      const {error}=await client.auth.signInWithPassword({email:usernameEmail(username),password});
      if(error) throw error;
    }
    await loadSession();
  } catch(error) { $('auth-error').textContent=error.message || 'Не удалось выполнить вход.'; }
  finally { $('auth-submit').disabled=false; }
}
async function loadSession() {
  const {data:{session}}=await client.auth.getSession();
  if(!session) { me=null; $('app').hidden=true; $('auth-wrap').hidden=false; return; }
  const {data:userData}=await client.auth.getUser();
  const user=userData.user;
  let {data:profile,error}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error) throw error;
  if(!profile) {
    const username=user.user_metadata?.username || user.email?.split('@')[0];
    const result=await client.from('profiles').upsert({id:user.id,username,display_name:username},{onConflict:'id'}).select().single();
    if(result.error) throw result.error;
    profile=result.data;
  }
  me={...profile,id:user.id};
  $('auth-wrap').hidden=true; $('app').hidden=false;
  $('me-av').textContent=initials(me.display_name||me.username);
  $('me-name').textContent=me.display_name||me.username;
  $('me-user').textContent='@'+me.username;
  await loadChats();
  markDelivered();
  startRealtime();
  startPresence();
}

let rt=null;
function startRealtime(){
  if(rt) return;
  rt=client.channel('inbox').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},payload=>{
    const m=payload.new;
    if(current && m.conversation_id===current.id){ appendMessage(m); if(m.sender_id!==me.id && document.visibilityState==='visible') markRead(current.id); }
    if(m.sender_id!==me.id) markDelivered();
    clearTimeout(window.rtTimer); window.rtTimer=setTimeout(()=>loadChats().catch(()=>{}),300);
  }).on('postgres_changes',{event:'UPDATE',schema:'public',table:'conversation_members'},payload=>{
    const r=payload.new; const chat=chats.find(c=>c.id===r.conversation_id); const p=chat?.participants.find(x=>x.user_id===r.user_id);
    if(!p) return; p.last_read_at=r.last_read_at; p.last_delivered_at=r.last_delivered_at;
    if(current && current.id===chat.id) updateTicks(); renderChats();
  }).subscribe((status,err)=>{ if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') toast('Реальное время: '+(err?.message||status)); });
}
async function stopRealtime(){ if(rt){ await client.removeChannel(rt); rt=null; } }

let pres=null, online=new Set(), typingMap={}, typingSent=false, typingTimer=null;
const isTyping=c=>c.type==='direct'&&c.otherId&&typingMap[c.otherId]===c.id;
function startPresence(){
  if(pres||!me) return;
  pres=client.channel('presence-online',{config:{presence:{key:me.id}}});
  pres.on('presence',{event:'sync'},()=>{
    const st=pres.presenceState(); online=new Set(); typingMap={};
    for(const [uid,metas] of Object.entries(st)){ online.add(uid); const t=metas.map(x=>x.typing_in).filter(Boolean).pop(); if(t) typingMap[uid]=t; }
    renderChats(); updateRoomStatus();
  }).subscribe(async status=>{ if(status==='SUBSCRIBED') await pres.track({typing_in:null}); });
}
async function stopPresence(){ if(pres){ await client.removeChannel(pres); pres=null; online=new Set(); typingMap={}; typingSent=false; } }
function updateRoomStatus(){
  if(!current) return; const c=currentChat(); if(!c) return;
  let text, live=false;
  if(c.type==='group') text='Групповой чат';
  else if(isTyping(c)){ text='печатает…'; live=true; }
  else if(online.has(c.otherId)){ text='в сети'; live=true; }
  else text='не в сети';
  $('room-sub').textContent=text; $('room-sub').classList.toggle('live',live);
}
function stopTyping(){ clearTimeout(typingTimer); if(typingSent&&pres){ typingSent=false; pres.track({typing_in:null}); } }
function noteTyping(){
  if(!pres||!current) return;
  if($('text').value.trim()===''){ stopTyping(); return; }
  if(!typingSent){ typingSent=true; pres.track({typing_in:current.id}); }
  clearTimeout(typingTimer); typingTimer=setTimeout(stopTyping,3000);
}
document.addEventListener('visibilitychange',()=>{
  if(me&&pres){ if(document.visibilityState==='visible') pres.track({typing_in:null}); else { stopTyping(); pres.untrack(); } }
  if(document.visibilityState!=='visible'||!me) return;
  loadChats().then(()=>{ markDelivered(); if(current){ loadMessages().then(()=>markRead(current.id)).catch(()=>{}); } }).catch(()=>{});
});
async function loadChats() {
  const {data:members,error}=await client.from('conversation_members').select('conversation_id, conversations(id,type,title,created_at)').eq('user_id',me.id);
  if(error) throw error;
  const ids=(members||[]).map(x=>x.conversation_id);
  if(!ids.length) { chats=[]; renderChats(); return; }
  const {data:allMembers,error:memberError}=await client.from('conversation_members').select('conversation_id,user_id,last_read_at,last_delivered_at,profiles(username,display_name)').in('conversation_id',ids);
  if(memberError) throw memberError;
  const {data:lastMessages,error:msgError}=await client.from('messages').select('id,conversation_id,sender_id,content,created_at').in('conversation_id',ids).order('created_at',{ascending:false});
  if(msgError) throw msgError;
  chats=(members||[]).filter(row=>row.conversations).map(row=>{
    const c=row.conversations; const participants=(allMembers||[]).filter(x=>x.conversation_id===c.id);
    const other=participants.find(x=>x.user_id!==me.id)?.profiles;
    const title=c.type==='group'?(c.title||'Группа'):(other?.display_name||other?.username||'Новый чат');
    return {id:c.id,type:c.type,title,otherId:participants.find(x=>x.user_id!==me.id)?.user_id,otherUsername:other?.username,participants,incoming:(lastMessages||[]).filter(m=>m.conversation_id===c.id&&m.sender_id!==me.id).map(m=>m.created_at),last:(lastMessages||[]).find(m=>m.conversation_id===c.id)||null};
  }).sort((a,b)=>new Date(b.last?.created_at||0)-new Date(a.last?.created_at||0));
  renderChats();
}
function unreadOf(c){
  const mine=(c.participants||[]).find(x=>x.user_id===me.id); if(!mine?.last_read_at) return 0;
  const lr=new Date(mine.last_read_at).getTime();
  return (c.incoming||[]).filter(t=>new Date(t).getTime()>lr).length;
}
function badge(c){ const n=unreadOf(c); return n?`<span class="badge">${n>99?'99+':n}</span>`:''; }
const currentChat=()=>chats.find(c=>c.id===current?.id)||current;
function tickState(createdAt){
  const others=(currentChat()?.participants||[]).filter(x=>x.user_id!==me.id);
  if(!others.length) return 'sent';
  const t=new Date(createdAt).getTime();
  if(others.every(x=>x.last_read_at&&new Date(x.last_read_at).getTime()>=t)) return 'read';
  if(others.every(x=>x.last_delivered_at&&new Date(x.last_delivered_at).getTime()>=t)) return 'delivered';
  return 'sent';
}
function paintTick(el,createdAt){ if(!el) return; const s=tickState(createdAt); el.className='tick '+s; el.textContent=s==='sent'?'✓':'✓✓'; }
function updateTicks(){ document.querySelectorAll('#msgs .m.me').forEach(d=>paintTick(d.querySelector('.tick'),d.dataset.t)); }
async function markRead(id){
  if(!id||!me) return;
  try{
    const {error}=await client.rpc('mark_conversation_read',{conv:id}); if(error) throw error;
    const p=chats.find(c=>c.id===id)?.participants.find(x=>x.user_id===me.id);
    if(p){ p.last_read_at=new Date().toISOString(); p.last_delivered_at=p.last_read_at; renderChats(); }
  }catch(e){ console.warn('mark read',e); }
}
let lastDel=0;
function markDelivered(){
  if(!me||Date.now()-lastDel<2000) return; lastDel=Date.now();
  client.rpc('mark_delivered').then(({error})=>{ if(error) console.warn('mark delivered',error); });
}
function renderChats() {
  const total=chats.reduce((s,c)=>s+unreadOf(c),0); document.title=total?`(${total}) KotakApp`:'KotakApp';
  const q=$('q').value.trim().toLowerCase();
  $('chat-list').innerHTML=chats.filter(c=>c.title.toLowerCase().includes(q)).map(c=>`<li><button class="item ${current?.id===c.id?'on':''}" data-chat="${c.id}"><div class="avatar">${esc(initials(c.title))}${c.type==='direct'&&online.has(c.otherId)?'<span class="dot"></span>':''}</div><div class="meta"><div class="row"><span class="name">${esc(c.title)}</span><span class="muted small">${c.last?time(c.last.created_at):''}</span></div><div class="row2"><div class="last">${isTyping(c)?'печатает…':c.last?esc(c.last.content||'Вложение'):'Сообщений пока нет'}</div>${badge(c)}</div></div></button></li>`).join('')||'<li class="muted" style="padding:20px">Чатов пока нет. Найди друзей во вкладке «Контакты».</li>';
}
async function searchUsers() {
  const q=$('user-search').value.trim().toLowerCase();
  if(q.length<2) { $('contact-list').innerHTML='<li class="muted" style="padding:20px">Введи минимум 2 символа username.</li>'; return; }
  const {data,error}=await client.from('profiles').select('id,username,display_name').ilike('username',`%${q}%`).neq('id',me.id).limit(20);
  if(error) { toast(error.message); return; }
  $('contact-list').innerHTML=(data||[]).map(u=>`<li><button class="item" data-user="${u.id}"><div class="avatar">${esc(initials(u.display_name||u.username))}</div><div class="meta"><div class="name">${esc(u.display_name||u.username)}</div><div class="last">@${esc(u.username)}</div></div></button></li>`).join('')||'<li class="muted" style="padding:20px">Пользователи не найдены.</li>';
}
async function startDirectChat(userId, title) {
  try {
    const {data,error}=await client.rpc('create_direct_conversation',{target_user_id:userId});
    if(error) throw new Error('Создание чата: '+error.message);
    try { await loadChats(); } catch(e) { toast('Список чатов: '+(e.message||e)); }
    let chat=chats.find(c=>c.id===data);
    if(!chat) chat={id:data,type:'direct',title:title||'Новый чат',participants:[],last:null};
    setTab('chats');
    await openChat(chat);
  } catch(e) { toast(e.message||String(e)); }
}
async function openChat(chat) {
  current=chat; replyTo=null; $('reply-bar').hidden=true; $('room').hidden=false; $('empty').hidden=true;
  $('room-av').textContent=initials(chat.title); $('room-title').textContent=chat.title;
  $('room-sub').textContent=chat.type==='group'?'Групповой чат':'KotakApp'; $('app').dataset.view='room';
  updateRoomStatus();
  if(!roomPushed){ history.pushState({room:1},''); roomPushed=true; }
  await loadMessages();
  renderChats();
  markRead(chat.id);
}
function appendMessage(m) {
  if(!current || m.conversation_id!==current.id) return;
  const exists=$('msgs').querySelector(`[data-id="${m.id}"]`); if(exists) return;
  const mine=m.sender_id===me.id;
  const div=document.createElement('div'); div.className='m '+(mine?'me':''); div.dataset.id=m.id;
  div.dataset.t=m.created_at;
  div.innerHTML=`${esc(m.content||'') }<div class="t"><span class="tm">${time(m.created_at)}</span>${mine?' <span class="tick"></span>':''}</div>`;
  if(mine) paintTick(div.querySelector('.tick'),m.created_at);
  $('msgs').appendChild(div); $('msgs').scrollTop=1e9;
}
async function loadMessages() {
  const {data,error}=await client.from('messages').select('*').eq('conversation_id',current.id).order('created_at',{ascending:true}).limit(200);
  if(error) { toast(error.message); return; }
  $('msgs').innerHTML=''; (data||[]).forEach(appendMessage);
}
async function sendMessage(event) {
  event.preventDefault(); const content=$('text').value.trim(); if(!content||!current) return;
  $('text').value=''; $('text').style.height='auto'; stopTyping();
  const {data,error}=await client.from('messages').insert({conversation_id:current.id,sender_id:me.id,content,message_type:'text'}).select().single();
  if(error) { $('text').value=content; toast(error.message); return; }
  appendMessage(data); loadChats().catch(()=>{});
}
let roomPushed=false;
function closeRoom(){ stopTyping(); $('app').dataset.view='list'; current=null; replyTo=null; $('room').hidden=true; $('empty').hidden=false; renderChats(); }
window.addEventListener('popstate',()=>{ roomPushed=false; if($('app').dataset.view==='room') closeRoom(); });
function setTab(tab) {
  for(const name of ['chats','contacts','profile']) $('pane-'+name).hidden=name!==tab;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
}
async function logout() { await stopRealtime(); await stopPresence(); await client.auth.signOut(); current=null; chats=[]; $('app').hidden=true; $('auth-wrap').hidden=false; setAuthMode('login'); }
$('auth-form').addEventListener('submit',authSubmit);
$('auth-switch').onclick=()=>setAuthMode(authMode==='login'?'register':'login');
$('tabs').onclick=e=>{const b=e.target.closest('button[data-tab]');if(b)setTab(b.dataset.tab);};
$('q').oninput=renderChats;
$('user-search').oninput=()=>{clearTimeout(window.searchTimer);window.searchTimer=setTimeout(searchUsers,250);};
$('contact-list').onclick=e=>{const b=e.target.closest('[data-user]');if(b)startDirectChat(b.dataset.user,b.querySelector('.name')?.textContent);};
$('chat-list').onclick=e=>{const b=e.target.closest('[data-chat]');if(b){const c=chats.find(x=>x.id===b.dataset.chat);if(c)openChat(c);}};
$('back').onclick=()=>{ if(roomPushed) history.back(); else closeRoom(); };
$('composer').onsubmit=sendMessage;
$('text').addEventListener('input',()=>{ noteTyping(); const t=$('text'); t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,140)+'px'; });
$('text').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey&&!matchMedia('(pointer:coarse)').matches){ e.preventDefault(); $('composer').requestSubmit(); } });
$('logout').onclick=logout;
$('react-row').innerHTML=EMOJI.map(x=>`<button data-e="${x}">${x}</button>`).join('');
$('msgs').onclick=e=>{const m=e.target.closest('.m');if(!m)return;target={id:m.dataset.id,text:m.textContent};$('sheet').hidden=false;};
$('react-row').onclick=()=>toast('Реакции подключим следующим этапом.');
$('act-reply').onclick=()=>{if(target){$('reply-text').textContent='Ответ: '+target.text;$('reply-bar').hidden=false;}$('sheet').hidden=true;};
$('reply-x').onclick=()=>$('reply-bar').hidden=true;
$('act-close').onclick=()=>$('sheet').hidden=true;
$('sheet').onclick=e=>{if(e.target===$('sheet'))$('sheet').hidden=true;};

const pushSupported=()=>'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function keyToBytes(b64){const p='='.repeat((4-b64.length%4)%4);const r=atob((b64+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));}
async function updatePushBtn(){
  const b=$('push-btn'); if(!pushSupported()){ b.textContent='Уведомления недоступны в этом браузере'; b.disabled=true; return; }
  const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription();
  b.textContent=sub?'Выключить уведомления':'Включить уведомления';
}
async function togglePush(){
  try{
    if(isIOS&&!isStandalone) return toast('На iPhone сначала добавь сайт на экран «Домой»: Поделиться → На экран Домой. Потом открой его оттуда.');
    const reg=await navigator.serviceWorker.ready; const existing=await reg.pushManager.getSubscription();
    if(existing){ await client.from('push_subscriptions').delete().eq('endpoint',existing.endpoint); await existing.unsubscribe(); toast('Уведомления выключены'); return updatePushBtn(); }
    if(!cfg.VAPID_PUBLIC_KEY) throw new Error('В config.js нет VAPID_PUBLIC_KEY');
    const perm=await Notification.requestPermission();
    if(perm!=='granted') return toast('Разрешение не выдано. Включи уведомления для сайта в настройках браузера.');
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyToBytes(cfg.VAPID_PUBLIC_KEY)});
    const j=sub.toJSON();
    const {error}=await client.from('push_subscriptions').upsert({user_id:me.id,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth},{onConflict:'endpoint'});
    if(error){ await sub.unsubscribe(); throw error; }
    toast('Уведомления включены'); updatePushBtn();
  }catch(e){ toast('Уведомления: '+(e.message||e)); }
}
$('push-btn').onclick=togglePush;
(async()=>{
  try {
  if(!client) { $('auth-error').textContent='Supabase не загрузился. Проверь интернет-соединение.'; return; }
  try { await loadSession(); updatePushBtn().catch(()=>{}); } catch(error) { toast(error.message||'Ошибка загрузки аккаунта'); }
  client.auth.onAuthStateChange((_event)=>{ if(_event==='SIGNED_OUT'){ $('app').hidden=true; $('auth-wrap').hidden=false; } });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  } finally { $('boot').hidden=true; }
})();
