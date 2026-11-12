/* ==================== CALC: FEM 3D frame, SP20 loads, SP16 checks, heatmaps, deflection, cut, report ==================== */
'use strict';
let appMode='model';
const calc={res:null,byId:new Map(),_u:null,show:'ur',deflScale:80,showDefl:true,factor:1,
 loads:{dead:true,snow:true,wind:true,live:true,snowRegion:3,windRegion:3,terrain:'C',bTrib:3,liveQ:.4}};
const SG_KPA={1:.5,2:1,3:1.5,4:2,5:2.5,6:3,7:3.5,8:4};
const W0_KPA={1:.17,2:.25,3:.32,4:.4,5:.48,6:.6,7:.73,8:.9};
const GF_SNOW={1:1.4,2:1.4,3:1.4,4:1.5,5:1.5,6:1.6,7:1.6,8:1.6};
function snowMu(a){a=Math.abs(a);return a<=25?1:(a<=60?1.25:0)}
function ce(z,t){z=Math.max(z,2);
 if(t==='A')return .75*Math.pow(z/20,.42);
 if(t==='B')return .65*Math.pow(Math.max(z,5)/5,.5);
 if(t==='D')return .3*Math.pow(Math.max(z,40)/80,.88);
 return .5*Math.pow(z/20,.65)}
function secById(id){return NR_SECTIONS.find(s=>s.id===id)}
function matById(id){return NR_MATERIALS.find(m=>m.id===id)}
function rodSec(r){return secById(r.sec)||secById(SEC_DEFAULTS[r.type])||NR_SECTIONS[0]}
function rodSteel(r){return matById(r.mat)||matById('mat_s245')||NR_MATERIALS[1]}
function secProps(s){const A=s.A_cm2*100,Ix=s.Ix_cm4*1e4,Iy=s.Iy_cm4*1e4,Wx=s.Wx_cm3*1e3,Wy=s.Wy_cm3*1e3,ix=s.ix_cm*10,iy=s.iy_cm*10;
 const b=s.b_mm||80,h=s.h_mm||80,t=s.t_mm||4;let J;
 if(s.kind==='shs'||s.kind==='rhs'){const am=(b-2*t)*(h-2*t),pm=Math.max(2*(b+h-4*t),1);J=2*am*am*t/pm}
 else J=(2*b*t*t*t+Math.max(h-2*t,1)*t*t*t)/3;
 return{A,Ix,Iy,Wx,Wy,ix,iy,J,mass:s.mass_kg_m||5}}
function heatColor(t){t=clamp(t,0,1);const st=[[30,70,210],[40,190,220],[70,220,110],[240,200,60],[240,70,60]];
 const i=Math.min(3,Math.floor(t*4)),f=t*4-i,a=st[i],b=st[i+1];
 return new THREE.Color((a[0]+(b[0]-a[0])*f)/255,(a[1]+(b[1]-a[1])*f)/255,(a[2]+(b[2]-a[2])*f)/255)}
function phiBar(lam,E,Ry){const lb=lam/Math.PI*Math.sqrt(Ry/E);
 const b=1+(1+.002*lb-.002*lb*lb*lb)*.8*(lb-1)+lb*lb;
 return Math.max(.05,.5*(b+Math.sqrt(Math.max(b*b-lb*lb,0))))}
