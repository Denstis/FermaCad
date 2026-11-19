/* ==================== FULL MODEL: профили тел + красные контуры сварных швов ==================== */
'use strict';
let fullModelOn=false;
const WELD_HEX=0xff3b30;
function fN(u){const l=Math.hypot(u[0],u[1],u[2]);return l>1e-9?[u[0]/l,u[1]/l,u[2]/l]:null}
function fullSegs(){const out=[];
 M.rods.forEach(r=>{const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return;
  const hn=hostedNodes(r.id);
  const pts=[a.p,...hn.map(n=>n.p),b.p];
  const ids=[r.a,...hn.map(n=>n.id),r.b];
  for(let i=0;i<pts.length-1;i++){const L=pts[i].distanceTo(pts[i+1]);if(L<10)continue;
   out.push({r,p0:pts[i],p1:pts[i+1],L,na:ids[i],nb:ids[i+1]})}});
 return out}
/* 2D контуры сечения в осях (x=b_mm, y=h_mm) */
function secContours(s){const b=s.b_mm||60,h=s.h_mm||60,t=s.t_mm||4;
 if(s.kind==='shs'||s.kind==='rhs'){const o=[[-b/2,-h/2],[b/2,-h/2],[b/2,h/2],[-b/2,h/2]];
  const w=Math.max(b-2*t,1)/2,q=Math.max(h-2*t,1)/2;
  return[o,[[-w,-q],[w,-q],[w,q],[-w,q]]]}
 if(s.kind==='ih'){const W=b/2,H=h/2,tf=Math.min(Math.max(t*1.2,3),H*.4),w2=Math.max(t,2)/2;
  return[[[-W,-H],[W,-H],[W,-H+tf],[w2,-H+tf],[w2,H-tf],[W,H-tf],[W,H],[-W,H],[-W,H-tf],[-w2,H-tf],[-w2,-H+tf],[-W,-H+tf]]]}
 /* channel: полка в +x */
 const W=b/2,H=h/2,t2=Math.max(t,2);
 return[[[-W,-H],[W,-H],[W,-H+t2],[-W+t2,-H+t2],[-W+t2,H-t2],[W,H-t2],[W,H],[-W,H]]]}
function weldLine(pts3){const g=new THREE.BufferGeometry().setFromPoints(pts3.map(p=>V3(p[0],p[1],p[2])));
 const m=new THREE.LineBasicMaterial({color:WELD_HEX,transparent:true,opacity:.95,depthTest:true});
 const l=new THREE.LineLoop(g,m);l.renderOrder=3;return l}
/* классификация конца сегмента для сварных контуров: обёртка над единым ядром
   cutCore (js/28-calc.js) — с v53 раскрой и 3D-призмы считаются одной логикой.
   Возвращает полный результат ядра: kind 'pass'|'main'|'flat'|'free'|'T'|'nest'|'miter',
   e — вынос, weld — рисовать кольцо (чужой соосный стык встык), n/c2/al — геометрия. */
