'use strict';

const $ = id => document.getElementById(id);
const EMOJI = ['👍','❤️','😂','🔥','😮','😢'];
const cfg = window.KOTAK_CONFIG || {};
const client = window.supabase?.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
let me = null, chats = [], current = null, replyTo = null, target = null, channel = null;
let authMode = 'login';
let reactions = [], msgMap = new Map(), reactWarned = false;
let hiddenIds = new Set(), editing = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = value => (String(value || '?').trim()[0] || '?').toUpperCase();
const avCls = v => 'c'+([...String(v||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)%6);
const avatar = (name,dot=false,url='') => url?`<div class="avatar photo" style="background-image:url('${esc(url)}')">${dot?'<span class="dot"></span>':''}</div>`:`<div class="avatar ${avCls(name)}">${esc(initials(name))}${dot?'<span class="dot"></span>':''}</div>`;
const setAv = (id,name,extra='',url='') => { const el=$(id); el.className=('avatar '+extra+' '+(url?'photo':avCls(name))).replace(/\s+/g,' ').trim(); el.style.backgroundImage=url?`url("${url}")`:''; el.textContent=url?'':initials(name); };
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
  paintMe();
  $('me-name').textContent=me.display_name||me.username;
  $('me-user').textContent='@'+me.username; $('bio-in').value=me.bio||'';
  await loadHidden();
  await loadChats();
  markDelivered();
  startRealtime();
  startPresence();
  startCalls();
  cleanupMedia();
}