/* ---------- solver: 3D frame 6 DOF/node, dense gauss ---------- */
function solveFrame(){
 const nodes0=[...M.nodes.values()];if(nodes0.length<2)return{err:'Нет узлов'};
 const isSup=n=>n.type==='support';
 const adj0=new Map();nodes0.forEach(n=>adj0.set(n.id,new Set()));
 for(const r of M.rods.values()){if(adj0.has(r.a))adj0.get(r.a).add(r.b);if(adj0.has(r.b))adj0.get(r.b).add(r.a)}
 const nodes=nodes0.filter(n=>!n.host&&(isSup(n)||adj0.get(n.id).size>0));
 const mset=new Set(nodes.map(n=>n.id));
 const idx=new Map();nodes.forEach((n,i)=>idx.set(n.id,i));
 const seenC=new Set(),bad=[];
 nodes.forEach(n=>{if(seenC.has(n.id))return;const st=[n.id],c=[];seenC.add(n.id);
  while(st.length){const v=st.pop();c.push(v);adj0.get(v).forEach(w=>{if(mset.has(w)&&!seenC.has(w)){seenC.add(w);st.push(w)}})}
  if(!c.some(id=>isSup(M.nodes.get(id))))bad.push(c.length+' узл., напр. '+M.nodes.get(c[0]).name)});
 if(bad.length)return{err:'Компонент(ы) без опоры: '+bad.join('; ')+' — свяжите с каркасом/поставьте опоры'};
 const fmap=new Map();let nf=0;
 nodes.forEach((n,i)=>{if(isSup(n))return;for(let d=0;d<6;d++)fmap.set(i*6+d,nf++)});
 if(nf<6)return{err:'Расставьте опоры (нужно ≥2)'};
 const els=[];
 for(const r of M.rods.values()){
  const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)continue;
  if(!mset.has(r.a)||!mset.has(r.b))continue;
  const x=b.p.clone().sub(a.p);const L=x.length();if(L<10)continue;
  const e1=x.clone().multiplyScalar(1/L);
  let e2=AZ.clone().cross(e1);if(e2.lengthSq()<1e-8)e2=AY.clone().cross(e1);
  e2.normalize();const e3=e1.clone().cross(e2).normalize();
  const s=rodSec(r),p=secProps(s),m=rodSteel(r),E=m.E_mpa,G=m.G_mpa||79000,Ry=m.Ry_mpa;
  const k=new Float64Array(144),kd=(i,j,v)=>{k[i*12+j]=v};
  const EA=p.A*E/L,GJ=p.J*G/L;
  kd(0,0,EA);kd(0,6,-EA);kd(6,0,-EA);kd(6,6,EA);
  kd(3,3,GJ);kd(3,9,-GJ);kd(9,3,-GJ);kd(9,9,GJ);
  const cx=p.Ix*E/L**3,cy=p.Iy*E/L**3;
  [[2,4,8,10,cx,1],[1,5,7,11,cy,-1]].forEach(([A,B,C,D,c,sg])=>{const cL=c*sg*L,cLL=c*L*L;
   kd(A,A,12*c);kd(A,B,cL);kd(A,C,-12*c);kd(A,D,cL);
   kd(B,A,cL);kd(B,B,4*cLL);kd(B,C,-cL);kd(B,D,2*cLL);
   kd(C,A,-12*c);kd(C,B,cL);kd(C,C,12*c);kd(C,D,cL);
   kd(D,A,cL);kd(D,B,2*cLL);kd(D,C,cL);kd(D,D,4*cLL)});
  const R=[e1,e2,e3],CR=[e1,e2,e3].map(v=>[v.x,v.y,v.z]),T=new Float64Array(144);
  for(let b2=0;b2<2;b2++)for(let d=0;d<3;d++)for(let j=0;j<3;j++){T[(b2*6+d)*12+(b2*6+j)]=CR[d][j];T[(b2*6+3+d)*12+(b2*6+3+j)]=CR[d][j]}
  const Tk=new Float64Array(144),KE=new Float64Array(144);
  for(let i=0;i<12;i++)for(let j=0;j<12;j++){let v=0;for(let t=0;t<12;t++)v+=T[t*12+i]*k[t*12+j];Tk[i*12+j]=v}
  for(let i=0;i<12;i++)for(let j=0;j<12;j++){let v=0;for(let t=0;t<12;t++)v+=Tk[i*12+t]*T[t*12+j];KE[i*12+j]=v}
  els.push({r,a,b,L,p,E,Ry,R,T,KE,k,ia:idx.get(r.a),ib:idx.get(r.b),sec:s,secName:s.name,matName:m.name,qv:[0,0,0]})}
 if(!els.length)return{err:'Нет стержней'};
 const box=new THREE.Box3();nodes.forEach(n=>box.expandByPoint(n.p));
 const yMin=box.min.y,yMax=box.max.y;
 const L2=calc.loads,mult=calc.factor;
 const varsN=[L2.snow,L2.wind,L2.live].filter(Boolean).length,kT=varsN>=2?.7:1;
 const addLoad=(e,q)=>{e.qv[0]+=q[0];e.qv[1]+=q[1];e.qv[2]+=q[2]};
 let ridgeZ=-1e9;els.forEach(e=>ridgeZ=Math.max(ridgeZ,e.a.p.z,e.b.p.z));
 const nodalF=[];
 if(L2.dead)els.forEach(e=>addLoad(e,[0,0,-e.p.mass*9.81/1000*1.05*mult]));
 if(L2.snow){const S=SG_KPA[L2.snowRegion]*1000,gf=GF_SNOW[L2.snowRegion];
  els.forEach(e=>{if(e.r.type!=='top')return;
   const Lh=Math.hypot(e.b.p.x-e.a.p.x,e.b.p.y-e.a.p.y),dz=Math.abs(e.b.p.z-e.a.p.z);
   const mu=snowMu(Math.atan2(dz,Math.max(Lh,1))*180/Math.PI);if(mu<=0)return;
   addLoad(e,[0,0,-S*mu*gf*mult*L2.bTrib*(Lh/e.L)/1000])})}
 if(L2.wind){const w0=W0_KPA[L2.windRegion]*1000*1.4*kT*mult;
  els.forEach(e=>{if(Math.abs(e.a.p.y-e.b.p.y)>1)return;
   const face=Math.abs(e.a.p.y-yMin)<50?1:(Math.abs(e.a.p.y-yMax)<50?.6:0);if(!face)return;
   const dz=Math.abs(e.b.p.z-e.a.p.z);if(!dz)return;
   const zmid=(e.a.p.z+e.b.p.z)/2000;
   addLoad(e,[w0*ce(zmid,L2.terrain)*face*L2.bTrib*dz/e.L/1000,0,0])})}
 if(L2.live){const q=L2.liveQ*1000*1.2*kT*mult;
  els.forEach(e=>{if(e.r.type!=='top')return;
   const Lh=Math.hypot(e.b.p.x-e.a.p.x,e.b.p.y-e.a.p.y);
   addLoad(e,[0,0,-q*(Lh/e.L)*L2.bTrib/1000])});
  const seen=new Set();
  nodes.forEach(n=>{if(!isSup(n)&&n.p.z>ridgeZ-1&&!seen.has(n.id)){seen.add(n.id);
   const fi=fmap.get(idx.get(n.id)*6+2);if(fi!==undefined)nodalF.push([fi,-1000*1.2*mult*kT])}})}
 const K=new Float64Array(nf*nf),F=new Float64Array(nf);
 els.forEach(e=>{const q=e.qv,R=e.R,L=e.L;
  const q1=q[0]*R[0].x+q[1]*R[1].x+q[2]*R[2].x,q2=q[0]*R[0].y+q[1]*R[1].y+q[2]*R[2].y,q3=q[0]*R[0].z+q[1]*R[1].z+q[2]*R[2].z;
  e.qloc=[q1,q2,q3];
  e.f0=[-q1*L/2,-q2*L/2,-q3*L/2,0,-q3*L*L/12,q2*L*L/12,q1*L/2,q2*L/2,q3*L/2,0,q3*L*L/12,-q2*L*L/12];
  const dofs=[];for(let i=0;i<12;i++)dofs.push(fmap.get((i<6?e.ia:e.ib)*6+(i%6)));
  for(let i=0;i<12;i++){const gi=dofs[i];if(gi===undefined)continue;
   for(let j=0;j<12;j++){const gj=dofs[j];if(gj===undefined)continue;K[gi*nf+gj]+=e.KE[i*12+j]}}
  for(let i=0;i<12;i++){const fi=dofs[i];if(fi===undefined)continue;
   let Fe=0;for(let j=0;j<12;j++)Fe+=e.T[j*12+i]*e.f0[j];F[fi]+=-Fe}});
 nodalF.forEach(([fi,v])=>F[fi]+=v);
 const A=K;
 for(let c=0;c<nf;c++){
  let piv=c,bv=Math.abs(A[c*nf+c]);
  for(let r=c+1;r<nf;r++){const v=Math.abs(A[r*nf+c]);if(v>bv){bv=v;piv=r}}
  if(bv<1e-9)return{err:'Особенная матрица — механизм: добавьте опоры/жёсткости'};
  if(piv!==c){for(let j=c;j<nf;j++){const t=A[c*nf+j];A[c*nf+j]=A[piv*nf+j];A[piv*nf+j]=t}const t=F[c];F[c]=F[piv];F[piv]=t}
  const d=A[c*nf+c];
  for(let r=c+1;r<nf;r++){const f=A[r*nf+c]/d;if(!f)continue;
   for(let j=c;j<nf;j++)A[r*nf+j]-=f*A[c*nf+j];F[r]-=f*F[c]}}
 const uf=new Float64Array(nf);
 for(let c=nf-1;c>=0;c--){let s=F[c];for(let j=c+1;j<nf;j++)s-=A[c*nf+j]*uf[j];uf[c]=s/A[c*nf+c]}
 const u=new Float64Array(nodes.length*6);
 nodes.forEach((n,i)=>{if(isSup(n))return;for(let d=0;d<6;d++)u[i*6+d]=uf[fmap.get(i*6+d)]});
 const res=[];const react=new Map();
 let maxUR=0,urRod='-',maxD=0,dRod='-',mass=0,cost=0;
 els.forEach(e=>{
  const ug=new Float64Array(12),ul=new Float64Array(12);
  for(let d=0;d<6;d++){ug[d]=u[e.ia*6+d];ug[6+d]=u[e.ib*6+d]}
  for(let i=0;i<12;i++){let v=0;for(let j=0;j<12;j++)v+=e.T[j*12+i]*ug[j];ul[i]=v}
  const fe=new Float64Array(12);
  for(let i=0;i<12;i++){let v=0;for(let j=0;j<12;j++)v+=e.k[i*12+j]*ul[j];fe[i]=v+e.f0[i]}
  const[q1,q2,q3]=e.qloc,L=e.L,p=e.p;
  const phi=phiBar(L/Math.min(p.ix,p.iy),e.E,e.Ry);
  const Ns=[],Ms=[],URs=[];
  for(let i=0;i<=8;i++){const s=L*i/8,r2=L-s;
   const N=fe[6]+q1*r2;
   const M2=fe[11]+fe[7]*r2+q2*r2*r2/2;
   const M3=-(fe[10]+fe[8]*r2+q3*r2*r2/2);
   const M=Math.hypot(M2,M3);
   const nn=Math.max(0,-N)/(phi*p.A*e.Ry),mm=M/(p.Wx*e.Ry);
   Ns.push(N);Ms.push(M);URs.push(nn+mm*Math.max(0,1-.8*nn))}
  const Ncomp=Math.max(0,-Math.min(...Ns)),Nt=Math.max(0,Math.max(...Ns)),Mmax=Math.max(...Ms),ur=Math.max(...URs);
  const M2a=fe[11]+fe[7]*L+q2*L*L/2,M3a=-(fe[10]+fe[8]*L+q3*L*L/2);
  const d2=(M2a+fe[11])*L*L/(16*e.E*p.Iy)+5*q2*L**4/(384*e.E*p.Iy);
  const d3=(M3a-fe[10])*L*L/(16*e.E*p.Ix)+5*q3*L**4/(384*e.E*p.Ix);
  const e1v=e.R[0];
  const um=[0,1,2].map(d=>(u[e.ia*6+d]+u[e.ib*6+d])/2);
  const along=um[0]*e1v.x+um[1]*e1v.y+um[2]*e1v.z;
  const nodalD=Math.hypot(um[0]-along*e1v.x,um[1]-along*e1v.y,um[2]-along*e1v.z);
  const defl=Math.hypot(d2,d3)+nodalD;
  res.push({id:e.r.id,name:e.r.name,secName:e.secName,matName:e.matName,secId:e.sec.id,L,
   Ncomp,Nt,Mmax,ur,defl,Ns,Ms,URs});
  if(ur>maxUR){maxUR=ur;urRod=e.r.name}
  if(defl>maxD){maxD=defl;dRod=e.r.name}
  mass+=e.p.mass*L/1000;cost+=(e.sec.price_rub_m||0)*L/1000;
  const gfe=new Float64Array(12);
  for(let i=0;i<12;i++){let v=0;for(let j=0;j<12;j++)v+=e.T[i*12+j]*fe[j];gfe[i]=v}
  [[e.ia,0],[e.ib,6]].forEach(([nd,off])=>{const n=nodes[nd];if(!isSup(n))return;
   const a2=react.get(n.id)||[0,0,0];a2[0]+=gfe[off];a2[1]+=gfe[off+1];a2[2]+=gfe[off+2];react.set(n.id,a2)})});
 const reactArr=[...react.entries()].map(([id,v])=>({id,
  name:(M.nodes.get(id)||{}).name||id,fx:-v[0]/1000,fy:-v[1]/1000,fz:-v[2]/1000,
  F:Math.hypot(v[0],v[1],v[2])/1000})).sort((a,b)=>b.F-a.F);
 return{res,reactArr,maxUR,urRod,maxD,dRod,mass,cost,u,nodeOrder:nodes.map(n=>n.id)}}
