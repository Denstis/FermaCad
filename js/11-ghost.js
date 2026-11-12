/* ==================== GHOSTS: tool preview, guides, live dims, coordinate badge ==================== */
'use strict';
function ghostSphere(p,r,color=0x6fd3ff,op=.4){const m=new THREE.Mesh(unitSphere,new THREE.MeshBasicMaterial({color:linColor(color),transparent:true,opacity:op,depthWrite:false}));
 m.position.copy(p);m.scale.setScalar(r);m.renderOrder=8;m.userData.ownMat=true;return m}
function ghostCyl(a,b,r,color,op=.32){const m=new THREE.Mesh(unitCyl,new THREE.MeshBasicMaterial({color:linColor(color),transparent:true,opacity:op,depthWrite:false}));
 setCyl(m,a,b,r);m.renderOrder=8;m.userData.ownMat=true;return m}
function drawGuides3D(s){if(!s)return;const z=s.workZ||0;const R=4500;
 if(s.gx!==null&&s.gx!==undefined)gGhost.add(lines([V3(s.gx,s.p.y-R,z),V3(s.gx,s.p.y+R,z)],0xff5fd2,.8,true,true,true));
 if(s.gy!==null&&s.gy!==undefined)gGhost.add(lines([V3(s.p.x-R,s.gy,z),V3(s.p.x+R,s.gy,z)],0xff5fd2,.8,true,true,true))}
function drawGuidesPlan(s){if(!s)return;const E=40000;const P=(a,b)=>pl.o.clone().addScaledVector(pl.u,a).addScaledVector(pl.v,b);
 if(s.gx!==null&&s.gx!==undefined)gGhost.add(lines([P(s.gx,-E),P(s.gx,E)],0xff5fd2,.7,true,true,true));
 if(s.gy!==null&&s.gy!==undefined)gGhost.add(lines([P(-E,s.gy),P(E,s.gy)],0xff5fd2,.7,true,true,true))}
function buildWorkGrid(){clearGroup(gWork);if(!chain.a||mode!=='3d')return;const p=chain.a.p;const g=params.grid;const R=g*10;const pts=[];
 for(let x=Math.ceil((p.x-R)/g)*g;x<=p.x+R;x+=g)pts.push(V3(x,p.y-R,p.z),V3(x,p.y+R,p.z));
 for(let y=Math.ceil((p.y-R)/g)*g;y<=p.y+R;y+=g)pts.push(V3(p.x-R,y,p.z),V3(p.x+R,y,p.z));
 gWork.add(lines(pts,0x4da6ff,.18))}
function clearGhost(){clearGroup(gGhost)}
/* ---- per-tool ghost handlers: each returns {snap,extra} for the badge ---- */
function ghostPaste(cx,cy){const snap=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,0,false);let extra='';
 if(snap){const c=V3();paste.nodes.forEach(n=>c.add(V3(...n.p)));c.divideScalar(paste.nodes.length);
  const ids=paste.nodes.map(n=>snap.p.clone().add(V3(...n.p)));
  paste.nodes.forEach((n,i)=>gGhost.add(ghostSphere(ids[i],params.nodeR,n.type==='support'?0xffb020:0x6fd3ff)));
  paste.rods.forEach(r=>gGhost.add(ghostCyl(ids[r.a],ids[r.b],25,TYPES[r.type].color,.45)));
  extra='ВСТАВКА • клик — разместить'}
 return{snap,extra}}
function ghostSupport(cx,cy){const snap=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,0,false);
 if(snap&&(mode==='3d'||planCtx.kind==='xy')){const p=snap.p;
  gGhost.add(ghostSphere(p,params.nodeR,0xffb020,.5));
  const cone=new THREE.Mesh(unitCone,new THREE.MeshBasicMaterial({color:linColor(0xffb020),transparent:true,opacity:.3,depthWrite:false}));
  cone.quaternion.setFromUnitVectors(YUP,AZ);const h=params.nodeR*2.6;cone.scale.set(params.nodeR*2.1,h,params.nodeR*2.1);
  cone.position.copy(p).add(V3(0,0,-h/2-params.nodeR*.4));cone.userData.ownMat=true;gGhost.add(cone);
  if(mode==='plan'){drawGuidesPlan(snap);liveSupDims(snap)}else drawGuides3D(snap)}
 return{snap,extra:''}}