async function loadHidden(){
  const {data,error}=await client.from('message_hides').select('message_id').eq('user_id',me.id);
  if(error){ console.warn('message_hides',error); return; }
  hiddenIds=new Set((data||[]).map(r=>r.message_id));
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
  }).on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},payload=>{
    const m=payload.new; if(current && m.conversation_id===current.id) refreshMessage(m);
    clearTimeout(window.rtTimer); window.rtTimer=setTimeout(()=>loadChats().catch(()=>{}),300);
  }).on('postgres_changes',{event:'*',schema:'public',table:'reactions'},()=>{
    clearTimeout(window.rxTimer); window.rxTimer=setTimeout(()=>{ if(current) loadReactions().catch(()=>{}); },250);
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
  if(c.type==='group') text='Группа · '+((c.participants||[]).length||'')+' уч.';
  else if(isTyping(c)){ text='печатает…'; live=true; }
  else if(online.has(c.otherId)){ text='в сети'; live=true; }
  else text='не в сети';
  $('room-sub').textContent=text; $('room-sub').classList.toggle('live',live);
  $('card-status').textContent=text; $('card-status').classList.toggle('live',live);
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
  cleanupMedia();
  loadChats().then(()=>{ markDelivered(); if(current){ loadMessages().then(()=>markRead(current.id)).catch(()=>{}); } }).catch(()=>{});
});
async function loadChats() {
  const {data:members,error}=await client.from('conversation_members').select('conversation_id, conversations(id,type,title,created_at)').eq('user_id',me.id);
  if(error) throw error;
  const ids=(members||[]).map(x=>x.conversation_id);
  if(!ids.length) { chats=[]; renderChats(); return; }
  const {data:allMembers,error:memberError}=await client.from('conversation_members').select('conversation_id,user_id,last_read_at,last_delivered_at,profiles(username,display_name,avatar_url,bio)').in('conversation_id',ids);
  if(memberError) throw memberError;
  const {data:lm,error:msgError}=await client.from('messages').select('id,conversation_id,sender_id,content,created_at,message_type,deleted_at').in('conversation_id',ids).order('created_at',{ascending:false});
  if(msgError) throw msgError;
  const lastMessages=(lm||[]).filter(m=>!hiddenIds.has(m.id));
  chats=(members||[]).filter(row=>row.conversations).map(row=>{
    const c=row.conversations; const participants=(allMembers||[]).filter(x=>x.conversation_id===c.id);
    const other=participants.find(x=>x.user_id!==me.id)?.profiles;
    const title=c.type==='group'?(c.title||'Группа'):(other?.display_name||other?.username||'Новый чат');
    return {id:c.id,type:c.type,title,otherId:participants.find(x=>x.user_id!==me.id)?.user_id,otherUsername:other?.username,otherAvatar:other?.avatar_url||'',participants,incoming:(lastMessages||[]).filter(m=>m.conversation_id===c.id&&m.sender_id!==me.id).map(m=>m.created_at),last:(lastMessages||[]).find(m=>m.conversation_id===c.id)||null};
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
const TICK1='<svg viewBox="0 0 20 16"><path d="M4 8.500l3.500 3.500L16 4"/></svg>', TICK2='<svg viewBox="0 0 22 16"><path d="M1.500 8.500L5 12l8-8.500M9 11.500l1 .8L19 4"/></svg>';
const tickSvg=s=>s==='sent'?TICK1:TICK2;
const tickState=createdAt=>tickFor(currentChat(),createdAt);
function tickFor(chat,createdAt){
  const others=(chat?.participants||[]).filter(x=>x.user_id!==me.id);
  if(!others.length) return 'sent';
  const t=new Date(createdAt).getTime();
  if(others.every(x=>x.last_read_at&&new Date(x.last_read_at).getTime()>=t)) return 'read';
  if(others.every(x=>x.last_delivered_at&&new Date(x.last_delivered_at).getTime()>=t)) return 'delivered';
  return 'sent';
}
function paintTick(el,createdAt){ if(!el) return; const s=tickState(createdAt); el.className='tick '+s; el.innerHTML=tickSvg(s); }
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
let unreadOnly=false;
function renderChats() {
  const total=chats.reduce((s,c)=>s+unreadOf(c),0); document.title=total?`(${total}) KotakApp`:'KotakApp';
  const q=$('q').value.trim().toLowerCase();
  $('chat-list').innerHTML=chats.filter(c=>c.title.toLowerCase().includes(q)&&(!unreadOnly||unreadOf(c)>0)).map(c=>{
    const n=unreadOf(c), typing=isTyping(c), mineLast=!!c.last&&c.last.sender_id===me.id&&!c.last.deleted_at;
    const prev=typing?'печатает…':c.last?(c.last.deleted_at?'🚫 Сообщение удалено':c.last.message_type==='voice'?'🎤 Голосовое':c.last.message_type==='image'?'📷 Фото':c.last.message_type==='video'?'🎬 Видео':esc(c.last.content||'Вложение')):'Сообщений пока нет';
    const tk=mineLast?`<span class="tick ${tickFor(c,c.last.created_at)}">${tickSvg(tickFor(c,c.last.created_at))}</span>`:'';
    return `<li><button class="item ${current?.id===c.id?'on':''}" data-chat="${c.id}">${avatar(c.title,c.type==='direct'&&online.has(c.otherId),c.type==='direct'?c.otherAvatar:'')}<div class="meta"><div class="row"><span class="name">${esc(c.title)}</span><span class="when ${n?'new':''}">${tk}${c.last?time(c.last.created_at):''}</span></div><div class="row2"><div class="last ${typing?'typing':''}">${prev}</div>${badge(c)}</div></div></button></li>`;
  }).join('')||`<li class="muted" style="padding:20px">${unreadOnly?'Непрочитанных чатов нет.':'Чатов пока нет. Найди друзей во вкладке «Контакты».'}</li>`;
}
async function searchUsers() {
  const q=$('user-search').value.trim().toLowerCase();
  if(q.length<2) { $('contact-list').innerHTML='<li class="muted" style="padding:20px">Введи минимум 2 символа username.</li>'; return; }
  const {data,error}=await client.from('profiles').select('id,username,display_name,avatar_url').ilike('username',`%${q}%`).neq('id',me.id).limit(20);
  if(error) { toast(error.message); return; }
  $('contact-list').innerHTML=(data||[]).map(u=>`<li><button class="item" data-user="${u.id}">${avatar(u.display_name||u.username,false,u.avatar_url)}<div class="meta"><div class="name">${esc(u.display_name||u.username)}</div><div class="last">@${esc(u.username)}</div></div></button></li>`).join('')||'<li class="muted" style="padding:20px">Пользователи не найдены.</li>';
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
  cancelEdit(); current=chat; replyTo=null; $('reply-bar').hidden=true; $('room').hidden=false; $('empty').hidden=true;
  setAv('room-av',chat.title,'',chat.otherAvatar); $('card').hidden=true; $('room-title').textContent=chat.title;
  $('room-sub').textContent=chat.type==='group'?'Группа':'KotakApp'; $('app').dataset.view='room';
  updateRoomStatus();
  if(!roomPushed){ history.pushState({room:1},''); roomPushed=true; }
  await loadMessages();
  renderChats();
  markRead(chat.id);
}
const nameOf=uid=>{ if(uid===me.id) return 'Вы'; const p=(currentChat()?.participants||[]).find(x=>x.user_id===uid)?.profiles; return p?.display_name||p?.username||'Участник'; };
const previewOf=m=>m?(m.deleted_at?'Сообщение удалено':m.message_type==='voice'?'🎤 Голосовое':m.message_type==='image'?'📷 Фото':m.message_type==='video'?'🎬 Видео':String(m.content||'Вложение').slice(0,90)):'Сообщение';
function quoteHtml(id){ const o=msgMap.get(id); return `<div class="q" data-goto="${esc(id)}"><b>${o?esc(nameOf(o.sender_id)):'Ответ'}</b> ${esc(previewOf(o))}</div>`; }
async function fillQuote(div,id){
  if(msgMap.has(id)) return;
  const {data}=await client.from('messages').select('id,content,sender_id,message_type,conversation_id,created_at').eq('id',id).maybeSingle();
  if(!data) return; msgMap.set(id,data);
  const q=div.querySelector('.q'); if(q) q.outerHTML=quoteHtml(id);
}
function fillMessage(div,m){
  const mine=m.sender_id===me.id;
  div.className='m '+(mine?'me':'')+(m.deleted_at?' deleted':''); div.dataset.t=m.created_at;
  if(m.deleted_at){
    div.innerHTML=`<div class="del">🚫 Сообщение удалено</div><div class="t"><span class="tm">${time(m.created_at)}</span></div>`;
    return;
  }
  const body=(m.message_type==='voice'&&m.media_path)
    ? `<div class="vm"><button type="button" class="vplay" data-path="${esc(m.media_path)}" data-ms="${Number(m.media_duration_ms)||0}" aria-label="Воспроизвести">▶</button><div class="vbar"><i></i></div><span class="vdur">${fmtDur(m.media_duration_ms)}</span></div>`
    : (m.message_type==='image'||m.message_type==='video')
      ? (m.media_deleted_at?'<div class="del">🕓 Файл удалён (срок хранения истёк)</div>':`<div class="media" data-path="${esc(m.media_path)}" data-kind="${m.message_type}"></div>`)+(m.content?`<div class="cap">${esc(m.content)}</div>`:'')
      : esc(m.content||'');
  const who=(current?.type==='group'&&!mine)?`<div class="who">${esc(nameOf(m.sender_id))}</div>`:'';
  const quote=m.reply_to_id?quoteHtml(m.reply_to_id):'';
  div.innerHTML=`${who}${quote}${body}<div class="t">${m.edited_at?'<span class="ed">изм.</span>':''}<span class="tm">${time(m.created_at)}</span>${mine?' <span class="tick"></span>':''}</div><div class="rx"></div>`;
  if(mine) paintTick(div.querySelector('.tick'),m.created_at);
  div.querySelectorAll('.media').forEach(loadMedia);
  if(m.reply_to_id) fillQuote(div,m.reply_to_id).catch(()=>{});
  renderReactions(m.id);
}
function appendMessage(m) {
  if(!current || m.conversation_id!==current.id) return;
  if(hiddenIds.has(m.id)) return;
  const exists=$('msgs').querySelector(`[data-id="${m.id}"]`); if(exists) return;
  msgMap.set(m.id,m);
  const div=document.createElement('div'); div.dataset.id=m.id;
  fillMessage(div,m);
  $('msgs').appendChild(div); $('msgs').scrollTop=1e9;
}
function refreshMessage(m){
  const old=msgMap.get(m.id); m={...old,...m}; msgMap.set(m.id,m);
  if(hiddenIds.has(m.id)) return;
  const div=$('msgs').querySelector(`[data-id="${m.id}"]`);
  if(div) fillMessage(div,m);
  $('msgs').querySelectorAll(`.q[data-goto="${m.id}"]`).forEach(q=>{ q.outerHTML=quoteHtml(m.id); });
}
function renderReactions(mid){
  const div=$('msgs').querySelector(`[data-id="${mid}"]`); if(!div) return;
  const box=div.querySelector('.rx'); if(!box) return;
  const by={}; for(const r of reactions.filter(x=>x.message_id===mid)){ (by[r.emoji]=by[r.emoji]||[]).push(r.user_id); }
  box.innerHTML=Object.entries(by).map(([e,u])=>`<button type="button" class="rxc ${u.includes(me.id)?'mine':''}" data-mid="${mid}" data-e="${e}">${e} ${u.length}</button>`).join('');
}
function renderAllReactions(){ $('msgs').querySelectorAll('.m').forEach(d=>renderReactions(d.dataset.id)); }
async function loadReactions(){
  if(!current) return; const id=current.id;
  const {data,error}=await client.from('reactions').select('message_id,user_id,emoji,messages!inner(conversation_id)').eq('messages.conversation_id',id);
  if(error){ if(!reactWarned){ reactWarned=true; toast('Реакции: '+error.message); } return; }
  if(!current||current.id!==id) return;
  reactions=(data||[]).map(r=>({message_id:r.message_id,user_id:r.user_id,emoji:r.emoji}));
  renderAllReactions();
}
async function toggleReaction(mid,emoji){
  const before=reactions.slice();
  const same=reactions.find(r=>r.message_id===mid&&r.user_id===me.id&&r.emoji===emoji);
  try{
    if(same){
      reactions=reactions.filter(r=>r!==same); renderReactions(mid);
      const {error}=await client.from('reactions').delete().eq('message_id',mid).eq('user_id',me.id).eq('emoji',emoji);
      if(error) throw error;
    } else {
      reactions.push({message_id:mid,user_id:me.id,emoji}); renderReactions(mid);
      let {error}=await client.from('reactions').insert({message_id:mid,user_id:me.id,emoji});
      if(error&&error.code==='23505'){
        reactions=reactions.filter(r=>!(r.message_id===mid&&r.user_id===me.id&&r.emoji!==emoji)); renderReactions(mid);
        ({error}=await client.from('reactions').update({emoji}).eq('message_id',mid).eq('user_id',me.id));
      }
      if(error) throw error;
    }
  }catch(e){ reactions=before; renderReactions(mid); toast('Реакция: '+(e.message||e)); }
}
async function loadMessages() {
  const {data,error}=await client.from('messages').select('*').eq('conversation_id',current.id).order('created_at',{ascending:false}).limit(200);
  if(error) { toast(error.message); return; }
  $('msgs').innerHTML=''; msgMap=new Map(); reactions=[]; (data||[]).slice().reverse().forEach(appendMessage);
  await loadReactions();
}
async function sendMessage(event) {
  event.preventDefault(); if(rec){ stopRecording(true); return; }
  const content=$('text').value.trim(); if(!content||!current) return;
  if(editing){
    const ed=editing, old=msgMap.get(ed.id);
    if(old && old.content===content){ cancelEdit(); return; }
    const {error}=await client.rpc('edit_message',{msg:ed.id,new_content:content});
    if(error){ toast('Изменение: '+error.message); return; }
    cancelEdit(); stopTyping();
    refreshMessage({id:ed.id,content,edited_at:new Date().toISOString()}); loadChats().catch(()=>{}); return;
  }
  $('text').value=''; $('text').style.height='auto'; stopTyping(); syncBtns();
  const rid=replyTo?.id||null;
  const row={conversation_id:current.id,sender_id:me.id,content,message_type:'text'}; if(rid) row.reply_to_id=rid;
  const {data,error}=await client.from('messages').insert(row).select().single();
  if(error) { $('text').value=content; syncBtns(); toast(error.message); return; }
  replyTo=null; $('reply-bar').hidden=true;
  appendMessage(data); loadChats().catch(()=>{});
}
const fmtDur=ms=>{ const s=Math.round((Number(ms)||0)/1000); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
function syncBtns(){ if(rec) return; const has=$('text').value.trim().length>0; $('mic').hidden=has; $('send-btn').hidden=!has; }
function setRecUI(on){ $('text').hidden=on; $('attach').hidden=on; $('recbar').hidden=!on; if(on){ $('mic').hidden=true; $('send-btn').hidden=false; } else syncBtns(); }

let rec=null;
async function startRecording(){
  if(!current||rec) return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder) return toast('Запись голоса не поддерживается в этом браузере.');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
    const mr=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000});
    const r={mr,stream,chunks:[],start:Date.now(),ms:0,cancelled:false,convId:current.id};
    mr.ondataavailable=e=>{ if(e.data&&e.data.size) r.chunks.push(e.data); };
    mr.onstop=()=>finishRecording(r);
    mr.start(250); rec=r; stopTyping(); setRecUI(true); $('rec-time').textContent='0:00';
    r.timer=setInterval(()=>{ const ms=Date.now()-r.start; $('rec-time').textContent=fmtDur(ms); if(ms>600000) stopRecording(true); },250);
  }catch(e){ toast('Нет доступа к микрофону. Разреши его для сайта в настройках Chrome.'); }
}
function stopRecording(send){
  const r=rec; if(!r) return; rec=null;
  r.cancelled=!send; r.ms=Date.now()-r.start; clearInterval(r.timer);
  if(r.mr.state!=='inactive') r.mr.stop();
  r.stream.getTracks().forEach(t=>t.stop()); setRecUI(false);
}
async function finishRecording(r){
  if(r.cancelled||!r.chunks.length) return;
  if(r.ms<700) return toast('Слишком короткое сообщение');
  try{
    const type=(r.mr.mimeType||'audio/webm').split(';')[0];
    const ext=type.includes('mp4')?'m4a':'webm';
    const blob=new Blob(r.chunks,{type});
    const path=`${r.convId}/${me.id}/${Date.now()}.${ext}`;
    const up=await client.storage.from('voice').upload(path,blob,{contentType:type});
    if(up.error) throw up.error;
    const {data,error}=await client.from('messages').insert({conversation_id:r.convId,sender_id:me.id,content:'',message_type:'voice',media_path:path,media_duration_ms:r.ms}).select().single();
    if(error) throw error;
    appendMessage(data); loadChats().catch(()=>{});
  }catch(e){ toast('Голосовое не отправлено: '+(e.message||e)); }
}