/* ---------- drawing ---------- */
function calcGroup(){if(!window._gCalc){window._gCalc=new THREE.Group();scene.add(window._gCalc)}return window._gCalc}
function nodeMatHeat(col){return matFor('nhx:'+col.getHexString(),'#'+col.getHexString(),'base')}
function rodMatHeat(col){return matFor('rhx:'+col.getHexString(),'#'+col.getHexString(),'base')}
function clearCalcDraw(){clearGroup(calcGroup());calc._nodeCol=calc._rodCol=null;if(window.applySelMats)applySelMats();const l=$('#calcLegend');if(l)l.style.display='none'}
function drawCalc(){clearCalcDraw();const R=calc.res;if(!R)return;
 const g=calcGroup(),show=calc.show;
 const valOf=(rr,i)=>show==='n'?rr.Ns[i]:show==='m'?rr.Ms[i]/1e6:show==='defl'?rr.defl:rr.URs[i];
 let scale=1;
 if(show==='n'){R.res.forEach(r=>scale=Math.max(scale,r.Ncomp,r.Nt))}
 else if(show==='m'){R.res.forEach(r=>scale=Math.max(scale,r.Mmax/1e6))}
 else if(show==='defl'){R.res.forEach(r=>scale=Math.max(scale,r.defl))}
 else scale=Math.max(1.01,R.maxUR);
 const nidx=new Map(R.nodeOrder.map((id,i)=>[id,i]));
 const buckets=new Map();
 M.rods.forEach(rd=>{const rr=calc.byId.get(rd.id);if(!rr)return;
  const na=M.nodes.get(rd.a),nb=M.nodes.get(rd.b);
  for(let i=0;i<8;i++){const v=(valOf(rr,i)+valOf(rr,i+1))/2;let col;
   if(show==='n'){const t=clamp(Math.abs(v)/scale,.12,1);
    col=v<0?heatColor(.62+.38*t):new THREE.Color(.15+.5*t,.45+.3*t,1*(.3+.7*t))}
   else col=heatColor(clamp(Math.abs(v)/scale,.08,1));
   const arr=buckets.get(col.getHexString())||[];
   arr.push(na.p.clone().lerp(nb.p,i/8),na.p.clone().lerp(nb.p,(i+1)/8));
   buckets.set(col.getHexString(),arr)}});
 buckets.forEach((pts,hex)=>g.add(lines(pts,'#'+hex,1,true,false,true)));
 // rod body heat colors (cylinders): worst segment per rod
 calc._rodCol=new Map();
 M.rods.forEach(rd=>{const rr=calc.byId.get(rd.id);if(!rr)return;let col;
  if(show==='n'){let bv=0;for(let i=0;i<8;i++){const v=(rr.Ns[i]+rr.Ns[i+1])/2;if(Math.abs(v)>Math.abs(bv))bv=v}
   const t=clamp(Math.abs(bv)/scale,.12,1);col=bv<0?heatColor(.62+.38*t):new THREE.Color(.15+.5*t,.45+.3*t,.3+.7*t)}
  else if(show==='m')col=heatColor(clamp(Math.abs(rr.Mmax/1e6)/scale,.08,1));
  else if(show==='defl')col=heatColor(clamp(rr.defl/scale,.08,1));
  else col=heatColor(clamp(rr.ur/scale,.08,1));
  calc._rodCol.set(rd.id,col)});
 // node heat colors: max end value of attached rods (disp for defl)
 calc._nodeCol=new Map();
 M.nodes.forEach(nd=>{let col;
  if(show==='defl'){const i=nidx.get(nd.id);const d=Math.hypot(R.u[i*6],R.u[i*6+1],R.u[i*6+2]);
   col=heatColor(clamp(d/scale,.08,1))}
  else{let bv=0;
   for(const r of attachedRods(nd.id)){const rr=calc.byId.get(r.id);if(!rr)continue;
    const v=valOf(rr,r.a===nd.id?0:8);if(Math.abs(v)>Math.abs(bv))bv=v}
   if(show==='n'){const t=clamp(Math.abs(bv)/scale,.12,1);
    col=bv<0?heatColor(.62+.38*t):new THREE.Color(.15+.5*t,.45+.3*t,1*(.3+.7*t))}
   else col=heatColor(clamp(Math.abs(bv)/scale,.08,1))}
  calc._nodeCol.set(nd.id,col)});
 applySelMats();
 if(calc.showDefl){const s=calc.deflScale,pts=[];
  M.rods.forEach(rd=>{const d=id=>{const n=M.nodes.get(id),i=nidx.get(id);
    return n.p.clone().add(V3(R.u[i*6]*s,R.u[i*6+1]*s,R.u[i*6+2]*s))};
   pts.push(d(rd.a),d(rd.b))});
  g.add(lines(pts,0xffc53d,.9,true,true,true))}
 const lg=$('#calcLegend');if(!lg)return;lg.style.display='flex';
 const fmtV=v=>show==='n'?(v/1000).toFixed(1)+' кН':show==='m'?v.toFixed(0)+' кН·м':show==='defl'?v.toFixed(1)+' мм':v.toFixed(2);
 const lbl={ur:'UR — использование 0…1',n:'N: сжатие (тёплый) / растяжение (синий)',m:'M изгибающий, кН·м',defl:'Прогиб, мм'}[show];
 lg.innerHTML=`<div class="lgBar ${show==='n'?'lgN':''}"></div><b>${lbl}</b><span class="mono">0 → ${fmtV(scale)}</span>`;
 if(show==='defl')lg.insertAdjacentHTML('beforeend',`<span class="dim2">деформации ×${calc.deflScale}</span>`)}
