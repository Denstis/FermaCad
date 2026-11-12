/* ==================== MODALS & TOASTS: openModal, clone/split/group/help modals ==================== */
'use strict';
/* ================= MODALS & TOASTS ================= */
let modalOpen=false;
function openModal(title,body,actions=[],onOpen){modalOpen=true;const w=$('#modalWrap'),c=$('#modalCard');
 c.innerHTML=`<h2>${title}<button class="x" id="mx">${ICONS.close}</button></h2><div id="mbody">${body}</div><div class="mactions" id="mact"></div>`;
 w.classList.add('on');$('#mx').onclick=closeModal;
 actions.forEach(a=>{const b=document.createElement('button');b.className='btn'+(a.primary?' prim':'')+(a.warn?' warn':'');b.textContent=a.label;
  b.onclick=()=>{if(a.fn)a.fn();if(!a.keep)closeModal()};$('#mact').appendChild(b)});
 if(!actions.length)$('#mact').style.display='none';
 if(onOpen)onOpen();fillIcons(c)}
function closeModal(){modalOpen=false;$('#modalWrap').classList.remove('on')}
$('#modalWrap').addEventListener('pointerdown',e=>{if(e.target.id==='modalWrap')closeModal()});
function toast(msg,opt={}){const{type='info',timeout=3800,action}=opt;const t=document.createElement('div');
 t.className='toast '+type;t.innerHTML=`<i>${ICONS[type==='ok'?'check':type==='warn'?'warn':type==='err'?'warn':'info']}</i><span style="flex:1">${esc(msg)}</span>`;
 if(action){const b=document.createElement('button');b.textContent=action.label;b.onclick=()=>{action.fn();kill()};t.appendChild(b)}
 $('#toasts').appendChild(t);const kill=()=>{t.classList.add('out');setTimeout(()=>t.remove(),320)};
 setTimeout(kill,timeout);while($('#toasts').children.length>4)$('#toasts').firstChild.remove()}
function cloneModal(){if(!selCount()){toast('Сначала выделите элементы',{type:'warn'});return}
 openModal('Клонировать массивом',`<p>Выделенные элементы копируются со смещением по оси. Узлы в совпадающих точках объединяются — копии соединяются в общий каркас.</p>
  <div class="row"><label>Ось</label><select id="cmAxis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></div>
  <div class="row"><label>Шаг</label><input type="number" id="cmStep" value="${params.clStep}" step="100"><span class="unit">мм</span></div>
  <div class="row"><label>Копий</label><input type="number" id="cmCount" value="${params.clCount}" min="1" max="50"></div>`,
  [{label:'Отмена'},{label:'Клонировать',primary:true,fn:()=>{const ax=$('#cmAxis').value,st=+$('#cmStep').value||3000,co=clamp(+$('#cmCount').value||1,1,50);
   params.clAxis=ax;params.clStep=st;params.clCount=co;syncParams();cloneSelection(ax,st,co)}}],
  ()=>{$('#cmAxis').value=params.clAxis})}
function splitModal(r){openModal('Разделить стержень '+r.name,`<p>Длина ${fmt(rodLen(r))} мм. Узлы будут созданы на оси через равные доли (существующие сохраняются).</p>
  <div class="row"><label>Частей N</label><input type="number" id="spN" value="4" min="2" max="60"></div>`,
  [{label:'Отмена'},{label:'Разделить',primary:true,fn:()=>splitRod(r,+$('#spN').value||4)}],()=>{$('#spN').focus();$('#spN').select()})}
function groupModal(){if(!selCount()){toast('Сначала выделите элементы',{type:'warn'});return}
 openModal('Новая группа',`<div class="row"><label>Имя</label><input id="grName" value="Группа-${M.counters.g+1}"></div>`,
  [{label:'Отмена'},{label:'Создать',primary:true,fn:()=>groupSelection($('#grName').value.trim()||'Группа')}],()=>{$('#grName').focus();$('#grName').select()})}
function confirmModal(title,text,fn,label='Подтвердить'){openModal(title,`<p>${text}</p>`,[{label:'Отмена'},{label,primary:true,fn}])}
function helpModal(){openModal('Справка • ФЕРМА·CAD',`
 <p><b style="color:var(--acc)">Рабочий процесс:</b> Чертёж XY → опоры (привязки к сетке, узлам, перпендикулярам/параллелям, автоматические размеры) → <b>«Закрыть чертёж»</b> → 3D: столбы (⊥ XY, высота в параметрах), стойки (вверх до пересечения — узел создаётся автоматически), пояса и раскосы между узлами. <b>2×клик по стержню</b> — его чертёж с параметрическими узлами (доли L, шаг, точное расстояние). <b>Плоскость по 3 узлам</b> (L) — 2×клик открывает чертёж в её плоскости.</p>
 <table class="htable"><tr><td>ЛКМ</td><td>действие инструмента / выделение / рамка / перетаскивание узла</td></tr>
 <tr><td>Колесо</td><td>зум к курсору</td></tr><tr><td>СКМ (тяга)</td><td>панорама</td></tr>
 <tr><td>ПКМ (тяга)</td><td>орбита в 3D</td></tr><tr><td>ПКМ (клик)</td><td>контекстное меню элемента</td></tr>
 <tr><td>Нав-куб</td><td>грани/рёбра/углы — стандартные виды</td></tr></table>
 <div class="hgrid"><div>Выбор <kbd>V</kbd></div><div>Узел <kbd>N</kbd></div><div>Опора <kbd>O</kbd></div><div>Стержни <kbd>1–9</kbd></div>
 <div>Плоскость <kbd>L</kbd></div><div>Измерение <kbd>M</kbd></div><div>Вписать <kbd>F</kbd></div><div>Скрыть <kbd>H</kbd></div>
 <div>Отмена <kbd>Ctrl+Z</kbd></div><div>Повтор <kbd>Ctrl+Y</kbd></div><div>Копия / вставка <kbd>Ctrl+C/V</kbd></div><div>Клон с шагом <kbd>Ctrl+D</kbd></div>
 <div>Группа <kbd>Ctrl+G</kbd></div><div>Сохранить <kbd>Ctrl+S</kbd></div><div>Удалить <kbd>Del</kbd></div><div>Закрыть чертёж <kbd>Enter</kbd></div></div>
 <p style="margin-bottom:6px"><b style="color:var(--acc2)">Типы стержней:</b></p><div class="legend">${ROD_KEYS.map(k=>`<div><span class="dot" style="background:${cssColor(TYPES[k].color)};color:${cssColor(TYPES[k].color)}"></span>${TYPES[k].label} <kbd>${TYPES[k].hk}</kbd></div>`).join('')}</div>
 <p style="margin-top:12px">Форматы: <b>JSON</b> (полный проект, импорт/экспорт), <b>OBJ</b> (геометрия осей для CAD/BIM). Автосохранение — в браузере.</p>`,
  [{label:'Закрыть',primary:true}])}