let voiceAudio=null, voiceBtn=null;
function stopVoice(){
  if(voiceAudio){ voiceAudio.pause(); voiceAudio=null; }
  if(voiceBtn){ voiceBtn.textContent='▶'; const i=voiceBtn.parentElement.querySelector('.vbar i'); if(i) i.style.width='0'; voiceBtn=null; }
}
async function toggleVoice(btn){
  if(voiceBtn===btn&&voiceAudio){ voiceAudio.paused?voiceAudio.play():voiceAudio.pause(); return; }
  stopVoice(); btn.textContent='…';
  try{
    const {data,error}=await client.storage.from('voice').createSignedUrl(btn.dataset.path,3600);
    if(error) throw error;
    const a=new Audio(data.signedUrl); voiceAudio=a; voiceBtn=btn;
    const bar=btn.parentElement.querySelector('.vbar i');
    a.ontimeupdate=()=>{ const total=Number.isFinite(a.duration)?a.duration:(Number(btn.dataset.ms)/1000); if(total>0) bar.style.width=Math.min(100,a.currentTime/total*100)+'%'; };
    a.onplay=()=>{ btn.textContent='❚❚'; }; a.onpause=()=>{ if(!a.ended) btn.textContent='▶'; };
    a.onended=()=>{ stopVoice(); };
    await a.play();
  }catch(e){ btn.textContent='▶'; voiceBtn=null; voiceAudio=null; toast('Не удалось воспроизвести: '+(e.message||e)); }
}