function calcRead(rodId){const rd=$('#calcRead');if(!rd)return;
 const rr=calc.byId.get(rodId);if(!rr){rd.textContent='';return}
 rd.textContent=`${rr.name} • ${rr.secName} • сж ${(rr.Ncomp/1000).toFixed(1)} / раср ${(rr.Nt/1000).toFixed(1)} кН • M ${(rr.Mmax/1e6).toFixed(1)} кН·м • UR ${rr.ur.toFixed(2)} • f ${rr.defl.toFixed(1)} мм`}
/* ---------- run + results panel ---------- */
function runCalc(){const t0=performance.now();const R=solveFrame();
 if(!R||R.err){toast((R&&R.err)||'Расчёт не выполнен',{type:'err',timeout:5000});return}
 calc.res=R;calc.byId=new Map(R.res.map(r=>[r.id,r]));
 drawCalc();renderCalcResults();
 toast(`РАСЧЁТ: ${R.res.length} стержней, ${Math.round(performance.now()-t0)} мс • UR max ${R.maxUR.toFixed(2)} (${R.urRod})`,
  {type:R.maxUR>1?'warn':'ok',timeout:6000})}
function renderCalcResults(){const R=calc.res,el=$('#calcOut');if(!el||!R)return;
 const top=[...R.res].sort((a,b)=>b.ur-a.ur).slice(0,8);
 el.innerHTML=`<div class="kv"><span>UR max</span><b style="color:${R.maxUR>1?'#ff7a6a':'#7fe8b8'}">${R.maxUR.toFixed(2)} — ${esc(R.urRod)}</b></div>
 <div class="kv"><span>Прогиб max</span><b>${R.maxD.toFixed(1)} мм — ${esc(R.dRod)} (L/250)</b></div>
 <div class="kv"><span>Реакция max</span><b>${(R.reactArr[0]?.F||0).toFixed(1)} кН — ${esc(R.reactArr[0]?.name||'-')}</b></div>
 <div class="kv"><span>Сталь</span><b>${R.mass.toFixed(0)} кг</b></div>
 <table class="calcTab"><tr><th>стержень</th><th>сечение</th><th>UR</th><th>f, мм</th></tr>
 ${top.map(r=>`<tr class="${r.ur>1?'bad':''}" data-cr="${r.id}"><td>${esc(r.name)}</td><td>${esc(r.secName)}</td><td><b>${r.ur.toFixed(2)}</b></td><td>${r.defl.toFixed(1)}</td></tr>`).join('')}</table>`;
 el.querySelectorAll('[data-cr]').forEach(tr=>tr.onclick=()=>{selectOnly('rod',tr.dataset.cr);selectionChanged()})}
