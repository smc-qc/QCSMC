/* QC SMC website adapter: gives the app the same db / assets / downloads / user interface it uses on claude.ai, backed by Supabase. */
(function(){
'use strict';
const CFG=window.QC_CONFIG||{};
const $=s=>document.querySelector(s);
const gate=$('#gate');
function showGate(html){gate.innerHTML='<div class="g-card"><div class="g-logo">QC SMC</div><div class="g-sub">ระบบตรวจสอบคุณภาพงาน</div>'+html+'</div>';gate.hidden=false}
if(!CFG.url||!CFG.key||/__/.test(CFG.url)){showGate('<p class="g-msg">ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล (Supabase URL / key)</p>');window.claude={use:()=>new Promise(()=>{})};return}
const sb=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
window.BLOB_BASE=CFG.url.replace(/\/$/,'')+'/storage/v1/object/public/photos/';
window.QC_LOGOUT=async()=>{try{await sb.auth.signOut()}catch(e){}try{localStorage.removeItem('qc.sb.cache')}catch(e){}location.reload()};
let session=null,resolveReady;const ready=new Promise(r=>resolveReady=r);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- sign-in: PIN only for everyone; the inspector assigns PINs. Each PIN is its own account behind the scenes. ---------- */
const PIN_DOMAIN='smc-qc.github.io';
const TEAM='team@'+PIN_DOMAIN, pinPass=p=>'qcsmc-'+p+'-pin';
const isTeam=e=>String(e||'').toLowerCase()===TEAM;
const PIN=(id,ac)=>'<input id="'+id+'" class="g-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="'+ac+'" placeholder="••••••">';
function digits(el){el.value=el.value.replace(/\D/g,'').slice(0,6);return el.value}
function loginForm(msg){
  showGate('<label class="g-l" for="gPw">ใส่ PIN 6 หลัก</label>'+PIN('gPw','current-password')+'<button class="g-btn" id="gGo">เข้าใช้</button>'+
    (msg?'<p class="g-err">'+esc(msg)+'</p>':'')+'<p class="g-foot">ยังไม่มี PIN ขอจากผู้ตรวจ</p><button class="g-link g-small" id="gAdmin">ผู้ดูแลระบบ: เข้าด้วยอีเมล</button>');
  const pw=$('#gPw'),go=$('#gGo');setTimeout(()=>pw.focus(),50);
  const run=async()=>{const p=digits(pw);if(p.length!==6)return loginForm('PIN ต้องเป็นตัวเลข 6 หลัก');go.disabled=true;go.textContent='กำลังตรวจ…';
    const {error}=await sb.auth.signInWithPassword({email:TEAM,password:pinPass(p)});
    if(error)loginForm(/rate|many/i.test(error.message)?'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่':'PIN ไม่ถูกต้อง')};
  pw.oninput=()=>{if(digits(pw).length===6)run()};go.onclick=run;
  $('#gAdmin').onclick=()=>emailForm('',false,'');
}
function emailForm(email,sent,msg){
  showGate('<p class="g-msg" style="margin-top:0">สำหรับผู้ดูแลระบบ ใช้อีเมลที่ลงทะเบียนไว้</p><label class="g-l" for="gEmail">อีเมล</label><input id="gEmail" type="email" inputmode="email" autocomplete="email" value="'+esc(email||'')+'">'+
    '<button class="g-btn" id="gSend">'+(sent?'ส่งอีกครั้ง':'ส่งลิงก์เข้าใช้ไปที่อีเมล')+'</button>'+
    (sent?'<p class="g-msg">ส่งอีเมลแล้ว เปิดอีเมลแล้วกดลิงก์ หรือกรอกรหัสจากอีเมล</p><label class="g-l" for="gCode">รหัสจากอีเมล</label><input id="gCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10"><button class="g-btn" id="gVerify">เข้าใช้</button>':'')+
    (msg?'<p class="g-err">'+esc(msg)+'</p>':'')+'<button class="g-link" id="gBack">กลับไปใส่ PIN</button>');
  const em=$('#gEmail'),E=()=>em.value.trim();
  $('#gBack').onclick=()=>loginForm('');
  $('#gSend').onclick=async()=>{const e=E();if(!/^\S+@\S+\.\S+$/.test(e))return emailForm(e,sent,'กรอกอีเมลให้ถูกต้อง');
    $('#gSend').disabled=true;$('#gSend').textContent='กำลังส่ง…';
    const {error}=await sb.auth.signInWithOtp({email:e,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
    emailForm(e,!error,error?('ส่งไม่สำเร็จ: '+(error.message||error.status)):'')};
  const vb=$('#gVerify');if(vb)vb.onclick=async()=>{const t=$('#gCode').value.replace(/\s/g,'');if(!t)return;vb.disabled=true;
    const {error}=await sb.auth.verifyOtp({email:E(),token:t,type:'email'});if(error)emailForm(E(),true,'รหัสไม่ถูกต้องหรือหมดอายุ')};
}
async function admit(s){
  session=s;
  const email=(s.user.email||'').toLowerCase();
  const {data:rows,error}=await sb.from('members').select('email,name,role').ilike('email',email);
  const data=(rows||[]).find(r=>String(r.email).toLowerCase()===email);
  if(error){
    if(!navigator.onLine){window.QC_USER=email;gate.hidden=true;resolveReady();return}
    showGate('<p class="g-err">ตรวจสอบสิทธิ์ไม่สำเร็จ ('+esc(error.message)+')</p><button class="g-btn" onclick="location.reload()">ลองใหม่</button>');return}
  if(!data){showGate('<p class="g-msg">'+(isTeam(email)?'PIN ถูกปิดใช้งาน':'อีเมล <b>'+esc(email)+'</b> ยังไม่ได้รับสิทธิ์')+' ติดต่อผู้ตรวจ</p><button class="g-btn" id="gOut">กลับไปใส่ PIN</button>');$('#gOut').onclick=window.QC_LOGOUT;return}
  window.QC_USER=isTeam(email)?(data.name||'ทีมงาน'):(data.name||email);window.QC_ROLE=data.role||'tech';
  if(window.QC_ROLE==='inspector')window.QC_MANAGE=manageUsers;
  gate.hidden=true;resolveReady();
}
/* ---------- inspector: assign / remove PINs ---------- */
const sb2=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'qc-sb2'}});
async function manageUsers(msg,ok){
  const {data}=await sb.from('members').select('email').ilike('email',TEAM);
  const has=(data||[]).length>0;
  showGate('<div class="g-mh"><b>PIN เข้าใช้ของทีม</b><button class="g-link g-x" id="mClose">ปิด</button></div>'+
    '<p class="g-msg" style="margin-top:0">ทุกคนใช้ PIN ชุดเดียวกัน '+(has?'ตอนนี้ <b>เปิดใช้อยู่</b>':'ตอนนี้ <b>ยังไม่ได้ตั้ง</b>')+'</p>'+
    (has?'<label class="g-l" for="mOld">PIN ปัจจุบัน</label>'+PIN('mOld','off'):'')+
    '<label class="g-l" for="mNew">'+(has?'PIN ใหม่':'ตั้ง PIN 6 หลัก')+'</label>'+PIN('mNew','off')+
    '<button class="g-btn" id="mSet">'+(has?'เปลี่ยน PIN':'ตั้ง PIN')+'</button>'+
    (has?'<p class="g-foot">เมื่อเปลี่ยน PIN ทุกเครื่องที่เข้าด้วย PIN เดิมจะถูกออกจากระบบ ต้องใส่ PIN ใหม่</p><button class="g-btn g-sec" id="mOff">ปิดการเข้าด้วย PIN</button>':'')+
    (msg?'<p class="'+(ok?'g-msg':'g-err')+'">'+esc(msg)+'</p>':''));
  $('#mClose').onclick=()=>{gate.hidden=true};
  ['mOld','mNew'].forEach(id=>{const el=$('#'+id);if(el){el.type='tel';el.oninput=()=>digits(el)}});
  $('#mSet').onclick=async()=>{const np=digits($('#mNew'));if(np.length!==6)return manageUsers('PIN ต้องเป็นตัวเลข 6 หลัก');
    $('#mSet').disabled=true;$('#mSet').textContent='กำลังบันทึก…';
    let r=await sb2.auth.signInWithPassword({email:TEAM,password:pinPass(has?digits($('#mOld')):np)});
    if(r.error&&has)return manageUsers('PIN ปัจจุบันไม่ถูกต้อง');
    if(r.error){const su=await sb2.auth.signUp({email:TEAM,password:pinPass(np)});
      if(su.error)return manageUsers(/registered|exists/i.test(su.error.message)?'เคยตั้ง PIN ไว้แล้ว ใส่ PIN เดิมเพื่อเปลี่ยน':'ตั้งไม่สำเร็จ: '+su.error.message);
      if(!su.data.session)return manageUsers('ต้องปิด Confirm email ใน Supabase ก่อน (Authentication > Sign In / Providers > Email)')}
    else{const u=await sb2.auth.updateUser({password:pinPass(np)});
      if(u.error&&!/same|different/i.test(u.error.message))return manageUsers('เปลี่ยนไม่สำเร็จ: '+u.error.message);
      await sb2.auth.signOut({scope:'others'}).catch(()=>{})}
    await sb2.auth.signOut({scope:'local'}).catch(()=>{});
    const {error:e2}=await sb.from('members').upsert({email:TEAM,name:'ทีมงาน',role:'tech'});
    if(e2)return manageUsers('บันทึกสิทธิ์ไม่สำเร็จ: '+e2.message+' (ต้องรันไฟล์ supabase-pin.sql ก่อน)');
    manageUsers((has?'เปลี่ยน':'ตั้ง')+' PIN เป็น '+np+' แล้ว แจ้งทีมได้เลย',true)};
  const off=$('#mOff');if(off)off.onclick=async()=>{if(!confirm('ปิดการเข้าด้วย PIN? ทุกคนที่ใช้ PIN จะเข้าไม่ได้จนกว่าจะตั้งใหม่'))return;
    const {error}=await sb.from('members').delete().eq('email',TEAM);manageUsers(error?'ไม่สำเร็จ: '+error.message:'ปิดแล้ว',!error)};
}
sb.auth.onAuthStateChange((ev,s)=>{if(ev==='SIGNED_IN'&&s&&!session)admit(s)});
sb.auth.getSession().then(({data})=>{if(data&&data.session){if(!session)admit(data.session)}else loginForm('')});

/* ---------- db ---------- */
const LS='qc.sb.cache';
const genId=()=>{const a='0123456789abcdefghijklmnopqrstuvwxyz',r=crypto.getRandomValues(new Uint8Array(20));let s='';r.forEach(x=>s+=a[x%36]);return s};
const snap=(rows,fromCache)=>({docs:rows.map(r=>({id:r.id,data:()=>r.data})),metadata:{fromCache}});
const ls=new Set();let rt=false,tmr=null;
const wrap=e=>{const x=new Error(e.message||'error');x.code=e.code==='42501'?'permission_denied':(e.code||'error');return x};
async function refetch(){
  const {data,error}=await sb.from('inspections').select('id,data').order('updated_at',{ascending:false}).limit(1000);
  if(error){if(navigator.onLine)ls.forEach(l=>l.err&&l.err(wrap(error)));return}
  try{localStorage.setItem(LS,JSON.stringify(data))}catch(e){}
  ls.forEach(l=>l.cb(snap(data,false)));
}
const soon=()=>{clearTimeout(tmr);tmr=setTimeout(refetch,400)};
function startRT(){
  sb.channel('qc-inspections').on('postgres_changes',{event:'*',schema:'public',table:'inspections'},soon).subscribe();
  setInterval(()=>{if(document.visibilityState==='visible')refetch()},60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')soon()});
  window.addEventListener('online',soon);
}
const db={
  collection(){const q={orderBy:()=>q,limit:()=>q,doc:()=>({id:genId()}),
    onSnapshot(cb,err){const l={cb,err};ls.add(l);
      let c=null;try{c=JSON.parse(localStorage.getItem(LS)||'null')}catch(e){}
      if(c&&c.length)setTimeout(()=>cb(snap(c,true)),0);
      refetch();if(!rt){rt=true;startRT()}return()=>ls.delete(l)}};return q},
  doc(path){const id=path.split('/').pop();return{
    async set(body){const {error}=await sb.from('inspections').upsert({id,data:body,updated_at:body.updatedAt||Date.now(),updated_by:session&&session.user.id});if(error)throw wrap(error);soon()},
    async delete(){const {error}=await sb.from('inspections').delete().eq('id',id);if(error)throw wrap(error);soon()}}}
};
/* ---------- photos ---------- */
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
async function put(id,blob,type){
  const {error}=await sb.storage.from('photos').upload(id,blob,{contentType:type||blob.type||'image/jpeg',cacheControl:'31536000',upsert:false});
  if(error&&!/exist|duplicate/i.test(error.message||'')&&String(error.statusCode)!=='409')throw wrap(error);
  return {id};
}
const assets={upload:(blob,o)=>put(hex(),blob,o&&o.type),put};
/* ---------- downloads ---------- */
const downloads={async save({filename,data}){
  const b=data instanceof Blob?data:new Blob([data],{type:'text/plain;charset=utf-8'});
  const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}};
const user={id:async()=>session?session.user.id:null};
const caps={db,assets,downloads,user};
window.claude={use:async n=>{await ready;return caps[n]||null}};
})();
