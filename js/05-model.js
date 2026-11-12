/* ==================== MODEL OPS: nodes/rods CRUD, planes, clone/copy/paste, split, orphans ==================== */
'use strict';
/* ================= MODEL OPS ================= */
function nodeArr(){return[...M.nodes.values()]}
function rodLen(r){const a=M.nodes.get(r.a),b=M.nodes.get(r.b);return a&&b?a.p.distanceTo(b.p):0}
function hostedNodes(rodId){return nodeArr().filter(n=>n.host&&n.host.rod===rodId).sort((x,y)=>x.host.t-y.host.t)}
function attachedRods(nodeId){return[...M.rods.values()].filter(r=>r.a===nodeId||r.b===nodeId)}
function findNodeAt(p,tol=.5){for(const n of M.nodes.values())if(n.p.distanceTo(p)<tol)return n;return null}
function getOrCreateNode(p,type='node',host=null){const ex=findNodeAt(p);
 if(ex){if(type==='support'&&ex.type!=='support'){ex.type='support';ex.name='Опора-'+(++M.counters.o)}return{node:ex,created:false}}
 const id=uid();const n={id,p:p.clone(),type,host,name:type==='support'?'Опора-'+(++M.counters.o):'Узел-'+(++M.counters.n)};
 M.nodes.set(id,n);bornIds.add(id);return{node:n,created:true}}
function addRod(aId,bId,type){if(aId===bId)return null;
 for(const r of M.rods.values())if((r.a===aId&&r.b===bId)||(r.a===bId&&r.b===aId))return null;
 const id=uid();const r={id,a:aId,b:bId,type,name:TYPES[type].prefix+'-'+(++M.counters.r)};M.rods.set(id,r);return r}
function nodeOnRod(rod,t){t=clamp(t,0,1);const a=M.nodes.get(rod.a).p,b=M.nodes.get(rod.b).p;const p=a.clone().lerp(b,t);
 if(t<1e-4)return{node:M.nodes.get(rod.a),created:false};if(t>1-1e-4)return{node:M.nodes.get(rod.b),created:false};
 for(const n of hostedNodes(rod.id))if(Math.abs(n.host.t-t)<1e-4)return{node:n,created:false};
 const ex=findNodeAt(p,1);if(ex)return{node:ex,created:false};
 const id=uid();const n={id,p,type:'node',host:{rod:rod.id,t},name:'Узел-'+(++M.counters.n)};M.nodes.set(id,n);bornIds.add(n.id);return{node:n,created:true}}
function postTarget(node){let best=null;
 for(const r of M.rods.values()){if(M.hidden.has('r'+r.id))continue;const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
  const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)<1e-6&&Math.abs(dy)<1e-6)continue;
  let t=Math.abs(dx)>=Math.abs(dy)?(node.p.x-a.x)/dx:(node.p.y-a.y)/dy;
  if(t<-1e-6||t>1+1e-6)continue;t=clamp(t,0,1);
  if(Math.hypot(a.x+dx*t-node.p.x,a.y+dy*t-node.p.y)>1)continue;
  const z=a.z+(b.z-a.z)*t;if(z<=node.p.z+1)continue;
  if(!best||z<best.z)best={rod:r,t,z}}
 return best}
function deleteSets(seedN,seedR){const dn=new Set(seedN),dr=new Set(seedR);let grew=true;
 while(grew){grew=false;
  for(const r of M.rods.values()){if(dr.has(r.id))continue;if(dn.has(r.a)||dn.has(r.b)){dr.add(r.id);grew=true}}
  for(const n of M.nodes.values()){if(dn.has(n.id))continue;if(n.host&&dr.has(n.host.rod)){dn.add(n.id);grew=true}}}
 dn.forEach(id=>M.nodes.delete(id));dr.forEach(id=>M.rods.delete(id));
 for(const[id,p]of[...M.planes])if(p.nodes.some(n=>!M.nodes.has(n)))M.planes.delete(id);
 for(const g of M.groups.values()){g.nodes=g.nodes.filter(id=>M.nodes.has(id));g.rods=g.rods.filter(id=>M.rods.has(id))}
 sel.nodes.forEach(id=>{if(!M.nodes.has(id))sel.nodes.delete(id)});sel.rods.forEach(id=>{if(!M.rods.has(id))sel.rods.delete(id)});sel.planes.forEach(id=>{if(!M.planes.has(id))sel.planes.delete(id)});
 [...M.hidden].forEach(k=>{const id=+k.slice(1);if(k[0]==='n'&&!M.nodes.has(id)||k[0]==='r'&&!M.rods.has(id))M.hidden.delete(k)});
 if(chain.a&&!M.nodes.has(chain.a.id))chain.a=null;
 return{n:dn.size,r:dr.size}}
function deleteSelection(){if(!selCount())return;pushUndo();
 const c=deleteSets(sel.nodes,sel.rods);sel.planes.forEach(id=>M.planes.delete(id));
 sel.nodes.clear();sel.rods.clear();sel.planes.clear();afterChange();
 toast(`Удалено: узлов ${c.n}, стержней ${c.r}`,{type:'warn',action:{label:'Отменить',fn:undo}})}
