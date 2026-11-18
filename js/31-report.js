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
  let e2=V3(-e1.y,e1.x,0);if(e2.lengthSq()<1e-9)e2=V3(1,0,0);e2.normalize();
  const e3=new THREE.Vector3().crossVectors(e1,e2);
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
   const sg=segs?segs[k]:{d2:rr.d2,d3:rr.d3};
   const bulge=e2p.clone().multiplyScalar(sg.d2||0).add(e3p.clone().multiplyScalar(sg.d3||0));
   const da=dof(nA.id),db=dof(nB.id);
   const NSp=Math.max(2,Math.round(18*Lp/L));
   for(let i=(k?1:0);i<=NSp;i++){const t=i/NSp;
    const base=nA.p.clone().lerp(nB.p,t);
    const xa=base.clone().sub(nA.p),xb=base.clone().sub(nB.p);
    const ua=da[0].clone().add(new THREE.Vector3().crossVectors(da[1],xa));
    const ub=db[0].clone().add(new THREE.Vector3().crossVectors(db[1],xb));
    const c=base.clone().add(ua.clone().lerp(ub,t))
      .add(bulge.clone().multiplyScalar(Math.sin(Math.PI*t)*s));
    rings.push(cts.map(([x,y])=>c.clone().addScaledVector(e2,x).addScaledVector(e3,y)))}}
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
/* --- расширенный HTML-отчёт --- */
function buildReportHTML(shots){
 if(typeof rodSig==='function'&&calc.sig!==rodSig()){runCalc();if(!calc.res)return ''}
 const R=calc.res,l=calc.loads,proj=$('#projName').value||'Каркас';
 const top=[...R.res].sort((a,b)=>b.ur-a.ur).slice(0,12);
 const over=R.res.filter(r=>r.ur>1);
 const stock=elemStock();
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
<h2>6. Смета металла</h2>
<table><tr><th>сечение</th><th>шт</th><th>L загот., м</th><th>покупка, м</th><th>масса, кг</th><th>₽/м</th><th>стоимость, ₽</th></tr>
${stock.grs.map(g=>`<tr><td>${esc(g.sec.name)}</td><td>${g.nStock}</td><td>${(g.total/1000).toFixed(1)}</td><td>${(g.nStock*(g.sec.sell_len_m||12)).toFixed(1)}</td><td>${g.mass.toFixed(0)}</td><td>${g.sec.price_rub_m||0}</td><td>${Math.round(g.cost).toLocaleString('ru')}</td></tr>`).join('')}
<tr><td colspan="4"><b>ИТОГО покупка</b></td><td><b>${stock.mass.toFixed(0)}</b></td><td></td><td><b>${Math.round(stock.cost).toLocaleString('ru')}</b></td></tr></table>
<div class="kv"><span>Металл по осям (справка)</span><b>${R.mass.toFixed(0)} кг • ${Math.round(R.cost).toLocaleString('ru')} ₽</b></div>
<h2>7. Состав сечений</h2><div class="kv">${Object.entries(kinds).map(([k,n])=>`<span>${esc(k)}</span><b>× ${n}</b>`).join(' • ')}</div>
<h2>8. Методика</h2><div style="font-size:12px;color:#333">
Снег/эксплуатационная/ветровые нагрузки — пространственное приведение по геометрии рядов (ширины из соседних рядов прогонов/поясов, шаг рам), СП 20.13330.<br>
UR: сжатие+изгиб — N/(φ·A·Ry) + (|M₂|/Wy+|M₃|/Wx)·(1−0.8n)/Ry; растяжение+изгиб — N/(A·Ry)+(|M₂|/Wy+|M₃|/Wx)/Ry; φ(λ), λ=min(L/i).<br>
Расчётная схема: стержни режутся по пересекающим узлам (основная модель не изменяется); узел «опора» — полная заделка; «узел» — жёсткое включение.<br>
Раскрой: склейка соосных стержней в элементы; штабы мерного проката, first-fit. Сварные швы/стыки в смету не включены.</div>
<h2>9. Отказ от ответственности</h2><div style="font-size:11.5px;color:#555;border:1px solid #999;padding:8px;border-radius:6px">
ФЕРМА·CAD — инструмент предварительной оценки. Расчёт выполнен по упрощённой стержневой КЭ-модели: без узловой податливости, эксцентриситетов, местной устойчивости стержней и пластин, усталости, температурных воздействий, монтажных нагрузок и проверок сварных швов; нагрузки и коэффициенты сочетаний — типовые, без учёта фактических снеговых/ветровых районов по картам СП, снеговых гололёдных комбинаций, сейсмики и полной нормативной базы (СП 16.13330, СП 20.13330, ГОСТ 8509/8510/8639, СНиП II-23).<br>
<b>Настоящий отчёт не является расчётной документацией</b>, не проходит экспертизу и не может служить основанием для производства работ, изготовления металлоконструкций и приёмки объектов. Несущие конструкции должны проектироваться квалифицированной проектной организацией с проверкой независимым сертифицированным расчётным комплексом.</div>
<div style="margin-top:14px;font-size:11px;color:#666">Автор: <b>DENstis</b> • <a href="mailto:Denstis@gmail.com">Denstis@gmail.com</a> • ФЕРМА·CAD v38 • ${new Date().toLocaleString('ru')}</div>`;
}
