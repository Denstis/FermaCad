/* ==================== SERIALIZE / UNDO / afterChange / autosave ==================== */
'use strict';
/* ================= SERIALIZE / UNDO ================= */
function serialize(){return{v:1,name:M.name,counters:M.counters,
 nodes:nodeArr().map(n=>({id:n.id,p:n.p.toArray(),type:n.type,host:n.host,name:n.name})),
 rods:[...M.rods.values()].map(r=>({id:r.id,a:r.a,b:r.b,type:r.type,name:r.name})),
 planes:[...M.planes.values()].map(p=>({id:p.id,nodes:p.nodes,name:p.name})),
 groups:[...M.groups.values()].map(g=>({...g})),hidden:[...M.hidden],measures:M.measures.map(m=>({a:m.a.toArray(),b:m.b.toArray()})),views:M.views.map(v=>({...v}))}}
function deserialize(d){M=freshModel();M.name=d.name||'Проект';Object.assign(M.counters,d.counters||{});
 (d.nodes||[]).forEach(n=>M.nodes.set(n.id,{id:n.id,p:V3(...n.p),type:n.type||'node',host:n.host||null,name:n.name||'Узел-'+n.id}));
 (d.rods||[]).forEach(r=>{if(M.nodes.has(r.a)&&M.nodes.has(r.b)&&TYPES[r.type])M.rods.set(r.id,{...r})});
 (d.planes||[]).forEach(p=>{if(p.nodes.every(id=>M.nodes.has(id)))M.planes.set(p.id,{...p})});
 (d.groups||[]).forEach(g=>M.groups.set(g.id,{...g}));
 M.hidden=new Set(d.hidden||[]);M.measures=(d.measures||[]).map(m=>({a:V3(...m.a),b:V3(...m.b)}));M.views=d.views||[];
 _uid=Math.max(_uid,...[...M.nodes.keys(),...M.rods.keys(),...M.planes.keys(),...M.groups.keys()].map(x=>x+1),1000);
 sel={nodes:new Set(),rods:new Set(),planes:new Set()};chain.a=null;paste=null;planePick=[];measPick=null}
function pushUndo(){undoStack.push(serialize());if(undoStack.length>100)undoStack.shift();redoStack.length=0;updateUndoUI()}
function undo(){if(!undoStack.length)return;redoStack.push(serialize());deserialize(undoStack.pop());afterChange(true);updateUndoUI();toast('Отменено',{type:'info',timeout:1200})}
function redo(){if(!redoStack.length)return;undoStack.push(serialize());deserialize(redoStack.pop());afterChange(true);updateUndoUI();toast('Повторено',{type:'info',timeout:1200})}
function updateUndoUI(){$('#btnUndo').disabled=!undoStack.length;$('#btnRedo').disabled=!redoStack.length}
const scheduleAuto=debounce(()=>{try{localStorage.setItem('fc.auto',JSON.stringify({data:serialize(),mode,ts:Date.now()}))}catch(e){}},900);
function afterChange(skipProps){rebuildScene();renderTree();renderProps();updateCounts();updateModeUI();coachUpdate();scheduleAuto();updateHint();updateToolAvail&&updateToolAvail()}