function ghostNode(cx,cy){let snap=null,extra='';
 if(mode==='plan'&&planCtx.kind==='rod'){snap=snapPlan(cx,cy);
  if(snap){gGhost.add(ghostSphere(snap.p,params.nodeR,0x6fd3ff,.55));
   const r=M.rods.get(planCtx.rodId);const L=rodLen(r);
   extra=`от начала ${fmt(snap.a)} мм • до конца ${fmt(L-snap.a)} мм`+(snap.frac?` • доля L/${Math.round(1/snap.frac)}`:'');
   const wH=clamp(15/pl.zoom,200,1300);
   dimLine(gGhost,0,snap.a,-650,'x',wH,0x6fd3ff);dimLine(gGhost,snap.a,L,650,'x',wH,0xffb020)}}
 else{snap=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,0,true);
  if(snap){gGhost.add(ghostSphere(snap.p,params.nodeR,0x6fd3ff,.55));mode==='plan'?drawGuidesPlan(snap):drawGuides3D(snap);
   if(snap.type==='rod')extra=`на стержне ${snap.rod.name} • ${fmt(snap.t*rodLen(snap.rod))} мм от начала`}}
 return{snap,extra}}
function ghostColumnPost(cx,cy){let extra='';
 if(tool==='column'){
  const plan=(mode==='plan');
  const hit=pickAt(cx,cy,plan?{kinds:['node']}:{kinds:['node','rod','plane']});
  let p=null;
  if(hit&&hit.kind==='node')p=M.nodes.get(hit.id).p.clone();
  else if(hit&&hit.kind==='rod'){const r=M.rods.get(hit.id);const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p,ab=b.clone().sub(a);const L2=ab.lengthSq();if(L2>1){const t=clamp(ab.dot(hit.point.clone().sub(a))/L2,0,1);p=a.clone().addScaledVector(ab,t)}}
  else if(hit&&hit.kind==='plane')p=hit.point.clone();
  else{const s=plan?snapPlan(cx,cy):snap3D(cx,cy,0,false);if(s)p=s.p.clone()}
  if(p){const top=p.clone().add(V3(0,0,params.colH));
   gGhost.add(ghostCyl(p,top,TYPES.column.r*params.rodScale,TYPES.column.color,.35));
   gGhost.add(ghostSphere(p,params.nodeR,TYPES.column.color,.5));gGhost.add(ghostSphere(top,params.nodeR,TYPES.column.color,.5));
   const lbl=labelSprite('h = '+fmt(params.colH),{worldH:mode==='plan'?clamp(15/pl.zoom,200,1300):ctrl.r*.02,border:'#6b2438',color:'#ff9db0'});
   lbl.position.copy(p).lerp(top,.5).add(V3(300,0,0));if(mode==='3d')lbl.userData.autoScale=true;gGhost.add(lbl);
   extra=`СТОЛБ • вертикаль +Z • ${fmt(params.colH)} мм`}
  return{snap:null,extra}}
 const hit=pickAt(cx,cy,{kinds:['node']});
 if(hit){const n=M.nodes.get(hit.id);
  const t=postTarget(n);
  if(t){const p=V3(n.p.x,n.p.y,t.z);gGhost.add(ghostCyl(n.p,p,TYPES.post.r*params.rodScale,TYPES.post.color,.4));
   gGhost.add(ghostSphere(p,params.nodeR,TYPES.post.color,.55));extra=`СТОЙКА → ${t.rod.name} • z=${fmt(t.z)} мм`}
  else{gGhost.add(lines([n.p,n.p.clone().add(V3(0,0,params.colH))],0xff5470,.6,true,true,true));extra='НЕТ ПЕРЕСЕЧЕНИЯ СО СТЕРЖНЕМ ВЫШЕ'}}
 else extra='КЛИКНИТЕ ПО УЗЛУ';
 return{snap:null,extra}}
function ghostRodTool(cx,cy){const snap=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,chain.a?chain.a.p.z:0,true);let extra='';
 if(snap){gGhost.add(ghostSphere(snap.p,params.nodeR*.9,TYPES[tool].color,.5));
  if(chain.a){const a=chain.a.p;gGhost.add(lines([a,snap.p],TYPES[tool].color,.95,true,true,true));
   const L=a.distanceTo(snap.p);const wH=mode==='plan'?clamp(15/pl.zoom,200,1300):Math.max(ctrl.r*.018,250);
   const lbl=labelSprite(fmt(L)+' мм',{worldH:wH,border:'#1e5a7a',color:'#aee4ff'});
   lbl.position.copy(a).lerp(snap.p,.5).add(V3(0,0,wH));if(mode==='3d')lbl.userData.autoScale=true;gGhost.add(lbl);
   extra=`${TYPES[tool].label}: ${chain.a.name} → … • Esc — отмена`}
  else extra=`${TYPES[tool].label}: кликните первый узел`;
  mode==='plan'?drawGuidesPlan(snap):drawGuides3D(snap)}
 return{snap,extra}}
