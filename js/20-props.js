/* ==================== PROPS: properties panel render + actions + field changes, counts ==================== */
'use strict';
/* ---- card builders: one per selection shape ---- */
function cardPaste(){return `<div class="hint"><b>РЕЖИМ ВСТАВКИ</b><br>Кликните точку размещения копии. Esc — отмена.</div>`}
function cardNode(n1){const hosted=n1.host&&M.rods.get(n1.host.rod);
 return `<div class="card"><h4><span class="sw" style="background:${cssColor(n1.type==='support'?SUP_COLOR:NODE_COLOR)};color:${cssColor(n1.type==='support'?SUP_COLOR:NODE_COLOR)}"></span>${n1.type==='support'?'ОПОРА':'УЗЕЛ'}</h4>
  <div class="row"><label>Имя</label><input data-k="nodeName" value="${esc(n1.name)}"></div>
  ${hosted?`<div class="hint">Лежит на оси <b>${esc(hosted.name)}</b> (${Math.round(n1.host.t*100)}% длины). Перемещение — только вдоль оси.</div>
  <div class="row"><label>От начала</label><input type="number" data-k="hostDist" value="${Math.round(n1.host.t*rodLen(hosted))}" step="${params.grid}"><span class="unit">мм</span></div>`
  :`<div class="mini">КООРДИНАТЫ, ММ</div><div class="row3"><input type="number" data-k="x" value="${Math.round(n1.p.x)}" step="100"><input type="number" data-k="y" value="${Math.round(n1.p.y)}" step="100"><input type="number" data-k="z" value="${Math.round(n1.p.z)}" step="100"></div>`}
  <div class="btnrow"><button class="btn" data-act="toSupport">${n1.type==='support'?'Сделать узлом':'Сделать опорой'}</button><button class="btn" data-act="zoomSel">Приблизить</button></div>
  <button class="btn" data-act="mkColumn">Столб ${fmt(params.colH)} мм ⊥ XY</button>
  <button class="btn" data-act="mkPost">Стойка вверх до стержня</button>
  <button class="btn warn" data-act="del">Удалить узел</button></div>`}
function cardRod(r1){const hn=hostedNodes(r1.id).length;
 return `<div class="card"><h4><span class="sw" style="background:${cssColor(TYPES[r1.type].color)};color:${cssColor(TYPES[r1.type].color)}"></span>СТЕРЖЕНЬ</h4>
  <div class="row"><label>Имя</label><input data-k="rodName" value="${esc(r1.name)}"></div>
  <div class="row"><label>Тип</label><select data-k="rodType">${ROD_KEYS.map(k=>`<option value="${k}"${k===r1.type?' selected':''}>${TYPES[k].label}</option>`).join('')}</select></div>
  <div class="kv"><span>Длина</span><b>${fmt(rodLen(r1))} мм</b></div>
  <div class="kv"><span>Концы</span><b>${esc(M.nodes.get(r1.a)?.name||'?')} → ${esc(M.nodes.get(r1.b)?.name||'?')}</b></div>
  <div class="kv"><span>Узлов на оси</span><b>${hn} внутр.</b></div>
  <button class="btn gold" data-act="openRod" style="margin-top:9px">Открыть чертёж стержня</button>
  <button class="btn" data-act="midNode">Узел на середине</button>
  <div class="row"><input type="number" id="splitN" value="4" min="2" max="60"><button class="btn" data-act="split" style="width:auto;flex:none;margin:0">Разделить на N</button></div>
  <button class="btn warn" data-act="del">Удалить стержень</button></div>`}
function cardPlane(p1){return `<div class="card"><h4><span class="sw" style="background:#6fd3ff;color:#6fd3ff"></span>ПЛОСКОСТЬ</h4>
  <div class="row"><label>Имя</label><input data-k="planeName" value="${esc(p1.name)}"></div>
  <div class="kv"><span>Узлы</span><b>${p1.nodes.map(id=>esc(M.nodes.get(id)?.name||'?')).join(', ')}</b></div>
  <button class="btn gold" data-act="openPlane" style="margin-top:9px">Чертёж в плоскости</button>
  <button class="btn warn" data-act="del">Удалить плоскость</button></div>`}
