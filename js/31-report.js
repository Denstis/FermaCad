/* ==================== ОТЧЁТ + ДЕФОРМИРОВАННЫЕ ТЕЛА + СХЕМЫ ==================== */
'use strict';
/* --- склейка стержней в непрерывные элементы (осевая линия через узлы-носители) --- */
function elemGroups(){
 const groups=[];const seen=new Set();
 const seqOf=r=>{const ids=[r.a,...hostedNodes(r.id).map(n=>n.id),r.b];
  return ids.map(id=>M.nodes.get(id)).filter(Boolean)};
 const key=pts=>pts.map(p=>[Math.round(p.p.x),Math.round(p.p.y),Math.round(p.p.z)].join(','));
 const join=(a,b)=>{const ka=key(a),kb=key(b);
  if(ka[ka.length-1]===kb[0])return a.concat(b.slice(1));
  if(ka[0]===kb[kb.length-1])return b.concat(a.slice(1));return null};
 M.rods.forEach(r=>{if(seen.has(r.id))return;seen.add(r.id);
  const pts=seqOf(r);if(pts.length<2)return;
  const item={r,pts,rods:[r]};groups.push(item);
  let frontier=[item];
  while(frontier.length){const nf=[];
   M.rods.forEach(o=>{if(seen.has(o.id))return;const op=seqOf(o);
    for(const g of frontier){const m=join(g.pts,op);if(m){g.pts=m;g.rodLen=(g.rodLen||0)+rodLen(o);g.rods.push(o);seen.add(o.id);nf.push(g);break}}});
   frontier=nf}});
 return groups;
}
/* --- деформированные тела: стержень разворачивается ПО ИЗОГНУТОЙ ОСЕВОЙ ---
   поле перемещений: u(x)=lerp(uA+θA×(x−pA), uB+θB×(x−pB)) + (e2·d2+e3·d3)·sin(πt)·scale
   (раньше: жёсткая коробка между смещёнными концами — при заделанных опорах невидима) */
/* внутренние узлы стержня — то же деление, что в solveFrame: hosts + узлы на оси (±25 мм) */
function rodSplitIds(r){const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return[];
 const v0=b.p.clone().sub(a.p),L0=v0.length();if(L0<10)return[];
 const u0=v0.clone().multiplyScalar(1/L0);const hs=new Map();
 M.nodes.forEach(n=>{if(n.id===r.a||n.id===r.b)return;
  const isHost=(n.host&&n.host.rod===r.id)||(n.hosts||[]).some(h=>h&&h.rod===r.id);
  const w=n.p.clone().sub(a.p),t=w.dot(u0)/L0;if(t<=0.002||t>=0.998)return;
  if(isHost||w.clone().addScaledVector(u0,-t*L0).length()<25)hs.set(n.id,t)});
 return[...hs.entries()].sort((p,q)=>p[1]-q[1]).map(e=>e[0])}
