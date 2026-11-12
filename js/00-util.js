/* ==================== UTILS: dom, clamp, fmt, esc, debounce, uid, V3, download ==================== */
'use strict';
/* ================= UTILS ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('ru-RU');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const debounce=(f,t)=>{let h;return(...a)=>{clearTimeout(h);h=setTimeout(()=>f(...a),t)}};
let _uid=1;const uid=()=>_uid++;
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const AX=V3(1,0,0),AY=V3(0,1,0),AZ=V3(0,0,1),YUP=V3(0,1,0);
const fmtAxis=n=>Math.abs(n)>=1000&&n%1000===0?(n/1000)+' м':fmt(n);
function download(name,text,mime='application/json'){const b=new Blob([text],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