let roomPushed=false, cardPushed=false;
function closeRoom(){ $('card').hidden=true; cardPushed=false; cancelEdit(); stopTyping(); stopRecording(false); stopVoice(); $('app').dataset.view='list'; current=null; replyTo=null; $('reply-bar').hidden=true; $('room').hidden=true; $('empty').hidden=false; renderChats(); }
window.addEventListener('popstate',()=>{ if(!$('card').hidden){ $('card').hidden=true; cardPushed=false; return; } roomPushed=false; if($('app').dataset.view==='room') closeRoom(); });
function setTab(tab) {
  for(const name of ['chats','contacts','settings','profile']) $('pane-'+name).hidden=name!==tab;
  $('side').dataset.tab=tab;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
}
async function logout() { if(call) endCall('remote',true); await stopCalls(); await stopRealtime(); await stopPresence(); await client.auth.signOut(); current=null; chats=[]; $('app').hidden=true; $('auth-wrap').hidden=false; setAuthMode('login'); }
$('auth-form').addEventListener('submit',authSubmit);
$('auth-switch').onclick=()=>setAuthMode(authMode==='login'?'register':'login');
$('tabs').onclick=e=>{const b=e.target.closest('button[data-tab]');if(b)setTab(b.dataset.tab);};
$('q').oninput=renderChats;
$('user-search').oninput=()=>{clearTimeout(window.searchTimer);window.searchTimer=setTimeout(searchUsers,250);};
$('contact-list').onclick=e=>{const b=e.target.closest('[data-user]');if(b)startDirectChat(b.dataset.user,b.querySelector('.name')?.textContent);};
$('chat-list').onclick=e=>{const b=e.target.closest('[data-chat]');if(b){const c=chats.find(x=>x.id===b.dataset.chat);if(c)openChat(c);}};
$('back').onclick=()=>{ if(roomPushed) history.back(); else closeRoom(); };
$('composer').onsubmit=sendMessage;
$('mic').onclick=startRecording;
$('rec-cancel').onclick=()=>stopRecording(false);
$('text').addEventListener('input',()=>{ noteTyping(); syncBtns(); const t=$('text'); t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,140)+'px'; });
$('text').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey&&!matchMedia('(pointer:coarse)').matches){ e.preventDefault(); $('composer').requestSubmit(); } });
$('logout').onclick=logout;
$('h-search').onclick=()=>{ setTab('chats'); $('q').focus(); };
$('h-menu').onclick=e=>{ e.stopPropagation(); $('menu').hidden=!$('menu').hidden; };
document.addEventListener('click',e=>{ if(!e.target.closest('#menu')) $('menu').hidden=true; });
$('m-group').onclick=()=>{ $('menu').hidden=true; openGroup(); };
$('m-settings').onclick=()=>{ $('menu').hidden=true; setTab('settings'); };
$('q-filter').onclick=()=>{ unreadOnly=!unreadOnly; $('q-filter').setAttribute('aria-pressed',unreadOnly); renderChats(); };
$('fab').onclick=()=>{ setTab('contacts'); $('user-search').focus(); };
$('react-row').innerHTML=EMOJI.map(x=>`<button data-e="${x}">${x}</button>`).join('');
$('msgs').onclick=e=>{
  const pb=e.target.closest('.vplay'); if(pb){ toggleVoice(pb); return; }
  const chip=e.target.closest('.rxc'); if(chip){ toggleReaction(chip.dataset.mid,chip.dataset.e); return; }
  const q=e.target.closest('.q'); if(q){ const t=$('msgs').querySelector(`[data-id="${q.dataset.goto}"]`); if(t){ t.scrollIntoView({block:'center',behavior:'smooth'}); t.classList.add('flash'); setTimeout(()=>t.classList.remove('flash'),1200); } return; }
  if(e.target.closest('video')) return;
  const im=e.target.closest('.media img'); if(im){ openLightbox('image',im.closest('.media').dataset.path); return; }
  const m=e.target.closest('.m'); if(!m) return;
  const msg=msgMap.get(m.dataset.id); target={id:m.dataset.id,msg};
  $('react-row').querySelectorAll('button').forEach(b=>b.classList.toggle('on',reactions.some(r=>r.message_id===target.id&&r.user_id===me.id&&r.emoji===b.dataset.e)));
  const mine=msg?.sender_id===me.id, del=!!msg?.deleted_at;
  $('react-row').hidden=del; $('act-reply').hidden=del;
  $('act-edit').hidden=!(mine&&!del&&!['voice','image','video'].includes(msg.message_type)); $('act-del-all').hidden=!(mine&&!del);
  $('sheet').hidden=false;
};
$('react-row').onclick=e=>{ const b=e.target.closest('[data-e]'); if(!b||!target) return; $('sheet').hidden=true; toggleReaction(target.id,b.dataset.e); };
$('act-reply').onclick=()=>{
  if(target&&!target.msg?.deleted_at){ cancelEdit(); replyTo={id:target.id}; $('reply-text').textContent='↩ '+nameOf(target.msg?.sender_id)+': '+previewOf(target.msg); $('reply-bar').hidden=false; }
  $('sheet').hidden=true; $('text').focus();
};
$('reply-x').onclick=()=>{ if(editing) cancelEdit(); replyTo=null; $('reply-bar').hidden=true; };
function cancelEdit(){
  if(!editing) return; editing=null; $('text').value=''; $('text').style.height='auto'; $('reply-bar').hidden=true; syncBtns();
}
$('act-edit').onclick=()=>{
  const msg=target?.msg; $('sheet').hidden=true; if(!msg) return;
  editing={id:msg.id}; replyTo=null;
  $('reply-text').textContent='✎ Изменение: '+previewOf(msg); $('reply-bar').hidden=false;
  const t=$('text'); t.value=msg.content||''; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,140)+'px'; syncBtns(); t.focus();
};
$('act-del-me').onclick=async()=>{
  const msg=target?.msg; $('sheet').hidden=true; if(!msg) return;
  const {error}=await client.rpc('hide_message',{msg:msg.id});
  if(error){ toast('Удаление: '+error.message); return; }
  hiddenIds.add(msg.id); $('msgs').querySelector(`[data-id="${msg.id}"]`)?.remove();
  if(editing?.id===msg.id) cancelEdit(); if(replyTo?.id===msg.id){ replyTo=null; $('reply-bar').hidden=true; }
  loadChats().catch(()=>{});
};
$('act-del-all').onclick=async()=>{
  const msg=target?.msg; $('sheet').hidden=true; if(!msg) return;
  if(!confirm('Удалить сообщение у всех участников?')) return;
  const {error}=await client.rpc('delete_message_for_all',{msg:msg.id});
  if(error){ toast('Удаление: '+error.message); return; }
  if(editing?.id===msg.id) cancelEdit(); if(replyTo?.id===msg.id){ replyTo=null; $('reply-bar').hidden=true; }
  refreshMessage({id:msg.id,deleted_at:new Date().toISOString(),content:''}); loadChats().catch(()=>{});
};
$('act-close').onclick=()=>$('sheet').hidden=true;
$('sheet').onclick=e=>{if(e.target===$('sheet'))$('sheet').hidden=true;};

