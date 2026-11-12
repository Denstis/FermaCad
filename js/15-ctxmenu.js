/* ==================== CONTEXT MENU: ctxAt menus, hide/show/isolate ==================== */
'use strict';
/* ================= CONTEXT MENU ================= */
function showMenu(items,x,y){const m=$('#ctxMenu');
 m.innerHTML=items.map(it=>it.sep?'<div class="msep"></div>':it.title?`<div class="mtitle">${esc(it.title)}</div>`:
  `<button class="mi${it.dis?' dis':''}${it.danger?' danger':''}">${it.ic?`<i>${ICONS[it.ic]||''}</i>`:'<i></i>'}<span>${esc(it.label)}</span>${it.hk?`<span class="hk">${it.hk}</span>`:''}</button>`).join('');
 m.style.display='block';const mw=m.offsetWidth,mh=m.offsetHeight;
 m.style.left=clamp(x,4,innerWidth-mw-6)+'px';m.style.top=clamp(y,4,innerHeight-mh-6)+'px';
 let bi=0;m.querySelectorAll('.mi').forEach(b=>{const it=items.filter(i=>!i.sep&&!i.title)[bi++];
  b.onclick=()=>{hideCtx();it.fn&&it.fn()}})}
function hideCtx(){$('#ctxMenu').style.display='none'}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#ctxMenu'))hideCtx()},true);
function ctxAt(cx,cy){const h=pickAt(cx,cy);
 if(h){const set=sel[h.kind+'s'];if(!set.has(h.id))selectOnly(h.kind,h.id);
  const items=[{title:h.kind==='node'?M.nodes.get(h.id).name:h.kind==='rod'?M.rods.get(h.id).name+' • '+TYPES[M.rods.get(h.id).type].label:M.planes.get(h.id).name}];
  if(h.kind==='node'){const n=M.nodes.get(h.id);
   items.push({label:'Приблизить',ic:'zoom',fn:zoomToSelection},
    {label:`Столб ${fmt(params.colH)} мм`,ic:'column',fn:()=>{pushUndo();const t=getOrCreateNode(n.p.clone().add(V3(0,0,params.colH)));const r=addRod(n.id,t.node.id,'column');if(r){afterChange();toast('＋ '+r.name,{type:'ok',timeout:1400})}else{undoStack.pop();updateUndoUI();toast('Столб уже существует',{type:'warn'})}}},
    {label:'Стойка вверх до стержня',ic:'post',fn:()=>{const t=postTarget(n);if(!t){toast('Нет пересечения выше',{type:'warn'});return}pushUndo();const res=nodeOnRod(t.rod,t.t);const r=addRod(n.id,res.node.id,'post');if(r){afterChange();toast('＋ '+r.name,{type:'ok'})}else{undoStack.pop();updateUndoUI()}}},
    {sep:1},{label:n.type==='support'?'Выделить все опоры':'Выделить все узлы',ic:'similar',fn:()=>{sel.nodes.clear();M.nodes.forEach(m=>{if(m.type===n.type)sel.nodes.add(m.id)});selectionChanged()}})}
  if(h.kind==='rod'){const r=M.rods.get(h.id);
   items.push({label:'Открыть в чертеже',ic:'edit',hk:'2×клик',fn:()=>enterPlanRod(r.id)},
    {label:'Узел на середине',ic:'mid',fn:()=>{pushUndo();const res=nodeOnRod(r,.5);if(res.created){afterChange();toast('Узел добавлен',{type:'ok'})}else{undoStack.pop();updateUndoUI();toast('Узел уже есть',{type:'info',timeout:1500})}}},
    {label:'Разделить на N частей…',ic:'split',fn:()=>splitModal(r)},
    {sep:1},{label:'Выделить все: '+TYPES[r.type].label,ic:'similar',fn:()=>{sel.rods.clear();M.rods.forEach(m=>{if(m.type===r.type)sel.rods.add(m.id)});selectionChanged()}})}
  if(h.kind==='plane')items.push({label:'Чертёж плоскости',ic:'edit',hk:'2×клик',fn:()=>enterPlanPlane(h.id)});
  items.push({sep:1},{label:'Копировать',ic:'copy',hk:'Ctrl+C',fn:copySelection},
   {label:'Клонировать массивом…',ic:'clone',fn:cloneModal},
   {label:'Скрыть',ic:'hide',hk:'H',fn:hideSelection},
   {sep:1},{label:'Удалить',ic:'trash',hk:'Del',danger:true,fn:deleteSelection});
  showMenu(items,cx,cy)}
 else{const items=[{title:mode==='plan'?'ЧЕРТЁЖ':'3D ВИД'},
   {label:'Вставить',ic:'copy',hk:'Ctrl+V',dis:!clipboard,fn:startPaste},
   {label:'Вписать всё',ic:'fit',hk:'F',fn:fitAll},{sep:1}];
  if(mode==='3d')items.push({label:'Вид сверху',ic:'grid',fn:()=>setViewDir(V3(0,0,1))},{label:'Чертёж XY',ic:'edit',fn:enterPlanXY});
  else items.push({label:'Закрыть чертёж → 3D',ic:'arrow',fn:exitPlan});
  items.push({sep:1},{label:'Показать все элементы',ic:'eye',fn:showAll},{label:'Сохранить проект',ic:'save',hk:'Ctrl+S',fn:saveQuick});
  showMenu(items,cx,cy)}}
function hideSelection(){sel.nodes.forEach(id=>M.hidden.add('n'+id));sel.rods.forEach(id=>M.hidden.add('r'+id));
 sel.nodes.clear();sel.rods.clear();afterChange();toast('Скрыто • «Показать все» на вкладке Модель',{type:'info'})}
function showAll(){M.hidden.clear();afterChange()}
function isolateSelection(){M.hidden.clear();const{ns,rs}=gatherSelection();
 M.nodes.forEach(n=>{if(!ns.has(n.id))M.hidden.add('n'+n.id)});M.rods.forEach(r=>{if(!rs.has(r.id))M.hidden.add('r'+r.id)});
 afterChange();toast('Изолировано выделение',{type:'info'})}
