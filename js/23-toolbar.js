/* ==================== TOOLBAR & TOPBAR ==================== */
'use strict';
/* ================= TOOLBAR & TOPBAR ================= */
function buildToolbar(){const tb=$('#toolbar');let html='';
 TOOL_DEFS.forEach(t=>{if(t.sec){html+=`<div class="tlabel">${t.sec}</div>`;return}
  html+=`<button class="tool" data-tool="${t.id}" data-tip="${esc(t.label)} (${t.hk})" ${t.c?`style="--tc:${cssColor(t.c)}"`:''}>${t.c?'<span class="dot"></span>':''}<i>${ICONS[t.ic]}</i><span class="hk">${t.hk}</span></button>`;
  if(t.id==='plane')html+='<button class="tool dis" id="tbPlaneSel" data-tip="Плоскость по выделению: ≥3 неколлинеарных компланарных узла (P)"><i>'+ICONS.planefit+'</i><span class="hk">P</span></button>'});
 html+='<div style="flex:1"></div><div class="tlabel">ВИД</div><button class="tool" id="tbFit" data-tip="Вписать всё (F)"><i>'+ICONS.fit+'</i><span class="hk">F</span></button>';
 tb.innerHTML=html;
 tb.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
 $('#tbFit').onclick=fitAll;
 $('#tbPlaneSel').onclick=planeFromSelectionAction;updateToolAvail()}
function bindTopbar(){$('#btnUndo').onclick=undo;$('#btnRedo').onclick=redo;
 $('#btnDemo').onclick=loadDemo;$('#btnSave').onclick=saveQuick;$('#btnOpen').onclick=savesModal;
 $('#btnImport').onclick=()=>$('#fileInput').click();
 $('#btnExport').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();
  showMenu([{title:'ЭКСПОРТ'},{label:'Проект JSON (полный)',ic:'export',fn:exportJSON},{label:'Геометрия OBJ (оси)',ic:'export',fn:exportOBJ}],r.left,r.bottom+6)};
 $('#btnHelp').onclick=helpModal;$('#btnSide').onclick=()=>$('#side').classList.toggle('open');
 $('#projName').addEventListener('change',e=>{M.name=e.target.value.trim()||'Проект';scheduleAuto()});
 $('#modePlan').onclick=()=>{if(mode!=='plan'||planCtx.kind!=='xy')enterPlanXY()};
 $('#mode3d').onclick=()=>{if(mode!=='3d')exitPlan()};
 $('#closePlanBtn').onclick=exitPlan;
 $('#tabProps').onclick=()=>{$('#tabProps').classList.add('on');$('#tabTree').classList.remove('on');$('#paneProps').classList.add('on');$('#paneTree').classList.remove('on')};
 $('#tabTree').onclick=()=>{$('#tabTree').classList.add('on');$('#tabProps').classList.remove('on');$('#paneTree').classList.add('on');$('#paneProps').classList.remove('on');renderTree()};
 $('#btnIso').onclick=()=>{ctrl.g.th=ctrl.th+Math.atan2(Math.sin(-Math.PI/4-ctrl.th),Math.cos(-Math.PI/4-ctrl.th));ctrl.g.ph=1.02};
 $('#btnFit').onclick=fitAll;
 $('#btnProj').onclick=()=>{ctrl.proj=ctrl.proj==='persp'?'ortho':'persp';updateModeUI()};
 $('#btnViews').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();
  const items=[{title:'СОХРАНЁННЫЕ ВИДЫ'}];
  M.views.forEach((v,i)=>items.push({label:v.name,ic:'views',fn:()=>{ctrl.g.t.copy(V3(...v.t));ctrl.g.r=v.r;ctrl.g.th=v.th;ctrl.g.ph=v.ph;ctrl.proj=v.proj;updateModeUI()}}));
  if(!M.views.length)items.push({label:'Пока нет сохранённых видов',dis:true});
  items.push({sep:1},{label:'＋ Сохранить текущий вид',ic:'plus',fn:()=>{if(mode!=='3d'){toast('Виды сохраняются в 3D',{type:'warn'});return}
   openModal('Сохранить вид',`<div class="row"><label>Имя</label><input id="vwName" value="Вид ${M.views.length+1}"></div>`,
    [{label:'Отмена'},{label:'Сохранить',primary:true,fn:()=>{pushUndo();M.views.push({name:$('#vwName').value.trim()||'Вид',t:ctrl.g.t.toArray(),r:ctrl.g.r,th:ctrl.g.th,ph:ctrl.g.ph,proj:ctrl.proj});afterChange();toast('Вид сохранён',{type:'ok'})}}],
    ()=>{$('#vwName').focus();$('#vwName').select()})}});
  if(M.views.length)items.push({label:'Очистить список видов',ic:'trash',danger:true,fn:()=>{pushUndo();M.views=[];afterChange()}});
  showMenu(items,r.left-60,r.bottom+6)}}