function ghostMeasure(cx,cy){const snap=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,measPick?measPick.z:0,true);let extra='';
 if(snap&&measPick){gGhost.add(lines([measPick,snap.p],0xffc53d,.9,true,true,true));
  const lbl=labelSprite(fmt(measPick.distanceTo(snap.p))+' мм',{worldH:mode==='plan'?clamp(15/pl.zoom,200,1300):Math.max(ctrl.r*.018,250),border:'#8a6a20',color:'#ffe2a0'});
  lbl.position.copy(measPick).lerp(snap.p,.5);if(mode==='3d')lbl.userData.autoScale=true;gGhost.add(lbl);extra='Вторая точка размера'}
 return{snap,extra}}
function ghostPlane(cx,cy){planePick.forEach(id=>{const n=M.nodes.get(id);if(n)gGhost.add(ghostSphere(n.p,params.nodeR*1.6,0x6fd3ff,.35))});
 if(planePick.length===2){const a=M.nodes.get(planePick[0]),b=M.nodes.get(planePick[1]);if(a&&b)gGhost.add(lines([a.p,b.p],0x6fd3ff,.8,true,true,true))}
 return{snap:null,extra:`Выберите узел ${planePick.length+1} из 3`}}
function ghostSelectHint(cx,cy){let extra='';
 if(tool==='select'&&hover.kind){const h=hover;
  if(h.kind==='node'){const n=M.nodes.get(h.id);extra=`${n.name} • ${n.type==='support'?'ОПОРА':'УЗЕЛ'}${n.host?' • на '+M.rods.get(n.host.rod)?.name:''}`}
  else if(h.kind==='rod'){const r=M.rods.get(h.id);extra=`${r.name} • ${TYPES[r.type].label} • L=${fmt(rodLen(r))} мм • 2×клик — чертёж`}
  else if(h.kind==='plane'){extra=M.planes.get(h.id)?.name+' • 2×клик — чертёж плоскости'}}
 return{snap:null,extra}}
const GHOST_HANDLERS={support:ghostSupport,node:ghostNode,column:ghostColumnPost,post:ghostColumnPost,measure:ghostMeasure,plane:ghostPlane};
function updateGhost(cx,cy){clearGhost();
 const r=paste?ghostPaste(cx,cy):tool==='column'?ghostColumnPost(cx,cy):ROD_KEYS.includes(tool)?ghostRodTool(cx,cy):(GHOST_HANDLERS[tool]||ghostSelectHint)(cx,cy);
 setBadge(cx,cy,r.snap,r.extra)}
function liveSupDims(snap){const sup=nodeArr().filter(n=>n.type==='support');const wH=clamp(15/pl.zoom,200,1300);
 let bx=null,bxd=1e9,by=null,byd=1e9;
 sup.forEach(n=>{if(Math.abs(n.p.y-snap.p.y)<1&&Math.abs(n.p.x-snap.p.x)>1){const d=Math.abs(n.p.x-snap.p.x);if(d<bxd){bxd=d;bx=n}}
  if(Math.abs(n.p.x-snap.p.x)<1&&Math.abs(n.p.y-snap.p.y)>1){const d=Math.abs(n.p.y-snap.p.y);if(d<byd){byd=d;by=n}}});
 if(bx)dimLine(gGhost,Math.min(bx.p.x,snap.p.x),Math.max(bx.p.x,snap.p.x),snap.p.y-700,'x',wH,0x3ddc97);
 if(by)dimLine(gGhost,Math.min(by.p.y,snap.p.y),Math.max(by.p.y,snap.p.y),snap.p.x-700,'y',wH,0x3ddc97)}
function setBadge(cx,cy,snap,extra){const b=$('#badge');const r=$('#vp').getBoundingClientRect();
 let coord='';
 if(snap){const p=snap.p;coord=mode==='plan'&&planCtx.kind==='rod'?`${fmt(snap.a)} мм по оси`:`${fmt(p.x)}; ${fmt(p.y)}; ${fmt(p.z)}`}
 const snapTxt=snap?(SNAP_RU[snap.type]||''):'';
 $('#stCoords').textContent=snap?`${fmt(snap.p.x)}; ${fmt(snap.p.y)}; ${fmt(snap.p.z)}`:'—';
 $('#stSnap').textContent=snapTxt;
 if(!coord&&!extra){b.style.display='none';return}
 b.innerHTML=(coord?`<div>${coord}</div>`:'')+(extra||snapTxt?`<div class="b2">${esc(extra||'')}${extra&&snapTxt?' • '+snapTxt:esc(snapTxt)}</div>`:'');
 b.style.display='block';
 const x=clamp(cx-r.left+18,4,vpW-290),y=clamp(cy-r.top+18,4,vpH-70);
 b.style.left=x+'px';b.style.top=y+'px'}