function deflBodies(group){
 const R=calc.res;if(!R)return;
 const nidx=new Map(R.nodeOrder.map((id,i)=>[id,i]));
 const s=calc.deflScale;
 M.rods.forEach(rd=>{
  const rr=calc.byId.get(String(rd.id));if(!rr)return;
  const A=M.nodes.get(rd.a),B=M.nodes.get(rd.b);if(!A||!B)return;
  const sec=rodSec(rd);
  const e1=B.p.clone().sub(A.p);const L=e1.length();if(L<40)return;e1.multiplyScalar(1/L);
  const dof=id=>{const i=nidx.get(id);if(i==null)return[V3(),V3()];
   return[V3(R.u[i*6],R.u[i*6+1],R.u[i*6+2]),V3(R.u[i*6+3],R.u[i*6+4],R.u[i*6+5])]};
  /* последовательность расчётных узлов: концы + узлы внутри стержня — то же деление, что в solveFrame;
     в узле прогнутый стержень проходит через ФЭМ-смещение узла, местный изгиб — по частям */
  const ids=[rd.a,...(typeof rodSplitIds==='function'?rodSplitIds(rd):[]),rd.b];
  const seqN=ids.map(i=>M.nodes.get(i)).filter(n=>n);if(seqN.length<2)return;
  const segs=(rr.segs&&rr.segs.length===seqN.length-1)?rr.segs:null;
  const col=(calc._rodCol&&calc._rodCol.get(rd.id))||new THREE.Color(0xffc53d);
  const mat=new THREE.MeshStandardMaterial({color:col,metalness:.25,roughness:.6,side:THREE.DoubleSide});
  const pts=secContours(sec)[0];              /* внешний контур сечения (8 точек) */
  const rot=sec.kind==='rhs';
  const cts=pts.map(([x,y])=>rot?[y,x]:[x,y]);
  const rings=[];
  for(let k=0;k<seqN.length-1;k++){
   const nA=seqN[k],nB=seqN[k+1];
   const vp=nB.p.clone().sub(nA.p);const Lp=vp.length();if(Lp<10)continue;
   const e1p=vp.clone().multiplyScalar(1/Lp);
   let e2p=AZ.clone().cross(e1p);if(e2p.lengthSq()<1e-8)e2p=AY.clone().cross(e1p);
   e2p.normalize();const e3p=e1p.clone().cross(e2p).normalize();
   const sg=segs?segs[k]:null;
   const full=!!(sg&&sg.E!=null&&sg.L>0);
   const da=full?null:dof(nA.id),db=full?null:dof(nB.id);
   const d2b=sg?(sg.d2||0):(rr.d2||0),d3b=sg?(sg.d3||0):(rr.d3||0);
   const bulge=full?null:e2p.clone().multiplyScalar(d2b).addScaledVector(e3p,d3b);
   const NSp=Math.max(4,Math.round(24*Lp/L));
   for(let i=(k?1:0);i<=NSp;i++){const t=i/NSp;
    const c=nA.p.clone().lerp(nB.p,t);
    let thv=0,thw=0;
    if(full){
     /* точное поле: Эрмит по концевым DOF + частное от q, целиком ×deflScale —
        ось стержня проходит через смещённые узлы (сварной узел) */
     const f=deflAt(sg,sg.L,t);
     c.addScaledVector(e1p,f.u*s).addScaledVector(e2p,f.v*s).addScaledVector(e3p,f.w*s);
     thv=f.tv*s;thw=f.tw*s;
    }else{
     const xa=c.clone().sub(nA.p),xb=c.clone().sub(nB.p);
     const ua=da[0].clone().add(new THREE.Vector3().crossVectors(da[1],xa));
     const ub=db[0].clone().add(new THREE.Vector3().crossVectors(db[1],xb));
     c.add(ua.lerp(ub,t).multiplyScalar(s)).addScaledVector(bulge,Math.sin(Math.PI*t)*s);
    }
    rings.push(cts.map(([x,y])=>{
     const o=e2p.clone().multiplyScalar(x).addScaledVector(e3p,y);
     if(thv||thw)o.addScaledVector(e1p,-(thv*x+thw*y));  /* наклон сечения по деформированной оси */
     return c.clone().add(o)}))}}
  if(rings.length<2)return;
  const NS=rings.length-1;
  const pos=[],idx=[];
  const nR=rings[0].length;
  for(const ring of rings)for(const p of ring)pos.push(p.x,p.y,p.z);
  for(let i=0;i<NS;i++)for(let j=0;j<nR;j++){const j2=(j+1)%nR;const a=i*nR+j,b2=i*nR+j2,c2=(i+1)*nR+j,d=(i+1)*nR+j2;
   idx.push(a,c2,d, a,d,b2)}
  const capI=(ringOff,flip)=>{const c0=rings[ringOff?NS:0].reduce((acc,p)=>acc.add(p),new THREE.Vector3()).multiplyScalar(1/nR);
   for(let j=1;j<nR-1;j++){const p0=nR*ringOff,p1=nR*ringOff+j,p2=nR*ringOff+j+1;
    if(flip)idx.push(p0,p1,p2);else idx.push(p0,p2,p1)}void c0};
  capI(0,false);capI(1,true);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);
  mesh.castShadow=false;mesh.receiveShadow=false;
  group.add(mesh)});
}
/* --- снимки видов (png dataURL) --- */
const SHOT_VIEWS=[
 {t:'Аксонометрия',ph:1.05,th:-Math.PI/4,m:1.5,defl:false},
 {t:'Фасад рамы',ph:Math.PI/2,th:Math.PI/2,m:1.35,defl:false},
 {t:'Торец',ph:Math.PI/2,th:0,m:1.35,defl:false},
 {t:'План',ph:Math.PI-0.12,th:-Math.PI/2,m:1.3,defl:false},
 {t:'Деформированная схема',ph:1.05,th:-Math.PI/4,m:1.6,defl:true},
];
function captureShots(){
 const shots=[];const box=modelBox();if(!box)return shots;
 const c=box.getCenter(V3()),sz=box.getSize(V3());const rad=Math.max(sz.length(),2500);
 const st={t:ctrl.g.t.clone(),r:ctrl.g.r,ph:ctrl.g.ph,th:ctrl.g.th};
 const W=1280,H=800;
 const cv=renderer.domElement;
 const hide=[];[gGrid,gMeasure,gGhost].forEach(o=>{if(o&&o.visible){o.visible=false;hide.push(o)}});
 const oldDefl=calc.showDefl;const clear=renderer.getClearColor(new THREE.Color());
 const alpha=renderer.getClearAlpha();
 function shot(v){
  calc.showDefl=!!v.defl;drawCalc();
  ctrl.g.t.copy(c);ctrl.g.r=rad*v.m;ctrl.g.ph=v.ph;ctrl.g.th=v.th;applyCams(1000);applyCams(1000);
  renderer.setSize(W,H,false);camP.aspect=W/H;camP.updateProjectionMatrix();
  renderer.setClearColor(0xffffff,1);
  renderer.render(scene,activeCam());
  shots.push({t:v.t,data:cv.toDataURL('image/png')});
 }
 SHOT_VIEWS.forEach(shot);
 renderer.setClearColor(clear,alpha);
 calc.showDefl=oldDefl;drawCalc();
 resize();
 ctrl.g.t.copy(st.t);ctrl.g.r=st.r;ctrl.g.ph=st.ph;ctrl.g.th=st.th;applyCams(1000);
 hide.forEach(o=>o.visible=true);
 return shots;
}
/* --- SVG схемы раскроя: штабы мерной длины, элементы в масштабе --- */
function svgStocks(g){
 const bin=g.bin,W=940,sc=(W-46)/bin,rowH=34,top=26;
 const Hh=top+g.bins.length*(rowH+22)+10;
 let y=top,s='';
 g.bins.forEach((b,bi)=>{
  s+=`<text x="4" y="${y+13}" font-size="10" fill="#444">штаб ${bi+1} • ${bin} мм</text>`;
  let x=4;const y0=y+18;
  s+=`<rect x="4" y="${y0}" width="${W-8}" height="14" fill="#f2f2f2" stroke="#aaa"/>`;
  b.items.forEach(it=>{const w=Math.max(3,it.Ls*sc);
   s+=`<rect x="${x.toFixed(1)}" y="${y0}" width="${w.toFixed(1)}" height="14" fill="#7fb2e5" stroke="#20506f"/>`;
   s+=`<text x="${(x+w/2).toFixed(1)}" y="${y0+11}" font-size="8.5" fill="#08324f" text-anchor="middle">${esc(it.r.name)} ${it.Ls}</text>`;
   x+=w+2});
  y=y0+rowH;
 });
 return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
function secNameOf(r){const s=rodSec(r);return s?s.name:'—'}
/* --- склейка элементов в заготовки мерного проката (для схемы раскроя отчёта) --- */
function elemStock(){
 /* склейка соосных стержней режется по сечениям: разные сечения — разные штабы/строки сметы */
 const items=[];
 elemGroups().forEach(g=>{
  let run=null;
  (g.rods||[g.r]).forEach(r=>{const sec=rodSec(r),L=rodLen(r);
   if(run&&run.sec.id===sec.id){run.len+=L;run.names.push(r.name)}
   else{run={sec,len:L,names:[r.name],r};items.push(run)}})});
 const groups=items.filter(x=>x.len>49).map(it=>({sec:it.sec,L:Math.round(it.len),g:{r:it.r},names:it.names}));
 const bySec=new Map();
 groups.forEach(it=>{const a=bySec.get(it.sec.id)||{sec:it.sec,items:[]};
  a.items.push({r:{name:it.names.join(', ')},Ls:it.L});bySec.set(it.sec.id,a)});
 const grs=[...bySec.values()].map(gr=>{const bin=Math.round((gr.sec.sell_len_m||12)*1000),bins=[];
  gr.items.slice().sort((x,y)=>y.Ls-x.Ls).forEach(it=>{let placed=false;
   for(const b2 of bins)if(b2.rem>=it.Ls){b2.rem-=it.Ls;b2.items.push(it);placed=true;break}
   if(!placed)bins.push({rem:bin-it.Ls,items:[it]})});
  const total=gr.items.reduce((s,i2)=>s+i2.Ls,0);
  return{sec:gr.sec,items:gr.items,bins,bin,nStock:bins.length,
   util:bins.length*bin?total/(bins.length*bin):0,total,
   mass:(gr.sec.mass_kg_m||0)*bins.length*bin/1000,cost:(gr.sec.price_rub_m||0)*bins.length*bin/1000}}).sort((a,b)=>b.total-a.total);
 return{grs,mass:grs.reduce((s,g2)=>s+g2.mass,0),cost:grs.reduce((s,g2)=>s+g2.cost,0)};
}
/* --- схема балки: ось + опоры + увеличенный прогиб + N у узлов + L --- */
function svgBeam(g,R){
 const pts=g.pts;let Lg=0;const cum=[0];
 for(let i=1;i<pts.length;i++){Lg+=pts[i].p.distanceTo(pts[i-1].p);cum.push(Lg)}
 if(Lg<50)return'';
 const W=940,mx=64,sc=(W-2*mx)/Lg,Hh=170,yMid=58,Hdef=34;
 const r0=pts[pts.length-1].p.clone().sub(pts[0].p);const L0=r0.length()||1;r0.multiplyScalar(1/L0);
 const e2=V3(-r0.y,r0.x,0);if(e2.lengthSq()<1e-9)e2.set(1,0,0);e2.normalize();
 const e3=new THREE.Vector3().crossVectors(r0,e2).normalize();
 const nidx=new Map(R.nodeOrder.map((id,i)=>[id,i]));
 const P=pts.map(n=>{const i=nidx.get(n.id);const u=i==null?[0,0,0]:[R.u[i*6],R.u[i*6+1],R.u[i*6+2]];
  return{dz:u[0]*e3.x+u[1]*e3.y+u[2]*e3.z,dy:u[0]*e2.x+u[1]*e2.y+u[2]*e2.z}});
 const dAt=t=>{for(let i=1;i<pts.length;i++)if(cum[i]>=t){const f=(t-cum[i-1])/((cum[i]-cum[i-1])||1);
   return{dz:P[i-1].dz+(P[i].dz-P[i-1].dz)*f,dy:P[i-1].dy+(P[i].dy-P[i-1].dy)*f}}
  return{dz:P[P.length-1].dz,dy:P[P.length-1].dy}};
 let maxAbs=1e-9;for(let k=0;k<=40;k++){const d=dAt(Lg*k/40);maxAbs=Math.max(maxAbs,Math.hypot(d.dz,d.dy))}
 const amp=Math.min(Hdef/maxAbs,400);
 let s='';
 s+=`<line x1="${mx}" y1="${yMid}" x2="${W-mx}" y2="${yMid}" stroke="#888" stroke-width="1.5"/>`;
 pts.forEach((n,i)=>{if(n.type!=='support'&&n.type!=='fixed')return;const x=mx+cum[i]*sc;
  s+=`<path d="M${(x-7).toFixed(1)},${yMid+3} L${(x+7).toFixed(1)},${yMid+3} L${x.toFixed(1)},${yMid+15} Z" fill="#c9a227" stroke="#7a6110"/>`;
  s+=`<text x="${x.toFixed(1)}" y="${yMid+26}" font-size="8.5" fill="#666" text-anchor="middle">${n.type==='support'?'заделка':'опора'}</text>`});
 let path='';
 for(let k=0;k<=40;k++){const t=Lg*k/40;const d=dAt(t);const x=mx+t*sc;
  path+=(k?'L':'M')+x.toFixed(1)+','+(yMid+(d.dz+d.dy)*amp).toFixed(1)}
 s+=`<path d="${path}" fill="none" stroke="#e0662f" stroke-width="2"/>`;
 const rodsByNode={};
 M.rods.forEach(r=>{[r.a,r.b].forEach(id=>{(rodsByNode[id]=rodsByNode[id]||[]).push(r)})});
 const labels=[];
 pts.forEach((n,i)=>{const rs=rodsByNode[n.id]||[];let best=null,bv=-1;
  rs.forEach(r=>{const rr=calc.byId.get(String(r.id));if(!rr)return;
   const v=Math.max(Math.abs(rr.Ncomp),Math.abs(rr.Nt));if(v>bv){bv=v;best=rr}});
  if(best&&cum[i]>0&&cum[i]<Lg)labels.push({x:mx+cum[i]*sc,
   txt:`${(Math.abs(best.Ncomp)/1000).toFixed(0)}сж/${(Math.abs(best.Nt)/1000).toFixed(0)}раср кН`})});
 labels.forEach((lb,i)=>{s+=`<text x="${lb.x.toFixed(1)}" y="${(yMid-10-(i%3)*11).toFixed(1)}" font-size="8.5" fill="#1a1a1a" text-anchor="middle">${lb.txt}</text>`});
 let deflMax=0,dName='';
 M.rods.forEach(r=>{const rr=calc.byId.get(String(r.id));if(!rr)return;
  if(pts.some(n=>n.id===r.a||n.id===r.b)&&rr.defl>deflMax){deflMax=rr.defl;dName=rr.name}});
 s+=`<line x1="${mx+8}" y1="${yMid+Hdef+18}" x2="${W-mx-8}" y2="${yMid+Hdef+18}" stroke="#444"/>`;
 s+=`<path d="M${mx+8},${yMid+Hdef+14} l0,8 M${W-mx-8},${yMid+Hdef+14} l0,8" stroke="#444"/>`;
 s+=`<text x="${W/2}" y="${yMid+Hdef+14}" font-size="10" fill="#111" text-anchor="middle">L = ${Math.round(Lg)} мм</text>`;
 s+=`<text x="${mx}" y="${yMid+Hdef+38}" font-size="9" fill="#e0662f">f max = ${deflMax.toFixed(1)} мм (${esc(dName)})</text>`;
 s+=`<text x="4" y="14" font-size="10.5" fill="#111">${esc(g.r.name)} • ${esc(secNameOf(g.r))} • прогибы ×${calc.deflScale} (оранжевый)</text>`;
 return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
/* ==================== Шаг 5 (docs/FABRICATION.md §4.6) ====================
   SVG-разделы отчёта: чертежи запилов (позиции одинаковых деталей),
   схемы стыковки узлов (calc.joints), план поэтапной сборки (assemblyPlan). */
/* короткая подпись типа реза для схем */
const cutShort=E=>E.kind==='miter'?'запил '+Math.round(E.angle||0)+'°':
 E.kind==='nest'?'вложение':E.kind==='T'?'подрез T':E.kind==='main'?'основной':
 E.kind==='pass'?'встык':E.kind==='flat'?'торец 90°':E.kind==='free'?'свободный':'—';
const sgnM=v=>(v>0?'+':'')+Math.round(v);
/* отрезок прямой (nx,ny)+s(dx,dy) внутри прямоугольника или null */
function clipSeg(nx,ny,dx,dy,rx0,ry0,rx1,ry1){
 if(Math.abs(dx)<1e-9&&Math.abs(dy)<1e-9)return null;
 const cand=[];
 if(Math.abs(dy)>1e-9)cand.push((ry0-ny)/dy,(ry1-ny)/dy);
 if(Math.abs(dx)>1e-9)cand.push((rx0-nx)/dx,(rx1-nx)/dx);
 const ok=s=>{const X=nx+s*dx,Y=ny+s*dy;return X>=rx0-1e-6&&X<=rx1+1e-6&&Y>=ry0-1e-6&&Y<=ry1+1e-6};
 const ss=cand.filter(ok).sort((a,b)=>a-b);
 if(ss.length<2)return null;
 return[[nx+ss[0]*dx,ny+ss[0]*dy],[nx+ss[ss.length-1]*dx,ny+ss[ss.length-1]*dy]];}
/* компоненты нормали плоскости реза в осях чертежа: n·e3 (латераль) и n·v (ось) */
function cutDir(E){if(!E.n||!E.e3)return null;
 const n3=E.n[0]*E.e3[0]+E.n[1]*E.e3[1]+E.n[2]*E.e3[2];
 const n2=E.n[0]*E.e2[0]+E.n[1]*E.e2[1]+E.n[2]*E.e2[2];
 const nv=Math.sqrt(Math.max(0,1-n3*n3-n2*n2)); /* n·v > 0 (биссектриса) */
 return[n3,nv]}
/* --- чертёж ПОЗИЦИИ раскроя: заготовка в масштабе + два укрупнённых торца --- */
function svgCutPos(sec,gp){
 const h=sec.h_mm||60,b=sec.b_mm||60;
 const W=940,x0=74,x1=W-64,sc=(x1-x0)/gp.Ls,yc=76;
 const hb=Math.max(4,h*sc);
 const pA=endLenAdd(gp.A),pB=endLenAdd(gp.B);
 const nAx=x0+pA*sc,nBx=x1+pB*sc;
 let s=`<text x="4" y="13" font-size="11" fill="#111"><tspan font-weight="bold" fill="#20506f">${gp.pos}</tspan> • ${gp.parts.length} шт • ${esc(gp.parts.join(', '))} • L загот ${gp.Ls} • ось ${gp.La} • ${esc(sec.name)}</text>`;
 /* ось (пунктир, выходит за заготовку у T/вложения) */
 s+=`<line x1="${nAx.toFixed(1)}" y1="${yc}" x2="${nBx.toFixed(1)}" y2="${yc}" stroke="#999" stroke-dasharray="7 4"/>`;
 /* заготовка */
 s+=`<rect x="${x0}" y="${(yc-hb/2).toFixed(1)}" width="${x1-x0}" height="${hb.toFixed(1)}" fill="#eef5fd" stroke="#20506f"/>`;
 /* линии реза на заготовке */
 const drawCut=(E,nx,sx2)=>{
  if(E.kind==='miter'){const d=cutDir(E);if(!d)return;
   const seg=clipSeg(nx,yc,d[0]*sx2*sc,d[1]*sc,x0,yc-hb/2,x1,yc+hb/2);
   if(seg)s+=`<line x1="${seg[0][0].toFixed(1)}" y1="${seg[0][1].toFixed(1)}" x2="${seg[1][0].toFixed(1)}" y2="${seg[1][1].toFixed(1)}" stroke="#c62828" stroke-width="2"/>`}
  else if(E.kind==='T'||E.kind==='nest'||E.kind==='flat'||E.kind==='free'){
   s+=`<line x1="${nx.toFixed(1)}" y1="${(yc-hb/2).toFixed(1)}" x2="${nx.toFixed(1)}" y2="${(yc+hb/2).toFixed(1)}" stroke="#c62828" stroke-width="2"/>`}};
 drawCut(gp.A,nAx,1);drawCut(gp.B,nBx,-1);
 /* узлы */
 [[nAx,'А',pA],[nBx,'Б',pB]].forEach(([nx,ttl,p])=>{
  s+=`<circle cx="${nx.toFixed(1)}" cy="${yc}" r="3.2" fill="#111"/>`;
  s+=`<text x="${nx.toFixed(1)}" y="${(yc+hb/2+15).toFixed(1)}" font-size="9" fill="#444" text-anchor="middle">узел ${ttl} (${sgnM(p)})</text>`});
 /* размеры */
 s+=`<line x1="${nAx.toFixed(1)}" y1="${(yc-hb/2-7).toFixed(1)}" x2="${nBx.toFixed(1)}" y2="${(yc-hb/2-7).toFixed(1)}" stroke="#666"/>`;
 s+=`<text x="${((nAx+nBx)/2).toFixed(1)}" y="${(yc-hb/2-11).toFixed(1)}" font-size="9" fill="#333" text-anchor="middle">L ось ${gp.La}</text>`;
 s+=`<line x1="${x0}" y1="${(yc+hb/2+30).toFixed(1)}" x2="${x1}" y2="${(yc+hb/2+30).toFixed(1)}" stroke="#666"/>`;
 s+=`<line x1="${x0}" y1="${(yc+hb/2+26).toFixed(1)}" x2="${x0}" y2="${(yc+hb/2+34).toFixed(1)}" stroke="#666"/>`;
 s+=`<line x1="${x1}" y1="${(yc+hb/2+26).toFixed(1)}" x2="${x1}" y2="${(yc+hb/2+34).toFixed(1)}" stroke="#666"/>`;
 s+=`<text x="${W/2}" y="${(yc+hb/2+43).toFixed(1)}" font-size="9.5" fill="#333" text-anchor="middle">L загот ${gp.Ls} мм (запас на запилы учтён в L)</text>`;
 /* два укрупнённых торца (равный масштаб обеих осей → углы истинные).
    Панели НИЖЕ размера «L загот» (текст на yc+hb/2+43) — без наложений. */
 const pY=Math.max(142,yc+hb/2+50);
 const panel=(E,side,P,ttl)=>{
  const pE=endLenAdd(E);
  const k=Math.min(28/h,360/Math.max(Math.abs(pE),140));
  const edge=side>0?P.x+46:P.x+P.w-46;
  const far=side>0?P.x+P.w-12:P.x+12;
  const X=v=>edge+side*v*k;
  const H=Math.max(6,h*k),yc2=pY+68,yT=yc2-H/2,yB=yT+H; /* грань = низ rect */
  const rx0=Math.min(edge,far),rx1=Math.max(edge,far);
  const nodeX=X(pE);
  let t=`<rect x="${P.x}" y="${pY}" width="${P.w}" height="150" fill="#fafafa" stroke="#ddd"/>`;
  t+=`<text x="${P.x+6}" y="${pY+14}" font-size="10" font-weight="bold" fill="#20506f">${ttl}</text>`;
  t+=`<text x="${P.x+6}" y="${pY+27}" font-size="8.5" fill="#555">${esc(E.txt.slice(0,74))}</text>`;
  /* тело заготовки */
  t+=`<rect x="${rx0.toFixed(1)}" y="${yT.toFixed(1)}" width="${(rx1-rx0).toFixed(1)}" height="${H.toFixed(1)}" fill="#eef5fd" stroke="#20506f"/>`;
  /* линия реза */
  if(E.kind==='miter'){const d=cutDir(E);
   if(d){const seg=clipSeg(nodeX,yc2,d[0]*side*k,d[1]*k,rx0,yT,rx1,yB);
    if(seg)t+=`<line x1="${seg[0][0].toFixed(1)}" y1="${seg[0][1].toFixed(1)}" x2="${seg[1][0].toFixed(1)}" y2="${seg[1][1].toFixed(1)}" stroke="#c62828" stroke-width="2.4"/>`}}
  else t+=`<line x1="${edge.toFixed(1)}" y1="${yT.toFixed(1)}" x2="${edge.toFixed(1)}" y2="${yB.toFixed(1)}" stroke="#c62828" stroke-width="2.4"/>`;
  /* узел + подписи */
  t+=`<line x1="${nodeX.toFixed(1)}" y1="${(yT-7).toFixed(1)}" x2="${nodeX.toFixed(1)}" y2="${(yB+7).toFixed(1)}" stroke="#111" stroke-dasharray="4 3"/>`;
  t+=`<circle cx="${nodeX.toFixed(1)}" cy="${yc2}" r="3.4" fill="#111"/>`;
  t+=`<text x="${Math.min(Math.max(nodeX,P.x+40),P.x+P.w-40).toFixed(1)}" y="${(yB+20).toFixed(1)}" font-size="9" fill="#333" text-anchor="middle">вынос ${sgnM(pE)} мм</text>`;
  let y2=yB+32;
  if(E.angle!=null&&E.kind==='miter')t+=`<text x="${P.x+P.w/2}" y="${y2}" font-size="9" fill="#c62828" text-anchor="middle">запил ${Math.round(E.angle)}° от торца (биссектриса)</text>`,y2+=12;
  if(E.main)t+=`<text x="${P.x+P.w/2}" y="${y2}" font-size="9" fill="#555" text-anchor="middle">основной: «${esc(E.main.name)}»</text>`;
  t+=`<text x="${far.toFixed(1)}" y="${(yT-4).toFixed(1)}" font-size="8.5" fill="#20506f" text-anchor="${side>0?'end':'start'}">${b}×${h}</text>`;
  return t};
 s+=panel(gp.A,1,{x:6,w:458},'Конец А')+panel(gp.B,-1,{x:476,w:458},'Конец Б');
 return `<svg viewBox="0 0 ${W} ${pY+156}" width="100%" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
/* --- группировка одинаковых схем узлов (класс + типы/секции/резы ветвей) --- */
function jointGroups(J){
 const map=new Map();
 J.forEach(j=>{
  const mType=id=>{const r=M.rods.get(id);return r?r.type:''};
  const key=j.cls+'|'+(j.main?mType(j.main.id):'')+'|'+j.members.map(m=>{const sc2=rodSec(m.r)||{};
   return `${m.r.type}:${sc2.name}:${m.E.kind}:${Math.round(m.E.al||m.E.angle||0)}`}).sort().join(';');
  const g=map.get(key)||{j,nodes:[]};g.nodes.push(j.name);map.set(key,g)});
 return[...map.values()]}
/* --- схема стыковки узла: две проекции (фасад XZ + план XY) --- */
function svgJoint(j){
 const W=620,Hh=312,cy=176,R=94;
 const prj=[{t:'Фасад (XZ)',a:0,b:2,cx:170},{t:'План (XY)',a:0,b:1,cx:470}];
 const jp=[j.p.x,j.p.y,j.p.z];
 const mem=[];
 j.members.forEach(m=>{let o=null;
  if(m.thru){const ra=M.nodes.get(m.r.a),rb=M.nodes.get(m.r.b);if(!ra||!rb)return;
   o=ra.p.distanceTo(j.p)>rb.p.distanceTo(j.p)?ra.p:rb.p}
  else{const on=M.nodes.get(m.r.a===j.nid?m.r.b:m.r.a);if(!on)return;o=on.p}
  if(o)mem.push({m,o:[o.x,o.y,o.z]})});
 let maxL=0;
 mem.forEach(x=>prj.forEach(p=>{const dx=x.o[p.a]-jp[p.a],dy=x.o[p.b]-jp[p.b];
  maxL=Math.max(maxL,Math.hypot(dx,dy))}));
 const sc=maxL>1?R/maxL:1;
 let s=`<text x="4" y="13" font-size="11" fill="#111"><tspan font-weight="bold" fill="#20506f">${esc(j.name)}</tspan> — ${esc(j.clsTxt)}${j.main?` • основной: ${esc(j.main.name)}`:''} • ${j.nBranch?('ветвей: '+j.nBranch):('элементов: '+j.members.length)}</text>`;
 prj.forEach((p,pi)=>{
  s+=`<text x="${p.cx-40}" y="32" font-size="9.5" fill="#666">${p.t}</text>`;
  s+=`<circle cx="${p.cx}" cy="${cy}" r="${R}" fill="#fcfcfc" stroke="#e2e2e2" stroke-dasharray="4 4"/>`;
  mem.forEach(x=>{
   const dx=x.o[p.a]-jp[p.a],dy=x.o[p.b]-jp[p.b];
   const L=Math.hypot(dx,dy);if(L<1e-6)return;
   const ex=p.cx+dx*sc,ey=cy-dy*sc;
   const isMain=j.main&&x.m.r.id===j.main.id;
   const col=isMain?'#c62828':x.m.thru?'#8a8a8a':'#2e7d32';
   const w=isMain?3.4:x.m.thru?1.8:2.2;
   const dash=x.m.thru?' stroke-dasharray="6 4"':'';
   s+=`<line x1="${p.cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${col}" stroke-width="${w}"${dash}/>`;
   const px=p.cx+dx*sc*0.72,py=cy-dy*sc*0.72;
   if(L*sc>36)s+=`<text x="${px.toFixed(1)}" y="${(py-3).toFixed(1)}" font-size="9" fill="#123" text-anchor="middle">${esc(x.m.r.name)}</text>`;
   const tx=p.cx+dx*sc*0.44,ty=cy-dy*sc*0.44;
   if(L*sc>70)s+=`<text x="${tx.toFixed(1)}" y="${(ty+9).toFixed(1)}" font-size="8" fill="#678" text-anchor="middle">${cutShort(x.m.E)}</text>`});
  /* узел по центру */
  if(j.type==='support')s+=`<path d="M${p.cx-7},${cy+2} L${p.cx+7},${cy+2} L${p.cx},${cy+10} Z" fill="#ffb020" stroke="#a87400"/>`;
  s+=`<circle cx="${p.cx}" cy="${cy}" r="4" fill="${j.type==='support'?'#ffb020':'#111'}" stroke="#fff" stroke-width="1.2"/>`});
 s+=`<text x="4" y="${Hh-6}" font-size="8.5" fill="#555">Состав: ${esc(j.members.map(m=>m.r.name+' ('+cutShort(m.E)+')').join(', ').slice(0,118))}</text>`;
 return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
/* --- план сборки: вид XZ, цвет по этапам --- */
const ASM_COL=['#ff5470','#38a1ff','#ffd23f','#ff7a45','#35e0ff','#a78bfa'];
function svgAsmPlan(plan){
 const W=940,Hh=380,m=34;
 let mnX=1e12,mxX=-1e12,mnZ=1e12,mxZ=-1e12;
 M.nodes.forEach(n=>{mnX=Math.min(mnX,n.p.x);mxX=Math.max(mxX,n.p.x);
  mnZ=Math.min(mnZ,n.p.z);mxZ=Math.max(mxZ,n.p.z)});
 const spanX=Math.max(1,mxX-mnX),spanZ=Math.max(1,mxZ-mnZ);
 const sc=Math.min((W-2*m)/spanX,(Hh-2*m-16)/spanZ);
 const ox=(W-spanX*sc)/2,oy=Hh-m-spanZ*sc;
 const px=x=>ox+(x-mnX)*sc,py=z=>oy+(mxZ-z)*sc; /* z вверх по экрану: опоры снизу */
 const st=new Map();plan.stages.forEach(s2=>s2.rods.forEach(r=>st.set(r.id,s2.n)));
 let s=`<rect x="0" y="0" width="${W}" height="${Hh}" fill="#fff"/>`;
 M.rods.forEach(r=>{const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return;
  const n=st.get(r.id)||1;
  s+=`<line x1="${px(a.p.x).toFixed(1)}" y1="${py(a.p.z).toFixed(1)}" x2="${px(b.p.x).toFixed(1)}" y2="${py(b.p.z).toFixed(1)}" stroke="${ASM_COL[(n-1)%6]}" stroke-width="2.6" stroke-linecap="round" opacity="0.92"/>`});
 M.nodes.forEach(n=>{if(n.type!=='support'&&n.type!=='fixed')return;
  const X=px(n.p.x),Y=py(n.p.z);
  s+=`<path d="M${(X-7).toFixed(1)},${Y+3} L${(X+7).toFixed(1)},${Y+3} L${X.toFixed(1)},${Y+12} Z" fill="#ffb020" stroke="#a87400"/>`});
 s+=`<text x="4" y="13" font-size="10" fill="#444">Вид сбоку (XZ) — детали окрашены по этапам сборки</text>`;
 return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
/* --- расширенный HTML-отчёт --- */
function buildReportHTML(shots){
 if(typeof rodSig==='function'&&calc.sig!==rodSig()){runCalc();if(!calc.res)return ''}
 const R=calc.res,l=calc.loads,proj=$('#projName').value||'Каркас';
 const top=[...R.res].sort((a,b)=>b.ur-a.ur).slice(0,12);
 const over=R.res.filter(r=>r.ur>1);
 const stock=elemStock();
 /* Шаг 5: данные новых разделов — раскрой (позиции), узлы, план сборки */
 const cutG=(typeof cutGroups==='function')?cutGroups():null;
 const jointsMap=(typeof nodeJoints==='function')?nodeJoints():new Map();
 const jgs=(typeof jointGroups==='function')?jointGroups(jointsMap):[];
 const plan=(typeof assemblyPlan==='function')?assemblyPlan():{stages:[],issues:[]};
 const name2pos={};if(cutG)cutG.grs.forEach(g=>g.groups.forEach(gp=>gp.parts.forEach(nm=>{name2pos[nm]=gp.pos})));
 const kinds={};M.rods.forEach(r=>{const s=rodSec(r);kinds[s.name]=(kinds[s.name]||0)+1});
 const imgMap={};shots.forEach(s=>imgMap[s.t]=s.data);
 const beams=elemGroups().filter(g=>g.pts.some(n=>n.type==='support'||n.type==='fixed')&&g.pts.length>=2)
   .slice(0,10).map(g=>svgBeam(g,R)).join('<hr>');
 const views=['Аксонометрия','Фасад рамы','Торец','План'].map(t=>
  `<figure style="margin:6px 0"><img src="${imgMap[t]}" style="width:100%;border:1px solid #bbb"/><figcaption>${t}</figcaption></figure>`).join('');
 const deflImg=imgMap['Деформированная схема']?`<figure style="margin:6px 0"><img src="${imgMap['Деформированная схема']}" style="width:100%;border:1px solid #bbb"/><figcaption>Деформированная схема (×${calc.deflScale})</figcaption></figure>`:'';
 return`<meta charset="utf-8"><title>${esc(proj)} — расчёт каркаса</title>
<style>body{font:13px sans-serif;color:#111;background:#fff;margin:18px;max-width:1000px}
h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #333}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #999;padding:4px 8px;font-size:12px}.bad td{background:#ffd9d0}.warn2 td{background:#fff1cc}
.kv{display:flex;gap:8px;margin:3px 0}.kv span{color:#555;min-width:220px}svg{display:block;margin:6px 0}
figure figcaption{font-size:11px;color:#555;margin-top:2px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}</style>
<h1 style="font-size:19px;margin:0">${esc(proj)} — расчёт сварного каркаса</h1>
<div class="kv"><span>Дата</span><b>${new Date().toLocaleString('ru')}</b></div>
<div class="kv"><span>Модель</span><b>${M.nodes.size} узлов / ${M.rods.size} стержней; КЭ (6 DOF/узел); стержни делены по узлам-носителям</b></div>
<div class="kv"><span>Нагрузки</span><b>${l.dead?'собств. вес (γf 1.05) • ':''}${l.snow?'снег р.'+l.snowRegion+' (γf='+GF_SNOW[l.snowRegion]+') • ':''}${l.wind?'ветер р.'+l.windRegion+' м.'+l.terrain+' (γf 1.4) • ':''}${l.live?'эксплуат. 0.4 кПа + 1 кН/узел • ':''}множитель ×${calc.factor}</b></div>
<div class="kv"><span>Итог</span><b style="color:${R.maxUR>1?'#b00':'#070'}">UR max ${R.maxUR.toFixed(2)} (${esc(R.urRod)})${R.maxUR>1?' — ПЕРЕГРУЗ':''} • прогиб max ${R.maxD.toFixed(1)} мм (${esc(R.dRod)})</b></div>
<div class="kv"><span>Сталь / металл</span><b>${R.mass.toFixed(0)} кг • ${Math.round(R.cost).toLocaleString('ru')} ₽ (по осям)</b></div>
<h2>1. Видовые схемы</h2><div class="grid2">${views}</div>${deflImg}
<h2>2. Схемы элементов с деформациями и усилиями</h2>${beams||'<i>нет длинных элементов с опорами</i>'}
<h2>3. Наиболее загруженные стержни</h2>
<table><tr><th>стержень</th><th>сечение</th><th>N сж, кН</th><th>N раср, кН</th><th>M, кН·м</th><th>UR</th><th>f, мм</th></tr>
${top.map(r=>`<tr class="${r.ur>1?'bad':r.ur>.9?'warn2':''}"><td>${esc(r.name)}</td><td>${esc(r.secName)}</td><td>${(r.Ncomp/1000).toFixed(1)}</td><td>${(r.Nt/1000).toFixed(1)}</td><td>${(r.Mmax/1e6).toFixed(1)}</td><td><b>${r.ur.toFixed(2)}</b></td><td>${r.defl.toFixed(1)}</td></tr>`).join('')}</table>
${over.length?`<div class="kv"><span>Перегруженные (UR&gt;1)</span><b style="color:#b00">${over.map(r=>esc(r.name)+' UR='+r.ur.toFixed(2)).join(', ')}</b></div>`:'<div class="kv"><span>Перегруза нет</span><b style="color:#070">UR ≤ 1 по всем стержням</b></div>'}
<h2>4. Опорные реакции, кН</h2>
<table><tr><th>опора</th><th>R</th><th>X</th><th>Y</th><th>Z</th></tr>
${R.reactArr.map(r=>`<tr><td>${esc(r.name)}</td><td><b>${r.F.toFixed(1)}</b></td><td>${r.fx.toFixed(1)}</td><td>${r.fy.toFixed(1)}</td><td>${r.fz.toFixed(1)}</td></tr>`).join('')}</table>
<h2>5. Схемы раскроя (штабы мерного проката)</h2>
<div style="font-size:11px;color:#555">Склейка соосных стержней в элементы через узлы-носители; штабы мерной длины, first-fit.</div>
${stock.grs.map(g=>`<h3 style="font-size:13px;margin:10px 0 2px">${esc(g.sec.name)} — ${g.nStock} штаб × ${g.sec.sell_len_m||12} м • утил. ${(g.util*100).toFixed(0)}% • ${g.mass.toFixed(0)} кг</h3>${svgStocks(g)}`).join('')}
<h2>6. Чертежи запилов (позиции одинаковых деталей)</h2>
<div style="font-size:11px;color:#555">Один чертёж на позицию Д-n: детали с одинаковой длиной и одинаковыми запилами обоих концов. Верх — заготовка в масштабе (ось, узлы, линии реза, размеры); низ — укрупнённые торцы, углы истинные. Вынос со знаком: у Т-подреза/вложения отрицательный — конец не доходит до оси.</div>
${cutG?cutG.grs.map(g=>g.groups.map(gp=>svgCutPos(g.sec,gp)).join('')).join(''):'<i>нет данных раскроя</i>'}
<h2>7. Схемы стыковки узлов</h2>
<div style="font-size:11px;color:#555">Классификация узлов (опора/T/K/X/N/угловой/сквозной); одинаковые схемы сгруппированы. Красный — основной элемент, серый пунктир — проходной стык, зелёный — ветви; подпись у ветви — тип реза.</div>
${jgs.length?jgs.map(g=>`<div style="margin-top:12px"><div style="font-size:12.5px"><b>${esc(g.j.clsTxt)}</b> — ${g.nodes.length} узл.: ${esc(g.nodes.join(', '))}${g.j.main?` • основной: ${esc(g.j.main.name)}`:''}</div>${svgJoint(g.j)}</div>`).join(''):'<i>нет данных узлов</i>'}
<h2>8. План сборки и проверки</h2>
<div style="font-size:11px;color:#555">Отраслевая последовательность: столбы → нижний пояс → стойки → верхний пояс → прогоны → укосины. Позиции — из раскроя (раздел 6).</div>
<table><tr><th>этап</th><th>операция</th><th>деталей</th><th>позиций</th><th>состав (детали / позиции)</th></tr>
${plan.stages.map(s2=>{const posSet=[...new Set(s2.rods.map(r=>name2pos[r.name]).filter(Boolean))];
 const names=s2.rods.map(r=>r.name);
 return`<tr><td><b>${s2.n}</b></td><td>${esc(s2.txt)}</td><td>${s2.rods.length}</td><td>${posSet.length}</td><td style="font-size:11px">${esc(names.join(', '))}<br><span style="color:#555">позиции: ${esc(posSet.join(', '))}</span></td></tr>`}).join('')}
</table>
<div style="font-size:11px;margin:8px 0 2px">${plan.stages.map((s2,i)=>`<span style="display:inline-block;margin-right:14px"><span style="color:${ASM_COL[i%6]};font-size:15px">■</span> ${s2.n}. ${esc(s2.txt.split(':')[0])}</span>`).join('')}</div>
${svgAsmPlan(plan)}
${plan.issues.length?`<div style="font-size:12.5px;margin-top:10px"><b>Проверки (${plan.issues.length}): ${plan.issues.filter(i2=>i2.sev==='err').length} ошиб. • ${plan.issues.filter(i2=>i2.sev!=='err').length} предупр.</b></div>
<table><tr><th></th><th>этап</th><th>проверка</th></tr>
${plan.issues.map(is=>`<tr class="${is.sev==='err'?'bad':'warn2'}"><td>${is.sev==='err'?'✖':'⚠'}</td><td>${is.stage==null?'—':is.stage}</td><td>${esc(is.txt)}</td></tr>`).join('')}</table>`:'<div class="kv"><span>Проверки</span><b style="color:#070">нарушений не найдено</b></div>'}
<h2>9. Смета металла</h2>
<table><tr><th>сечение</th><th>шт</th><th>L загот., м</th><th>покупка, м</th><th>масса, кг</th><th>₽/м</th><th>стоимость, ₽</th></tr>
${stock.grs.map(g=>`<tr><td>${esc(g.sec.name)}</td><td>${g.nStock}</td><td>${(g.total/1000).toFixed(1)}</td><td>${(g.nStock*(g.sec.sell_len_m||12)).toFixed(1)}</td><td>${g.mass.toFixed(0)}</td><td>${g.sec.price_rub_m||0}</td><td>${Math.round(g.cost).toLocaleString('ru')}</td></tr>`).join('')}
<tr><td colspan="4"><b>ИТОГО покупка</b></td><td><b>${stock.mass.toFixed(0)}</b></td><td></td><td><b>${Math.round(stock.cost).toLocaleString('ru')}</b></td></tr></table>
<div class="kv"><span>Металл по осям (справка)</span><b>${R.mass.toFixed(0)} кг • ${Math.round(R.cost).toLocaleString('ru')} ₽</b></div>
<h2>10. Состав сечений</h2><div class="kv">${Object.entries(kinds).map(([k,n])=>`<span>${esc(k)}</span><b>× ${n}</b>`).join(' • ')}</div>
<h2>11. Методика</h2><div style="font-size:12px;color:#333">
Снег/эксплуатационная/ветровые нагрузки — пространственное приведение по геометрии рядов (ширины из соседних рядов прогонов/поясов, шаг рам), СП 20.13330.<br>
UR: сжатие+изгиб — N/(φ·A·Ry) + (|M₂|/Wy+|M₃|/Wx)·(1−0.8n)/Ry; растяжение+изгиб — N/(A·Ry)+(|M₂|/Wy+|M₃|/Wx)/Ry; φ(λ), λ=min(L/i).<br>
Расчётная схема: стержни режутся по пересекающим узлам (основная модель не изменяется); узел «опора» — полная заделка; «узел» — жёсткое включение.<br>
Раскрой: единое ядро запилов cutCore — торец опоры 90°, сквозной стык без запила, угловой запил по биссектрисе (θ=90°−α/2, вынос за узел), Т-подрез/вложение в полость основного (конец не доходит до оси — вынос вычитается из L загот). Позиции — группировка одинаковых деталей. Проверки сборки: коллизии тел (segClosest), углы раскосов 30–60° (EC3/CIDECT), взаимная подрезка тел в узлах (зазор ≥ t₁+t₂ или нахлёст ≥25%), поэтапность (нет «висящих» деталей). Склейка соосных стержней в элементы; штабы мерного проката, first-fit. Сварные швы/стыки в смету не включены.</div>
<h2>12. Отказ от ответственности</h2><div style="font-size:11.5px;color:#555;border:1px solid #999;padding:8px;border-radius:6px">
ФЕРМА·CAD — инструмент предварительной оценки. Расчёт выполнен по упрощённой стержневой КЭ-модели: без узловой податливости, эксцентриситетов, местной устойчивости стержней и пластин, усталости, температурных воздействий, монтажных нагрузок и проверок сварных швов; нагрузки и коэффициенты сочетаний — типовые, без учёта фактических снеговых/ветровых районов по картам СП, снеговых гололёдных комбинаций, сейсмики и полной нормативной базы (СП 16.13330, СП 20.13330, ГОСТ 8509/8510/8639, СНиП II-23).<br>
<b>Настоящий отчёт не является расчётной документацией</b>, не проходит экспертизу и не может служить основанием для производства работ, изготовления металлоконструкций и приёмки объектов. Несущие конструкции должны проектироваться квалифицированной проектной организацией с проверкой независимым сертифицированным расчётным комплексом.</div>
<div style="margin-top:14px;font-size:11px;color:#666">Автор: <b>DENstis</b> • <a href="mailto:Denstis@gmail.com">Denstis@gmail.com</a> • ФЕРМА·CAD v38 • ${new Date().toLocaleString('ru')}</div>`;
}
