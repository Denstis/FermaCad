/* ==================== LOOP & BOOT ==================== */
'use strict';
/* ================= LOOP ================= */
let lastT=performance.now();
function tick(t){const dt=clamp((t-lastT)/1000,.001,.05);lastT=t;
 applyCams(dt);
 if(dimsDirty&&mode==='plan'){rebuildDims();dimsDirty=false}
 if(shadowsDirty){renderer.shadowMap.needsUpdate=true;shadowsDirty=false}
 const now=performance.now();
 nodeObjs.forEach(o=>{const s=o.parts[0];if(s.userData.born){const k=1-(now-s.userData.born)/350;
  if(k>0)s.scale.setScalar(s.userData.base*(1+.7*k));else{delete s.userData.born;s.scale.setScalar(s.userData.base)}}});
 const cam=activeCam();
 scene.traverse(o=>{if(o.userData.sprite&&o.userData.autoScale){const wp=V3();o.getWorldPosition(wp);
  const d=mode==='plan'?1/pl.zoom:cam.position.distanceTo(wp);
  const h=mode==='plan'?clamp(15/pl.zoom,220,1400):clamp(d*.02,250,2500);o.scale.set(h*o.userData.ar,h,1)}});
 renderer.render(scene,cam);
 if(mode==='3d')cubeRenderer.render(cubeScene,cubeCam);
 requestAnimationFrame(tick)}
/* ================= BOOT ================= */
function boot(){if(typeof THREE==='undefined'){$('#bootErr').style.display='grid';return}
 try{initThree();buildToolbar();bindTopbar();bindParams();bindPointer();bindCube();fillIcons();
  setPlanBasis(V3(),AX,AY,AZ);
  let restored=false;
  try{const a=JSON.parse(localStorage.getItem('fc.auto'));
   if(a&&a.data&&a.data.nodes&&a.data.nodes.length){deserialize(a.data);restored=true;
    if(M.rods.size){mode='3d';ever3d=true;scene.fog=new THREE.Fog(linColor(0x0a1322),60000,240000)}
    else{mode='plan';planCtx={kind:'xy'}}}}catch(e){}
  rebuildGrid();rebuildScene();renderTree();updateCounts();updateUndoUI();
  if(restored){setTool('select');updateModeUI();fitAll();
   ctrl.t.copy(ctrl.g.t);ctrl.r=ctrl.g.r;
   toast('Восстановлен автосохранённый проект',{type:'info',action:{label:'Начать заново',fn:newProject}})}
  else{mode='plan';setTool('support');updateModeUI();pl.ca=pl.g.ca=3000;pl.cb=pl.g.cb=1500}
  coachUpdate();updateHint();renderProps();
  requestAnimationFrame(tick);
  window.addEventListener('beforeunload',()=>{try{localStorage.setItem('fc.auto',JSON.stringify({data:serialize(),mode,ts:Date.now()}))}catch(e){}});
 }catch(err){console.error(err);$('#bootErr').style.display='grid';$('#bootErrMsg').textContent='Ошибка запуска: '+err.message}}
boot();