/* ---------- panel ---------- */
function calcPaneHTML(){const l=calc.loads;
 const opt=(v,cur,lbl)=>`<option value="${v}" ${String(v)===String(cur)?'selected':''}>${lbl}</option>`;
 return`<div class="psect">НАГРУЗКИ (СП 20.13330)</div>
 <label class="ck"><input type="checkbox" id="ckDead" ${l.dead?'checked':''}> Собственный вес (γf 1.05)</label>
 <label class="ck"><input type="checkbox" id="ckSnow" ${l.snow?'checked':''}> Снег: μ(α) + γf по району</label>
 <div class="crow"><label>Снеговой район</label><select id="selSnowR">${[1,2,3,4,5,6,7,8].map(i=>opt(i,l.snowRegion,i+' — '+SG_KPA[i]+' кПа')).join('')}</select></div>
 <label class="ck"><input type="checkbox" id="ckWind" ${l.wind?'checked':''}> Ветер: напор+всас (γf 1.4)</label>
 <div class="crow"><label>Ветровой район</label><select id="selWindR">${[1,2,3,4,5,6,7,8].map(i=>opt(i,l.windRegion,i+' — '+W0_KPA[i]+' кПа')).join('')}</select></div>
 <div class="crow"><label>Местность</label><select id="selTerr">${['A','B','C','D'].map(t=>opt(t,l.terrain,t)).join('')}</select></div>
 <label class="ck"><input type="checkbox" id="ckLive" ${l.live?'checked':''}> Эксплуат.: 0.4 кПа + 1 кН в узел</label>
 <div class="crow"><label>Ширина b (шаг ферм), м</label><input type="number" id="inB" value="${l.bTrib}" step=".5" min=".5" max="24"></div>
 <div class="crow"><label>Множитель нагрузки <b id="multVal">${calc.factor.toFixed(2)}×</b></label>
  <input type="range" id="rngMult" min="0.25" max="3" step="0.05" value="${calc.factor}"></div>
 <div class="btnrow"><button class="btn gold" id="btnCalc">РАСЧЁТ</button><button class="btn" id="btnCalcClear">СБРОС</button></div>
 <div class="psect">ОТОБРАЖЕНИЕ</div>
 <div class="crow"><label>Тепловая карта</label><select id="selShow">
  <option value="ur" ${calc.show==='ur'?'selected':''}>UR — общая нагрузка</option>
  <option value="n" ${calc.show==='n'?'selected':''}>N — сжатие/растяжение</option>
  <option value="m" ${calc.show==='m'?'selected':''}>M — изгиб</option>
  <option value="defl" ${calc.show==='defl'?'selected':''}>Прогибы</option></select></div>
 <label class="ck"><input type="checkbox" id="ckDefl" ${calc.showDefl?'checked':''}> Деформированная схема</label>
 <div class="crow"><label>Масштаб прогибов ×<b id="dScaleVal">${calc.deflScale}</b></label>
  <input type="range" id="rngDefl" min="1" max="300" step="1" value="${calc.deflScale}"></div>
 <div class="psect">РЕЗУЛЬТАТ</div><div id="calcOut"><div class="hint2">РАСЧЁТ считает всю раму КЭ-моделью по свойствам профилей и материалов.</div></div>`}
