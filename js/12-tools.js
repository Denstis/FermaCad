/* ==================== TOOLS: setTool, hint, selection, toolClick ==================== */
'use strict';
/* ================= TOOLS ================= */
function setTool(t){if(mode==='plan'){const bad={xy:['column','post','plane'],rod:['column','post','plane','support'],plane:['column','post','plane','support']}[planCtx.kind]||[];
  if(bad.includes(t))t='select'}
 tool=t;chain.a=null;planePick=[];measPick=null;clearGroup(gWork);clearGhost();
 $$('#toolbar .tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
 renderer.domElement.style.cursor=t==='select'?'default':'crosshair';
 renderProps();updateHint()}
function updateHint(){if(appMode==='loads'){$('#stHint').textContent='РЕЖИМ РАСЧЁТА: ЛКМ по стержню — N/M/UR/прогиб в строке состояния • панель нагрузок и РАСЧЁТ справа • F2 — возврат в «Каркас»';return}const h={select:'Клик — выделить • Ctrl+клик — добавить • рамка — область • перетащите узел — переместить • ПКМ — меню • Ctrl+ПКМ+тяга — панорама • ПКМ+тяга — орбита • скрытое не выделяется',
 support:'Клик — опора • привязки: сетка, узлы, ⟂/∥ • точные координаты и ряды — на панели справа',
 node:planCtx.kind==='rod'&&mode==='plan'?'Клик по оси — узел • привязка к долям L и шагу сетки • точное расстояние — справа':'Клик — узел (сетка / ось стержня)',
 column:`Клик по узлу — столб ⊥ XY высотой ${fmt(params.colH)} мм (меняется справа)`,
 post:'Клик по узлу — стойка вверх до ближайшего стержня (узел пересечения создаётся автоматически)',
 plane:`Плоскость по 3 узлам: выбрано ${planePick.length}/3`,measure:'Две точки — размер (сохраняется в модели)'};
 let txt=h[tool]||(TYPES[tool]?`${TYPES[tool].label}: кликните первый узел, затем второй (или тяните от узла) • цепочка продолжается • Esc — сброс`:'');
 if(chain.a&&TYPES[tool])txt=`${TYPES[tool].label}: от ${chain.a.name} — выберите следующий узел • Esc — сброс`;
 if(paste)txt='ВСТАВКА: кликните точку размещения • Esc — отмена';
 $('#stHint').textContent=txt}
function selectOnly(kind,id){sel.nodes.clear();sel.rods.clear();sel.planes.clear();if(kind)sel[kind+'s']?.add(id);selectionChanged()}
function selectionChanged(){applySelMats();updateSelBox();renderProps();markTreeSel();updateToolAvail()}
/* ---- per-tool click handlers. ctx={cx,cy,ev,hit,g}; g.pushOnce() registers one undo snapshot per click ---- */
function makeClickGuard(){const g={did:false,pushOnce(){if(!g.did){pushUndo();g.did=true}}};return g}
function clickSelect({ev,hit}){
 if(hit){const set=sel[hit.kind+'s'];
  if(ev.ctrlKey||ev.metaKey){set.has(hit.id)?set.delete(hit.id):set.add(hit.id);selectionChanged()}
  else if(!set.has(hit.id))selectOnly(hit.kind,hit.id);else selectionChanged()}
 else if(!(ev.ctrlKey||ev.metaKey)){sel.nodes.clear();sel.rods.clear();sel.planes.clear();selectionChanged()}}
function clickSupport({cx,cy,g}){
 if(mode==='plan'&&planCtx.kind!=='xy'){toast('Опоры ставятся только в чертеже XY',{type:'warn'});return}
 const s=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,0,false);if(!s)return;
 g.pushOnce();const{node,created}=getOrCreateNode(V3(s.p.x,s.p.y,0),'support');
 if(!created&&node.type==='support'){toast('Здесь уже есть опора',{type:'info',timeout:1500});undoStack.pop();updateUndoUI();return}
 afterChange()}
function clickNode({cx,cy,g}){
 if(mode==='plan'&&planCtx.kind==='rod'){const s=snapPlan(cx,cy);if(!s)return;
  g.pushOnce();const r=M.rods.get(planCtx.rodId);const res=nodeOnRod(r,s.rodT??s.a/rodLen(r));
  if(!res.created){toast('Узел здесь уже существует',{type:'info',timeout:1500});undoStack.pop();updateUndoUI();return}
  afterChange();return}
 const s=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,0,true);if(!s)return;g.pushOnce();
 if(s.type==='rod'){const res=nodeOnRod(s.rod,s.t);if(!res.created){undoStack.pop();updateUndoUI();toast('Узел здесь уже существует',{type:'info',timeout:1500});return}}
 else{const{created}=getOrCreateNode(mode==='plan'?s.p:V3(s.p.x,s.p.y,s.p.z));if(!created){undoStack.pop();updateUndoUI();toast('Узел здесь уже существует',{type:'info',timeout:1500});return}}
 afterChange()}
