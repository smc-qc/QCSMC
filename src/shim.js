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

const PIN=(id,ac)=>'<input id="'+id+'" class="g-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="'+ac+'" placeholder="••••••">';
function loginForm(email,sent,msg,mode){
  mode=mode||'pw';
  const tabs='<div class="g-tabs"><button data-m="pw" class="'+(mode==='pw'?'on':'')+'">เข้าสู่ระบบ</button><button data-m="new" class="'+(mode==='new'?'on':'')+'">ตั้ง PIN ครั้งแรก</button></div>';
  let body='<label class="g-l" for="gEmail">อีเมล</label><input id="gEmail" type="email" inputmode="email" autocomplete="email" value="'+esc(email||'')+'" placeholder="name@example.com">';
  if(mode==='pw')body+='<label class="g-l" for="gPw">PIN 6 หลัก</label>'+PIN('gPw','current-password')+'<button class="g-btn" id="gGo">เข้าสู่ระบบ</button><button class="g-link" id="gLinkMode">ลืม PIN / เข้าด้วยลิงก์ทางอีเมล</button>';
  else if(mode==='new')body+='<label class="g-l" for="gPw">ตั้ง PIN 6 หลัก</label>'+PIN('gPw','new-password')+'<label class="g-l" for="gPw2">ใส่ PIN อีกครั้ง</label>'+PIN('gPw2','new-password')+'<button class="g-btn" id="gGo">ตั้ง PIN และเข้าใช้</button>';
  else body+='<button class="g-btn" id="gSend">'+(sent?'ส่งอีกครั้ง':'ส่งลิงก์เข้าใช้ไปที่อีเมล')+'</button>'+
    (sent?'<p class="g-msg">ส่งอีเมลแล้ว เปิดอีเมลแล้วกดลิงก์ หรือกรอกรหัสจากอีเมลด้านล่าง</p><label class="g-l" for="gCode">รหัสจากอีเมล</label><input id="gCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"><button class="g-btn" id="gVerify">เข้าใช้</button>':'')+
    '<button class="g-link" id="gPwMode">กลับไปเข้าด้วย PIN</button>';
  showGate((mode==='link'?'':tabs)+body+(msg?'<p class="g-err">'+esc(msg)+'</p>':'')+'<p class="g-foot">ใช้ได้เฉพาะอีเมลที่ผู้ตรวจเพิ่มสิทธิ์ไว้แล้ว</p>');
  const em=$('#gEmail'),E=()=>em.value.trim(),okE=e=>/^\S+@\S+\.\S+$/.test(e);
  const remember=e=>{try{localStorage.setItem('qc.lastEmail',e)}catch(_){}};
  gate.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>loginForm(E(),false,'',b.dataset.m));
  const lm=$('#gLinkMode');if(lm)lm.onclick=()=>loginForm(E(),false,'','link');
  const pm=$('#gPwMode');if(pm)pm.onclick=()=>loginForm(E(),false,'','pw');
  const go=$('#gGo'),pw=$('#gPw');
  if(pw)pw.oninput=()=>{pw.value=pw.value.replace(/\D/g,'').slice(0,6);if(mode==='pw'&&pw.value.length===6)go.click()};
  {const p2=$('#gPw2');if(p2)p2.oninput=()=>{p2.value=p2.value.replace(/\D/g,'').slice(0,6)}}
  if(go)go.onclick=async()=>{const e=E(),p=pw.value;if(!okE(e))return loginForm(e,false,'กรอกอีเมลให้ถูกต้อง',mode);
    if(!/^\d{6}$/.test(p))return loginForm(e,false,'PIN ต้องเป็นตัวเลข 6 หลัก',mode);
    if(mode==='new'&&p!==$('#gPw2').value)return loginForm(e,false,'PIN สองช่องไม่ตรงกัน',mode);
    go.disabled=true;go.textContent='กำลังตรวจ…';remember(e);
    if(mode==='pw'){const {error}=await sb.auth.signInWithPassword({email:e,password:p});
      if(error)loginForm(e,false,/confirm/i.test(error.message)?'อีเมลนี้ยังไม่ได้ยืนยัน เปิดอีเมลแล้วกดลิงก์ยืนยันก่อน':'อีเมลหรือ PIN ไม่ถูกต้อง','pw')}
    else{const {data,error}=await sb.auth.signUp({email:e,password:p,options:{emailRedirectTo:location.origin+location.pathname}});
      if(error)loginForm(e,false,/registered|exists/i.test(error.message)?'อีเมลนี้ตั้ง PIN ไว้แล้ว ไปที่ "เข้าสู่ระบบ" หรือกด "ลืม PIN"':('สร้างไม่สำเร็จ: '+error.message),'new');
      else if(!data.session)loginForm(e,false,'สร้างแล้ว ระบบส่งอีเมลยืนยันไปให้ กดลิงก์ในอีเมลครั้งเดียว แล้วกลับมาเข้าสู่ระบบ','pw')}};
  const sd=$('#gSend');if(sd)sd.onclick=async()=>{const e=E();if(!okE(e))return loginForm(e,sent,'กรอกอีเมลให้ถูกต้อง','link');
    sd.disabled=true;sd.textContent='กำลังส่ง…';remember(e);
    const {error}=await sb.auth.signInWithOtp({email:e,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
    loginForm(e,!error,error?('ส่งไม่สำเร็จ: '+(error.message||error.status)):'','link')};
  const vb=$('#gVerify');if(vb)vb.onclick=async()=>{const t=$('#gCode').value.replace(/\s/g,'');if(!t)return;vb.disabled=true;vb.textContent='กำลังตรวจ…';
    const {error}=await sb.auth.verifyOtp({email:E(),token:t,type:'email'});
    if(error)loginForm(E(),true,'รหัสไม่ถูกต้องหรือหมดอายุ ลองส่งใหม่','link')};
}
async function admit(s){
  session=s;
  const email=(s.user.email||'').toLowerCase();
  const {data,error}=await sb.from('members').select('email,name,role').limit(1).maybeSingle();
  if(error&&!data){ // offline or transient: let the app run from cache
    if(!navigator.onLine){window.QC_USER=email;gate.hidden=true;resolveReady();return}
    showGate('<p class="g-err">ตรวจสอบสิทธิ์ไม่สำเร็จ ('+esc(error.message)+')</p><button class="g-btn" onclick="location.reload()">ลองใหม่</button>');return}
  if(!data){showGate('<p class="g-msg">อีเมล <b>'+esc(email)+'</b> ยังไม่ได้รับสิทธิ์เข้าใช้ แจ้งผู้ตรวจให้เพิ่มอีเมลนี้ แล้วกดลองใหม่</p><button class="g-btn" onclick="location.reload()">ลองใหม่</button><button class="g-btn g-sec" id="gOut">ใช้อีเมลอื่น</button>');$('#gOut').onclick=window.QC_LOGOUT;return}
  window.QC_USER=(data.name?data.name+' · ':'')+email;window.QC_ROLE=data.role||'tech';
  gate.hidden=true;resolveReady();
}
sb.auth.onAuthStateChange((ev,s)=>{if(ev==='SIGNED_IN'&&s&&!session)admit(s)});
sb.auth.getSession().then(({data})=>{if(data&&data.session){if(!session)admit(data.session)}else loginForm((()=>{try{return localStorage.getItem('qc.lastEmail')}catch(e){return ''}})(),false,'')});

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
