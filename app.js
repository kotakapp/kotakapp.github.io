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
const avatar = (name,dot=false,url='',own=false) => url?`<div class="avatar photo${own?' owner':''}" style="background-image:url('${esc(url)}')">${dot?'<span class="dot"></span>':''}</div>`:`<div class="avatar ${avCls(name)}${own?' owner':''}">${esc(initials(name))}${dot?'<span class="dot"></span>':''}</div>`;
const setAv = (id,name,extra='',url='',own=false) => { const el=$(id); el.className=('avatar '+extra+(own?' owner ':' ')+' '+(url?'photo':avCls(name))).replace(/\s+/g,' ').trim(); el.style.backgroundImage=url?`url("${url}")`:''; el.textContent=url?'':initials(name); };

/* ---- v20: значок создателя (owner) ---- */
const isOwner = u => String(u||'').toLowerCase()==='owner';
const VB_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vb-bg" d="M12 1.500l2.600 1.900 3.200-.1 1 3.100 2.600 1.900-1 3.100 1 3.100-2.600 1.900-1 3.100-3.200-.1L12 22.500l-2.600-1.900-3.200.1-1-3.100-2.600-1.900 1-3.100-1-3.100 2.600-1.900 1-3.100 3.200.1z"/><path class="vb-ck" d="M7.800 12.200l3 3 5.500-6"/></svg>';
const vbadge = (u,cls='') => isOwner(u)?`<span class="vbadge ${cls}" role="button" tabindex="0" aria-label="Создатель KotakApp">${VB_SVG}</span>`:'';
const nameHtml = (name,u,cls='') => esc(name)+vbadge(u,cls);
function showOwnerInfo(){
  document.getElementById('own-sheet')?.remove();
  const mine=me&&isOwner(me.username);
  const d=document.createElement('div'); d.id='own-sheet'; d.className='own-ov';
  d.innerHTML=`<div class="own-card" role="dialog" aria-modal="true"><div class="own-ic">${VB_SVG}</div><h3>Создатель KotakApp</h3><p>Это официальный аккаунт автора и владельца приложения. Галочка подтверждает, что вы общаетесь с настоящим создателем KotakApp.</p><p class="muted small">Идеи, ошибки и вопросы можно писать прямо сюда.</p>${mine?'':'<button type="button" class="own-btn pri" data-o="chat">Написать создателю</button>'}<button type="button" class="own-btn" data-o="close">Закрыть</button></div>`;
  d.onclick=e=>{ const a=e.target.closest('[data-o]'); if(a?.dataset.o==='chat'){ d.remove(); chatWithOwner(); } else if(a||e.target===d) d.remove(); };
  document.body.appendChild(d);
}
document.addEventListener('click',e=>{ if(e.target.closest('.vbadge')){ e.preventDefault(); e.stopPropagation(); showOwnerInfo(); } },true);
document.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&e.target.closest?.('.vbadge')){ e.preventDefault(); showOwnerInfo(); } if(e.key==='Escape') document.getElementById('own-sheet')?.remove(); });
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
  await loadHidden();
  await loadChats();
  markDelivered();
  startRealtime();
  startPresence();
  startCalls();
  cleanupMedia();
  checkAdmin();
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
    if(m.sender_id!==me.id){ markDelivered(); notifyIncoming(m); }
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
  pres._raw=pres.track.bind(pres); pres.track=p=>me.privacy_status==='nobody'?Promise.resolve('ok'):pres._raw(p);
  pres.on('presence',{event:'sync'},()=>{
    const st=pres.presenceState(); const prevOn=online; online=new Set(); typingMap={};
    for(const [uid,metas] of Object.entries(st)){ online.add(uid); const t=metas.map(x=>x.typing_in).filter(Boolean).pop(); if(t) typingMap[uid]=t; }
    if(isAdm) logPresence(prevOn);
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
let chatFilter='all';
function renderChats() {
  const total=chats.reduce((s,c)=>s+unreadOf(c),0); document.title=total?`(${total}) KotakApp`:'KotakApp';
  const q=$('q').value.trim().toLowerCase();
  $('chat-list').innerHTML=chats.filter(c=>c.title.toLowerCase().includes(q)&&(chatFilter==='all'||(chatFilter==='unread'?unreadOf(c)>0:c.type===chatFilter))).map(c=>{
    const n=unreadOf(c), typing=isTyping(c), mineLast=!!c.last&&c.last.sender_id===me.id&&!c.last.deleted_at;
    const prev=typing?'печатает…':c.last?(c.last.deleted_at?'🚫 Сообщение удалено':c.last.message_type==='voice'?'🎤 Голосовое':c.last.message_type==='image'?'📷 Фото':c.last.message_type==='video'?'🎬 Видео':esc(c.last.content||'Вложение')):'Сообщений пока нет';
    const tk=mineLast?`<span class="tick ${tickFor(c,c.last.created_at)}">${tickSvg(tickFor(c,c.last.created_at))}</span>`:'';
    return `<li><button class="item ${current?.id===c.id?'on':''}${c.type==='direct'&&isOwner(c.otherUsername)?' owner-item':''}" data-chat="${c.id}">${avatar(c.title,c.type==='direct'&&online.has(c.otherId),c.type==='direct'?c.otherAvatar:'',c.type==='direct'&&isOwner(c.otherUsername))}<div class="meta"><div class="row"><span class="name">${nameHtml(c.title,c.type==='direct'?c.otherUsername:'')}</span><span class="when ${n?'new':''}">${tk}${c.last?time(c.last.created_at):''}</span></div><div class="row2"><div class="last ${typing?'typing':''}">${prev}</div>${badge(c)}</div></div></button></li>`;
  }).join('')||`<li class="muted" style="padding:20px">${chatFilter==='unread'?'Непрочитанных чатов нет.':chatFilter!=='all'&&chats.length?'В этом разделе чатов нет.':'Чатов пока нет. Найди друзей во вкладке «Контакты».'}</li>`;
  $('cnt').textContent=chats.length; $('cnt').hidden=!chats.length;
  renderContacts();
}
let contactHits=null;
const userQuery=()=>$('user-search').value.trim().replace(/^@/,'').toLowerCase();
function renderContacts(){
  const q=userQuery(); let html;
  if(q.length>=2){
    html='<li class="sec">Результаты поиска</li>'+((contactHits||[]).map(u=>`<li><button class="item${isOwner(u.username)?' owner-item':''}" data-user="${u.id}">${avatar(u.display_name||u.username,online.has(u.id),u.avatar_url,isOwner(u.username))}<div class="meta"><div class="name">${nameHtml(u.display_name||u.username,u.username)}</div><div class="last">@${esc(u.username)}</div></div><span class="go">Написать</span></button></li>`).join('')||'<li class="muted" style="padding:20px">Пользователи не найдены.</li>');
  } else {
    const seen=new Set();
    const cs=chats.filter(c=>c.type==='direct'&&c.otherId&&!seen.has(c.otherId)&&seen.add(c.otherId)&&(!q||(c.title+' '+(c.otherUsername||'')).toLowerCase().includes(q)));
    html='<li class="sec">Контакты</li>'+(cs.map(c=>{ const on=online.has(c.otherId); return `<li><button class="item${isOwner(c.otherUsername)?' owner-item':''}" data-user="${c.otherId}">${avatar(c.title,on,c.otherAvatar,isOwner(c.otherUsername))}<div class="meta"><div class="name">${nameHtml(c.title,c.otherUsername)}</div><div class="st ${on?'on':''}"><i></i>${on?'В сети':'Не в сети'}</div></div></button></li>`; }).join('')||`<li class="muted" style="padding:20px">${q?'Среди контактов никого нет. Введи ещё символ, чтобы искать по всем пользователям.':'Контактов пока нет. Найди человека по @username и напиши ему.'}</li>`);
  }
  $('contact-list').innerHTML=html;
}
async function searchUsers() {
  const q=userQuery();
  if(q.length<2) { contactHits=null; renderContacts(); return; }
  const {data,error}=await client.from('profiles').select('id,username,display_name,avatar_url').ilike('username',`%${q}%`).neq('id',me.id).limit(20);
  if(q!==userQuery()) return;
  if(error) { toast(error.message); return; }
  contactHits=data||[]; renderContacts();
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
  const ow=chat.type!=='group'&&isOwner(chat.otherUsername); setAv('room-av',chat.title,'',chat.otherAvatar,ow); $('card').hidden=true; $('room-title').innerHTML=nameHtml(chat.title,ow?'owner':'');
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
window.addEventListener('popstate',()=>{ if(pageDepth>0){ pageDepth--; const o=[...document.querySelectorAll('.page:not([hidden])')].pop(); if(o) o.hidden=true; return; } if(!$('card').hidden){ $('card').hidden=true; cardPushed=false; return; } roomPushed=false; if($('app').dataset.view==='room') closeRoom(); });
function setTab(tab) {
  for(const name of ['chats','contacts','settings','profile']) $('pane-'+name).hidden=name!==tab;
  $('side').dataset.tab=tab;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
}
async function logout() { isAdm=false; admUsers=[]; tickets=[]; adminLog=[]; if(admCh){ client.removeChannel(admCh); admCh=null; } renderSettingsMain(); if(call) endCall('remote',true); await stopCalls(); await stopRealtime(); await stopPresence(); await client.auth.signOut(); current=null; chats=[]; $('app').hidden=true; $('auth-wrap').hidden=false; setAuthMode('login'); }
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
$('h-search').onclick=()=>{ setTab('chats'); $('q').focus(); };
$('h-menu').onclick=e=>{ e.stopPropagation(); $('menu').hidden=!$('menu').hidden; };
document.addEventListener('click',e=>{ if(!e.target.closest('#menu')) $('menu').hidden=true; });
$('m-group').onclick=()=>{ $('menu').hidden=true; openGroup(); };
$('m-settings').onclick=()=>{ $('menu').hidden=true; setTab('settings'); };
$('chips').onclick=e=>{ const b=e.target.closest('[data-f]'); if(!b) return; chatFilter=b.dataset.f; document.querySelectorAll('#chips button').forEach(x=>x.classList.toggle('on',x===b)); renderChats(); };
$('add-contact').onclick=()=>$('user-search').focus();
$('fab').onclick=()=>{ setTab('contacts'); $('user-search').focus(); };
$('react-row').innerHTML=EMOJI.map(x=>`<button data-e="${x}">${x}</button>`).join('');
$('msgs').onclick=e=>{
  const ph=e.target.closest('.mph'); if(ph){ const box=ph.closest('.media'); delete box.dataset.done; box.dataset.manual='1'; loadMedia(box); return; }
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
  const n=me.display_name||me.username, url=me.avatar_url||'';
  const ow=isOwner(me.username); setAv('me-av',n,'big',url,ow); setAv('tab-av',n,'tav',url,ow);
  $('me-name').innerHTML=nameHtml(n,me.username); $('me-user').textContent='@'+me.username;
  const b=$('me-bio'); b.textContent=me.bio||'Добавьте описание: Профиль → Изменить'; b.classList.toggle('empty',!me.bio);
  $('av-view').hidden=!url; $('av-remove').hidden=!url; $('av-change').textContent=url?'Изменить фото':'Добавить фото';
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
$('av-file').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; setAvatar(f); };
/* ---- карточка контакта ---- */
let cardTab='media';
function openCard(){
  if(!current) return; $('card').hidden=false; cardTab='media'; renderCard();
  if(!cardPushed){ history.pushState({card:1},''); cardPushed=true; }
}
function closeCardUI(){ if(cardPushed) history.back(); else $('card').hidden=true; }
function renderCard(){
  const c=currentChat(); if(!c) return; const g=c.type==='group';
  const ow=!g&&isOwner(c.otherUsername); setAv('card-av',c.title,'huge',g?'':(c.otherAvatar||''),ow);
  $('card-name').innerHTML=nameHtml(c.title,ow?'owner':''); updateRoomStatus();
  const people=(c.participants||[]).filter(x=>x.user_id!==me.id);
  $('card-info').innerHTML=g
    ? `<div class="irow"><small>Участники · ${(c.participants||[]).length}</small></div>`+(c.participants||[]).map(x=>{ const p=x.profiles||{}; const n=x.user_id===me.id?'Вы':(p.display_name||p.username||'Участник'); return `<div class="mrow">${avatar(n,false,p.avatar_url,isOwner(p.username))}<div><div>${nameHtml(n,p.username)}</div><small>@${esc(p.username||'')}</small></div></div>`; }).join('')
    : (ow?`<div class="irow own-row"><div>${VB_SVG.replace('<svg','<svg class="vbi"')} Создатель KotakApp</div><small>Официальный аккаунт владельца</small></div>`:'')+(people[0]?.profiles?.bio?`<div class="irow"><div class="bio">${esc(people[0].profiles.bio)}</div><small>О себе</small></div>`:'')+`<div class="irow"><div>@${esc(c.otherUsername||people[0]?.profiles?.username||'')}</div><small>Имя пользователя</small></div>`;
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
  if(box.dataset.done) return;
  if(pref('autoload','1')==='0'&&!box.dataset.manual){ box.dataset.done='1'; box.innerHTML=`<button type="button" class="mph">${box.dataset.kind==='video'?'🎬 Загрузить видео':'📷 Загрузить фото'}</button>`; return; }
  box.dataset.done='1';
  try{
    const url=await mediaUrl(box.dataset.path);
    box.classList.add('ok');
    if(box.dataset.kind==='image'){
      box.innerHTML=`<img src="${esc(url)}" alt="Фото">`;
      box.querySelector('img').addEventListener('load',()=>{ const ms=$('msgs'); if(box.closest('.m')===ms.lastElementChild) ms.scrollTop=1e9; });
    } else box.innerHTML=`<video src="${esc(url)}#t=0.1" controls playsinline preload="metadata" ${pref('autoplay','0')==='1'?'autoplay muted loop':''}></video>`;
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
  if(!pushSupported()){ pushAvail=false; pushOn=false; return renderPageIf(); }
  const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription();
  pushOn=!!sub; renderPageIf();
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
const APP_VERSION='21';
async function runDiag(){
  const out=[]; const t=async(name,fn)=>{ try{ const r=await fn(); out.push((r&&r.error?'❌ ':'✅ ')+name+(r&&r.error?': '+r.error.message:'')); }catch(e){ out.push('❌ '+name+': '+(e.message||e)); } };
  await t('messages.reply_to_id',()=>client.from('messages').select('id,reply_to_id').limit(1));
  await t('таблица reactions',()=>client.from('reactions').select('message_id,user_id,emoji').limit(1));
  await t('связь reactions → messages',()=>client.from('reactions').select('message_id,messages!inner(conversation_id)').limit(1));
  await t('conversations.type/title',()=>client.from('conversations').select('id,type,title').limit(1));
  alert(out.join('\n')+'\n\nЕсли есть ❌ — выполни SQL из v9 в Supabase → SQL Editor ещё раз.');
}

/* ---- v17: страницы настроек, редактирование профиля, локальные предпочтения ---- */
let pageDepth=0, pushOn=false, pushAvail=true, curPage=null, edUserOk=true, edTimer=null;
const pref=(k,d)=>{ try{ const v=localStorage.getItem('kotak_'+k); return v===null?d:v; }catch(e){ return d; } };
const setPref=(k,v)=>{ try{ localStorage.setItem('kotak_'+k,v); }catch(e){} };
function applyPrefs(){
  document.documentElement.style.setProperty('--msg-fs',({s:'14px',m:'16px',l:'18px'})[pref('fs','m')]||'16px');
  document.body.classList.toggle('hide-time',pref('time','1')==='0');
  const w=WALLS.find(x=>x[0]===pref('wp','none')); document.documentElement.style.setProperty('--wp',w&&w[2]?w[2]:'none');
  const am=pref('theme','dark')==='amoled'; document.documentElement.classList.toggle('amoled',am);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',am?'#000000':'#050914');
}
let actx=null;
function beep(){ try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); actx.resume?.(); const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain(); o.type='sine'; o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(1320,t+.08); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.18,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+.25); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+.26); }catch(e){} }
function notifyIncoming(m){
  if(mutedSet().has(m.conversation_id)) return;
  if(current&&m.conversation_id===current.id&&document.visibilityState==='visible') return;
  if(pref('snd','1')==='1') beep();
  if(pref('vib','1')==='1') navigator.vibrate?.(80);
  if(document.visibilityState!=='visible') return;
  const c=chats.find(x=>x.id===m.conversation_id);
  if(pref('prev','1')!=='1'||!c) return toast('Новое сообщение');
  const p=c.participants.find(x=>x.user_id===m.sender_id)?.profiles;
  const body=m.message_type==='voice'?'🎤 Голосовое':m.message_type==='image'?'📷 Фото':m.message_type==='video'?'🎬 Видео':(m.content||'Вложение');
  toast((c.type==='group'?c.title+' · '+(p?.display_name||p?.username||''):c.title)+': '+body.slice(0,80));
}
function openPage(el){ el.hidden=false; history.pushState({pg:1},''); pageDepth++; }
const closePage=()=>{ if(pageDepth>0) history.back(); };
const renderPageIf=()=>{ if(!$('spage').hidden) renderPage(); };
const IC={
  user:'<circle cx="12" cy="8" r="3.500"/><path d="M5 20c1-4 4-5.500 7-5.500s6 1.500 7 5.500"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2.500"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bell:'<path d="M6 17V11a6 6 0 0 1 12 0v6l1.500 2h-15zM10 21h4"/>',
  chat:'<path d="M12 4C7.600 4 4 7 4 10.800c0 1.900.9 3.600 2.400 4.800-.1 1.400-.7 2.500-1.500 3.300 1.900-.1 3.400-.8 4.400-1.700.9.200 1.800.3 2.700.3 4.400 0 8-3 8-6.700S16.400 4 12 4z"/>',
  db:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.700 3.100 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3.100 3 7 3s7-1.300 7-3v-6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01"/>',
  shield:'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  out:'<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>'
};
const ico=n=>`<svg viewBox="0 0 24 24">${IC[n]||''}</svg>`;
const CHEV='<svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';
const CHECK='<svg class="chev" style="color:var(--ac)" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';
const POLICY=[
['Кто мы','KotakApp — небольшой мессенджер. Его делает и поддерживает один человек — владелец аккаунта @owner. Связаться можно в приложении: Настройки → О приложении → Поддержка.'],
['Какие данные мы храним','Имя пользователя (username), отображаемое имя, описание профиля и фото, если вы их добавили. Ваши сообщения, реакции, ответы, голосовые, фото и видео. Дату регистрации и последнего входа. Список заблокированных вами людей и ваши настройки приватности. Обращения, которые вы отправили через «Сообщить об ошибке» или «Предложить улучшение». Если включены push-уведомления, то технический адрес подписки вашего устройства.'],
['Чего мы не собираем','Мы не просим телефон и настоящий email: вход идёт по username. Мы не продаём данные и не показываем рекламу.'],
['Пароль','Пароль хранится в Supabase только в виде необратимого хеша. Владелец приложения не может его увидеть или восстановить.'],
['Где хранятся данные','Данные лежат у сторонних сервисов: база, файлы и вход — в Supabase, сайт размещён на GitHub Pages. Они обрабатывают данные по своим правилам. Сообщения хранятся на сервере и сейчас не защищены сквозным шифрованием.'],
['Фото, видео и голосовые','Файлы в чатах автоматически удаляются с сервера через 15 дней после отправки. Фото профиля хранится, пока вы его не удалите или не замените.'],
['Кто что видит','Ваши сообщения видят участники чата. Ваш username и имя видны другим пользователям при поиске. Статус «в сети» можно скрыть: Настройки → Конфиденциальность. Там же можно ограничить, кто может вам писать, и заблокировать пользователя. Владелец приложения имеет доступ к списку аккаунтов (username, даты регистрации и входа) и к обращениям в поддержку. Читать вашу переписку он не собирается и не использует её.'],
['Данные на вашем устройстве','Часть настроек (тема, размер текста, обои, звук, мьют чатов) хранится только в вашем браузере и на сервер не отправляется.'],
['Ваши права','Вы можете изменить имя, username, описание и фото в профиле, удалить своё сообщение и заблокировать пользователя. Если хотите удалить аккаунт и данные полностью, напишите в поддержку. Автоматического удаления аккаунта в приложении пока нет.'],
['Дети','KotakApp не предназначен для детей младше 13 лет.'],
['Изменения','Если правила изменятся, мы обновим этот текст и дату вверху страницы.'],
];
const SETTINGS=[
  {id:'account',t:'Аккаунт',i:'user',rows:[{t:'Управление профилем',i:'user',go:'edit'},{t:'Выйти из аккаунта',i:'out',act:'logout',danger:1}]},
  {id:'privacy',t:'Конфиденциальность',i:'lock',rows:[{t:'Видимость статуса',vf:()=>PVL.privacy_status[me?.privacy_status||'all']||'Все',go:'pv-status'},{t:'Кто может писать',vf:()=>PVL.privacy_write[me?.privacy_write||'all']||'Все',go:'pv-write'},{t:'Видимость профиля',v:'Все',soon:1},{t:'Чёрный список',go:'blocklist'},{t:'Блокировка пользователей',go:'blockuser'}]},
  {id:'notif',t:'Уведомления',i:'bell',rows:[{t:'Новые сообщения',sw:1,act:'push'},{t:'Звук сообщений',sw:1,act:'snd'},{t:'Предпросмотр текста',sw:1,act:'prev'},{t:'Вибрация',sw:1,act:'vib'},{t:'Уведомления отдельных чатов',go:'mute'}]},
  {id:'chats',t:'Настройки чатов',i:'chat',rows:[{t:'Размер текста',seg:'fs'},{t:'Обои',go:'wp'},{t:'Тема',seg:'theme'},{t:'Автовоспроизведение видео',sw:1,act:'autoplay'},{t:'Автозагрузка медиа',sw:1,act:'autoload'},{t:'Отображение времени сообщений',sw:1,act:'time'}]},
  {id:'data',t:'Данные и память',i:'db',rows:[{t:'Мои файлы в чатах',go:'files'}]},
  {id:'lang',t:'Язык',i:'globe',rows:[{t:'Русский',chk:1},{t:'Қазақша',soon:1},{t:'English',soon:1}]},
  {id:'about',t:'О приложении',i:'info',about:1,rows:[{t:'Поддержка',go:'support'},{t:'Политика конфиденциальности',go:'policy'}]},
  {id:'help',t:'Помощь',i:'help',rows:[{t:'Разработчик',go:'support'},{t:'FAQ',go:'faq'},{t:'Сообщить об ошибке',go:'fb-bug'},{t:'Предложить улучшение',go:'fb-idea'},{t:'Проверить базу данных',act:'diag',chev:1}]}
];
const SWD={snd:'1',prev:'1',vib:'1',autoplay:'0',autoload:'1',time:'1'};
const SEGS={fs:[['s','Мелкий'],['m','Обычный'],['l','Крупный']],theme:[['dark','Синяя'],['amoled','Чёрная']]};
const SEGD={fs:'m',theme:'dark'};
const WALLS=[['none','Без обоев',''],['aurora','Аврора','radial-gradient(600px 400px at 15% 10%,#168bff40,transparent 60%),radial-gradient(500px 400px at 90% 95%,#00bfff2a,transparent 60%)'],['night','Ночь','linear-gradient(180deg,#050914,#0c1d44)'],['violet','Фиолет','linear-gradient(160deg,#0a0a1f,#1d1450 60%,#0b1a3a)'],['teal','Бирюза','linear-gradient(160deg,#04141a,#08404f)'],['graphite','Графит','#0b0d13']];
const mutedSet=()=>{ try{ return new Set(JSON.parse(pref('muted','[]'))); }catch(e){ return new Set(); } };
const FAQ=[['Как найти человека?','Вкладка «Контакты» → поиск по @username → кнопка «Написать».'],['Как создать группу?','В шапке списка чатов нажми ⋮ → «Новая группа», выбери участников по username.'],['Сколько хранятся фото и видео?','Файлы из чатов удаляются автоматически через 15 дней, текст остаётся.'],['Как сменить фото профиля?','Профиль → нажми на аватар → «Изменить фото».'],['Не приходят уведомления','Настройки → Уведомления → «Новые сообщения». На iPhone сначала добавь сайт на экран «Домой» (Поделиться → На экран Домой) и открой оттуда.'],['Можно ли восстановить пароль?','Пока нет: вход только по username и паролю. Запомни пароль.']];
const fbBox=k=>`<div class="card2" style="padding:14px"><label class="fld"><span>${k==='bug'?'Что пошло не так?':'Что улучшить или добавить?'}</span><textarea id="fb-text" rows="6" maxlength="1500" placeholder="Опиши подробнее"></textarea></label></div><button type="button" class="primary" id="fb-send" data-kind="${k}">Отправить</button>`;
SETTINGS.push(
 {id:'mute',t:'Уведомления чатов',parent:'notif',hidden:1,custom:()=>{ const m=mutedSet(); return '<p class="tiny muted" style="padding:0 6px">Работает только в открытом приложении на этом устройстве: без звука, вибрации и всплывающих подсказок. Push-уведомления сервера это не отключает.</p><div class="card2">'+(chats.map(c=>`<button type="button" class="srow" data-mute="${c.id}"><span class="tx">${esc(c.title)}</span><span class="sw ${m.has(c.id)?'':'on'}"></span></button>`).join('')||'<p class="muted" style="padding:18px">Чатов пока нет.</p>')+'</div>'; }},
 {id:'wp',t:'Обои',parent:'chats',hidden:1,custom:()=>{ const w=pref('wp','none'); return '<div class="wps">'+WALLS.map(([k,n,bg])=>`<button type="button" class="wp ${w===k?'on':''}" data-wp="${k}" style="background:${bg||'#0b1428'}"><span>${n}</span></button>`).join('')+'</div>'; }},
 {id:'files',t:'Мои файлы в чатах',parent:'data',hidden:1,custom:()=>'<p class="tiny muted" style="padding:0 6px">Файлы, которые ты отправил и которые ещё хранятся. Через 15 дней после отправки они удаляются автоматически.</p><div class="card2" id="files-box"><p class="muted" style="padding:18px">Считаю…</p></div>',after:async()=>{
   const T=[['image','Фото'],['video','Видео'],['voice','Голосовые']];
   const r=await Promise.all(T.map(([t])=>client.from('messages').select('id',{count:'exact',head:true}).eq('sender_id',me.id).eq('message_type',t).is('media_deleted_at',null).not('media_path','is',null)));
   const b=$('files-box'); if(!b||curPage!=='files') return;
   b.innerHTML=T.map(([t,n],i)=>`<div class="srow"><span class="tx">${n}</span><span class="val">${r[i].error?'—':r[i].count||0}</span></div>`).join('');
 }},
 {id:'faq',t:'FAQ',parent:'help',hidden:1,custom:()=>'<div class="card2">'+FAQ.map(([q,a])=>`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')+'</div>'},
 {id:'fb-bug',t:'Сообщить об ошибке',parent:'help',hidden:1,custom:()=>fbBox('bug')},
 {id:'fb-idea',t:'Предложить улучшение',parent:'help',hidden:1,custom:()=>fbBox('idea')}
);
applyPrefs();
const swOn=a=>a==='push'?pushOn:pref(a,SWD[a])==='1';
function rowHtml(r){
  if(r.seg){ const f=pref(r.seg,SEGD[r.seg]); return `<div class="srow"><span class="tx">${r.t}</span><span class="segs">${SEGS[r.seg].map(([k,n])=>`<button type="button" data-seg="${r.seg}" data-v="${k}" class="${f===k?'on':''}">${n}</button>`).join('')}</span></div>`; }
  const ic=r.i?`<span class="ic">${ico(r.i)}</span>`:'';
  let right='';
  if(r.soon) right=(r.v?`<span class="val">${r.v}</span>`:'')+'<span class="pill">Скоро</span>'+(r.sw?'<span class="sw"></span>':'');
  else if(r.act==='push'&&!pushAvail) right='<span class="val">Недоступно</span>';
  else if(r.sw) right=`<span class="sw ${swOn(r.act)?'on':''}"></span>`;
  else if(r.chk) right=CHECK;
  else if(r.vf) right=`<span class="val">${r.vf()}</span>`+CHEV;
  else if(r.go||r.chev||r.url) right=CHEV;
  return `<button type="button" class="srow ${r.soon?'soon':''} ${r.danger?'danger':''}" data-act="${r.act||''}" data-go="${r.go||''}" data-url="${r.url||''}" ${r.soon?'data-soon="1"':''}>${ic}<span class="tx">${r.t}</span>${right}</button>`;
}
function renderPage(){
  const s=SETTINGS.find(x=>x.id===curPage); if(!s) return; $('sp-title').textContent=s.t;
  const head=s.about?`<div class="abt"><img src="logo-mark.png" alt="" width="90" height="87"><b>Kotak<span style="color:var(--pr)">App</span></b><span class="muted">Версия ${APP_VERSION}</span></div>`:'';
  $('sp-body').innerHTML=s.custom?s.custom():head+'<div class="card2">'+s.rows.map(rowHtml).join('')+'</div>';
  if(s.after) s.after().catch(()=>{});
}
function openSettings(id){
  const s=SETTINGS.find(x=>x.id===id); if(!s) return;
  curPage=id; $('sp-title').textContent=s.t; renderPage(); if($('spage').hidden) openPage($('spage'));
}
let isAdm=false, admUsers=[], adminLog=[], tickets=[], admCh=null, admSeen=false;
function renderSettingsMain(){ $('settings-main').innerHTML='<div class="card2">'+SETTINGS.filter(s=>!s.hidden&&(!s.admin||isAdm)).map(s=>`<button type="button" class="srow" data-open="${s.id}"><span class="ic">${ico(s.i)}</span><span class="tx">${s.t}</span>${s.id==='lang'?'<span class="val">Русский</span>':''}${CHEV}</button>`).join('')+'</div>'; }
renderSettingsMain();
$('settings-main').onclick=e=>{ const b=e.target.closest('[data-open]'); if(b) openSettings(b.dataset.open); };
$('sp-body').onclick=async e=>{
  const sg=e.target.closest('[data-seg]'); if(sg){ setPref(sg.dataset.seg,sg.dataset.v); applyPrefs(); return renderPage(); }
  const wp=e.target.closest('[data-wp]'); if(wp){ setPref('wp',wp.dataset.wp); applyPrefs(); return renderPage(); }
  const mu=e.target.closest('[data-mute]'); if(mu){ const s=mutedSet(), id=mu.dataset.mute; s.has(id)?s.delete(id):s.add(id); setPref('muted',JSON.stringify([...s])); return renderPage(); }
  const fb=e.target.closest('#fb-send'); if(fb){ return sendFeedback(fb); }
  const pv=e.target.closest('[data-pv]'); if(pv) return setPrivacy(pv.dataset.pv,pv.dataset.v);
  const ub=e.target.closest('[data-unblock]'); if(ub) return unblock(ub.dataset.unblock);
  const bk=e.target.closest('[data-block]'); if(bk) return blockUser(bk.dataset.block,bk);
  const tk=e.target.closest('[data-tk]'); if(tk) return ticketAct(tk.dataset.tk,tk.dataset.id,tk.dataset.name);
  const b=e.target.closest('.srow'); if(!b) return;
  if(b.dataset.soon) return toast('Эта функция скоро появится');
  if(b.dataset.url) return window.open(b.dataset.url,'_blank','noopener');
  if(b.dataset.act==='owner-chat') return chatWithOwner();
  const a=b.dataset.act, g=b.dataset.go;
  if(g==='edit') return openEdit();
  if(g) return openSettings(g);
  if(a==='logout'){ if(!confirm('Выйти из аккаунта?')) return; document.querySelectorAll('.page').forEach(p=>p.hidden=true); pageDepth=0; return logout(); }
  if(a==='push'){ if(!pushAvail) return toast('Уведомления недоступны в этом браузере'); return togglePush(); }
  if(a in SWD){ setPref(a,pref(a,SWD[a])==='1'?'0':'1'); if(a==='vib'&&pref('vib','1')==='1') navigator.vibrate?.(60); if(a==='snd'&&pref('snd','1')==='1') beep(); applyPrefs(); return renderPage(); }
  if(a==='diag') return runDiag();
};
async function sendFeedback(btn){
  const text=($('fb-text').value||'').trim(); if(text.length<5) return toast('Напиши хотя бы пару слов');
  btn.disabled=true;
  try{
    const {error}=await client.from('feedback').insert({kind:btn.dataset.kind,text,app_version:APP_VERSION});
    if(error) throw error;
    toast('Спасибо, отправлено'); $('fb-text').value='';
  }catch(e){ toast('Не отправлено: '+(e.message||e)+(/feedback/.test(e.message||'')?' (выполни SQL из чата в Supabase)':'')); }
  finally{ btn.disabled=false; }
}

/* ---- v19: приватность, блокировки, поддержка, админ-панель owner ---- */
const PVL={privacy_status:{all:'Все',nobody:'Никто'},privacy_write:{all:'Все',replied:'Только после моего сообщения'}};
const sbUrl=p=>{ try{ return 'https://supabase.com/dashboard/project/'+new URL(cfg.SUPABASE_URL).hostname.split('.')[0]+p; }catch(e){ return 'https://supabase.com/dashboard'; } };
const dt=v=>v?new Date(v).toLocaleString('ru',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const radioPage=(id,t,col,opts,note)=>({id,t,parent:'privacy',hidden:1,custom:()=>`<p class="tiny muted" style="padding:0 6px">${note}</p><div class="card2">`+opts.map(([k,n])=>`<button type="button" class="srow" data-pv="${col}" data-v="${k}"><span class="tx">${n}</span>${(me?.[col]||'all')===k?CHECK:''}</button>`).join('')+'</div>'});
const uRow=(u,btn)=>`<div class="srow">${avatar(u.display_name||u.username,false,u.avatar_url)}<span class="tx">${esc(u.display_name||u.username)}<small class="muted">@${esc(u.username)}</small></span>${btn}</div>`;
const msg0=t=>`<p class="muted" style="padding:18px">${t}</p>`;
const nameById=id=>{ const u=admUsers.find(x=>x.id===id); return u?'@'+u.username:(id===me?.id?'@'+me.username:String(id).slice(0,8)); };
SETTINGS.push(
 radioPage('pv-status','Видимость статуса','privacy_status',[['all','Все'],['nobody','Никто']],'Если выбрано «Никто», другие не увидят твоё «в сети» и «печатает…». Ты сам тоже не будешь отображаться онлайн для других.'),
 radioPage('pv-write','Кто может писать','privacy_write',[['all','Все'],['replied','Только после моего сообщения']],'«Только после моего сообщения»: в личных чатах тебе смогут отвечать, но новые чужие чаты не смогут написать первыми. Проверяется на сервере. Группы не затрагиваются.'),
 {id:'blocklist',t:'Чёрный список',parent:'privacy',hidden:1,custom:()=>'<div class="card2" id="bl-box">'+msg0('Загружаю…')+'</div>',after:async()=>{
   const {data:bl,error}=await client.from('blocks').select('blocked_id').eq('blocker_id',me.id); const b=$('bl-box'); if(!b||curPage!=='blocklist') return;
   if(error){ b.innerHTML=msg0('Не загрузилось: '+esc(error.message)); return; }
   if(!bl.length){ b.innerHTML=msg0('Список пуст.'); return; }
   const {data:ps}=await client.from('profiles').select('id,username,display_name,avatar_url').in('id',bl.map(x=>x.blocked_id)); if(curPage!=='blocklist') return;
   b.innerHTML=(ps||[]).map(u=>uRow(u,`<button type="button" class="go" data-unblock="${u.id}">Разблокировать</button>`)).join('');
 }},
 {id:'blockuser',t:'Блокировка пользователей',parent:'privacy',hidden:1,custom:()=>'<p class="tiny muted" style="padding:0 6px">Заблокированный не сможет писать тебе в личку, а ты ему, пока не разблокируешь. В группах блок не действует.</p><label class="fld"><span>Username</span><input id="bl-q" placeholder="@username" autocomplete="off" autocapitalize="off" spellcheck="false"></label><div class="card2" id="bl-res">'+msg0('Введи минимум 2 символа.')+'</div>'},
 {id:'policy',t:'Политика конфиденциальности',parent:'about',hidden:1,custom:()=>'<p class="tiny muted" style="padding:0 6px">Обновлено: 28 ноября 2026</p><div class="card2 pol">'+POLICY.map(([h,t])=>`<h4>${h}</h4><p>${t}</p>`).join('')+'</div>'},
 {id:'support',t:'Поддержка',parent:'about',hidden:1,rows:[{t:'Написать владельцу в KotakApp',i:'chat',act:'owner-chat'},{t:'Telegram @parabellumkz',i:'help',url:'https://t.me/parabellumkz'},{t:'Сообщить об ошибке',i:'info',go:'fb-bug'},{t:'Предложить улучшение',i:'info',go:'fb-idea'}]},
 {id:'admin',t:'Админ-панель',i:'shield',admin:1,rows:[{t:'Пользователи',i:'user',go:'adm-users'},{t:'Онлайн и лог',i:'info',go:'adm-live'},{t:'Обращения в поддержку',i:'help',go:'adm-tickets',vf:()=>{ const n=tickets.filter(t=>t.status!=='done').length; return n?'Новых: '+n:''; }},{t:'SQL Editor (Supabase)',i:'db',url:sbUrl('/sql/new')},{t:'Table Editor',i:'db',url:sbUrl('/editor')},{t:'Auth → Users',i:'db',url:sbUrl('/auth/users')},{t:'Проект Supabase',i:'db',url:sbUrl('')}]},
 {id:'adm-users',t:'Пользователи',parent:'admin',hidden:1,custom:()=>'<p class="tiny muted" style="padding:0 6px">Пароли в Supabase хранятся только в виде необратимого хеша: посмотреть их нельзя, приложение их не получает. Сбросить пароль можно в Supabase → Authentication → Users.</p><div class="card2" id="adm-box">'+msg0('Загружаю…')+'</div>',after:async()=>{
   let err=''; try{ await loadAdmUsers(); }catch(e){ err=e.message||String(e); } const b=$('adm-box'); if(!b||curPage!=='adm-users') return;
   b.innerHTML=err?msg0('Ошибка: '+esc(err)+'. Выполнены ли SQL и добавлен ли owner в app_admins?'):`<div class="srow"><span class="tx">Всего аккаунтов</span><span class="val">${admUsers.length}</span></div>`+admUsers.map(u=>`<div class="srow"><span class="tx">${esc(u.display_name||u.username)} ${online.has(u.id)?'<i class="ond"></i>':''}<small class="muted">@${esc(u.username)} · рег. ${dt(u.created_at)} · вход ${dt(u.last_sign_in_at)}</small></span></div>`).join('');
 }},
 {id:'adm-live',t:'Онлайн и лог',parent:'admin',hidden:1,custom:()=>`<div class="card2"><div class="srow"><span class="tx">Сейчас онлайн</span><span class="val">${online.size}</span></div>`+[...online].map(id=>`<div class="srow"><span class="tx">${esc(nameById(id))}</span><i class="ond"></i></div>`).join('')+'</div><p class="tiny muted" style="padding:0 6px">Лог за текущий сеанс: входы и выходы, регистрации, обращения. Текст переписок не показывается.</p><div class="card2">'+(adminLog.map(l=>`<div class="srow"><span class="tx">${esc(l.text)}<small class="muted">${new Date(l.t).toLocaleTimeString('ru')}</small></span></div>`).join('')||msg0('Пока пусто.'))+'</div>'},
 {id:'adm-tickets',t:'Обращения',parent:'admin',hidden:1,custom:()=>'<div id="tk-box">'+ticketsHtml()+'</div>',after:async()=>{ try{ await loadTickets(); }catch(e){ const b=$('tk-box'); if(b) b.innerHTML='<div class="card2">'+msg0('Ошибка: '+esc(e.message||e))+'</div>'; return; } const b=$('tk-box'); if(b&&curPage==='adm-tickets') b.innerHTML=ticketsHtml(); }}
);
function ticketsHtml(){
  if(!tickets.length) return '<div class="card2">'+msg0('Обращений пока нет.')+'</div>';
  return tickets.map(t=>{ const n=t.u?(t.u.display_name||t.u.username):'аноним'; return `<div class="card2 tk ${t.status==='done'?'done':''}"><div class="tkh"><span class="pill">${t.kind==='bug'?'Ошибка':'Идея'}</span><b>${esc(n)}${t.u?' @'+esc(t.u.username):''}</b><span class="muted small">${dt(t.created_at)}</span></div><p>${esc(t.text)}</p><div class="tka"><button type="button" data-tk="chat" data-id="${t.user_id}" data-name="${esc(n)}">Написать</button><button type="button" data-tk="done" data-id="${t.id}">${t.status==='done'?'Вернуть':'Готово'}</button><button type="button" data-tk="del" data-id="${t.id}">Удалить</button></div></div>`; }).join('');
}
async function loadAdmUsers(){ const {data,error}=await client.rpc('admin_users'); if(error) throw error; admUsers=data||[]; return admUsers; }
async function loadTickets(){
  const {data,error}=await client.from('feedback').select('*').order('created_at',{ascending:false}).limit(100); if(error) throw error;
  const ids=[...new Set((data||[]).map(x=>x.user_id))], names={};
  if(ids.length){ const {data:ps}=await client.from('profiles').select('id,username,display_name').in('id',ids); (ps||[]).forEach(p=>names[p.id]=p); }
  tickets=(data||[]).map(x=>({...x,u:names[x.user_id]})); return tickets;
}
function closeAllPages(){ document.querySelectorAll('.page').forEach(p=>p.hidden=true); pageDepth=0; }
async function ticketAct(a,id,name){
  try{
    if(a==='chat'){ closeAllPages(); return startDirectChat(id,name); }
    if(a==='done'){ const t=tickets.find(x=>String(x.id)===String(id)); const {error}=await client.from('feedback').update({status:t?.status==='done'?'new':'done'}).eq('id',id); if(error) throw error; }
    if(a==='del'){ if(!confirm('Удалить обращение?')) return; const {error}=await client.from('feedback').delete().eq('id',id); if(error) throw error; }
    await loadTickets(); renderPage();
  }catch(e){ toast('Обращение: '+(e.message||e)); }
}
function logA(text){ adminLog.unshift({t:Date.now(),text}); adminLog.length=Math.min(adminLog.length,100); if(!$('spage').hidden&&curPage==='adm-live') renderPage(); }
function logPresence(prev){
  if(!prev.size&&!admSeen){ admSeen=true; return; } admSeen=true;
  online.forEach(id=>{ if(!prev.has(id)) logA('🟢 '+nameById(id)+' в сети'); });
  prev.forEach(id=>{ if(!online.has(id)) logA('⚪ '+nameById(id)+' вышел'); });
}
function startAdminLog(){
  if(admCh||!isAdm) return;
  admCh=client.channel('admin-log')
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'profiles'},p=>{ logA('🆕 Регистрация @'+(p.new.username||'?')); loadAdmUsers().catch(()=>{}); })
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'feedback'},p=>{ logA('📩 Обращение: '+(p.new.kind==='bug'?'ошибка':'идея')); toast('Новое обращение в поддержку'); loadTickets().then(renderPageIf).catch(()=>{}); })
   .subscribe();
}
async function checkAdmin(){
  if(!me||me.username!=='owner') return;
  try{ const {data,error}=await client.rpc('is_admin'); if(error||!data) return;
    isAdm=true; renderSettingsMain(); await loadAdmUsers().catch(()=>{}); loadTickets().then(renderPageIf).catch(()=>{}); startAdminLog();
  }catch(e){}
}
async function chatWithOwner(){
  const {data,error}=await client.from('profiles').select('id,username,display_name').eq('username','owner').maybeSingle();
  if(error||!data) return toast('Аккаунт owner не найден');
  if(data.id===me.id) return toast('Это твой аккаунт');
  closeAllPages(); startDirectChat(data.id,data.display_name||data.username);
}
async function setPrivacy(col,v){
  const {error}=await client.from('profiles').update({[col]:v}).eq('id',me.id);
  if(error) return toast('Не сохранено: '+error.message+' (выполни SQL из чата в Supabase)');
  me[col]=v; if(col==='privacy_status') applyStatusVisibility(); renderPage();
}
function applyStatusVisibility(){ if(!pres) return; if(me.privacy_status==='nobody') pres.untrack(); else pres.track({typing_in:null}); }
async function blockUser(id,btn){
  const {error}=await client.from('blocks').insert({blocker_id:me.id,blocked_id:id});
  if(error&&error.code!=='23505') return toast('Не заблокирован: '+error.message+' (выполни SQL из чата в Supabase)');
  toast('Пользователь заблокирован'); if(btn){ btn.textContent='Заблокирован'; btn.disabled=true; }
}
async function unblock(id){ const {error}=await client.from('blocks').delete().eq('blocker_id',me.id).eq('blocked_id',id); if(error) return toast(error.message); toast('Разблокирован'); renderPage(); }
let blTimer=null;
$('sp-body').oninput=e=>{
  if(e.target.id!=='bl-q') return; const el=e.target; clearTimeout(blTimer);
  blTimer=setTimeout(async()=>{
    const q=el.value.trim().replace(/^@/,'').toLowerCase(), box=$('bl-res'); if(!box) return;
    if(q.length<2){ box.innerHTML=msg0('Введи минимум 2 символа.'); return; }
    const {data,error}=await client.from('profiles').select('id,username,display_name,avatar_url').ilike('username',`%${q}%`).neq('id',me.id).limit(15);
    if(!$('bl-res')||q!==el.value.trim().replace(/^@/,'').toLowerCase()) return;
    box.innerHTML=error?msg0(esc(error.message)):((data||[]).map(u=>uRow(u,`<button type="button" class="go" data-block="${u.id}">Заблокировать</button>`)).join('')||msg0('Не найдено.'));
  },300);
};
$('sp-back').onclick=()=>{ const s=SETTINGS.find(x=>x.id===curPage); if(s?.parent&&!$('spage').hidden) openSettings(s.parent); else closePage(); }; $('ep-back').onclick=closePage;

/* профиль */
const setHint=(t,c)=>{ const h=$('ed-hint'); h.textContent=t; h.className='hint '+(c||''); };
function openEdit(){
  $('ed-name').value=me.display_name||''; $('ed-user').value=me.username; $('ed-bio').value=me.bio||'';
  edUserOk=true; setHint(''); openPage($('epage'));
}
function checkUsername(){
  const v=$('ed-user').value.trim().toLowerCase(); clearTimeout(edTimer);
  if(v===me.username){ edUserOk=true; return setHint(''); }
  edUserOk=false;
  if(!validUsername(v)) return setHint('3–24 символа: a–z, 0–9 и _','bad');
  setHint('Проверяю…');
  edTimer=setTimeout(async()=>{
    const {data,error}=await client.from('profiles').select('id').eq('username',v).neq('id',me.id).maybeSingle();
    if($('ed-user').value.trim().toLowerCase()!==v) return;
    if(error) return setHint('Не удалось проверить: '+error.message,'bad');
    edUserOk=!data; setHint(data?'@'+v+' уже занят':'@'+v+' свободен',data?'bad':'ok');
  },400);
}
async function saveProfileEdit(){
  const uname=$('ed-user').value.trim().toLowerCase(), name=$('ed-name').value.trim().slice(0,40), bio=$('ed-bio').value.trim().slice(0,200);
  const changedU=uname!==me.username;
  if(changedU&&!edUserOk) return toast('Проверь username');
  $('ed-save').disabled=true;
  try{
    if(changedU){
      // вход идёт по username → email, поэтому сначала меняем email входа; если сервер не применил — ничего не трогаем
      const {data,error}=await client.auth.updateUser({email:usernameEmail(uname)});
      if(error) throw error;
      if((data?.user?.email||'').toLowerCase()!==usernameEmail(uname)) throw new Error('смена username пока недоступна (сервер требует подтверждение email)');
    }
    const upd={display_name:name||uname,bio:bio||null}; if(changedU) upd.username=uname;
    const {error}=await client.from('profiles').update(upd).eq('id',me.id);
    if(error){ if(changedU) await client.auth.updateUser({email:usernameEmail(me.username)}).catch(()=>{}); throw error; }
    Object.assign(me,upd); paintMe(); loadChats().catch(()=>{}); toast('Профиль сохранён'); closePage();
  }catch(e){ toast('Профиль: '+(e.message||e)); }
  finally{ $('ed-save').disabled=false; }
}
$('ed-user').oninput=checkUsername; $('ed-save').onclick=saveProfileEdit; $('p-edit').onclick=openEdit;
$('pav').onclick=()=>{ $('av-sheet').hidden=false; };
$('av-change').onclick=()=>{ $('av-sheet').hidden=true; $('av-file').click(); };
$('av-view').onclick=()=>{ $('av-sheet').hidden=true; if(!me?.avatar_url) return; $('lb-body').innerHTML=`<img src="${esc(me.avatar_url)}" alt="Фото профиля">`; $('lb').hidden=false; };
$('av-remove').onclick=()=>{ $('av-sheet').hidden=true; removeAvatar(); };
$('av-close').onclick=()=>{ $('av-sheet').hidden=true; };
$('av-sheet').onclick=e=>{ if(e.target===$('av-sheet')) $('av-sheet').hidden=true; };
$('ptabs').onclick=e=>{
  const b=e.target.closest('[data-p]'); if(!b) return; const a=b.dataset.p==='arc';
  document.querySelectorAll('#ptabs button').forEach(x=>x.classList.toggle('on',x===b));
  $('pe-t').textContent=a?'Архив пуст':'Пока нет публикаций';
  $('pe-s').textContent=a?'Здесь будут скрытые публикации':'Делитесь мыслями, фото и моментами с друзьями';
  $('p-add').hidden=a;
};
$('p-add').onclick=()=>toast('Публикации скоро появятся');

(async()=>{
  try {
  if(!client) { $('auth-error').textContent='Supabase не загрузился. Проверь интернет-соединение.'; return; }
  try { await loadSession(); updatePushBtn().catch(()=>{}); } catch(error) { toast(error.message||'Ошибка загрузки аккаунта'); }
  client.auth.onAuthStateChange((_event)=>{ if(_event==='SIGNED_OUT'){ $('app').hidden=true; $('auth-wrap').hidden=false; } });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  } finally { $('boot').hidden=true; }
})();