function clickColumnPost({cx,cy,g}){
 const plan=(mode==='plan');
 const h=pickAt(cx,cy,plan?{kinds:['node']}:{kinds:['node','rod','plane']});
 const s=plan?snapPlan(cx,cy):snap3D(cx,cy,0,false);
 let base=null;
 if(h&&h.kind==='node')base=M.nodes.get(h.id);
 else if(h&&h.kind==='rod'){
  const r=M.rods.get(h.id);
  const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p,ab=b.clone().sub(a);
  const L2=ab.lengthSq();if(L2<1)return;
  const t=clamp(ab.dot(h.point.clone().sub(a))/L2,0,1);
  base=nodeOnRod(r,t).node;
 }else if(h&&h.kind==='plane'){
  g.pushOnce();base=getOrCreateNode(h.point).node;
 }else if(s){
  const q=plan?V3(s.p.x,s.p.y,s.p.z):s.p;
  g.pushOnce();base=getOrCreateNode(q).node;
 }
 if(!base)return;
 const topP=base.p.clone().add(V3(0,0,params.colH));
 if(M.nodes.has(topP)){const tn=M.nodes.get(topP);if([...M.rods.values()].some(r=>(r.a===base.id&&r.b===tn.id)||(r.b===base.id&&r.a===tn.id))){toast('Столб из этого узла уже существует',{type:'warn',timeout:1600});if(g.did)afterChange();return}}
 g.pushOnce();
 const top=getOrCreateNode(topP);
 const r=addRod(base.id,top.node.id,'column');
 if(!r){undoStack.pop();updateUndoUI();toast('Столб из этого узла уже существует',{type:'warn'});return}
 afterChange();toast(`＋ ${r.name} • h=${fmt(params.colH)} мм`,{type:'ok',timeout:1400})}
function clickRodTool({cx,cy,g}){let target=null;
 if(mode==='plan'){const s=snapPlan(cx,cy);if(!s)return;
  if(s.node)target=s.node;
  else if(planCtx.kind==='rod'){toast('В чертеже стержня узлы ставятся инструментом «Узел» (N)',{type:'info'});return}
  else{g.pushOnce();target=getOrCreateNode(s.p).node}}
 else{const s=snap3D(cx,cy,chain.a?chain.a.p.z:0,true);if(!s)return;
  if(s.type==='node')target=s.node;
  else if(s.type==='rod'){g.pushOnce();target=nodeOnRod(s.rod,s.t).node}
  else{g.pushOnce();target=getOrCreateNode(s.p).node}}
 if(!chain.a){chain.a=target;buildWorkGrid();updateHint();if(g.did)afterChange();return}
 if(target.id===chain.a.id)return;
 g.pushOnce();const r=addRod(chain.a.id,target.id,tool);
 if(!r){toast('Стержень между этими узлами уже есть',{type:'warn',timeout:1800});if(g.did)afterChange();return}
 chain.a=target;buildWorkGrid();afterChange()}
function clickPlane({hit,g}){
 if(!hit||hit.kind!=='node'){toast('Кликните по узлу',{type:'warn',timeout:1500});return}
 if(planePick.includes(hit.id))return;planePick.push(hit.id);
 if(planePick.length===3){g.pushOnce();const p=makePlane(planePick);planePick=[];
  if(p){afterChange();selectOnly('plane',p.id);setTool('select');toast(`${p.name} построена • 2×клик — чертёж плоскости`,{type:'ok'})}
  else{undoStack.pop();updateUndoUI()}}
 updateHint()}
function clickMeasure({cx,cy,g}){
 const s=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,measPick?measPick.z:0,true);if(!s)return;
 if(!measPick){measPick=s.p.clone();updateHint();return}
 g.pushOnce();M.measures.push({a:measPick.clone(),b:s.p.clone()});measPick=null;afterChange()}
const CLICK_HANDLERS={select:clickSelect,support:clickSupport,node:clickNode,column:clickColumnPost,post:clickColumnPost,plane:clickPlane,measure:clickMeasure};
function toolClick(cx,cy,ev){hideCtx();
 if(paste){const s=mode==='plan'?snapPlan(cx,cy):snap3D(cx,cy,0,false);if(s)commitPaste(s.p);return}
 const hit=pickAt(cx,cy);
 const f=(tool==='column')?clickColumnPost:ROD_KEYS.includes(tool)?clickRodTool:CLICK_HANDLERS[tool];
 if(!f)return;
 f({cx,cy,ev,hit,g:makeClickGuard()})}