function bindCalcPane(){const W=(id,ev,fn)=>{const e=$(id);if(e)e.addEventListener(ev,fn)};const L=calc.loads;
 W('#ckDead','change',e=>L.dead=e.target.checked);
 W('#ckSnow','change',e=>L.snow=e.target.checked);
 W('#ckWind','change',e=>L.wind=e.target.checked);
 W('#ckLive','change',e=>L.live=e.target.checked);
 W('#selSnowR','change',e=>L.snowRegion=+e.target.value);
 W('#selWindR','change',e=>L.windRegion=+e.target.value);
 W('#selTerr','change',e=>L.terrain=e.target.value);
 W('#inB','change',e=>L.bTrib=clamp(+e.target.value||3,.5,24));
 W('#rngMult','input',e=>{calc.factor=+e.target.value;$('#multVal').textContent=calc.factor.toFixed(2)+'×'});
 W('#btnCalc','click',()=>runCalc());
 W('#btnCalcClear','click',()=>{calc.res=null;clearCalcDraw();$('#calcOut').innerHTML='<div class="hint2">Расчёт сброшен.</div>';toast('Результаты сброшены')});
 W('#selShow','change',e=>{calc.show=e.target.value;if(calc.res)drawCalc()});
 W('#ckDefl','change',e=>{calc.showDefl=e.target.checked;if(calc.res)drawCalc()});
 W('#rngDefl','input',e=>{calc.deflScale=+e.target.value;$('#dScaleVal').textContent=calc.deflScale;if(calc.res)drawCalc()})}