/* ================= PLANE FROM SELECTION ================= */
/* Active when selected nodes/rod-endpoints define ONE unambiguous plane:
   >=3 points, not collinear, all within 1 mm of the fitted plane. */
function selPlaneData(){const pts=[],ids=[];
 sel.nodes.forEach(id=>{const n=M.nodes.get(id);if(n){pts.push(n.p);ids.push(id)}});
 sel.rods.forEach(id=>{const r=M.rods.get(id);if(r)[r.a,r.b].forEach(nid=>{if(!ids.includes(nid)){const n=M.nodes.get(nid);if(n){pts.push(n.p);ids.push(nid)}}})});
 return{pts,ids}}
function fitSelPlane(pts){if(pts.length<3)return null;let o=null,n=null;
 for(let i=2;i<pts.length;i++){const cr=pts[1].clone().sub(pts[0]).cross(pts[i].clone().sub(pts[0]));
  if(cr.length()>1){n=cr.normalize();o=pts[0];break}}
 if(!n)return null;
 for(const p of pts){if(Math.abs(p.clone().sub(o).dot(n))>1)return null}
 return{o,n}}
function selPlaneTriple(){const{pts,ids}=selPlaneData();
 if(!fitSelPlane(pts))return null;
 let A=0,B=1,best=-1;
 for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const d=pts[i].distanceTo(pts[j]);if(d>best){best=d;A=i;B=j}}
 if(best<=0)return null;
 const ab=pts[B].clone().sub(pts[A]);const L2=ab.lengthSq();let C=-1,hd=0;
 for(let k=0;k<pts.length;k++){if(k===A||k===B)continue;const t=pts[k].clone().sub(pts[A]);
  const perp=t.clone().sub(ab.clone().multiplyScalar(t.dot(ab)/L2));const d=perp.length();
  if(d>hd){hd=d;C=k}}
 if(C<0||best*hd<1)return null;
 return[ids[A],ids[B],ids[C]]}
function planeFromSelectionAction(){const tr=selPlaneTriple();
 if(!tr){toast('Нужно ≥3 выделенных узла (или стержней), лежащих в одной плоскости и не на одной прямой',{type:'warn'});return}
 const nPts=selPlaneData().pts.length;
 const poly=selPlaneHull();
 pushUndo();const p=makePlane(tr,poly);
 if(!p){undoStack.pop();updateUndoUI();return}
 afterChange();selectOnly('plane',p.id);
 toast(`${p.name}: контур из ${p.poly?p.poly.length:'?'} крайних точек (${nPts} опорных)`,{type:'ok'})}
/* convex hull of all selected points in the fitted plane: vertices = extreme nodes of selection */
function selPlaneHull(){const{pts}=selPlaneData();const fp=fitSelPlane(pts);if(!fp)return null;
 const{o,n}=fp;
 let u=n.clone().cross(AX);if(u.lengthSq()<1e-6)u=n.clone().cross(AY);u.normalize();let v=n.clone().cross(u).normalize();
 const co=pts.map(p=>{const d=p.clone().sub(o);return[d.dot(u),d.dot(v)]});
 let A=0,B=1,bd=-1;
 for(let i=0;i<co.length;i++)for(let j=i+1;j<co.length;j++){const d=Math.hypot(co[i][0]-co[j][0],co[i][1]-co[j][1]);if(d>bd){bd=d;A=i;B=j}}
 if(bd<=0)return null;
 u=pts[B].clone().sub(pts[A]);u.addScaledVector(n,-u.dot(n));if(u.length()<1e-6)return null;u.normalize();v=n.clone().cross(u).normalize();
 const cp=pts.map(p=>{const d=p.clone().sub(o);return[d.dot(u),d.dot(v)]});
 const idx=cp.map((c,i)=>i).sort((a,b)=>cp[a][0]-cp[b][0]||cp[a][1]-cp[b][1]);
 const cr=(oa,ob,oc)=>(cp[ob][0]-cp[oa][0])*(cp[oc][1]-cp[oa][1])-(cp[ob][1]-cp[oa][1])*(cp[oc][0]-cp[oa][0]);
 const lo=[],up=[];
 for(const i of idx){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],i)<=0)lo.pop();lo.push(i)}
 for(let k=idx.length-1;k>=0;k--){const i=idx[k];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],i)<=0)up.pop();up.push(i)}
 const hull=lo.slice(0,lo.length-1).concat(up.slice(0,up.length-1));
 if(hull.length<3)return null;
 let area=0;for(let i=0;i<hull.length;i++){const a=cp[hull[i]],b=cp[hull[(i+1)%hull.length]];area+=a[0]*b[1]-b[0]*a[1]}
 if(Math.abs(area)/2<1)return null;
 return hull.map(i=>pts[i].clone())}
function updateToolAvail(){const b=$('#tbPlaneSel');if(b)b.classList.toggle('dis',!selPlaneTriple())}
