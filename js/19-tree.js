/* ==================== TREE: model tree panel render + interactions ==================== */
'use strict';
/* ---- row builders ---- */
const HID_PREFIX={node:'n',rod:'r',plane:'p',meas:'m'};
function hiddenKey(k,id){return (HID_PREFIX[k]||k[0])+id}
function treeEyeBtn(k,id){const key=hiddenKey(k,id);return `<button class="eye" data-eye="${key}" data-tip="${M.hidden.has(key)?'Показать':'Скрыть'}"><i>${M.hidden.has(key)?ICONS.eyeoff:ICONS.eye}</i></button>`}
function treeItemRow(k,id,color,nm,sub){const hid=M.hidden.has(hiddenKey(k,id));const s=sel[k+'s'].has(id);
 return`<div class="titem${s?' sel':''}${hid?' hid':''}" data-el="${k}:${id}"><span class="dot" style="background:${color};color:${color}"></span><span class="nm">${esc(nm)}</span><span class="sub">${esc(sub)}</span>${treeEyeBtn(k,id)}</div>`}
const treeSecOpen={};
function treeSection(title,cnt,inner,open=true){const on=(title in treeSecOpen)?treeSecOpen[title]:open;
 return cnt?`<details class="tsec"${on?' open':''}><summary>${title}<span class="cnt">${cnt}</span></summary>${inner}</details>`:''}
function treePlaneRow(p){return `<div class="titem${sel.planes.has(p.id)?' sel':''}${M.hidden.has(hiddenKey('plane',p.id))?' hid':''}" data-el="plane:${p.id}"><span class="dot" style="background:#6fd3ff;color:#6fd3ff"></span><span class="nm">${esc(p.name)}</span><span class="sub">${p.poly&&p.poly.length>=3?p.poly.length+' верш.':'3 узла'}</span><button class="eye" data-open-plane="${p.id}"><i>${ICONS.edit}</i></button>${treeEyeBtn('plane',p.id)}</div>`}
function treeGroupRow(g){return `<div class="titem" data-group="${g.id}"><span class="dot" style="background:#ffb020;color:#ffb020"></span><span class="nm">${esc(g.name)}</span><span class="sub">${g.nodes.length} узл • ${g.rods.length} ст</span><button class="eye" data-ungroup="${g.id}"><i>${ICONS.close}</i></button></div>`}
function treeMeasureRow(m,i){return `<div class="titem${M.hidden.has(hiddenKey('meas',i))?' hid':''}" data-meas="${i}"><span class="dot" style="background:#ffc53d;color:#ffc53d"></span><span class="nm">Размер ${i+1}</span><span class="sub">${fmt(m.a.distanceTo(m.b))} мм</span>${treeEyeBtn('meas',i)}</div>`}
function renderTree(){const q=($('#treeSearch').value||'').toLowerCase();const list=$('#treeList');
 const match=s=>!q||s.toLowerCase().includes(q);
 const sup=nodeArr().filter(n=>n.type==='support'&&match(n.name));
 const nod=nodeArr().filter(n=>n.type==='node'&&match(n.name));
 let rods=[...M.rods.values()].filter(r=>match(r.name)||match(TYPES[r.type].label));
 rods.sort($('#treeSort').value==='len'?(a,b)=>rodLen(b)-rodLen(a):(a,b)=>a.name.localeCompare(b.name,'ru',{numeric:true}));
 list.innerHTML=
  treeSection('ОПОРЫ',sup.length,sup.map(n=>treeItemRow('node',n.id,cssColor(SUP_COLOR),n.name,`${fmt(n.p.x)}; ${fmt(n.p.y)}`)).join(''))+
  treeSection('УЗЛЫ',nod.length,nod.map(n=>treeItemRow('node',n.id,cssColor(NODE_COLOR),n.name,n.host?`на ${M.rods.get(n.host.rod)?.name||'?'} • ${Math.round(n.host.t*100)}%`:`${fmt(n.p.x)}; ${fmt(n.p.y)}; ${fmt(n.p.z)}`)).join(''),nod.length<25)+
  treeSection('СТЕРЖНИ',rods.length,rods.map(r=>treeItemRow('rod',r.id,cssColor(TYPES[r.type].color),r.name,`${TYPES[r.type].label} • L=${fmt(rodLen(r))}`)).join(''),rods.length<25)+
  treeSection('ПЛОСКОСТИ',M.planes.size,[...M.planes.values()].filter(p=>match(p.name)).map(treePlaneRow).join(''))+
  treeSection('ГРУППЫ',M.groups.size,[...M.groups.values()].map(treeGroupRow).join(''))+
  treeSection('ИЗМЕРЕНИЯ',M.measures.length,M.measures.map(treeMeasureRow).join(''));
 if(!list.innerHTML)list.innerHTML='<p style="color:var(--dim);font-size:11px;padding:10px">Модель пуста. Поставьте опоры или загрузите демо.</p>'}
function markTreeSel(){$$('#treeList .titem[data-el]').forEach(el=>{const[k,id]=el.dataset.el.split(':');el.classList.toggle('sel',sel[k+'s'].has(+id))})}
$('#paneTree').addEventListener('click',e=>{const eye=e.target.closest('[data-eye]');
 if(eye){const k=eye.dataset.eye;M.hidden.has(k)?M.hidden.delete(k):M.hidden.add(k);afterChange();return}
 const op=e.target.closest('[data-open-plane]');if(op){enterPlanPlane(+op.dataset.openPlane);return}
 const ug=e.target.closest('[data-ungroup]');if(ug){pushUndo();M.groups.delete(+ug.dataset.ungroup);afterChange();toast('Группа расформирована',{type:'info'});return}
 const gr=e.target.closest('[data-group]');if(gr){const g=M.groups.get(+gr.dataset.group);if(g){sel.nodes=new Set(g.nodes);sel.rods=new Set(g.rods);sel.planes.clear();selectionChanged()}return}
 const it=e.target.closest('[data-el]');if(it){const[k,id]=it.dataset.el.split(':');
  if(e.ctrlKey)sel[k+'s'].has(+id)?sel[k+'s'].delete(+id):sel[k+'s'].add(+id);else selectOnly(k,+id);selectionChanged()}});
$('#paneTree').addEventListener('dblclick',e=>{const it=e.target.closest('[data-el]');if(it){const[k,id]=it.dataset.el.split(':');selectOnly(k,+id);zoomToSelection()}});
$('#treeSearch').addEventListener('input',renderTree);$('#treeSort').addEventListener('change',renderTree);
$('#paneTree').addEventListener('toggle',e=>{const d=e.target;if(d&&d.matches&&d.matches('details.tsec')){const s=d.querySelector('summary');treeSecOpen[s.childNodes[0].textContent]=d.open}},true);
$('#btnShowAll').onclick=showAll;$('#btnOrphans').onclick=clearOrphans;