function endInfo(S,X,v,nid,segAt){
 const inc=(segAt.get(nid)||[]).filter(s=>s.seg!==S)
  .map(s=>({name:s.seg.r.name,id:s.seg.r.id,d:s.d,sec:rodSec(s.seg.r)}));
 const nd=M.nodes.get(nid);
 return cutCore({v,L:S.L,sec:rodSec(S.r),selfId:S.r.id,isSupport:!!nd&&nd.type==='support',inc});
}
function buildFullModel(){
 if(window._gFull){clearGroup(window._gFull)}
 if(window._gWeld){clearGroup(window._gWeld)}
 if(!window._gFull){window._gFull=new THREE.Group();scene.add(window._gFull)}
 if(!window._gWeld){window._gWeld=new THREE.Group();scene.add(window._gWeld)}
 window._gFull.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});
 window._gWeld.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});
 window._gFull.clear();window._gWeld.clear();
 if(!fullModelOn)return;
 const segs=fullSegs(),segAt=new Map();
 segs.forEach(s=>{[[s.na,s.p0,s.p1],[s.nb,s.p1,s.p0]].forEach(([nid,X,oth])=>{
   const d=fN([X.x-oth.x,X.y-oth.y,X.z-oth.z]);if(!d)return;
   const a=segAt.get(nid)||[];a.push({seg:s,d});segAt.set(nid,a)})});
 /* ЕДИНАЯ геометрия: 3D-сцена = модель со всеми запилами (32-meshexport.cutModelParts),
    miter по биссектрисе / T-подрез / вложение — реальными плоскостями реза.
    Fallback (модуль не подключён) — призма от узла до узла с обрезкой T/nest. */
 const parts=(typeof cutModelParts==='function')?cutModelParts():null;
 const unified=parts&&parts.length===segs.length;
 for(let i=0;i<segs.length;i++){
  const S=segs[i];
  const s=rodSec(S.r);
  const vA=fN([S.p0.x-S.p1.x,S.p0.y-S.p1.y,S.p0.z-S.p1.z]),vB=fN([S.p1.x-S.p0.x,S.p1.y-S.p0.y,S.p1.z-S.p0.z]);
  const EA=endInfo(S,S.p0,vA,S.na,segAt),EB=endInfo(S,S.p1,vB,S.nb,segAt);
  let pos,capA=null,capB=null;
  if(unified){pos=parts[i].tris;capA=parts[i].capA;capB=parts[i].capB}
  else{
   const trimA=(EA.kind==='T'||EA.kind==='nest')?Math.min(EA.e||0,S.L*0.45):0;
   const trimB=(EB.kind==='T'||EB.kind==='nest')?Math.min(EB.e||0,S.L*0.45):0;
   let e2=fN([-vB[1],vB[0],0]);if(!e2)e2=[1,0,0];
   const e3=fN([vB[1]*e2[2]-vB[2]*e2[1],vB[2]*e2[0]-vB[0]*e2[2],vB[0]*e2[1]-vB[1]*e2[0]]);
   const rhs=s.kind==='rhs';
   const depth=S.L-trimA-trimB;
   const all=rhs?secContours(s).map(ct=>ct.map(([x,y])=>[y,x])):secContours(s);
   const top=all.map(ct=>ct.map(([x,y])=>[x,y,depth]));
   const bot=all.map(ct=>ct.map(([x,y])=>[x,y,0]));
   const p2=[];
   const tri2=(a,b,c)=>p2.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
   all.forEach((ct,ci)=>{
    for(let j=0;j<ct.length;j++){const k=(j+1)%ct.length;
     const b0=bot[ci][j],b1=bot[ci][k],t0=top[ci][j],t1=top[ci][k];
     if(ci){tri2(b0,t1,b1);tri2(b0,t0,t1)}else{tri2(b0,b1,t1);tri2(b0,t1,t0)}}});
   const flat=all.map(ct=>ct.map(([x,y])=>new THREE.Vector2(x,y)));
   const idx=THREE.ShapeUtils.triangulateShape(flat[0],flat.slice(1));
   const ptsAll=[].concat.apply([],top),ptsBot=[].concat.apply([],bot);
   idx.forEach(t3=>{tri2(ptsAll[t3[0]],ptsAll[t3[1]],ptsAll[t3[2]]);
                   tri2(ptsBot[t3[0]],ptsBot[t3[2]],ptsBot[t3[1]])});
   pos=p2}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:linColor(TYPES[S.r.type].color),metalness:.32,roughness:.5,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.castShadow=params.shadows;mesh.receiveShadow=false;
  mesh.userData={rn:S.r.name,kind:s.kind,b:s.b_mm,h:s.h_mm};
  if(!unified){
   /* локальные координаты призмы (0..depth) + поворот базиса и сдвиг к узлу */
   let e2=fN([-vB[1],vB[0],0]);if(!e2)e2=[1,0,0];
   const e3=fN([vB[1]*e2[2]-vB[2]*e2[1],vB[2]*e2[0]-vB[0]*e2[2],vB[0]*e2[1]-vB[1]*e2[0]]);
   const trimA=(EA.kind==='T'||EA.kind==='nest')?Math.min(EA.e||0,S.L*0.45):0;
   const rot=new THREE.Matrix4().makeBasis(V3(e2[0],e2[1],e2[2]),V3(e3[0],e3[1],e3[2]),V3(vB[0],vB[1],vB[2]));
   mesh.quaternion.setFromRotationMatrix(rot);
   mesh.position.set(S.p0.x+vB[0]*trimA,S.p0.y+vB[1]*trimA,S.p0.z+vB[2]*trimA)}
  window._gFull.add(mesh);
  /* ---- сварные контуры: полные сечения на концах с реальным стыком ---- */
  const mkWeld=(E,v,caps,trim)=>{
   if((E.kind==='pass'&&!E.weld)||E.kind==='main'||E.kind==='free')return;   /* pass+weld — чужой соосный стык: кольцо рисуем */
   const t=trim||0;
   (caps||secContours(s)).forEach(ct=>{
    const pts3=unified?ct.map(q=>[q[0]+v[0]*1.2,q[1]+v[1]*1.2,q[2]+v[2]*1.2])
      :ct.map(([x,y])=>{let e2=fN([-v[1],v[0],0]);if(!e2)e2=[1,0,0];
       const e3=fN([v[1]*e2[2]-v[2]*e2[1],v[2]*e2[0]-v[0]*e2[2],v[0]*e2[1]-v[1]*e2[0]]);
       return[S.p0.x-v[0]*t+x*e2[0]+y*e3[0]+v[0]*1.2,S.p0.y-v[1]*t+x*e2[1]+y*e3[1]+v[1]*1.2,S.p0.z-v[2]*t+x*e2[2]+y*e3[2]+v[2]*1.2]});
    window._gWeld.add(weldLine(pts3))})};
  if(unified){mkWeld(EA,vA,capA,0);mkWeld(EB,vB,capB,0)}
  else{const trimA=(EA.kind==='T'||EA.kind==='nest')?Math.min(EA.e||0,S.L*0.45):0;
   const trimB=(EB.kind==='T'||EB.kind==='nest')?Math.min(EB.e||0,S.L*0.45):0;
   mkWeld(EA,vA,null,trimA);mkWeld(EB,vB,null,trimB)}}
 /* butt-швы между сегментами одного стержня: контуры уже нарисованы с обеих сторон прохода (kind pass пропускает): рисуем отдельно */
 M.rods.forEach(r=>{const ids=hostedNodes(r.id);
  ids.forEach(n=>{const s=rodSec(r);const pts=[M.nodes.get(r.a).p,...ids.map(k=>k.p),M.nodes.get(r.b).p];
   const X=n.p;const ia=pts.findIndex(p=>p.distanceTo(X)<1e-6);
   if(ia<=0||ia>=pts.length-1)return;
   const vB=fN([pts[ia+1].x-pts[ia-1].x,pts[ia+1].y-pts[ia-1].y,pts[ia+1].z-pts[ia-1].z]);if(!vB)return;
   let e2=fN([-vB[1],vB[0],0]);if(!e2)e2=[1,0,0];
   const e3=fN([vB[1]*e2[2]-vB[2]*e2[1],vB[2]*e2[0]-vB[0]*e2[2],vB[0]*e2[1]-vB[1]*e2[0]]);
   const c2s=s.kind==='rhs'?secContours(s).map(ct=>ct.map(([x,y])=>[y,x])):secContours(s);
   c2s.forEach(ct=>{const pts3=ct.map(([x,y])=>[X.x+x*e2[0]+y*e3[0],X.y+x*e2[1]+y*e3[1],X.z+x*e2[2]+y*e3[2]]);
    window._gWeld.add(weldLine(pts3))})})});
 applyFullModel()}
function applyFullModel(){const on=fullModelOn&&mode!=='plan';
 gRods.visible=!on;gNodes.visible=!on;
 if(window._gFull)window._gFull.visible=on;
 if(window._gWeld)window._gWeld.visible=on}
function setFullModel(on,quiet){fullModelOn=!!on;
 localStorage.setItem('fc.full',fullModelOn?'1':'');
 const b=$('#btnFull');if(b)b.classList.toggle('on',fullModelOn);
 if(fullModelOn&&mode==='plan'&&window.exitPlan)exitPlan();
 if(fullModelOn)buildFullModel();else{if(window._gFull)window._gFull.clear();if(window._gWeld)window._gWeld.clear()}
 applyFullModel();
 if(!quiet)toast(fullModelOn?'Полная модель из профилей • красным — сварные швы':'Стержневая схема',{type:'ok'})}
window.addEventListener('load',()=>{const b=$('#btnFull');if(b)b.onclick=()=>setFullModel(!fullModelOn);
 if(localStorage.getItem('fc.full')==='1')setFullModel(true,true)});