/* ---------- app modes ---------- */
function setAppMode(m){appMode=m;
 document.body.classList.toggle('app-loads',m!=='model');
 ['tabModel','tabLoads','tabCut','tabReport'].forEach(id=>{const b=$('#'+id);if(b)b.classList.toggle('on',id==='tab'+m.charAt(0).toUpperCase()+m.slice(1))});
 $('#toolbar').style.display=m==='model'?'':'none';
 if(m==='model'){$('#paneCalc').classList.remove('on');$('#tabCalc').classList.remove('on');$('#tabProps').classList.add('on');$('#paneProps').classList.add('on');clearCalcDraw&&clearCalcDraw();renderTree&&renderTree()}
 if(m==='loads'){
  if(mode==='plan')exitPlan();
  $('#tabCalc').classList.add('on');
  $('#paneProps').classList.remove('on');$('#paneTree').classList.remove('on');$('#tabProps').classList.remove('on');$('#tabTree').classList.remove('on');
  $('#paneCalc').classList.add('on');if(!$('#paneCalc').innerHTML)$('#paneCalc').innerHTML=calcPaneHTML(),bindCalcPane();
  if(calc.res)drawCalc();updateHint();renderTree&&renderTree()}
 if(m==='cut'){setAppModeQuiet('model');openCutModal()}
 if(m==='report'){setAppModeQuiet('model');openReportModal()}}
function setAppModeQuiet(m){appMode=m;document.body.classList.toggle('app-loads',m!=='model');
 ['tabModel','tabLoads','tabCut','tabReport'].forEach(id=>{const b=$('#'+id);if(b)b.classList.toggle('on',id==='tab'+m.charAt(0).toUpperCase()+m.slice(1))});
 $('#toolbar').style.display=m==='model'?'':'none';
 if(m==='model'){$('#paneCalc').classList.remove('on');$('#tabProps').classList.add('on');$('#paneProps').classList.add('on')}}
/* ---------- cut ---------- */
function cutGroups(){const g=new Map();
 M.rods.forEach(r=>{const s=rodSec(r);const a=M.nodes.get(r.a),b=M.nodes.get(r.b);const L=Math.round(a.p.distanceTo(b.p));
  const arr=g.get(s.id)||{sec:s,items:[]};arr.items.push({name:r.name,L});g.set(s.id,arr)});
 return[...g.values()].map(gr=>{const items=gr.items.slice().sort((a,b)=>b.L-a.L);
  const bin=Math.round((gr.sec.sell_len_m||12)*1000);const bins=[],map=[];
  items.forEach(it=>{let placed=false;
   for(let i=0;i<bins.length;i++)if(bins[i]>=it.L){bins[i]-=it.L;placed=true;break}
   if(!placed)bins.push(bin-it.L)});
  const total=items.reduce((s,i2)=>s+i2.L,0),stockLen=bins.length*bin;
  return{sec:gr.sec,items,nStock:bins.length,util:stockLen?total/stockLen:0,total,
   mass:(gr.sec.mass_kg_m||0)*stockLen/1000,cost:(gr.sec.price_rub_m||0)*stockLen/1000}})}
function openCutModal(){const grs=cutGroups().sort((a,b)=>b.total-a.total);
 let csv='Сечение,Элемент,Длина мм\n';
 const rows=grs.map(g2=>{const cnt=new Map();g2.items.forEach(i2=>cnt.set(i2.L,(cnt.get(i2.L)||0)+1));
  [...cnt.entries()].sort((a,b)=>b[0]-a[0]).forEach(([L,c])=>csv+=`"${g2.sec.name}",${c},"${L}"\n`);
  const list=[...cnt.entries()].sort((a,b)=>b[0]-a[0]).map(([L,c])=>`${c}× ${fmt(L)}`).join(', ');
  return`<tr><td><b>${esc(g2.sec.name)}</b><br><span class="dim2">${g2.nStock} штаба × ${(g2.sec.sell_len_m||12)} м • утил. ${(g2.util*100).toFixed(0)}% • ${g2.mass.toFixed(0)} кг • ${Math.round(g2.cost).toLocaleString('ru')} ₽</span></td><td class="mono">${list}</td></tr>`}).join('');
 const mass=grs.reduce((s,g2)=>s+g2.mass,0),cost=grs.reduce((s,g2)=>s+g2.cost,0);
 openModal('РАСКРОЙ — мерный прокат',`<div class="hint2">Раскладка FFD по штабам длины продажи (по каталогу); цена — ₽/м из каталога 1metallobaza.</div>
 <table class="calcTab wide"><tr><th>сечение / штабы</th><th>мерные длины</th></tr>${rows}</table>
 <div class="kv"><span>Сталь по раскрою (с отходами)</span><b>${mass.toFixed(0)} кг</b></div>
 <div class="kv"><span>Ориентировочная стоимость металла</span><b>${Math.round(cost).toLocaleString('ru')} ₽</b></div>`,
 [{label:'Копировать CSV',keep:true,fn:()=>navigator.clipboard.writeText(csv).then(()=>toast('CSV скопирован',{type:'ok'}))}])}