function moveNodeTo(n,p){if(n.host){const r=M.rods.get(n.host.rod);if(r){const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
  const u=b.clone().sub(a);const L=u.length();u.normalize();n.host.t=clamp(p.clone().sub(a).dot(u)/L,0,1);n.p.copy(a).addScaledVector(u,n.host.t*L)}else n.p.copy(p)}
 else{n.p.copy(p);for(const r of attachedRods(n.id))for(const h of hostedNodes(r.id)){const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;h.p.copy(a).lerp(b,h.host.t)}}}
function refreshAfterMove(n){refreshNodePos(n.id);for(const r of attachedRods(n.id)){refreshRodGeom(r.id);for(const h of hostedNodes(r.id))refreshNodePos(h.id)}
 updateSelBox();dimsDirty=true;shadowsDirty=true}
function planeBasis(ids){const A=M.nodes.get(ids[0]),B=M.nodes.get(ids[1]),C=M.nodes.get(ids[2]);if(!A||!B||!C)return null;
 const u=B.p.clone().sub(A.p);const w=C.p.clone().sub(A.p);const n=u.clone().cross(w);if(n.length()<1)return null;
 n.normalize();u.normalize();const v=n.clone().cross(u).normalize();return{o:A.p.clone(),u,v,n}}
function makePlane(ids){const b=planeBasis(ids);if(!b){toast('Узлы лежат на одной прямой — плоскость не построена',{type:'err'});return null}
 const id=uid();const p={id,nodes:[...ids],name:'Плоскость-'+(++M.counters.p)};M.planes.set(id,p);return p}
function gatherSelection(){const ns=new Set(sel.nodes),rs=new Set(sel.rods);
 sel.rods.forEach(id=>{const r=M.rods.get(id);if(r){ns.add(r.a);ns.add(r.b)}});
 rs.forEach(id=>{});for(const r of M.rods.values())if(ns.has(r.a)&&ns.has(r.b)&&sel.rods.has(r.id))rs.add(r.id);
 return{ns,rs}}
function cloneSelection(axis,step,count){const{ns,rs}=gatherSelection();if(!ns.size){toast('Сначала выделите элементы',{type:'warn'});return}
 pushUndo();const off=V3(axis==='x'?step:0,axis==='y'?step:0,axis==='z'?step:0);
 const newN=new Set(),newR=new Set();
 for(let i=1;i<=count;i++){const map=new Map();const o=off.clone().multiplyScalar(i);
  ns.forEach(id=>{const n=M.nodes.get(id);const{node}=getOrCreateNode(n.p.clone().add(o),n.type);map.set(id,node.id);newN.add(node.id)});
  rs.forEach(id=>{const r=M.rods.get(id);const nr=addRod(map.get(r.a),map.get(r.b),r.type);if(nr)newR.add(nr.id)})}
 sel.nodes=newN;sel.rods=newR;sel.planes.clear();afterChange();
 toast(`Клонировано: +${newN.size} узлов, +${newR.size} стержней (шаг ${fmt(step)} по ${axis.toUpperCase()})`,{type:'ok'})}
function copySelection(){const{ns,rs}=gatherSelection();if(!ns.size){toast('Нечего копировать',{type:'warn'});return}
 const c=V3();ns.forEach(id=>c.add(M.nodes.get(id).p));c.divideScalar(ns.size);
 clipboard={nodes:[...ns].map(id=>{const n=M.nodes.get(id);return{p:n.p.clone().sub(c).toArray(),type:n.type}}),
  rods:[...rs].map(id=>{const r=M.rods.get(id);return{a:[...ns].indexOf(r.a),b:[...ns].indexOf(r.b),type:r.type}})};
 toast(`Скопировано: ${ns.size} узлов, ${rs.size} стержней • Ctrl+V — вставить`,{type:'ok'})}
function startPaste(){if(!clipboard||!clipboard.nodes.length){toast('Буфер обмена пуст',{type:'warn'});return}
 paste=clipboard;setTool('select');toast('Кликните точку вставки • Esc — отмена',{type:'info'});renderProps()}
function commitPaste(p){pushUndo();const ids=[];const newN=new Set(),newR=new Set();
 paste.nodes.forEach(n=>{const{node}=getOrCreateNode(V3(...n.p).add(p),n.type);ids.push(node.id);newN.add(node.id)});
 paste.rods.forEach(r=>{const nr=addRod(ids[r.a],ids[r.b],r.type);if(nr)newR.add(nr.id)});
 paste=null;sel.nodes=newN;sel.rods=newR;sel.planes.clear();afterChange();toast('Вставлено',{type:'ok'})}
function groupSelection(name){const{ns,rs}=gatherSelection();if(!ns.size&&!rs.size)return;
 pushUndo();const id=uid();M.groups.set(id,{id,name:name||'Группа-'+(++M.counters.g),nodes:[...ns],rods:[...rs]});afterChange();toast(`Группа «${name}» создана`,{type:'ok'})}
function splitRod(rod,n){n=clamp(Math.round(n),2,60);pushUndo();let c=0;
 for(let i=1;i<n;i++)if(nodeOnRod(rod,i/n).created)c++;
 afterChange();toast(`Добавлено узлов: ${c} (деление на ${n})`,{type:'ok'})}
function clearOrphans(){pushUndo();let c=0;
 for(const n of[...M.nodes.values()])if(n.type==='node'&&!attachedRods(n.id).length){M.nodes.delete(n.id);sel.nodes.delete(n.id);c++}
 afterChange();toast(c?`Удалено одиночных узлов: ${c}`:'Одиночных узлов нет',{type:c?'ok':'info'})}
