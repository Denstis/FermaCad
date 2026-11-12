/* ==================== SCENE BUILD: context sets, rebuildScene, selection materials/box, shadow frustum ==================== */
'use strict';
/* Which nodes/rods belong to the current drawing context (full opacity in plan mode) */
function ctxNodeIds(){const s=new Set();
 if(mode!=='plan'){M.nodes.forEach(n=>s.add(n.id));return s}
 if(planCtx.kind==='xy')M.nodes.forEach(n=>{if(Math.abs(n.p.z)<1)s.add(n.id)});
 else if(planCtx.kind==='rod'){const r=M.rods.get(planCtx.rodId);if(r){s.add(r.a);s.add(r.b);hostedNodes(r.id).forEach(n=>s.add(n.id))}}
 else if(planCtx.kind==='plane'){const b=planeBasis(M.planes.get(planCtx.planeId)?.nodes||[]);if(b)M.nodes.forEach(n=>{if(Math.abs(n.p.clone().sub(b.o).dot(b.n))<1)s.add(n.id)})}
 return s}
function ctxRodIds(){const s=new Set();
 if(mode!=='plan'){M.rods.forEach(r=>s.add(r.id));return s}
 const ns=ctxNodeIds();
 if(planCtx.kind==='rod')s.add(planCtx.rodId);
 else M.rods.forEach(r=>{if(ns.has(r.a)&&ns.has(r.b))s.add(r.id)});
 return s}
function nodesAlong(r){const a=M.nodes.get(r.a),b=M.nodes.get(r.b);return[a.p,...hostedNodes(r.id).map(n=>n.p),b.p]}
/* ---- node objects: sphere for nodes, cone+plate for supports, invisible pick sphere ---- */
function buildNodeObjects(cn,now){
 for(const n of M.nodes.values()){const ghost=mode==='plan'&&!cn.has(n.id);
  const g=new THREE.Group();g.position.copy(n.p);g.userData={kind:'node',id:n.id};
  const s=new THREE.Mesh(unitSphere,ghost?matGhostEl:nodeMat(n.type,'base'));
  const base=params.nodeR*(n.type==='support'?.95:1);s.scale.setScalar(base);s.castShadow=!ghost&&params.shadows;g.add(s);
  const parts=[s];
  if(n.type==='support'){const h=params.nodeR*2.6,rad=params.nodeR*2.1;
   const cone=new THREE.Mesh(unitCone,ghost?matGhostEl:nodeMat('support','base'));
   cone.quaternion.setFromUnitVectors(YUP,AZ);cone.scale.set(rad,h,rad);cone.position.z=-h/2-params.nodeR*.4;cone.castShadow=!ghost&&params.shadows;g.add(cone);parts.push(cone);
   const plate=new THREE.Mesh(unitBox,ghost?matGhostEl:nodeMat('support','base'));
   plate.scale.set(rad*2.4,rad*2.4,params.nodeR*.45);plate.position.z=-h-params.nodeR*.6;g.add(plate);parts.push(plate)}
  const pick=new THREE.Mesh(unitSphere,matInvis);pick.scale.setScalar(Math.max(params.nodeR*2.4,180));pick.visible=false;pick.userData={kind:'node',id:n.id};g.add(pick);
  if(M.hidden.has('n'+n.id))g.visible=false;
  if(bornIds.has(n.id)){s.userData.born=now;s.userData.base=base}
  gNodes.add(g);nodeObjs.set(n.id,{g,parts,pick,ghost});pickNodes.push(pick)}
 bornIds.clear()}
/* ---- rod objects: cylinder per segment (split by hosted nodes), invisible pick cylinder ---- */
function buildRodObjects(cr){
 for(const r of M.rods.values()){const ghost=mode==='plan'&&!cr.has(r.id);
  const g=new THREE.Group();g.userData={kind:'rod',id:r.id};const pts=nodesAlong(r);const segs=[];const rad=TYPES[r.type].r*params.rodScale;
  for(let i=0;i<pts.length-1;i++){const m=new THREE.Mesh(unitCyl,ghost?matGhostEl:rodMat(r.type,'base'));setCyl(m,pts[i],pts[i+1],rad);m.castShadow=!ghost&&params.shadows;g.add(m);segs.push(m)}
  const pick=new THREE.Mesh(unitCyl,matInvis);setCyl(pick,pts[0],pts[pts.length-1],Math.max(rad*2.6,100));pick.visible=false;pick.userData={kind:'rod',id:r.id};g.add(pick);
  if(M.hidden.has('r'+r.id))g.visible=false;
  gRods.add(g);rodObjs.set(r.id,{g,segs,pick,ghost});pickRods.push(pick)}}