function cardMulti(){return `<div class="card"><h4>ВЫДЕЛЕНО: ${selCount()}</h4>
  <div class="kv"><span>Узлы</span><b>${sel.nodes.size}</b></div><div class="kv"><span>Стержни</span><b>${sel.rods.size}</b></div><div class="kv"><span>Плоскости</span><b>${sel.planes.size}</b></div>
  ${sel.rods.size?`<div class="row" style="margin-top:9px"><label>Тип всем</label><select data-k="bulkType"><option value="">— не менять —</option>${ROD_KEYS.map(k=>`<option value="${k}">${TYPES[k].label}</option>`).join('')}</select></div>`:''}
  <button class="btn" data-act="group">Группировать (Ctrl+G)</button>
  <div class="btnrow"><button class="btn" data-act="copy">Копировать</button><button class="btn" data-act="clone">Клонировать…</button></div>
  <div class="btnrow"><button class="btn" data-act="hide">Скрыть</button><button class="btn" data-act="isolate">Изолировать</button></div>
  <button class="btn warn" data-act="del">Удалить выделенное</button></div>`}
function cardTool(){const td=TOOL_DEFS.find(t=>t.id===tool);
 let h=`<div class="card"><h4><span class="sw" style="background:${cssColor(td?.c||0x4da6ff)};color:${cssColor(td?.c||0x4da6ff)}"></span>ИНСТРУМЕНТ: ${esc(td?.label||'')}</h4>`;
 if(tool==='support')h+=`<div class="hint">Клик по сетке — опора. Магнитные привязки: <b>сетка</b>, <b>узлы</b>, <b>⟂/∥</b> к существующим опорам. Размеры строятся автоматически.</div>
  <div class="mini">ТОЧНАЯ УСТАНОВКА</div>
  <div class="row"><label>X / Y</label><input type="number" id="supX" value="0" step="${params.grid}"><input type="number" id="supY" value="0" step="${params.grid}"><span class="unit">мм</span></div>
  <button class="btn" data-act="addSup">Поставить опору по координатам</button>
  <div class="mini" style="margin-top:8px">ПАРАМЕТРИЧЕСКИЙ РЯД (ОТ ПОСЛЕДНЕЙ ОПОРЫ)</div>
  <div class="row"><label>Кол-во</label><input type="number" id="rowN" value="3" min="1" max="50"><label style="width:40px">Шаг</label><input type="number" id="rowStep" value="6000" step="500"></div>
  <div class="btnrow"><button class="btn" data-act="rowX">Ряд по X →</button><button class="btn" data-act="rowY">Ряд по Y ↑</button></div>`;
 else if(tool==='column')h+=`<div class="hint">Столб ставится <b>строго перпендикулярно XY</b> из выбранного узла/опоры.</div>
  <div class="row"><label>Высота</label><input type="number" data-k="colH" value="${params.colH}" step="100" min="100"><span class="unit">мм</span></div>`;
 else if(tool==='post')h+=`<div class="hint">Стойка идёт <b>вертикально вверх</b> до ближайшего стержня. Узел пересечения создаётся на оси стержня автоматически.</div>`;
 else if(TYPES[tool])h+=`<div class="hint">${TYPES[tool].label}: кликните <b>первый узел</b>, затем второй (или тяните от узла к узлу). Цепочка продолжается от последнего узла. Клик по пустому месту создаёт узел на рабочей плоскости Z.</div>
  <div class="kv"><span>Сечение (визуально)</span><b>Ø${TYPES[tool].r*2} мм</b></div>`;
 else if(tool==='node')h+=`<div class="hint">${mode==='plan'&&planCtx.kind==='rod'?'Клик по оси стержня — внутренний узел. Привязка: доли L (1/2, 1/3, 1/4), шаг сетки, существующие узлы.':'Узел ставится на сетку, на ось стержня (в 3D) или в плоскость чертежа.'}</div>`;
 else if(tool==='plane')h+=`<div class="hint">Выберите <b>3 узла</b> — построится плоскость (${planePick.length}/3). 2×клик по плоскости открывает чертёж в ней.</div>`;
 else if(tool==='measure')h+=`<div class="hint">Две точки — размер. Сохраняется в модели, виден в 3D. Очистка — в параметрах.</div>`;
 else h+=`<div class="hint">Клик — выделение, <b>Ctrl+клик</b> — множественное, рамка — область, перетаскивание узла — перемещение с привязками. <b>2×клик</b> по стержню/плоскости — чертёж. ПКМ — меню.</div>
  <div class="kv"><span>Узлов / опор</span><b>${M.nodes.size} / ${nodeArr().filter(n=>n.type==='support').length}</b></div>
  <div class="kv"><span>Стержней</span><b>${M.rods.size}</b></div><div class="kv"><span>Плоскостей</span><b>${M.planes.size}</b></div>`;
 h+='</div>';
 if(mode==='plan'&&planCtx.kind==='rod'){const r=M.rods.get(planCtx.rodId);
  if(r)h+=`<div class="card"><h4>ЧЕРТЁЖ СТЕРЖНЯ ${esc(r.name)}</h4>
   <div class="kv"><span>Тип</span><b>${TYPES[r.type].label}</b></div><div class="kv"><span>Длина</span><b>${fmt(rodLen(r))} мм</b></div>
   <div class="row" style="margin-top:8px"><label>От начала</label><input type="number" id="rodDist" value="${Math.round(rodLen(r)/2)}" step="${params.grid}" min="0"><span class="unit">мм</span></div>
   <button class="btn" data-act="rodDistAdd">Добавить узел на расстоянии</button>
   <div class="row"><input type="number" id="splitN2" value="4" min="2" max="60"><button class="btn" data-act="splitCtx" style="width:auto;flex:none;margin:0">Разделить на N</button></div>
   <button class="btn warn" data-act="clearInner">Удалить внутренние узлы</button>
   <button class="btn gold" data-act="closePlan">Закрыть чертёж → 3D</button></div>`}
 return h}
