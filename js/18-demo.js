/* ==================== DEMO: demo hangar model builder ==================== */
'use strict';
/* ================= DEMO ================= */
function buildDemo(){M=freshModel();M.name='Демо • Ангар 12×6 м';
 const N=(x,y,z,t='node')=>getOrCreateNode(V3(x,y,z),t).node;
 const R=(a,b,t)=>addRod(a.id,b.id,t);
 const cols=[];
 [0,6000,12000].forEach(x=>[0,6000].forEach(y=>{const s=N(x,y,0,'support');const t=N(x,y,3000);R(s,t,'column');cols.push({s,t,x,y})}));
 [0,6000].forEach(y=>{
  const bn=[0,3000,6000,9000,12000].map(x=>N(x,y,3000));
  for(let i=0;i<4;i++)R(bn[i],bn[i+1],'bottom');
  const t1=N(3000,y,3750),t2=N(6000,y,4500),t3=N(9000,y,3750);
  const e0=bn[0],e4=bn[4];
  const sd1=R(e0,t1,'sdiag'),sd2=R(t3,e4,'sdiag');
  R(t1,t2,'top');R(t2,t3,'top');
  [bn[1],bn[2],bn[3]].forEach(b=>{const tg=postTarget(b);if(tg){const res=nodeOnRod(tg.rod,tg.t);R(b,res.node,'post')}});
  R(bn[2],t1,'diag');R(bn[2],t3,'diag');
  const h1=nodeOnRod(sd1,.5).node,h2=nodeOnRod(sd2,.5).node;
  if(y===0){window._demoH={h1,h2}}});
 // прогоны между фермами
 const at=(x,y,z)=>N(x,y,z);
 [[0,3000],[3000,3750],[6000,4500],[9000,3750],[12000,3000]].forEach(([x,z])=>R(at(x,0,z),at(x,6000,z),'purlin'));
 R(window._demoH.h1,at(1500,6000,3375),'purlin');R(at(10500,0,3375),window._demoH.h2,'purlin');
 // связи
 R(at(0,0,0),at(6000,0,3000),'brace');R(at(6000,0,0),at(0,0,3000),'brace');
 R(at(6000,6000,0),at(12000,6000,3000),'brace');R(at(12000,6000,0),at(6000,6000,3000),'brace');
 R(at(0,0,3000),at(6000,6000,3000),'brace');
 makePlane([at(0,0,0).id,at(12000,0,0).id,at(6000,0,4500).id]);
 delete window._demoH}
function loadDemo(){const go=()=>{pushUndo();buildDemo();mode='3d';ever3d=true;planCtx={kind:'xy'};
  scene.fog=new THREE.Fog(linColor(0x0a1322),60000,240000);
  rebuildGrid();setTool('select');afterChange();
  const box=modelBox();if(box){ctrl.t.copy(box.getCenter(V3()));ctrl.r=ctrl.g.r=clamp(box.getSize(V3()).length()*1.05,3000,200000);ctrl.g.t.copy(ctrl.t)}
  ctrl.th=-2.2;ctrl.ph=.6;ctrl.g.th=-Math.PI/4;ctrl.g.ph=1.02;
  toast('Демо-каркас загружен • попробуйте 2×клик по стержню',{type:'ok',action:{label:'Отменить',fn:undo}})};
 if(M.nodes.size)confirmModal('Загрузить демо','Текущая модель будет заменена демо-каркасом (можно отменить).',go,'Загрузить');else go()}
