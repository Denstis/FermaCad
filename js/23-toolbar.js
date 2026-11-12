/* ==================== TOOLBAR & TOPBAR ==================== */
'use strict';
/* ================= TOOLBAR & TOPBAR ================= */
function buildToolbar(){const tb=$('#toolbar');let html='';
 TOOL_DEFS.forEach(t=>{if(t.sec){html+=`<div class="tlabel">${t.sec}</div>`;return}
  html+=`<button class="tool" data-tool="${t.id}" data-tip="${esc(t.label)} (${t.hk})" ${t.c?`style="--tc:${cssColor(t.c)}"`:''}>${t.c?'<span class="dot"></span>':''}<i>${ICONS[t.ic]}</i><span class="hk">${t.hk}</span></button>`});
 html+='<div style="flex:1"></div><div class="tlabel">ВИД</div><button class="tool" id="tbFit" data-tip="Вписать всё (F)"><i>'+ICONS.fit+'</i><span class="hk">F</span></button>';
 tb.innerHTML=html;
 tb.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
 $('#tbFit').onclick=fitAll}
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