function renderProps(){const p=$('#paneProps');const n1=sel.nodes.size===1?M.nodes.get([...sel.nodes][0]):null;
 const r1=sel.rods.size===1?M.rods.get([...sel.rods][0]):null;const p1=sel.planes.size===1?M.planes.get([...sel.planes][0]):null;
 let h='';
 if(paste)h=cardPaste();
 else if(n1&&selCount()===1)h=cardNode(n1);
 else if(r1&&selCount()===1)h=cardRod(r1);
 else if(p1&&selCount()===1)h=cardPlane(p1);
 else if(selCount()>1)h=cardMulti();
 else h=cardTool();
 p.innerHTML=h}
/* ---- data-act button handlers; ctx={n1,r1,p1} — single-selected entities ---- */
function actRowSup(act,ctx){const nn=clamp(+($('#rowN')?.value||3),1,50),st=+($('#rowStep')?.value||6000);
 const sup=nodeArr().filter(n=>n.type==='support');const last=sup[sup.length-1];const o=last?last.p.clone():V3();
 pushUndo();let c=0;for(let i=1;i<=nn;i++){const p=o.clone();if(act==='rowX')p.x+=st*i;else p.y+=st*i;if(getOrCreateNode(p,'support').created)c++}
 afterChange();toast(`Ряд: +${c} опор, шаг ${fmt(st)} мм`,{type:'ok'})}
const PROPS_ACTS={
 del:()=>deleteSelection(),
 zoomSel:()=>zoomToSelection(),
 toSupport:({n1})=>{if(n1){pushUndo();if(n1.type==='support'){n1.type='node';n1.name='Узел-'+(++M.counters.n)}else{n1.type='support';n1.name='Опора-'+(++M.counters.o)}afterChange()}},
 mkColumn:({n1})=>{if(n1){pushUndo();const t=getOrCreateNode(n1.p.clone().add(V3(0,0,params.colH)));const r=addRod(n1.id,t.node.id,'column');if(r){afterChange();toast('＋ '+r.name,{type:'ok'})}else{undoStack.pop();updateUndoUI();toast('Столб уже существует',{type:'warn'})}}},
 mkPost:({n1})=>{if(n1){const t=postTarget(n1);if(!t){toast('Нет пересечения выше узла',{type:'warn'});return}pushUndo();const res=nodeOnRod(t.rod,t.t);const r=addRod(n1.id,res.node.id,'post');if(r){afterChange();toast('＋ '+r.name,{type:'ok'})}else{undoStack.pop();updateUndoUI()}}},
 openRod:({r1})=>{if(r1)enterPlanRod(r1.id)},
 openPlane:({p1})=>{if(p1)enterPlanPlane(p1.id)},
 midNode:({r1})=>{if(r1){pushUndo();if(nodeOnRod(r1,.5).created){afterChange();toast('Узел на середине добавлен',{type:'ok'})}else{undoStack.pop();updateUndoUI();toast('Узел уже есть',{type:'info'})}}},
 split:({r1})=>{if(r1)splitRod(r1,+($('#splitN')?.value||4))},
 splitCtx:()=>{const r=M.rods.get(planCtx.rodId);if(r)splitRod(r,+($('#splitN2')?.value||4))},
 rodDistAdd:()=>{const r=M.rods.get(planCtx.rodId);if(r){const d=clamp(+($('#rodDist')?.value||0),0,rodLen(r));pushUndo();
  if(nodeOnRod(r,d/rodLen(r)).created){afterChange();toast(`Узел на ${fmt(d)} мм добавлен`,{type:'ok'})}else{undoStack.pop();updateUndoUI();toast('Узел рядом уже есть',{type:'info'})}}},
 clearInner:()=>{const r=M.rods.get(planCtx.rodId);if(r){pushUndo();const hs=hostedNodes(r.id).map(n=>n.id);
  if(hs.length){deleteSets(hs,[]);afterChange();toast(`Удалено внутренних узлов: ${hs.length}`,{type:'warn',action:{label:'Отменить',fn:undo}})}else{undoStack.pop();updateUndoUI()}}},
 closePlan:()=>exitPlan(),
 addSup:()=>{const x=+($('#supX')?.value||0),y=+($('#supY')?.value||0);pushUndo();const{created}=getOrCreateNode(V3(x,y,0),'support');
  if(created){afterChange();toast(`Опора (${fmt(x)}; ${fmt(y)})`,{type:'ok',timeout:1500})}else{undoStack.pop();updateUndoUI();toast('Здесь уже есть опора',{type:'info'})}},
 rowX:ctx=>actRowSup('rowX',ctx),
 rowY:ctx=>actRowSup('rowY',ctx),
 group:()=>groupModal(),
 copy:()=>copySelection(),
 clone:()=>cloneModal(),
 hide:()=>hideSelection(),
 isolate:()=>isolateSelection()};