let gSel=new Map();
function openGroup(){ gSel=new Map(); $('g-title').value=''; $('g-search').value=''; renderGroupSel(); $('g-results').innerHTML=''; $('group-sheet').hidden=false; }
function renderGroupSel(){ $('g-sel').innerHTML=[...gSel].map(([id,n])=>`<button type="button" class="gchip" data-id="${esc(id)}">${esc(n)} ×</button>`).join(''); }
async function searchGroupUsers(){
  const q=$('g-search').value.trim().toLowerCase();
  if(q.length<2){ $('g-results').innerHTML=''; return; }
  const {data,error}=await client.from('profiles').select('id,username,display_name,avatar_url').ilike('username',`%${q}%`).neq('id',me.id).limit(15);
  if(error){ toast(error.message); return; }
  $('g-results').innerHTML=(data||[]).map(u=>{ const n=u.display_name||u.username; return `<li><button type="button" class="item ${gSel.has(u.id)?'on':''}" data-gid="${esc(u.id)}" data-name="${esc(n)}">${avatar(n,false,u.avatar_url)}<div class="meta"><div class="name">${esc(n)}</div><div class="last">@${esc(u.username)}</div></div></button></li>`; }).join('')||'<li class="muted" style="padding:14px">Не найдено.</li>';
}
async function createGroup(){
  const title=$('g-title').value.trim();
  if(!title) return toast('Введи название группы');
  if(!gSel.size) return toast('Выбери хотя бы одного участника');
  $('g-create').disabled=true;
  try{
    const {data,error}=await client.rpc('create_group_conversation',{group_title:title,member_ids:[...gSel.keys()]});
    if(error) throw new Error('Создание группы: '+error.message);
    const cid=typeof data==='string'?data:(data?.id||data?.conversation_id||data);
    await loadChats();
    const chat=chats.find(c=>c.id===cid)||{id:cid,type:'group',title,participants:[],last:null};
    $('group-sheet').hidden=true; setTab('chats'); await openChat(chat);
  }catch(e){ toast(e.message||String(e)); }
  finally{ $('g-create').disabled=false; }
}
$('g-cancel').onclick=()=>$('group-sheet').hidden=true;
$('group-sheet').onclick=e=>{ if(e.target===$('group-sheet')) $('group-sheet').hidden=true; };
$('g-search').oninput=()=>{ clearTimeout(window.gTimer); window.gTimer=setTimeout(searchGroupUsers,250); };
$('g-results').onclick=e=>{ const b=e.target.closest('[data-gid]'); if(!b) return; const id=b.dataset.gid; if(gSel.has(id)) gSel.delete(id); else gSel.set(id,b.dataset.name); b.classList.toggle('on',gSel.has(id)); renderGroupSel(); };
$('g-sel').onclick=e=>{ const b=e.target.closest('[data-id]'); if(!b) return; gSel.delete(b.dataset.id); renderGroupSel(); searchGroupUsers(); };
$('g-create').onclick=createGroup;


/* ---- аватар: свой профиль ---- */
function paintMe(){
  const n=me.display_name||me.username; setAv('me-av',n,'big',me.avatar_url||'');
  $('av-remove').hidden=!me.avatar_url; $('av-change').textContent=me.avatar_url?'Сменить фото':'Добавить фото';
}
async function squareJpeg(file,size=512){
  const bmp=await createImageBitmap(file); const s=Math.min(bmp.width,bmp.height);
  const c=document.createElement('canvas'); c.width=c.height=size;
  c.getContext('2d').drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,size,size);
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Не удалось обработать фото')),'image/jpeg',.85));
}
const avPath=url=>{ const i=String(url||'').indexOf('/avatars/'); return i<0?null:decodeURIComponent(url.slice(i+9).split('?')[0]); };
async function setAvatar(file){
  if(!file||!me) return;
  try{
    toast('Загружаю фото…');
    const blob=await squareJpeg(file);
    const path=`${me.id}/avatar-${Date.now()}.jpg`;
    const up=await client.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
    if(up.error) throw up.error;
    const url=client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const {error}=await client.from('profiles').update({avatar_url:url}).eq('id',me.id);
    if(error) throw error;
    const old=avPath(me.avatar_url); me.avatar_url=url; paintMe();
    if(old) client.storage.from('avatars').remove([old]).catch(()=>{});
    toast('Фото обновлено');
  }catch(e){ toast('Фото: '+(e.message||e)); }
}
async function removeAvatar(){
  if(!me?.avatar_url) return;
  try{
    const {error}=await client.from('profiles').update({avatar_url:null}).eq('id',me.id); if(error) throw error;
    const old=avPath(me.avatar_url); me.avatar_url=null; paintMe();
    if(old) client.storage.from('avatars').remove([old]).catch(()=>{});
    toast('Фото удалено');
  }catch(e){ toast('Фото: '+(e.message||e)); }
}
$('av-change').onclick=()=>$('av-file').click();
$('me-av').onclick=()=>$('av-file').click();
$('av-file').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; setAvatar(f); };
$('av-remove').onclick=removeAvatar;
$('bio-save').onclick=async()=>{
  const bio=$('bio-in').value.trim().slice(0,200);
  const {error}=await client.from('profiles').update({bio:bio||null}).eq('id',me.id);
  if(error) return toast('Описание: '+error.message);
  me.bio=bio||null; $('bio-in').value=bio; toast('Описание сохранено');
};

