/* ==================== SAVES / EXPORT: localStorage saves, JSON/OBJ export, import ==================== */
'use strict';
/* ================= SAVES / EXPORT ================= */
function getSaves(){try{return JSON.parse(localStorage.getItem('fc.saves'))||{}}catch(e){return{}}}
function saveQuick(){M.name=$('#projName').value.trim()||'Проект';const s=getSaves();
 s[M.name]={ts:Date.now(),data:serialize()};
 try{localStorage.setItem('fc.saves',JSON.stringify(s));savedOnce=true;coachUpdate();toast(`Сохранено «${M.name}»`,{type:'ok'})}
 catch(e){toast('Не удалось сохранить (хранилище недоступно)',{type:'err'})}}
function savesModal(){const s=getSaves();const rows=Object.entries(s).sort((a,b)=>b[1].ts-a[1].ts).map(([name,v])=>
  `<div class="saverow"><div class="inf"><b>${esc(name)}</b><small>${new Date(v.ts).toLocaleString('ru-RU')} • узлов ${v.data.nodes.length} • стержней ${v.data.rods.length}</small></div>
   <button class="btn" data-load="${esc(name)}">Открыть</button><button class="btn warn" data-del="${esc(name)}">✕</button></div>`).join('')||'<p>Сохранённых проектов пока нет.</p>';
 openModal('Проекты',`<div class="row"><input id="svName" value="${esc(M.name)}" placeholder="Имя проекта"><button class="btn prim" id="svSave" style="width:auto;flex:none;margin:0">Сохранить текущий</button></div>
  <div style="max-height:280px;overflow-y:auto;margin:10px 0">${rows}</div>
  <div class="btnrow"><button class="btn" id="svNew">Новый проект</button><button class="btn" id="svImp">Импорт JSON</button><button class="btn" id="svExp">Экспорт JSON</button><button class="btn" id="svObj">Экспорт OBJ</button></div>`,[],
  ()=>{$('#svSave').onclick=()=>{M.name=$('#svName').value.trim()||'Проект';saveQuick();closeModal();savesModal()};
   $('#svNew').onclick=()=>{closeModal();newProject()};$('#svImp').onclick=()=>{closeModal();$('#fileInput').click()};
   $('#svExp').onclick=()=>{closeModal();exportJSON()};$('#svObj').onclick=()=>{closeModal();exportOBJ()};
   $$('#mbody [data-load]').forEach(b=>b.onclick=()=>{const v=getSaves()[b.dataset.load];if(v){pushUndo();deserialize(v.data);
    if(M.rods.size){mode='3d';ever3d=true;scene.fog=new THREE.Fog(linColor(0x0a1322),60000,240000)}else{mode='plan';planCtx={kind:'xy'};setPlanBasis(V3(),AX,AY,AZ);scene.fog=null}
    rebuildGrid();setTool('select');afterChange();fitAll();closeModal();toast(`Открыт «${b.dataset.load}»`,{type:'ok'})}});
   $$('#mbody [data-del]').forEach(b=>b.onclick=()=>{const ss=getSaves();delete ss[b.dataset.del];localStorage.setItem('fc.saves',JSON.stringify(ss));closeModal();savesModal()})})}
function newProject(){confirmModal('Новый проект','Текущая модель будет очищена (действие можно отменить через Ctrl+Z).',()=>{
 pushUndo();M=freshModel();undoStack.length=0;redoStack.length=0;updateUndoUI();
 mode='plan';planCtx={kind:'xy'};setPlanBasis(V3(),AX,AY,AZ);scene.fog=null;
 pl.g.ca=3000;pl.g.cb=1500;pl.g.zoom=.055;
 rebuildGrid();setTool('support');afterChange();toast('Новый проект • расставьте опоры',{type:'info'})},'Создать')}
function exportJSON(){M.name=$('#projName').value.trim()||'Проект';download(M.name+'.framecad.json',JSON.stringify(serialize(),null,1));toast('Экспортирован JSON',{type:'ok'})}
function exportOBJ(){M.name=$('#projName').value.trim()||'Проект';
 const ids=[...M.nodes.keys()];const idx=new Map(ids.map((id,i)=>[id,i+1]));
 let s='# ФЕРМА·CAD — осевая модель, единицы: мм, Z — вертикаль\no '+M.name.replace(/\s+/g,'_')+'\n';
 ids.forEach(id=>{const p=M.nodes.get(id).p;s+=`v ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n`});
 ROD_KEYS.forEach(k=>{const rs=[...M.rods.values()].filter(r=>r.type===k);if(!rs.length)return;s+='g '+TYPES[k].prefix+'\n';
  rs.forEach(r=>{const pts=[r.a,...hostedNodes(r.id).map(n=>n.id),r.b];
   for(let i=0;i<pts.length-1;i++)s+=`l ${idx.get(pts[i])} ${idx.get(pts[i+1])}\n`})});
 const sup=ids.filter(id=>M.nodes.get(id).type==='support');
 if(sup.length){s+='g Supports\n';sup.forEach(id=>s+=`p ${idx.get(id)}\n`)}
 download(M.name+'.obj',s,'text/plain');toast('Экспортирован OBJ (оси стержней)',{type:'ok'})}
$('#fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;
 const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);
   if(!Array.isArray(d.nodes)||!Array.isArray(d.rods))throw new Error('format');
   pushUndo();deserialize(d);
   if(M.rods.size){mode='3d';ever3d=true;scene.fog=new THREE.Fog(linColor(0x0a1322),60000,240000)}else{mode='plan';planCtx={kind:'xy'};setPlanBasis(V3(),AX,AY,AZ);scene.fog=null}
   rebuildGrid();setTool('select');afterChange();fitAll();toast(`Импортирован «${M.name}»`,{type:'ok'})}
  catch(x){toast('Файл не является проектом ФЕРМА·CAD',{type:'err'})}};
 rd.readAsText(f);e.target.value=''});