$('#paneProps').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;
 const f=PROPS_ACTS[b.dataset.act];if(!f)return;
 f({n1:sel.nodes.size===1?M.nodes.get([...sel.nodes][0]):null,
    r1:sel.rods.size===1?M.rods.get([...sel.rods][0]):null,
    p1:sel.planes.size===1?M.planes.get([...sel.planes][0]):null})});
/* ---- data-k field change handlers; ctx={k,v,n1,r1,p1} ---- */
function changeCoord(ctx){const{v,n1}=ctx;const val=parseFloat(v.replace(',','.'));if(!isFinite(val))return;pushUndo();
 const p=n1.p.clone();p[ctx.k]=val;moveNodeTo(n1,p);afterChange()}
const PROPS_CHANGE={
 nodeName:({v,n1})=>{if(n1){pushUndo();n1.name=v.trim()||n1.name;afterChange()}},
 x:changeCoord,y:changeCoord,z:changeCoord,
 hostDist:({v,n1})=>{if(n1&&n1.host){const r=M.rods.get(n1.host.rod);if(r){pushUndo();const L=rodLen(r);
  const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;moveNodeTo(n1,a.clone().lerp(b,clamp((parseFloat(v)||0)/L,0,1)));afterChange()}}},
 rodName:({v,r1})=>{if(r1){pushUndo();r1.name=v.trim()||r1.name;afterChange()}},
 rodType:({v,r1})=>{if(r1&&TYPES[v]){pushUndo();r1.type=v;afterChange()}},
 bulkType:({v})=>{if(v&&TYPES[v]){pushUndo();sel.rods.forEach(id=>{const r=M.rods.get(id);if(r)r.type=v});afterChange();toast('Тип изменён у '+sel.rods.size+' стержней',{type:'ok'})}},
 planeName:({v,p1})=>{if(p1){pushUndo();p1.name=v.trim()||p1.name;afterChange()}},
 colH:({v})=>{params.colH=Math.max(100,parseFloat(v)||2500);syncParams();saveParams();updateHint()}};
$('#paneProps').addEventListener('change',e=>{const k=e.target.dataset.k;if(!k)return;
 const f=PROPS_CHANGE[k];if(!f)return;
 f({k,v:e.target.value,
    n1:sel.nodes.size===1?M.nodes.get([...sel.nodes][0]):null,
    r1:sel.rods.size===1?M.rods.get([...sel.rods][0]):null,
    p1:sel.planes.size===1?M.planes.get([...sel.planes][0]):null})});
function updateCounts(){const sup=nodeArr().filter(n=>n.type==='support').length;
 $('#stCounts').textContent=`узлы ${M.nodes.size} • опоры ${sup} • стержни ${M.rods.size} • плоскости ${M.planes.size}`}