/* ---- карточка контакта ---- */
let cardTab='media';
function openCard(){
  if(!current) return; $('card').hidden=false; cardTab='media'; renderCard();
  if(!cardPushed){ history.pushState({card:1},''); cardPushed=true; }
}
function closeCardUI(){ if(cardPushed) history.back(); else $('card').hidden=true; }
function renderCard(){
  const c=currentChat(); if(!c) return; const g=c.type==='group';
  setAv('card-av',c.title,'huge',g?'':(c.otherAvatar||''));
  $('card-name').textContent=c.title; updateRoomStatus();
  const people=(c.participants||[]).filter(x=>x.user_id!==me.id);
  $('card-info').innerHTML=g
    ? `<div class="irow"><small>Участники · ${(c.participants||[]).length}</small></div>`+(c.participants||[]).map(x=>{ const p=x.profiles||{}; const n=x.user_id===me.id?'Вы':(p.display_name||p.username||'Участник'); return `<div class="mrow">${avatar(n,false,p.avatar_url)}<div><div>${esc(n)}</div><small>@${esc(p.username||'')}</small></div></div>`; }).join('')
    : (people[0]?.profiles?.bio?`<div class="irow"><div class="bio">${esc(people[0].profiles.bio)}</div><small>О себе</small></div>`:'')+`<div class="irow"><div>@${esc(c.otherUsername||people[0]?.profiles?.username||'')}</div><small>Имя пользователя</small></div>`;
  document.querySelectorAll('#card-seg button').forEach(b=>b.classList.toggle('on',b.dataset.s===cardTab));
  renderCardBody();
}
function renderCardBody(){
  const list=[...msgMap.values()].filter(m=>!m.deleted_at&&!hiddenIds.has(m.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const when=v=>new Date(v).toLocaleDateString('ru',{day:'numeric',month:'short'})+', '+time(v);
  let html='';
  if(cardTab==='media'){
    const items=list.filter(m=>(m.message_type==='image'||m.message_type==='video')&&m.media_path&&!m.media_deleted_at);
    html=items.length?`<div class="mgrid">${items.map(m=>`<button type="button" class="mthumb" data-path="${esc(m.media_path)}" data-kind="${m.message_type}" aria-label="${m.message_type==='video'?'Видео':'Фото'}"></button>`).join('')}</div><p class="cempty">Файлы хранятся 15 дней, затем удаляются.</p>`:'<p class="cempty">Фото и видео в этом чате пока нет. Файлы хранятся 15 дней.</p>';
  }
  else if(cardTab==='links'){
    const seen=new Set(), out=[];
    for(const m of list){ for(const u of (String(m.content||'').match(/https?:\/\/[^\s<>"']+/g)||[])){ if(!seen.has(u)){ seen.add(u); out.push([u,m.created_at]); } } }
    html=out.map(([u,t])=>`<a class="lrow" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${esc(u)}</span><small>${when(t)}</small></a>`).join('')||'<p class="cempty">Ссылок в переписке пока нет.</p>';
  } else {
    html=list.filter(m=>m.message_type==='voice'&&m.media_path).map(m=>`<div class="vrow"><div class="vm"><button type="button" class="vplay" data-path="${esc(m.media_path)}" data-ms="${Number(m.media_duration_ms)||0}" aria-label="Воспроизвести">▶</button><div class="vbar"><i></i></div><span class="vdur">${fmtDur(m.media_duration_ms)}</span></div><small>${esc(nameOf(m.sender_id))} · ${when(m.created_at)}</small></div>`).join('')||'<p class="cempty">Голосовых сообщений пока нет.</p>';
  }
  $('card-body').innerHTML=html;
  $('card-body').querySelectorAll('.mthumb').forEach(loadThumb);
}
$('room-head').onclick=e=>{ if(e.target.closest('.back')) return; openCard(); };
$('card-back').onclick=closeCardUI;
$('card-seg').onclick=e=>{ const b=e.target.closest('[data-s]'); if(!b) return; cardTab=b.dataset.s; document.querySelectorAll('#card-seg button').forEach(x=>x.classList.toggle('on',x===b)); renderCardBody(); };
$('card-body').onclick=e=>{ const pb=e.target.closest('.vplay'); if(pb) toggleVoice(pb); const t=e.target.closest('.mthumb'); if(t) openLightbox(t.dataset.kind,t.dataset.path); };
$('card-actions').onclick=e=>{ const b=e.target.closest('[data-act]'); if(!b) return; if(b.dataset.act==='chat') closeCardUI(); else if(b.dataset.act==='call') startCall('audio'); else if(b.dataset.act==='vid') startCall('video'); else toast('Скоро будет'); };


/* ---- фото и видео ---- */
const urlCache=new Map();
async function mediaUrl(path){
  const c=urlCache.get(path); if(c&&c.exp>Date.now()) return c.url;
  const {data,error}=await client.storage.from('media').createSignedUrl(path,3600); if(error) throw error;
  urlCache.set(path,{url:data.signedUrl,exp:Date.now()+3300000}); return data.signedUrl;
}
async function loadMedia(box){
  if(box.dataset.done) return; box.dataset.done='1';
  try{
    const url=await mediaUrl(box.dataset.path);
    box.classList.add('ok');
    if(box.dataset.kind==='image'){
      box.innerHTML=`<img src="${esc(url)}" alt="Фото">`;
      box.querySelector('img').addEventListener('load',()=>{ const ms=$('msgs'); if(box.closest('.m')===ms.lastElementChild) ms.scrollTop=1e9; });
    } else box.innerHTML=`<video src="${esc(url)}#t=0.1" controls playsinline preload="metadata"></video>`;
  }catch(e){ box.innerHTML='<span class="muted small">Не удалось загрузить</span>'; }
}
async function loadThumb(t){
  try{
    const url=await mediaUrl(t.dataset.path);
    if(t.dataset.kind==='image') t.style.backgroundImage=`url("${url}")`;
    else t.innerHTML=`<video src="${esc(url)}#t=0.1" preload="metadata" muted playsinline></video><i class="pl">▶</i>`;
  }catch(e){}
}
async function openLightbox(kind,path){
  try{
    const url=await mediaUrl(path);
    $('lb-body').innerHTML=kind==='video'?`<video src="${esc(url)}" controls autoplay playsinline></video>`:`<img src="${esc(url)}" alt="Фото">`;
    $('lb').hidden=false;
  }catch(e){ toast('Не удалось открыть: '+(e.message||e)); }
}
function closeLightbox(){ $('lb').hidden=true; $('lb-body').innerHTML=''; }
$('lb-x').onclick=closeLightbox;
$('lb').onclick=e=>{ if(e.target===$('lb')||e.target===$('lb-body')) closeLightbox(); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('lb').hidden) closeLightbox(); });
async function resizeJpeg(file,max=1600){
  const bmp=await createImageBitmap(file); const k=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Не удалось обработать фото')),'image/jpeg',.82));
}
async function sendMedia(file){
  if(!file||!current||!me) return;
  if(editing) return toast('Сначала закончите изменение сообщения');
  const isImg=file.type.startsWith('image/'), isVid=file.type.startsWith('video/');
  if(!isImg&&!isVid) return toast('Можно отправлять только фото и видео');
  if(isVid&&file.size>50*1024*1024) return toast('Видео больше 50 МБ. Выберите покороче.');
  const convId=current.id, caption=$('text').value.trim(), rid=replyTo?.id||null;
  $('attach').disabled=true; toast('Отправляю…');
  try{
    let blob=file, type=file.type, ext;
    if(isImg){ blob=await resizeJpeg(file); type='image/jpeg'; ext='jpg'; }
    else ext=((file.name||'').split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'mp4';
    const path=`${convId}/${me.id}/${Date.now()}.${ext}`;
    const up=await client.storage.from('media').upload(path,blob,{contentType:type});
    if(up.error) throw up.error;
    const row={conversation_id:convId,sender_id:me.id,content:caption,message_type:isImg?'image':'video',media_path:path};
    if(rid) row.reply_to_id=rid;
    const {data,error}=await client.from('messages').insert(row).select().single();
    if(error){ client.storage.from('media').remove([path]).catch(()=>{}); throw error; }
    $('text').value=''; $('text').style.height='auto'; stopTyping(); syncBtns(); replyTo=null; $('reply-bar').hidden=true;
    appendMessage(data); loadChats().catch(()=>{}); toast('Отправлено');
  }catch(e){ toast('Вложение не отправлено: '+(e.message||e)); }
  finally{ $('attach').disabled=false; }
}
$('attach').onclick=()=>$('media-file').click();
$('media-file').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; sendMedia(f); };

/* автоудаление файлов старше 15 дней */
let lastClean=0;
async function cleanupMedia(){
  if(!me||Date.now()-lastClean<3600000) return; lastClean=Date.now();
  try{
    const {data:paths,error}=await client.rpc('media_to_expire'); if(error||!paths?.length) return;
    const {data:rm,error:e2}=await client.storage.from('media').remove(paths); if(e2) return;
    const done=(rm||[]).map(f=>f.name); if(!done.length) return;
    await client.rpc('media_mark_expired',{paths:done});
    if(current) loadMessages().catch(()=>{}); loadChats().catch(()=>{});
  }catch(e){ console.warn('cleanup',e); }
}


/* ---- звонки (WebRTC, сигналы через Supabase Realtime) ---- */
let call=null, callIn=null; const callOut=new Map();
function startCalls(){
  if(callIn||!me) return;
  callIn=client.channel('call-'+me.id,{config:{broadcast:{self:false}}}).on('broadcast',{event:'sig'},({payload})=>onSignal(payload)).subscribe();
}
async function stopCalls(){
  if(callIn){ await client.removeChannel(callIn); callIn=null; }
  for(const ch of callOut.values()) client.removeChannel(ch); callOut.clear();
}
async function sendSig(toId,payload){
  let ch=callOut.get(toId);
  if(!ch){
    ch=client.channel('call-'+toId,{config:{broadcast:{self:false}}}); callOut.set(toId,ch);
    await new Promise(res=>{ const t=setTimeout(res,5000); ch.subscribe(st=>{ if(st==='SUBSCRIBED'){ clearTimeout(t); res(); } }); });
  }
  try{ await ch.send({type:'broadcast',event:'sig',payload:{...payload,from:me.id}}); }catch(e){ console.warn('sig',e); }
}
let ringCtx=null, ringT=null;
function tone(on){
  clearInterval(ringT); ringT=null; if(!on) return;
  try{
    ringCtx=ringCtx||new (window.AudioContext||window.webkitAudioContext)();
    const beep=()=>{ if(!call) return; const o=ringCtx.createOscillator(), g=ringCtx.createGain(); o.frequency.value=call.role==='in'?880:440; g.gain.value=.07; o.connect(g); g.connect(ringCtx.destination); o.start(); o.stop(ringCtx.currentTime+.35); if(call.role==='in'&&navigator.vibrate) navigator.vibrate(300); };
    beep(); ringT=setInterval(beep,1600);
  }catch(e){}
}
const callStatus=t=>{ $('call-status').textContent=t; };
function showCall(){
  const el=$('call'); el.hidden=false; el.classList.remove('hasv');
  setAv('call-av',call.name,'huge',call.avatar||''); $('call-name').textContent=call.name;
  renderCallBtns();
}
function renderCallBtns(){
  const inc=call&&call.role==='in'&&call.state==='ringing';
  $('c-acc').hidden=!inc; $('c-mic').hidden=inc; $('c-cam').hidden=inc||call.kind!=='video';
  $('call').classList.toggle('video',call.kind==='video');
}
function sendIce(c){ if(!call) return; if(call.ready) sendSig(call.peerId,{type:'ice',cid:call.id,cand:c}); else call.q.push(c); }
function flushIce(){ if(!call) return; call.ready=true; call.q.splice(0).forEach(c=>sendSig(call.peerId,{type:'ice',cid:call.id,cand:c})); }
async function setupMedia(){
  try{
    call.local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:call.kind==='video'?{facingMode:'user',width:{ideal:640},height:{ideal:480}}:false});
  }catch(e){ throw new Error('Нет доступа к микрофону'+(call.kind==='video'?' или камере':'')+'. Разреши его для сайта в настройках браузера.'); }
  $('call-local').srcObject=call.local;
  try{ call.wake=await navigator.wakeLock?.request('screen'); }catch(e){}
}
function makePc(){
  const pc=new RTCPeerConnection({iceServers:cfg.ICE_SERVERS||[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]});
  call.pc=pc; call.local.getTracks().forEach(t=>pc.addTrack(t,call.local));
  pc.onicecandidate=e=>{ if(e.candidate) sendIce(e.candidate.toJSON()); };
  pc.ontrack=e=>{ const v=$('call-remote'); v.srcObject=e.streams[0]; v.play?.().catch(()=>{}); if(call?.kind==='video') $('call').classList.add('hasv'); };
  pc.onconnectionstatechange=()=>{
    if(!call||call.pc!==pc) return; const st=pc.connectionState;
    if(st==='connected'){ clearTimeout(call.dropT); onConnected(); }
    else if(st==='failed') endCall('failed',true);
    else if(st==='disconnected'){ clearTimeout(call.dropT); call.dropT=setTimeout(()=>{ if(call&&call.pc===pc&&pc.connectionState!=='connected') endCall('failed',true); },8000); }
  };
}
function onConnected(){
  if(!call||call.state==='connected') return; call.state='connected'; tone(false); clearTimeout(call.timeout); clearTimeout(call.ackTimer);
  call.t0=Date.now(); call.tick=setInterval(()=>{ const s=Math.floor((Date.now()-call.t0)/1000); callStatus(Math.floor(s/60)+':'+String(s%60).padStart(2,'0')); },500); callStatus('0:00');
}
async function startCall(kind){
  const c=currentChat(); if(!c) return;
  if(c.type!=='direct'||!c.otherId) return toast('Звонки пока доступны только в личных чатах');
  if(call) return toast('Звонок уже идёт');
  if(!window.RTCPeerConnection||!navigator.mediaDevices?.getUserMedia) return toast('Звонки не поддерживаются в этом браузере');
  call={id:crypto.randomUUID(),peerId:c.otherId,kind,role:'out',name:c.title,avatar:c.otherAvatar||'',q:[],buf:[],state:'calling'};
  showCall(); callStatus('Соединяю…');
  try{
    await setupMedia(); makePc();
    const offer=await call.pc.createOffer(); await call.pc.setLocalDescription(offer);
    await sendSig(call.peerId,{type:'invite',cid:call.id,kind,sdp:{type:offer.type,sdp:offer.sdp},name:me.display_name||me.username,avatar:me.avatar_url||''});
    flushIce();
    const id=call.id;
    call.ackTimer=setTimeout(()=>{ if(call&&call.id===id&&!call.ack) endCall('unreach',true); },10000);
    call.timeout=setTimeout(()=>{ if(call&&call.id===id&&call.state!=='connected') endCall('noanswer',true); },50000);
  }catch(e){ endCall('error',false,e); }
}
async function acceptCall(){
  if(!call||call.role!=='in'||call.state!=='ringing') return;
  clearTimeout(call.timeout); tone(false); call.state='connecting'; callStatus('Соединяю…'); renderCallBtns(); closeCallNote();
  try{
    await setupMedia(); makePc();
    await call.pc.setRemoteDescription(call.offer);
    for(const c of call.buf.splice(0)) await call.pc.addIceCandidate(c).catch(()=>{});
    const ans=await call.pc.createAnswer(); await call.pc.setLocalDescription(ans);
    await sendSig(call.peerId,{type:'accept',cid:call.id,sdp:{type:ans.type,sdp:ans.sdp}});
    flushIce();
    const id=call.id; call.timeout=setTimeout(()=>{ if(call&&call.id===id&&call.state!=='connected') endCall('failed',true); },25000);
  }catch(e){ endCall('error',true,e); }
}
function closeCallNote(){ navigator.serviceWorker?.ready.then(r=>r.getNotifications({tag:'kotak-call'}).then(l=>l.forEach(n=>n.close()))).catch(()=>{}); }
async function onSignal(p){
  if(!p||!me) return;
  if(p.type==='invite'){
    if(call){ sendSig(p.from,{type:'busy',cid:p.cid}); return; }
    call={id:p.cid,peerId:p.from,kind:p.kind==='video'?'video':'audio',role:'in',name:p.name||'Звонок',avatar:p.avatar||'',offer:p.sdp,q:[],buf:[],state:'ringing'};
    showCall(); callStatus(call.kind==='video'?'Входящий видеозвонок':'Входящий звонок'); tone(true);
    sendSig(p.from,{type:'ringing',cid:p.cid});
    const id=call.id; call.timeout=setTimeout(()=>{ if(call&&call.id===id&&call.state==='ringing') endCall('missed',true); },45000);
    if(document.hidden&&'Notification' in window&&Notification.permission==='granted') navigator.serviceWorker?.ready.then(r=>r.showNotification('Входящий звонок',{body:call?.name||'',tag:'kotak-call',icon:'icon-192.png',requireInteraction:true})).catch(()=>{});
    return;
  }
  if(!call||p.cid!==call.id) return;
  if(p.type==='ringing'){ call.ack=true; clearTimeout(call.ackTimer); callStatus('Вызов…'); tone(true); }
  else if(p.type==='accept'&&call.role==='out'&&call.state==='calling'){
    call.state='connecting'; tone(false); callStatus('Соединяю…');
    try{ await call.pc.setRemoteDescription(p.sdp); for(const c of call.buf.splice(0)) await call.pc.addIceCandidate(c).catch(()=>{}); }catch(e){ endCall('error',true,e); }
  }
  else if(p.type==='ice'){ if(call.pc&&call.pc.remoteDescription) call.pc.addIceCandidate(p.cand).catch(()=>{}); else call.buf.push(p.cand); }
  else if(p.type==='busy') endCall('busy',false);
  else if(p.type==='end') endCall(p.reason==='declined'?'declined':p.reason==='missed'?'missed_in':'remote',false);
}
function endCall(reason,notify,err){
  const c=call; if(!c) return; call=null;
  if(notify) sendSig(c.peerId,{type:'end',cid:c.id,reason:reason==='declined'?'declined':reason==='missed'?'missed':'hangup'});
  tone(false); clearTimeout(c.timeout); clearTimeout(c.ackTimer); clearTimeout(c.dropT); clearInterval(c.tick);
  try{ c.pc?.close(); }catch(e){} c.local?.getTracks().forEach(t=>t.stop()); try{ c.wake?.release(); }catch(e){}
  $('call-remote').srcObject=null; $('call-local').srcObject=null; $('call').hidden=true; $('c-mic').classList.remove('off'); $('c-cam').classList.remove('off'); closeCallNote();
  const msg={remote:'Звонок завершён',declined:'Абонент отклонил звонок',busy:'Абонент занят',unreach:'Абонент недоступен: приложение у него закрыто',noanswer:'Нет ответа',missed:'Звонок пропущен',missed_in:'Звонок не был принят',failed:'Не удалось соединиться. Возможно, сеть не поддерживает прямое соединение.',error:err?(err.message||String(err)):'Ошибка звонка'}[reason];
  if(msg) toast(msg);
}
$('c-end').onclick=()=>{ if(!call) return; endCall(call.role==='in'&&call.state==='ringing'?'declined':'hangup',true); };
$('c-acc').onclick=acceptCall;
$('c-mic').onclick=()=>{ const t=call?.local?.getAudioTracks()[0]; if(!t) return; t.enabled=!t.enabled; $('c-mic').classList.toggle('off',!t.enabled); };
$('c-cam').onclick=()=>{ const t=call?.local?.getVideoTracks()[0]; if(!t) return; t.enabled=!t.enabled; $('c-cam').classList.toggle('off',!t.enabled); };

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
const APP_VERSION='16';
$('ver').textContent='Версия приложения: '+APP_VERSION;
async function runDiag(){
  const out=[]; const t=async(name,fn)=>{ try{ const r=await fn(); out.push((r&&r.error?'❌ ':'✅ ')+name+(r&&r.error?': '+r.error.message:'')); }catch(e){ out.push('❌ '+name+': '+(e.message||e)); } };
  await t('messages.reply_to_id',()=>client.from('messages').select('id,reply_to_id').limit(1));
  await t('таблица reactions',()=>client.from('reactions').select('message_id,user_id,emoji').limit(1));
  await t('связь reactions → messages',()=>client.from('reactions').select('message_id,messages!inner(conversation_id)').limit(1));
  await t('conversations.type/title',()=>client.from('conversations').select('id,type,title').limit(1));
  alert(out.join('\n')+'\n\nЕсли есть ❌ — выполни SQL из v9 в Supabase → SQL Editor ещё раз.');
}
$('diag').onclick=runDiag;

(async()=>{
  try {
  if(!client) { $('auth-error').textContent='Supabase не загрузился. Проверь интернет-соединение.'; return; }
  try { await loadSession(); updatePushBtn().catch(()=>{}); } catch(error) { toast(error.message||'Ошибка загрузки аккаунта'); }
  client.auth.onAuthStateChange((_event)=>{ if(_event==='SIGNED_OUT'){ $('app').hidden=true; $('auth-wrap').hidden=false; } });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  } finally { $('boot').hidden=true; }
})();
