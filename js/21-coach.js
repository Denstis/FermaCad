/* ==================== COACH: onboarding checklist ==================== */
'use strict';
/* ================= COACH ================= */
let coachDismissed=false;try{coachDismissed=localStorage.getItem('fc.coach')==='1'}catch(e){}
function coachUpdate(){const el=$('#coach');if(coachDismissed){el.style.display='none';return}
 const st={sup:nodeArr().some(n=>n.type==='support'),close:ever3d,col:[...M.rods.values()].some(r=>r.type==='column'),
  rod:[...M.rods.values()].some(r=>['top','bottom','diag','sdiag'].includes(r.type)),save:savedOnce};
 let all=true;Object.entries(st).forEach(([k,v])=>{const s=el.querySelector(`[data-step="${k}"]`);if(s)s.classList.toggle('done',v);if(!v)all=false});
 el.style.display=all?'none':'block'}
$('#coachHead').addEventListener('click',e=>{if(e.target.closest('#coachClose')){coachDismissed=true;try{localStorage.setItem('fc.coach','1')}catch(x){}coachUpdate();return}
 if(e.target.closest('#coachMin')){$('#coach').classList.toggle('min');return}
 $('#coach').classList.toggle('min')});
$('#coachDemo').onclick=e=>{e.stopPropagation();loadDemo()};
