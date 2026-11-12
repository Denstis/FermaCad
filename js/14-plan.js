/* ==================== PLAN MODES: XY / rod / plane drawings, exitPlan, mode UI ==================== */
'use strict';
/* ================= PLAN MODES ================= */
function setPlanBasis(o,u,v,n){pl.o=o.clone();pl.u=u.clone();pl.v=v.clone();pl.n=n.clone()}
function enterPlanXY(){mode='plan';planCtx={kind:'xy'};setPlanBasis(V3(),AX,AY,AZ);
 const sup=nodeArr().filter(n=>n.type==='support');
 if(sup.length){const c=V3();sup.forEach(n=>c.add(n.p));c.divideScalar(sup.length);pl.g.ca=c.x;pl.g.cb=c.y}
 else{pl.g.ca=ctrl.t.x;pl.g.cb=ctrl.t.y}
 pl.ca=pl.g.ca;pl.cb=pl.g.cb;
 scene.fog=null;clearGroup(gWork);chain.a=null;
 if(['column','post','plane'].includes(tool))tool='support';
 setTool(tool);rebuildGrid();afterChange();updateModeUI()}
function enterPlanRod(id){const r=M.rods.get(id);if(!r)return;mode='plan';planCtx={kind:'rod',rodId:id};
 const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;const u=b.clone().sub(a).normalize();
 let v=AZ.clone().addScaledVector(u,-AZ.dot(u));if(v.length()<.01)v=AX.clone().addScaledVector(u,-AX.dot(u));v.normalize();
 const n=u.clone().cross(v).normalize();setPlanBasis(a,u,v,n);
 const L=rodLen(r);pl.g.ca=L/2;pl.g.cb=0;pl.g.zoom=clamp(Math.min(vpW/(L+3000),vpH/5200),.004,1.5);
 pl.ca=pl.g.ca;pl.cb=pl.g.cb;pl.zoom=pl.g.zoom;
 scene.fog=null;chain.a=null;clearGroup(gWork);setTool('node');rebuildGrid();afterChange();updateModeUI();
 toast(`Чертёж стержня ${r.name} • клик по оси — новый узел • Esc — назад в 3D`,{type:'info'})}
function enterPlanPlane(id){const p=M.planes.get(id);if(!p)return;const b=planeBasis(p.nodes);if(!b)return;
 mode='plan';planCtx={kind:'plane',planeId:id};setPlanBasis(b.o,b.u,b.v,b.n);
 const ids=ctxNodeIds();const c=V3();let n=0;ids.forEach(i=>{c.add(M.nodes.get(i).p);n++});
 if(n){c.divideScalar(n);const d=c.clone().sub(b.o);pl.g.ca=d.dot(b.u);pl.g.cb=d.dot(b.v)}
 pl.ca=pl.g.ca;pl.cb=pl.g.cb;
 scene.fog=null;chain.a=null;clearGroup(gWork);setTool('select');rebuildGrid();afterChange();updateModeUI();
 toast(`Чертёж плоскости ${p.name} • узлы этой плоскости редактируются • Esc — назад`,{type:'info'})}
function exitPlan(){if(mode!=='3d'&&planCtx.kind==='xy'&&![...M.nodes.values()].some(n=>n.type==='support')){toast('Расставьте хотя бы одну опору',{type:'warn'});return}
 const fromXY=planCtx.kind==='xy';
 mode='3d';planCtx={kind:'xy'};ever3d=true;
 scene.fog=new THREE.Fog(linColor(0x0a1322),60000,240000);
 if(fromXY){ctrl.th=-Math.PI/2;ctrl.ph=.03;ctrl.t.copy(V3(pl.ca,pl.cb,0));ctrl.r=vpH/(2*pl.zoom*Math.tan(THREE.MathUtils.degToRad(25)));
  ctrl.g.th=-Math.PI/4;ctrl.g.ph=1.02;const box=modelBox();
  if(box){ctrl.g.t.copy(box.getCenter(V3()));ctrl.g.r=clamp(box.getSize(V3()).length()*1.05,3000,200000)}
  else{ctrl.g.t.copy(V3(pl.ca,pl.cb,1200));ctrl.g.r=14000}}
 setTool(tool);rebuildGrid();afterChange();updateModeUI()}
function updateModeUI(){$('#vp').classList.toggle('plan',mode==='plan');
 $('#modePlan').classList.toggle('on',mode==='plan'&&planCtx.kind==='xy');
 $('#mode3d').classList.toggle('on',mode==='3d');$('#mode3d').classList.toggle('amber',mode==='3d');
 const supN=nodeArr().filter(n=>n.type==='support').length;
 const btn=$('#closePlanBtn');btn.disabled=mode==='plan'&&planCtx.kind==='xy'&&supN===0;
 $('#closePlanTxt').textContent='Закрыть чертёж';
 $('#closePlanSub').textContent=planCtx.kind==='xy'?`Опор: ${supN}${supN===0?' — расставьте опоры':''}`:planCtx.kind==='rod'?`Стержень ${M.rods.get(planCtx.rodId)?.name||''} • L=${fmt(rodLen(M.rods.get(planCtx.rodId)||{a:0,b:0}))} мм`:'Плоскость '+(M.planes.get(planCtx.planeId)?.name||'');
 let chip='ЧЕРТЁЖ • XY (Z=0)',sub='X → • Y ↑',st='ЧЕРТЁЖ • XY';
 if(mode==='plan'&&planCtx.kind==='rod'){const r=M.rods.get(planCtx.rodId);chip=`ЧЕРТЁЖ • ${r?.name||''} • ${TYPES[r?.type]?.label||''}`;sub='ось стержня → • ⊥ ↑';st='ЧЕРТЁЖ • '+r?.name}
 else if(mode==='plan'&&planCtx.kind==='plane'){chip='ЧЕРТЁЖ • '+(M.planes.get(planCtx.planeId)?.name||'');sub='U → • V ↑';st='ЧЕРТЁЖ • ПЛОСКОСТЬ'}
 else if(mode==='3d'){st='3D • '+(ctrl.proj==='persp'?'ПЕРСП':'ОРТО')}
 $('#planChipTxt').textContent=chip;$('#planChipSub').textContent=sub;$('#stMode').textContent=st;
 $('#btnProj').textContent=ctrl.proj==='persp'?'ПЕРСП':'ОРТО';
 $('#projName').value=M.name}
