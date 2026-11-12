/* ==================== NAV CUBE ==================== */
'use strict';
/* ================= NAV CUBE ================= */
function bindCube(){const cv=$('#cubeCanvas');const cr=new THREE.Raycaster();let hoverIdx=-1;
 const nd=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*2-1,y:-((e.clientY-r.top)/r.height)*2+1}};
 const faceIdx=n=>{const ax=Math.abs(n.x)>Math.abs(n.y)?(Math.abs(n.x)>Math.abs(n.z)?0:2):(Math.abs(n.y)>Math.abs(n.z)?1:2);
  return ax===0?(n.x>0?0:1):ax===1?(n.y>0?2:3):(n.z>0?4:5)};
 cv.addEventListener('pointermove',e=>{cr.setFromCamera(nd(e),cubeCam);const h=cr.intersectObject(cubeMesh,false)[0];
  const idx=h?faceIdx(h.face.normal):-1;
  if(idx!==hoverIdx){cubeMats.forEach((m,i)=>m.color.set(i===idx?0xbfe0ff:0xffffff));hoverIdx=idx;
   cv.style.cursor=h?'pointer':'default'}});
 cv.addEventListener('pointerleave',()=>{cubeMats.forEach(m=>m.color.set(0xffffff));hoverIdx=-1});
 cv.addEventListener('pointerdown',e=>{cr.setFromCamera(nd(e),cubeCam);const h=cr.intersectObject(cubeMesh,false)[0];if(!h)return;
  const lp=cubeMesh.worldToLocal(h.point.clone());const d=V3();
  if(Math.abs(lp.x)>.42)d.x=Math.sign(lp.x);if(Math.abs(lp.y)>.42)d.y=Math.sign(lp.y);if(Math.abs(lp.z)>.42)d.z=Math.sign(lp.z);
  if(!d.length()){const n=h.face.normal;d.copy(n)}
  setViewDir(d)})}
