/* ==================== DEMO: demo hangar model builder ==================== */
'use strict';
function demoNode(x,y,z,t='node'){return getOrCreateNode(V3(x,y,z),t).node}
function demoRod(a,b,t){return addRod(a.id,b.id,t)}
/* Two-hinged truss in plane y=const: bottom chord, sloped sdiagonals, top chord, posts, diagonals.
   Returns the sdiag mid nodes (h1,h2) used later for purlin stubs. */
function demoTrussFrame(y){
 const bn=[0,3000,6000,9000,12000].map(x=>demoNode(x,y,3000));
 for(let i=0;i<4;i++)demoRod(bn[i],bn[i+1],'bottom');
 const t1=demoNode(3000,y,3750),t2=demoNode(6000,y,4500),t3=demoNode(9000,y,3750);
 const e0=bn[0],e4=bn[4];
 const sd1=demoRod(e0,t1,'sdiag'),sd2=demoRod(t3,e4,'sdiag');
 demoRod(t1,t2,'top');demoRod(t2,t3,'top');
 [bn[1],bn[2],bn[3]].forEach(b=>{const tg=postTarget(b);if(tg){const res=nodeOnRod(tg.rod,tg.t);demoRod(b,res.node,'post')}});
 demoRod(bn[2],t1,'diag');demoRod(bn[2],t3,'diag')}
/* Columns with supports at grid 0/6/12 m x 0/6 m */
function demoColumns(){
 const cols=[];
 [0,6000,12000].forEach(x=>[0,6000].forEach(y=>{const s=demoNode(x,y,0,'support');const t=demoNode(x,y,3000);demoRod(s,t,'column');cols.push({s,t,x,y})}));
 return cols}
/* Purlins linking the two trusses over the ridge line */
function demoPurlins(){const at=(x,y,z)=>demoNode(x,y,z);
 [[0,3000],[3000,3750],[6000,4500],[9000,3750],[12000,3000]].forEach(([x,z])=>demoRod(at(x,0,z),at(x,6000,z),'purlin'))}
function demoBraces(){const at=(x,y,z)=>demoNode(x,y,z);
 demoRod(at(0,0,0),at(6000,0,3000),'brace');demoRod(at(6000,0,0),at(0,0,3000),'brace');
 demoRod(at(6000,6000,0),at(12000,6000,3000),'brace');demoRod(at(12000,6000,0),at(6000,6000,3000),'brace');
 demoRod(at(0,0,3000),at(6000,6000,3000),'brace')}
function buildDemo(){M=freshModel();M.name='Демо • Ангар 12×6 м';
 const at=(x,y,z)=>demoNode(x,y,z);
 demoColumns();
 const trusses=[demoTrussFrame(0),demoTrussFrame(6000)];
 demoPurlins();
 demoBraces();
 makePlane([at(0,0,0).id,at(12000,0,0).id,at(6000,0,4500).id])}
function loadDemo(){const go=()=>{pushUndo();buildDemo();M.rods.forEach(r=>{r.sec=SEC_DEFAULTS[r.type]||'shs_80x80x4';r.mat='mat_s245'});mode='3d';ever3d=true;planCtx={kind:'xy'};
 scene.fog=new THREE.Fog(linColor(0x0a1322),60000,240000);
 rebuildGrid();setTool('select');afterChange();
 const box=modelBox();if(box){ctrl.t.copy(box.getCenter(V3()));ctrl.r=ctrl.g.r=clamp(box.getSize(V3()).length()*1.05,3000,200000);ctrl.g.t.copy(ctrl.t)}
 ctrl.th=-2.2;ctrl.ph=.6;ctrl.g.th=-Math.PI/4;ctrl.g.ph=1.02;
 toast('Демо-каркас загружен • попробуйте 2×клик по стержню',{type:'ok',action:{label:'Отменить',fn:undo}})};
 if(M.nodes.size)confirmModal('Загрузить демо','Текущая модель будет заменена демо-каркасом (можно отменить).',go,'Загрузить');else go()}
