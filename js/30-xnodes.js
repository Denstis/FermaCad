/* ==================== УЗЛЫ НА ПЕРЕСЕЧЕНИЯХ СТЕРЖНЕЙ (3D) ==================== */
'use strict';
/* Ближайшие точки двух отрезков: pa на p1-q1 (t), pb на p2-q2 (u), dd — расстояние между ними.
   Пересечение в 3D = минимальное сближение осей; узел ставится в середине отрезка сближения,
   дальше hostNodeOn сажает его на обе оси (допуск rodHostAt). */
function segClosest(p1,q1,p2,q2){
 const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),w=p1.clone().sub(p2);
 const a=d1.dot(d1),e=d2.dot(d2);
 if(a<1e-6||e<1e-6)return null;
 const b=d1.dot(d2),c=d1.dot(w),f=d2.dot(w);
 let t,u;
 const den=a*e-b*b;
 if(den<1e-9){t=0;u=Math.min(1,Math.max(0,f/e))}
 else{t=(b*f-c*e)/den;u=(b*t+f)/e;
  if(t<0){t=0;u=Math.min(1,Math.max(0,f/e))}else if(t>1){t=1;u=Math.min(1,Math.max(0,(b+f)/e))}
  else{if(u<0){u=0;t=Math.min(1,Math.max(0,-c/a))}else if(u>1){u=1;t=Math.min(1,Math.max(0,(b-c)/a))}}}
 const pa=p1.clone().addScaledVector(d1,t),pb=p2.clone().addScaledVector(d2,u);
 return{pa,pb,t,u,dd:pa.distanceTo(pb)};
}
function xnodesAction(){
 const rods=[...M.rods.values()];
 if(rods.length<2){toast('Нужно ≥2 стержней', {type:'warn'});return}
 const TOL=HOST_TOL(); /* мм: ось стержня «ловит» узел в этом допуске */
 const found=[];
 for(let i=0;i<rods.length;i++)for(let j=i+1;j<rods.length;j++){
  const A=rods[i],B=rods[j];
  if(A.a===B.a||A.a===B.b||A.b===B.a||A.b===B.b)continue; /* общий узел = узел соединения, не пересечение */
  const a1=M.nodes.get(A.a),a2=M.nodes.get(A.b),b1=M.nodes.get(B.a),b2=M.nodes.get(B.b);
  if(!a1||!a2||!b1||!b2)continue;
  const s=segClosest(a1.p,a2.p,b1.p,b2.p);
  if(!s||s.dd>TOL)continue;
  const tE=s.t<=.002?'a':(s.t>=.998?'b':null),uE=s.u<=.002?'a':(s.u>=.998?'b':null);
  if(tE&&uE){const nA=tE==='a'?a1:a2,nB=uE==='a'?b1:b2;
   if(nA.id!==nB.id)found.push({k:'weld',na:nA.id,nb:nB.id}); /* стык встык: сварить узлы */
   continue}
  if(tE||uE){const nE=tE?(tE==='a'?a1:a2):(uE==='a'?b1:b2);
   found.push({k:'t',nid:nE.id}); /* Т-стык: узловой конец + проходящий стержень */
   continue}
  found.push({p:s.pa.clone().add(s.pb).multiplyScalar(.5),ra:A.id,rb:B.id});
 }
 if(!found.length){toast('Пересечений стержней не найдено (допуск '+Math.round(TOL)+' мм)', {type:'info'});return}
 /* один узел на точку: если несколько пар сходятся в одной точке — общий узел со списком hosts;
    attachNodeToRods делает узел общим для ВСЕХ стержней, оси которых проходят через точку */
 pushUndo();
 let created=0,attached=0,welded=0;const made=[];
 for(const f of found){
  if(f.k==='weld'){const nb=M.nodes.get(f.nb),na=M.nodes.get(f.na);
   if(!nb||!na)continue;
   M.rods.forEach(r=>{if(r.a===nb.id)r.a=na.id;if(r.b===nb.id)r.b=na.id});
   [...M.rods.values()].forEach(r=>{if(r.a===r.b)M.rods.delete(r.id)});
   M.nodes.delete(nb.id);welded++;
   attached+=attachNodeToRods(na);made.push(na);
   continue}
  if(f.k==='t'){const n=M.nodes.get(f.nid);if(!n)continue;
   attached+=attachNodeToRods(n);if(!made.includes(n))made.push(n);
   continue}
  let n=findNodeAt(f.p,TOL*0.6)||made.find(m=>m.p.distanceTo(f.p)<TOL*0.6);
  if(!n){
   n={id:uid(),p:f.p.clone(),type:'node',name:'Узел-'+(++M.counters.n),hosts:[],host:null};
   M.nodes.set(n.id,n);bornIds.add(n.id);created++;
  }
  if(hostNodeOn(n,M.rods.get(f.ra)))attached++;
  if(hostNodeOn(n,M.rods.get(f.rb)))attached++;
  attached+=attachNodeToRods(n);
  made.push(n);
 }
 afterChange();
 sel.nodes.clear();sel.rods.clear();selectionChanged();
 const list=made.slice(0,6).map(n=>n.name).join(', ')+(made.length>6?'…':'');
 toast('Пересечения: узлов создано '+created+', сварено '+welded+', посадок на оси '+attached+(made.length?(' ('+list+')'):''), {type:'ok',timeout:6000});
}