/* ---------- report ---------- */
function openReportModal(){
 if(!calc.res){toast('Сначала выполните РАСЧЁТ в режиме «Нагрузки»',{type:'warn'});setAppMode('loads');return}
 const R=calc.res,l=calc.loads;
 const top=[...R.res].sort((a,b)=>b.ur-a.ur).slice(0,12);
 const kinds={};M.rods.forEach(r=>{const s=rodSec(r);kinds[s.name]=(kinds[s.name]||0)+1});
 openModal('ОТЧЁТ ПО КАРКАСУ',
 `<div class="hint2">«${esc($('#projName').value)}» • ${M.nodes.size} узлов / ${M.rods.size} стержней • стержневая КЭ модель (6 DOF/узел) • нагрузки СП 20.13330, проверки СП 16.13330 (упрощённая φ по λ)</div>
 <div class="kv"><span>Нагрузки</span><b>${l.dead?'собств. вес • ':''}${l.snow?'снег р.'+l.snowRegion+' γf='+GF_SNOW[l.snowRegion]+' • ':''}${l.wind?'ветер р.'+l.windRegion+' м.'+l.terrain+' • ':''}${l.live?'эксплуат. 0.4 кПа + 1 кН • ':''}b=${l.bTrib} м • множитель ×${calc.factor}</b></div>
 <div class="kv"><span>Итог</span><b style="color:${R.maxUR>1?'#ff7a6a':'#7fe8b8'}">UR max ${R.maxUR.toFixed(2)} (${esc(R.urRod)})${R.maxUR>1?' — ПЕРЕГРУЗ':''} • прогиб max ${R.maxD.toFixed(1)} мм (${esc(R.dRod)})</b></div>
 <div class="kv"><span>Сталь / металл</span><b>${R.mass.toFixed(0)} кг • ${Math.round(R.cost).toLocaleString('ru')} ₽</b></div>
 <div class="psect">НАИБОЛЕЕ ЗАГРУЖЕННЫЕ СТЕРЖНИ</div>
 <table class="calcTab"><tr><th>стержень</th><th>сечение</th><th>N сж, кН</th><th>M, кН·м</th><th>UR</th><th>f, мм</th></tr>
 ${top.map(r=>`<tr class="${r.ur>1?'bad':r.ur>.9?'warn2':''}"><td>${esc(r.name)}</td><td>${esc(r.secName)}</td><td>${(r.Ncomp/1000).toFixed(1)}</td><td>${(r.Mmax/1e6).toFixed(1)}</td><td><b>${r.ur.toFixed(2)}</b></td><td>${r.defl.toFixed(1)}</td></tr>`).join('')}</table>
 <div class="psect">ОПОРНЫЕ РЕАКЦИИ, кН</div>
 <table class="calcTab"><tr><th>опора</th><th>R</th><th>X</th><th>Y</th><th>Z</th></tr>
 ${R.reactArr.map(r=>`<tr><td>${esc(r.name)}</td><td><b>${r.F.toFixed(1)}</b></td><td>${r.fx.toFixed(1)}</td><td>${r.fy.toFixed(1)}</td><td>${r.fz.toFixed(1)}</td></tr>`).join('')}</table>
 <div class="psect">СОСТАВ СЕЧЕНИЙ</div>
 <div class="hint2">${Object.entries(kinds).map(([k,n])=>`${esc(k)} × ${n}`).join(' • ')}</div>
 <div class="hint2">UR = N/(φ·A·Ry) + M·(1−0.8N/(φARy))/(W·Ry). Прогибы — от полной нагрузки без γf-коэффициентов доверия к комбинации (эксплуатационная оценка).</div>`,
 [{label:'Скачать HTML',keep:true,fn:()=>{const body=document.querySelector('#mbody');
   const blob=new Blob(['<meta charset="utf-8"><style>body{font:13px sans-serif;color:#111;background:#fff}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}.psect{font-weight:700;margin:12px 0 4px}</style>'+body.innerHTML],{type:'text/html'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='roof-report.html';a.click();toast('Отчёт сохранён',{type:'ok'})}},
  {label:'Закрыть',fn:closeModal}])}
/* boot wiring */
window.addEventListener('load',()=>{
 ['#tabModel','#tabLoads','#tabCut','#tabReport'].forEach((id,i)=>{const b=$(id);if(b)b.onclick=()=>setAppMode(['model','loads','cut','report'][i])});
});
