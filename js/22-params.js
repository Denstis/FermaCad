/* ==================== PARAMS UI: params panel sync + bindings ==================== */
'use strict';
/* ================= PARAMS UI ================= */
function syncParams(){$('#pGrid').value=String(params.grid);$('#pColH').value=params.colH;
 $('#pSnapGrid').checked=params.snapGrid;$('#pSnapNode').checked=params.snapNode;$('#pSnapOrtho').checked=params.snapOrtho;
 $('#pDims3d').checked=params.dims3d;$('#pShadows').checked=params.shadows;
 $('#pClAxis').value=params.clAxis;$('#pClStep').value=params.clStep;$('#pClCount').value=params.clCount;
 const rs=(el,min,max)=>{el.style.setProperty('--v',((el.value-min)/(max-min)*100)+'%')};
 $('#pNodeSize').value=params.nodeR;rs($('#pNodeSize'),40,150);
 $('#pRodScale').value=Math.round(params.rodScale*100);rs($('#pRodScale'),50,220);
 $('#pPlaneOp').value=Math.round(params.planeOp*100);rs($('#pPlaneOp'),0,30)}
const saveParams=debounce(()=>{try{localStorage.setItem('fc.params',JSON.stringify(params))}catch(e){}},400);
function bindParams(){
 $('#pGrid').onchange=e=>{params.grid=+e.target.value;rebuildGrid();saveParams()};
 $('#pColH').onchange=e=>{params.colH=Math.max(100,+e.target.value||2500);saveParams();updateHint();renderProps()};
 $('#pSnapGrid').onchange=e=>{params.snapGrid=e.target.checked;saveParams()};
 $('#pSnapNode').onchange=e=>{params.snapNode=e.target.checked;saveParams()};
 $('#pSnapOrtho').onchange=e=>{params.snapOrtho=e.target.checked;saveParams()};
 $('#pDims3d').onchange=e=>{params.dims3d=e.target.checked;rebuildDims();saveParams()};
 $('#pShadows').onchange=e=>{params.shadows=e.target.checked;rebuildScene();saveParams()};
 $('#pClAxis').onchange=e=>{params.clAxis=e.target.value;saveParams()};
 $('#pClStep').onchange=e=>{params.clStep=+e.target.value||3000;saveParams()};
 $('#pClCount').onchange=e=>{params.clCount=clamp(+e.target.value||3,1,50);saveParams()};
 $('#btnQuickClone').onclick=()=>cloneSelection(params.clAxis,params.clStep,1);
 const range=(id,fn,min,max)=>{const el=$(id);el.oninput=()=>{el.style.setProperty('--v',((el.value-min)/(max-min)*100)+'%');fn(+el.value)}};
 range('#pNodeSize',v=>{params.nodeR=v;rebuildScene();saveParams()},40,150);
 range('#pRodScale',v=>{params.rodScale=v/100;rebuildScene();saveParams()},50,220);
 range('#pPlaneOp',v=>{params.planeOp=v/100;planeObjs.forEach(o=>{o.quad.material.opacity=params.planeOp});saveParams()},0,30);
 $('#btnClearMeas').onclick=()=>{if(!M.measures.length)return;pushUndo();M.measures=[];afterChange();toast('Измерения очищены',{type:'info',action:{label:'Отменить',fn:undo}})};
 syncParams()}