/* ---- plane objects: padded quad + border + name label ---- */
function buildPlaneObjects(){
 for(const p of M.planes.values()){const b=planeBasis(p.nodes);if(!b)continue;
  let minA=1e9,maxA=-1e9,minB=1e9,maxB=-1e9;
  p.nodes.forEach(id=>{const q=M.nodes.get(id).p.clone().sub(b.o);const a=q.dot(b.u),bb=q.dot(b.v);minA=Math.min(minA,a);maxA=Math.max(maxA,a);minB=Math.min(minB,bb);maxB=Math.max(maxB,bb)});
  const pad=900;minA-=pad;maxA+=pad;minB-=pad;maxB+=pad;
  const c0=b.o.clone().addScaledVector(b.u,minA).addScaledVector(b.v,minB);
  const c1=b.o.clone().addScaledVector(b.u,maxA).addScaledVector(b.v,minB);
  const c2=b.o.clone().addScaledVector(b.u,maxA).addScaledVector(b.v,maxB);
  const c3=b.o.clone().addScaledVector(b.u,minA).addScaledVector(b.v,maxB);
  const geo=new THREE.BufferGeometry().setFromPoints([c0,c1,c2,c0,c2,c3]);geo.computeVertexNormals();
  const inCtx=mode==='plan'&&planCtx.kind==='plane'&&planCtx.planeId===p.id;
  const quad=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:linColor(0x6fd3ff),transparent:true,opacity:inCtx?params.planeOp*1.6:params.planeOp,side:THREE.DoubleSide,depthWrite:false}));
  quad.userData={kind:'plane',id:p.id,own:true,ownMat:true};quad.renderOrder=2;
  const border=lines([c0,c1,c1,c2,c2,c3,c3,c0],0x6fd3ff,inCtx?.9:.4);
  const lbl=labelSprite(p.name,{border:'#2c7ea8',color:'#a8e4ff',worldH:400});lbl.position.copy(c3).addScaledVector(b.v,300);lbl.userData.autoScale=true;
  const g=new THREE.Group();g.add(quad,border,lbl);g.userData={kind:'plane',id:p.id};
  if(M.hidden.has('p'+p.id))g.visible=false;
  gPlanes.add(g);planeObjs.set(p.id,{g,quad,border,lbl});pickPlanes.push(quad)}}
function rebuildScene(){clearGroup(gNodes);clearGroup(gRods);clearGroup(gPlanes);
 nodeObjs.clear();rodObjs.clear();planeObjs.clear();pickNodes=[];pickRods=[];pickPlanes=[];
 const cn=ctxNodeIds(),cr=ctxRodIds();const now=performance.now();
 buildNodeObjects(cn,now);buildRodObjects(cr);buildPlaneObjects();
 scene.updateMatrixWorld(true);
 applySelMats();updateSelBox();rebuildDims();buildMeasures();updateShadowFrustum();shadowsDirty=true}
function refreshNodePos(id){const o=nodeObjs.get(id),n=M.nodes.get(id);if(o&&n)o.g.position.copy(n.p)}
function refreshRodGeom(id){const o=rodObjs.get(id),r=M.rods.get(id);if(!o||!r)return;const pts=nodesAlong(r);const rad=TYPES[r.type].r*params.rodScale;
 for(let i=0;i<o.segs.length&&i<pts.length-1;i++)setCyl(o.segs[i],pts[i],pts[i+1],rad);
 setCyl(o.pick,pts[0],pts[pts.length-1],Math.max(rad*2.6,100))}
function updateShadowFrustum(){const box=new THREE.Box3();let any=false;
 M.nodes.forEach(n=>{box.expandByPoint(n.p);any=true});
 const c=any?box.getCenter(V3()):V3(3000,1500,0);const s=any?Math.max(10000,box.getSize(V3()).length()*.75):14000;
 dirLight.position.copy(c).add(V3(9000,-11000,16000));dirLight.target.position.copy(c);
 const sc=dirLight.shadow.camera;sc.left=-s;sc.right=s;sc.top=s;sc.bottom=-s;sc.near=100;sc.far=80000;sc.updateProjectionMatrix();
 dirLight.castShadow=params.shadows;ground.visible=params.shadows}
function applySelMats(){nodeObjs.forEach((o,id)=>{if(o.ghost)return;const n=M.nodes.get(id);if(!n)return;
  const st=sel.nodes.has(id)?'sel':(hover.kind==='node'&&hover.id===id?'hov':'base');
  o.parts.forEach(p=>p.material=nodeMat(n.type,st))});
 rodObjs.forEach((o,id)=>{if(o.ghost)return;const r=M.rods.get(id);if(!r)return;
  const st=sel.rods.has(id)?'sel':(hover.kind==='rod'&&hover.id===id?'hov':'base');
  o.segs.forEach(s=>s.material=rodMat(r.type,st))});
 planeObjs.forEach((o,id)=>{o.border.material.color=linColor(sel.planes.has(id)?0xffb020:0x6fd3ff)})}
function updateSelBox(){const box=new THREE.Box3();let any=false;
 sel.nodes.forEach(id=>{const n=M.nodes.get(id);if(n){box.expandByPoint(n.p);any=true}});
 sel.rods.forEach(id=>{const r=M.rods.get(id);if(r){box.expandByPoint(M.nodes.get(r.a).p);box.expandByPoint(M.nodes.get(r.b).p);any=true}});
 if(any){box.expandByScalar(250);selBoxH.box.copy(box);selBoxH.visible=mode==='3d'}else selBoxH.visible=false}
