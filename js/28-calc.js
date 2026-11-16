/* ==================== CALC: FEM 3D frame, SP20 loads, SP16 checks, heatmaps, deflection, cut, report ==================== */
'use strict';
let appMode='model';
const calc={res:null,byId:new Map(),_u:null,show:'ur',deflScale:80,deflAuto:true,showDefl:true,palMM:false,optDefl:true,optCrit:'mass',optTarget:.7,factor:1,
 loads:{dead:true,snow:true,wind:true,live:true,snowRegion:3,windRegion:3,terrain:'C',liveQ:.4}};
const SG_KPA={1:.5,2:1,3:1.5,4:2,5:2.5,6:3,7:3.5,8:4};
const W0_KPA={1:.17,2:.25,3:.32,4:.4,5:.48,6:.6,7:.73,8:.9};
const GF_SNOW={1:1.4,2:1.4,3:1.4,4:1.5,5:1.5,6:1.6,7:1.6,8:1.6};
function snowMu(a){a=Math.abs(a);return a<=25?1:(a<=60?1.25:0)}
function ce(z,t){z=Math.max(z,2);
 if(t==='A')return .75*Math.pow(z/20,.42);
 if(t==='B')return .65*Math.pow(Math.max(z,5)/5,.5);
 if(t==='D')return .3*Math.pow(Math.max(z,40)/80,.88);
 return .5*Math.pow(z/20,.65)}
const GVEC={P:p=>[p.x,p.y,p.z],sub:(u,v)=>[u[0]-v[0],u[1]-v[1],u[2]-v[2]],
 cross:(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],
 dot:(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2],
 norm:u=>{const l=Math.hypot(u[0],u[1],u[2]);return l>1e-9?[u[0]/l,u[1]/l,u[2]/l]:null}};
function slopeFamilies(){const mY=[0,1,0],planes=[],rp=[],out=[];let ridgeZ=-1e9;
 M.rods.forEach(r=>{const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return;
  rp.push([r,GVEC.P(a.p),GVEC.P(b.p)]);ridgeZ=Math.max(ridgeZ,a.p.z,b.p.z)});
 rp.forEach(([r,a,b])=>{const u=GVEC.norm(GVEC.cross(GVEC.sub(a,b),mY));if(!u)return;
  if(u[2]<0){u[0]=-u[0];u[1]=-u[1];u[2]=-u[2]}
  const c=GVEC.dot(u,a);let p=planes.find(q=>GVEC.dot(q.n,u)>0.99995&&Math.abs(q.c-c)<2);
  if(!p){p={n:u,c,ids:new Set()};planes.push(p)}p.ids.add(r.id)});
 rp.forEach(([r,a,b])=>{if(GVEC.norm(GVEC.cross(GVEC.sub(a,b),mY)))return;
  planes.forEach(p=>{if(p.n[2]<0.25)return;
   const dd=Math.min(Math.abs(GVEC.dot(p.n,a)-p.c),Math.abs(GVEC.dot(p.n,b)-p.c));
   if(dd<2)p.ids.add(r.id)})});
 planes.forEach(p=>{if(p.n[2]<0.25)return;
  if(p.n[2]>0.9999&&p.c<ridgeZ-50)return;
  const fams=new Map();
  p.ids.forEach(id=>{const r=M.rods.get(id);if(!r||!(r.type==='top'||r.type==='purlin'))return;
   const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
   let d=GVEC.norm(GVEC.sub(GVEC.P(a),GVEC.P(b)));if(!d)return;
   if(d[0]<-1e-9||(Math.abs(d[0])<1e-9&&d[1]<0)||(Math.abs(d[0])<1e-9&&Math.abs(d[1])<1e-9&&d[2]<0))d=[-d[0],-d[1],-d[2]];
   const k=d.map(x=>Math.round(x*1000)).join(',');
   let f=fams.get(k);if(!f){f={d,rods:[]};fams.set(k,f)}f.rods.push(id)});
  const sh=GVEC.norm([-p.n[0]*p.n[2],-p.n[1]*p.n[2],1-p.n[2]*p.n[2]]);
  let skin=null,bc=0,bs=9;
  fams.forEach(f=>{const sc=sh?Math.abs(GVEC.dot(f.d,sh)):0;
   if(f.rods.length>=2&&sc<0.25&&f.rods.length>bc){bc=f.rods.length;skin=f}});
  if(!skin){fams.forEach(f=>{const sc=sh?Math.abs(GVEC.dot(f.d,sh)):0;
   if(f.rods.length>=2&&sc<bs){bs=sc;skin=f}});
   if(!skin)return}
  const v=GVEC.norm(GVEC.cross(p.n,skin.d));if(!v)return;
  const up=GVEC.norm([v[0],v[1],0]);if(!up)return;
  /* плановые границы ската (карниз..конёк) по всем стержням плоскости:
     полосы приведения покрывают план ската РОВНО ОДИН РАЗ (СП 20: S на 1 м² проекции) */
  let tmin=1e18,tmax=-1e18;
  p.ids.forEach(id=>{const r=M.rods.get(id);if(!r)return;const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
   [a,b].forEach(pn=>{const t=GVEC.dot(up,GVEC.P(pn));if(t<tmin)tmin=t;if(t>tmax)tmax=t})});
  const span=tmax-tmin;
  const lines=[];
  skin.rods.forEach(id=>{const r=M.rods.get(id),a=M.nodes.get(r.a).p,pos=GVEC.dot(up,GVEC.P(a));
   let L=lines.find(l=>Math.abs(l.pos-pos)<100);
   if(!L){L={pos,r:[]};lines.push(L)}L.r.push(id)});
  lines.sort((x,y)=>x.pos-y.pos);
  lines.forEach((L,i)=>{let bw;
   if(lines.length===1)bw=span;
   else if(i===0)bw=(lines[1].pos-L.pos)/2+(L.pos-tmin);
   else if(i===lines.length-1)bw=(L.pos-lines[i-1].pos)/2+(tmax-L.pos);
   else bw=(lines[i+1].pos-lines[i-1].pos)/2;
   if(!(bw>1))bw=lines.length===1?6000:(lines[1].pos-lines[0].pos)/2;
   L.b=Math.max(1,Math.round(bw))});
  out.push({n:p.n,mu:snowMu(Math.atan2(Math.hypot(p.n[0],p.n[1]),p.n[2])*180/Math.PI),lines})});
 return out}
function framePlanes(){const planes=[];
 M.rods.forEach(r=>{const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
  const u=GVEC.norm(GVEC.cross(GVEC.sub(GVEC.P(a),GVEC.P(b)),[0,1,0]));if(!u)return;
  if(u[2]>=0.25)return;
  const c=GVEC.dot(u,GVEC.P(a));let p=planes.find(q=>GVEC.dot(q.n,u)>0.99995&&Math.abs(q.c-c)<2);
  if(!p){p={n:u,c,ids:new Set()};planes.push(p)}p.ids.add(r.id)});
 M.rods.forEach(r=>{const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
  if(GVEC.norm(GVEC.cross(GVEC.sub(GVEC.P(a),GVEC.P(b)),[0,1,0])))return;
  planes.forEach(p=>{const dd=Math.min(Math.abs(GVEC.dot(p.n,GVEC.P(a))-p.c),Math.abs(GVEC.dot(p.n,GVEC.P(b))-p.c));
   if(dd<2)p.ids.add(r.id)})});
 planes.sort((x,y)=>x.c-y.c);
 planes.forEach((p,i)=>{p.bw=planes.length===1?1000:
  i===0?(planes[1].c-planes[0].c)/2:i===planes.length-1?(p.c-planes[i-1].c)/2:(planes[i+1].c-planes[i-1].c)/2;
  p.bw=Math.max(1,Math.round(p.bw))});
 return planes}
function frameBFor(planes){return (a,b)=>{for(const p of planes)
  if(Math.abs(GVEC.dot(p.n,GVEC.P(a))-p.c)<2&&Math.abs(GVEC.dot(p.n,GVEC.P(b))-p.c)<2)return p.bw;
  return 1000}}
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
 const hostBy=new Map();
 nodes0.forEach(n=>{const hl=[];
  if(n.host&&n.host.rod)hl.push(n.host);
  (n.hosts||[]).forEach(h=>{if(h&&h.rod&&hl.every(x=>x.rod!==h.rod))hl.push(h)});
  hl.forEach(h=>{if(!M.rods.has(h.rod))return;let a=hostBy.get(h.rod);if(!a){a=[];hostBy.set(h.rod,a)}a.push({id:n.id,t:h.t})})});
 const parts=[];
 for(const r of M.rods.values()){const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)continue;
  const v0=b.p.clone().sub(a.p),L0=v0.length();if(L0<10)continue;
  const u0=v0.multiplyScalar(1/L0);
  const hs=new Map();
  (hostBy.get(r.id)||[]).forEach(h=>{if(h.t>0.002&&h.t<0.998)hs.set(h.id,h.t)});
  M.nodes.forEach(n=>{if(n.id===r.a||n.id===r.b||hs.has(n.id))return;
   const w=n.p.clone().sub(a.p),t=w.dot(u0)/L0;if(t<=0.002||t>=0.998)return;
   if(w.clone().addScaledVector(u0,-t*L0).length()<25)hs.set(n.id,t)});
  const hsl=[...hs.entries()].map(e2=>({id:e2[0],t:e2[1]})).sort((p,q)=>p.t-q.t);
  if(!hsl.length){parts.push(r);continue}
  let prev=r.a,prevT=0;
  hsl.forEach((h,k)=>{parts.push({id:r.id+'#'+k,a:prev,b:h.id,sec:r.sec,mat:r.mat,type:r.type,name:r.name+'·'+(k+1),t0:prevT,t1:h.t});prev=h.id;prevT=h.t});
  parts.push({id:r.id+'#'+hsl.length,a:prev,b:r.b,sec:r.sec,mat:r.mat,type:r.type,name:r.name+'·'+(hsl.length+1),t0:prevT,t1:1})}
 const adj0=new Map();nodes0.forEach(n=>adj0.set(n.id,new Set()));
 for(const r of parts){if(adj0.has(r.a))adj0.get(r.a).add(r.b);if(adj0.has(r.b))adj0.get(r.b).add(r.a)}
 const nodes=nodes0.filter(n=>isSup(n)||adj0.get(n.id).size>0);
 const mset=new Set(nodes.map(n=>n.id));
 const idx=new Map();nodes.forEach((n,i)=>idx.set(n.id,i));
 const seenC=new Set(),bad=[];
 nodes.forEach(n=>{if(seenC.has(n.id))return;const st=[n.id],c=[];seenC.add(n.id);
  while(st.length){const v=st.pop();c.push(v);adj0.get(v).forEach(w=>{if(mset.has(w)&&!seenC.has(w)){seenC.add(w);st.push(w)}})}
  if(!c.some(id=>isSup(M.nodes.get(id))))bad.push(c.length+' узл., напр. '+M.nodes.get(c[0]).name)});
 if(bad.length)return{err:'Компонент(ы) без опоры: '+bad.join('; ')+' — свяжите с каркасом/поставьте опоры'};
 const fmap=new Map();let nf=0;
 nodes.forEach((n,i)=>{if(isSup(n))return;for(let d=0;d<6;d++)fmap.set(i*6+d,nf++)});
 if(nodes.filter(isSup).length<2)return{err:'Расставьте опоры (нужно ≥2)'};
 const els=[];
 for(const r of parts){
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
  [[1,5,7,11,cy,1],[2,4,8,10,cx,-1]].forEach(([A,B,C,D,c,sg])=>{const cL=c*L,cLL=c*L*L;
   kd(A,A,12*c);kd(A,B,6*sg*cL);kd(A,C,-12*c);kd(A,D,6*sg*cL);
   kd(B,A,6*sg*cL);kd(B,B,4*cLL);kd(B,C,-6*sg*cL);kd(B,D,2*cLL);
   kd(C,A,-12*c);kd(C,B,-6*sg*cL);kd(C,C,12*c);kd(C,D,-6*sg*cL);
   kd(D,A,6*sg*cL);kd(D,B,2*cLL);kd(D,C,-6*sg*cL);kd(D,D,4*cLL)});
  const R=[e1,e2,e3],CR=[e1,e2,e3].map(v=>[v.x,v.y,v.z]),T=new Float64Array(144);
  for(let b2=0;b2<2;b2++)for(let d=0;d<3;d++)for(let j=0;j<3;j++){T[(b2*6+d)*12+(b2*6+j)]=CR[d][j];T[(b2*6+3+d)*12+(b2*6+3+j)]=CR[d][j]}
  const Tk=new Float64Array(144),KE=new Float64Array(144);
  for(let i=0;i<12;i++)for(let j=0;j<12;j++){let v=0;for(let t=0;t<12;t++)v+=T[t*12+i]*k[t*12+j];Tk[i*12+j]=v}
  for(let i=0;i<12;i++)for(let j=0;j<12;j++){let v=0;for(let t=0;t<12;t++)v+=Tk[i*12+t]*T[t*12+j];KE[i*12+j]=v}
  els.push({r,a,b,L,p,E,Ry,R,T,KE,k,ia:idx.get(r.a),ib:idx.get(r.b),sec:s,secName:s.name,matName:m.name,qv:[0,0,0]})}
 calc._elsN=els.length;if(!els.length)return{err:'Нет стержней'};
 const box=new THREE.Box3();nodes.forEach(n=>box.expandByPoint(n.p));
 const yMin=box.min.y,yMax=box.max.y;
 const L2=calc.loads,mult=calc.factor;
 const varsN=[L2.snow,L2.wind,L2.live].filter(Boolean).length,kT=varsN>=2?.7:1;
 const addLoad=(e,q)=>{e.qv[0]+=q[0];e.qv[1]+=q[1];e.qv[2]+=q[2]};
 let ridgeZ=-1e9;els.forEach(e=>ridgeZ=Math.max(ridgeZ,e.a.p.z,e.b.p.z));
 const nodalF=[];
 const emap=new Map();els.forEach(e=>{const k=String(e.r.id).split('#')[0];let a=emap.get(k);if(!a){a=[];emap.set(k,a)}a.push(e)});
 const eL=id=>emap.get(String(id))||[];
 const sfs=(L2.snow||L2.live||L2.wind)?slopeFamilies():[],fpl=L2.wind?framePlanes():[],fb=L2.wind?frameBFor(fpl):null;
 if(L2.dead)els.forEach(e=>addLoad(e,[0,0,-e.p.mass*9.81/1000*1.05*mult]));
 if(L2.snow){const S=SG_KPA[L2.snowRegion]*1000,gf=GF_SNOW[L2.snowRegion];
  sfs.forEach(f=>{if(f.mu<=0)return;
   f.lines.forEach(L=>L.r.forEach(id=>{eL(id).forEach(e=>{
    const Lh=Math.hypot(e.b.p.x-e.a.p.x,e.b.p.y-e.a.p.y);
    addLoad(e,[0,0,-S*f.mu*gf*mult*(L.b/1000)*(Lh/e.L)/1000])})}))})}
 if(L2.wind){const w0=W0_KPA[L2.windRegion]*1000*1.4*kT*mult;
  els.forEach(e=>{if(Math.abs(e.a.p.y-e.b.p.y)>1)return;
   const face=Math.abs(e.a.p.y-yMin)<50?1:(Math.abs(e.a.p.y-yMax)<50?.6:0);if(!face)return;
   const dz=Math.abs(e.b.p.z-e.a.p.z);if(!dz)return;
   const zmid=(e.a.p.z+e.b.p.z)/2000;
   addLoad(e,[w0*ce(zmid,L2.terrain)*face*fb(e.a.p,e.b.p)*dz/e.L/1e6,0,0])});
  sfs.forEach(f=>{const cf=f.n[0]<0?0.8:-1.2;
   f.lines.forEach(L=>L.r.forEach(id=>{eL(id).forEach(e=>{
    const Lh=Math.hypot(e.b.p.x-e.a.p.x,e.b.p.y-e.a.p.y);
    const zmid=(e.a.p.z+e.b.p.z)/2000,w=w0*ce(zmid,L2.terrain)*L.b/1e6*(Lh/e.L);
    addLoad(e,[-cf*w*f.n[0],0,-cf*w*f.n[2]])})}))})}
 if(L2.live){const q=L2.liveQ*1000*1.2*kT*mult;
  sfs.forEach(f=>f.lines.forEach(L=>L.r.forEach(id=>{eL(id).forEach(e=>{
   const Lh=Math.hypot(e.b.p.x-e.a.p.x,e.b.p.y-e.a.p.y);
   addLoad(e,[0,0,-q*(L.b/1000)*(Lh/e.L)/1000])})})));
  const seen=new Set();
  nodes.forEach(n=>{if(!isSup(n)&&n.p.z>ridgeZ-1&&!seen.has(n.id)){seen.add(n.id);
   const fi=fmap.get(idx.get(n.id)*6+2);if(fi!==undefined)nodalF.push([fi,-1000*1.2*mult*kT])}})}
 const K=new Float64Array(nf*nf),F=new Float64Array(nf);
 calc._dbgQ=els.map(e=>[e.r.name,e.L,+(e.qv[2].toFixed(6))]);
 els.forEach(e=>{const q=e.qv,R=e.R,L=e.L;
  const q1=q[0]*R[0].x+q[1]*R[1].x+q[2]*R[2].x,q2=q[0]*R[0].y+q[1]*R[1].y+q[2]*R[2].y,q3=q[0]*R[0].z+q[1]*R[1].z+q[2]*R[2].z;
  e.qloc=[q1,q2,q3];
  e.f0=[-q1*L/2,-q2*L/2,-q3*L/2,0,q3*L*L/12,-q2*L*L/12,-q1*L/2,-q2*L/2,-q3*L/2,0,-q3*L*L/12,q2*L*L/12];
  const dofs=[];for(let i=0;i<12;i++)dofs.push(fmap.get((i<6?e.ia:e.ib)*6+(i%6)));
  for(let i=0;i<12;i++){const gi=dofs[i];if(gi===undefined)continue;
   for(let j=0;j<12;j++){const gj=dofs[j];if(gj===undefined)continue;K[gi*nf+gj]+=e.KE[i*12+j]}}
  for(let i=0;i<12;i++){const fi=dofs[i];if(fi===undefined)continue;
   let Fe=0;for(let j=0;j<12;j++)Fe+=e.T[j*12+i]*e.f0[j];F[fi]+=Fe}});
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
 calc._resid=(()=>{let m=0;const n2=Math.min(nf,3);for(let i=0;i<n2;i++){let s=-F[i];for(let j=0;j<nf;j++)s+=A[i*nf+j]*uf[j];m=Math.max(m,Math.abs(s))}return m.toExponential(2)})();
 const u=new Float64Array(nodes.length*6);
 nodes.forEach((n,i)=>{if(isSup(n))return;for(let d=0;d<6;d++)u[i*6+d]=uf[fmap.get(i*6+d)]});
 calc._dbgU=Array.from(u.slice(0,12)).map(v=>+v.toExponential(2));
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
   const M3=-fe[10]+fe[8]*r2+q3*r2*r2/2;
   const M=Math.hypot(M2,M3);
   const nnc=Math.max(0,-N)/(phi*p.A*e.Ry),mst=(Math.abs(M2)/p.Wy+Math.abs(M3)/p.Wx)/e.Ry;
   Ns.push(N);Ms.push(M);URs.push(N>=0?N/(p.A*e.Ry)+mst:nnc+mst*Math.max(0,1-.8*nnc))}
  const Ncomp=Math.max(0,-Math.min(...Ns)),Nt=Math.max(0,Math.max(...Ns)),Mmax=Math.max(...Ms),ur=Math.max(...URs);
  const M2a=fe[11]+fe[7]*L+q2*L*L/2,M3a=-fe[10]+fe[8]*L+q3*L*L/2;
  const d2=5*q2*L**4/(384*e.E*p.Iy)-(M2a+fe[11])*L*L/(16*e.E*p.Iy);
  const d3=5*q3*L**4/(384*e.E*p.Ix)-(M3a-fe[10])*L*L/(16*e.E*p.Ix);
  const e1v=e.R[0];
  const um=[0,1,2].map(d=>(u[e.ia*6+d]+u[e.ib*6+d])/2);
  const along=um[0]*e1v.x+um[1]*e1v.y+um[2]*e1v.z;
  const nodalD=Math.hypot(um[0]-along*e1v.x,um[1]-along*e1v.y,um[2]-along*e1v.z);
  const defl=Math.hypot(d2,d3)+nodalD;
  res.push({id:e.r.id,name:e.r.name,secName:e.secName,matName:e.matName,secId:e.sec.id,L,
   Ncomp,Nt,Mmax,ur,defl,d2:+d2.toFixed(3),d3:+d3.toFixed(3),nodalD:+nodalD.toFixed(3),Ns,Ms,URs,t0:e.r.t0==null?0:e.r.t0,t1:e.r.t1==null?1:e.r.t1});
  if(ur>maxUR){maxUR=ur;urRod=e.r.name}
  if(defl>maxD){maxD=defl;dRod=e.r.name}
  mass+=e.p.mass*L/1000;cost+=(e.sec.price_rub_m||0)*L/1000;
  const gfe=new Float64Array(12);
  for(let i=0;i<12;i++){let v=0;for(let j=0;j<12;j++)v+=e.T[i*12+j]*fe[j];gfe[i]=v}
  [[e.ia,0],[e.ib,6]].forEach(([nd,off])=>{const n=nodes[nd];if(!isSup(n))return;
   const a2=react.get(n.id)||[0,0,0];a2[0]+=gfe[off];a2[1]+=gfe[off+1];a2[2]+=gfe[off+2];react.set(n.id,a2)})});
 const agg=new Map();
 res.forEach(rr=>{const k=String(rr.id).split('#')[0];
  const sm=rr.Ns.map((N,i)=>[rr.t0+(rr.t1-rr.t0)*i/8,N,rr.Ms[i],rr.URs[i]]);
  let a=agg.get(k);
  if(!a){a={row:{...rr,id:k,name:(M.rods.get(k)||M.rods.get(Number(k))||{}).name||rr.name},sm};agg.set(k,a)}
  else{a.sm.push(...sm);const p0=a.row;
   if(rr.defl>p0.defl)p0.defl=rr.defl;
   if(rr.Ncomp>p0.Ncomp)p0.Ncomp=rr.Ncomp;
   if(rr.Nt>p0.Nt)p0.Nt=rr.Nt;
   if(rr.Mmax>p0.Mmax)p0.Mmax=rr.Mmax;
   if(rr.ur>p0.ur)p0.ur=rr.ur;
   p0.L=(p0.L||0)+rr.L;
   p0.t1=Math.max(p0.t1||0,rr.t1||0)}});
 res.length=0;
 agg.forEach((a,k)=>{const r0=a.row;
  a.sm.sort((x,y)=>x[0]-y[0]);
  const at=t=>{const sm=a.sm;if(t<=sm[0][0])return sm[0];
   for(let i=1;i<sm.length;i++)if(sm[i][0]>=t){const a0=sm[i-1],b0=sm[i],dt=b0[0]-a0[0],f=dt>1e-9?(t-a0[0])/dt:0;
    return[a0[0],a0[1]+(b0[1]-a0[1])*f,a0[2]+(b0[2]-a0[2])*f,a0[3]+(b0[3]-a0[3])*f]}
   return sm[sm.length-1]};
  r0.Ns=[];r0.Ms=[];r0.URs=[];
  for(let i=0;i<=8;i++){const s=at(i/8);r0.Ns.push(s[1]);r0.Ms.push(s[2]);r0.URs.push(s[3])}
  r0.ur=Math.max(...a.sm.map(s=>s[3]));r0.Mmax=Math.max(...a.sm.map(s=>s[2]));
  const rr=M.rods.get(k);if(rr)r0.L=rodLen(rr);
  res.push(r0)});
 maxUR=0;urRod='-';maxD=0;dRod='-';
 res.forEach(rr=>{if(rr.ur>maxUR){maxUR=rr.ur;urRod=rr.name}if(rr.defl>maxD){maxD=rr.defl;dRod=rr.name}});
 const reactArr=[...react.entries()].map(([id,v])=>({id,
  name:(M.nodes.get(id)||{}).name||id,fx:-v[0]/1000,fy:-v[1]/1000,fz:-v[2]/1000,
  F:Math.hypot(v[0],v[1],v[2])/1000})).sort((a,b)=>b.F-a.F);
 return{res,reactArr,maxUR,urRod,maxD,dRod,mass,cost,u,nodeOrder:nodes.map(n=>n.id)}}
/* ---------- drawing ---------- */
function calcGroup(){if(!window._gCalc){window._gCalc=new THREE.Group();scene.add(window._gCalc)}return window._gCalc}
function nodeMatHeat(col){return matFor('nhx:'+col.getHexString(),'#'+col.getHexString(),'base')}
function rodMatHeat(col){return matFor('rhx:'+col.getHexString(),'#'+col.getHexString(),'base')}
function clearCalcDraw(){clearGroup(calcGroup());calc._nodeCol=calc._rodCol=null;if(typeof rodObjs!=='undefined')rodObjs.forEach((o,id)=>{o.g.visible=!M.hidden.has('r'+id)});if(window.applySelMats)applySelMats();const l=$('#calcLegend');if(l)l.style.display='none'}
function drawCalc(){clearCalcDraw();const R=calc.res;if(!R)return;
 const g=calcGroup(),show=calc.show;
 /* деформированная схема выключает обычный каркас (стержни модели) в 3D */
 if(typeof rodObjs!=='undefined'){const hide=calc.showDefl&&mode!=='plan';
  rodObjs.forEach((o,id)=>{o.g.visible=(!hide&&!M.hidden.has('r'+id))})}
 const valOf=(rr,i)=>show==='n'?rr.Ns[i]:show==='m'?rr.Ms[i]/1e6:show==='defl'?rr.defl:rr.URs[i];
 let scale=1;
 if(show==='n'){R.res.forEach(r=>scale=Math.max(scale,r.Ncomp,r.Nt))}
 else if(show==='m'){R.res.forEach(r=>scale=Math.max(scale,r.Mmax/1e6))}
 else if(show==='defl'){R.res.forEach(r=>scale=Math.max(scale,r.defl))}
 else scale=Math.max(1.01,R.maxUR);
 const nidx=new Map(R.nodeOrder.map((id,i)=>[id,i]));
 /* палитра от текущих min/max (signed): минимум -> синий, максимум -> красный */
 let mmn=Infinity,mx=-Infinity;
 if(calc.palMM){R.res.forEach(r=>{for(let i=0;i<=8;i++){const v=valOf(r,i);if(v<mmn)mmn=v;if(v>mx)mx=v}});
  if(show==='defl')R.nodeOrder.forEach((id,j)=>{const d=Math.hypot(R.u[j*6],R.u[j*6+1],R.u[j*6+2]);if(d<mmn)mmn=d;if(d>mx)mx=d})}
 const tOf=v=>(mx>mmn)?(v-mmn)/(mx-mmn):.5;
 const buckets=new Map();
 if(!calc.showDefl)M.rods.forEach(rd=>{const rr=calc.byId.get(String(rd.id));if(!rr)return;
  const na=M.nodes.get(rd.a),nb=M.nodes.get(rd.b);
  for(let i=0;i<8;i++){const v=(valOf(rr,i)+valOf(rr,i+1))/2;let col;
   if(calc.palMM)col=heatColor(clamp(tOf(v),0,1));
   else if(show==='n'){const t=clamp(Math.abs(v)/scale,.12,1);
    col=v<0?heatColor(.62+.38*t):new THREE.Color(.15+.5*t,.45+.3*t,1*(.3+.7*t))}
   else col=heatColor(clamp(Math.abs(v)/scale,.08,1));
   const arr=buckets.get(col.getHexString())||[];
   arr.push(na.p.clone().lerp(nb.p,i/8),na.p.clone().lerp(nb.p,(i+1)/8));
   buckets.set(col.getHexString(),arr)}});
 buckets.forEach((pts,hex)=>g.add(lines(pts,'#'+hex,1,true,false,true)));
 // rod body heat colors (cylinders): worst segment per rod
 calc._rodCol=new Map();
 M.rods.forEach(rd=>{const rr=calc.byId.get(String(rd.id));if(!rr)return;let col,v;
  if(show==='n'){let bv=0;for(let i=0;i<8;i++){const v2=(rr.Ns[i]+rr.Ns[i+1])/2;if(Math.abs(v2)>Math.abs(bv))bv=v2}v=bv}
  else if(show==='m')v=rr.Mmax/1e6;
  else if(show==='defl')v=rr.defl;
  else v=rr.ur;
  if(calc.palMM)col=heatColor(clamp(tOf(v),0,1));
  else if(show==='n'){const t=clamp(Math.abs(v)/scale,.12,1);col=v<0?heatColor(.62+.38*t):new THREE.Color(.15+.5*t,.45+.3*t,.3+.7*t)}
  else col=heatColor(clamp(Math.abs(v)/scale,.08,1));
  calc._rodCol.set(rd.id,col)});
 // node heat colors: max end value of attached rods (disp for defl)
 calc._nodeCol=new Map();
 M.nodes.forEach(nd=>{let col;
  if(show==='defl'){const i=nidx.get(nd.id);const d=Math.hypot(R.u[i*6],R.u[i*6+1],R.u[i*6+2]);
   col=calc.palMM?heatColor(clamp(tOf(d),0,1)):heatColor(clamp(d/scale,.08,1))}
  else{let bv=0;
   for(const r of attachedRods(nd.id)){const rr=calc.byId.get(String(r.id));if(!rr)continue;
    const v=valOf(rr,r.a===nd.id?0:8);if(Math.abs(v)>Math.abs(bv))bv=v}
   if(calc.palMM)col=heatColor(clamp(tOf(bv),0,1));
   else if(show==='n'){const t=clamp(Math.abs(bv)/scale,.12,1);
    col=bv<0?heatColor(.62+.38*t):new THREE.Color(.15+.5*t,.45+.3*t,1*(.3+.7*t))}
   else col=heatColor(clamp(Math.abs(bv)/scale,.08,1))}
  calc._nodeCol.set(nd.id,col)});
 applySelMats();
 /* деформация в плане (вид сверху): прогибы откладываются перпендикулярно осям — эпюра */
 const gPlan=window._gPlanDefl||(window._gPlanDefl=new THREE.Group(),scene.add(window._gPlanDefl),window._gPlanDefl);
 clearGroup(gPlan);
 if(mode==='plan'&&calc.showDefl){
  const s2=calc.deflScale;
  M.rods.forEach(rd=>{const rr=calc.byId.get(String(rd.id));if(!rr||!rr.defl)return;
   const na=M.nodes.get(rd.a),nb=M.nodes.get(rd.b);if(!na||!nb)return;
   const e1=nb.p.clone().sub(na.p);const L=e1.length();if(L<50)return;e1.multiplyScalar(1/L);
   let perp=AZ.clone().cross(e1);if(perp.lengthSq()<1e-9)perp=AX.clone().cross(e1);
   if(perp.lengthSq()<1e-9)return;perp.normalize();
   const col=(calc._rodCol&&calc._rodCol.get(rd.id))||new THREE.Color(0xffc53d);
   const mat=new THREE.LineBasicMaterial({color:col,linewidth:2});
   const pts=[];const N=20;
   for(let i=0;i<=N;i++){const t=i/N;
    pts.push(na.p.clone().addScaledVector(e1,L*t).addScaledVector(perp,rr.defl*s2*Math.sin(Math.PI*t)))}
   gPlan.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat))});
  gPlan.visible=true;
 }else gPlan.visible=false;
 if(calc.showDefl&&mode!=='plan'&&typeof deflBodies==='function'){
  if(calc.deflAuto){let md=0;R.res.forEach(r=>{if(r.defl>md)md=r.defl});
   const box=modelBox();const dim=box?box.getSize(V3()).length():12000;
   calc.deflScale=md>1e-6?Math.round(clamp(dim*0.06/md,1,300)):1;
   const rg=$('#rngDefl'),dv=$('#dScaleVal');if(rg){rg.value=calc.deflScale}if(dv)dv.textContent=calc.deflScale}
  deflBodies(g)}
 const lg=$('#calcLegend');if(!lg)return;lg.style.display='flex';
 const fmtV=v=>show==='n'?(v/1000).toFixed(1)+' кН':show==='m'?v.toFixed(0)+' кН·м':show==='defl'?v.toFixed(1)+' мм':v.toFixed(2);
 const lbl={ur:'UR — использование',n:'N: сжатие (тёплый) / растяжение (синий)',m:'M изгибающий, кН·м',defl:'Прогиб, мм'}[show];
 const rng=calc.palMM&&isFinite(mmn)&&isFinite(mx)?`${fmtV(mmn)} → ${fmtV(mx)}`:`0 → ${fmtV(scale)}`;
 lg.innerHTML=`<div class="lgBar ${show==='n'&&!calc.palMM?'lgN':''}"></div><b>${lbl}${calc.palMM?' (палитра от мин..макс)':''}</b><span class="mono">${rng}</span>`;
 if(show==='defl')lg.insertAdjacentHTML('beforeend',`<span class="dim2">деформации ×${calc.deflScale}</span>`)}
function calcRead(rodId){const rd=$('#calcRead');if(!rd)return;
 const rr=calc.byId.get(String(rodId));if(!rr){rd.textContent='';return}
 rd.textContent=`${rr.name} • ${rr.secName} • сж ${(rr.Ncomp/1000).toFixed(1)} / раср ${(rr.Nt/1000).toFixed(1)} кН • M ${(rr.Mmax/1e6).toFixed(1)} кН·м • UR ${rr.ur.toFixed(2)} • f ${rr.defl.toFixed(1)} мм`}
/* ---------- run + results panel ---------- */
function runCalc(){const t0=performance.now();const R=solveFrame();
 if(!R||R.err){toast((R&&R.err)||'Расчёт не выполнен',{type:'err',timeout:5000});return}
 calc.res=R;calc.byId=new Map(R.res.map(r=>[String(r.id),r]));
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
 el.querySelectorAll('[data-cr]').forEach(tr=>tr.onclick=()=>{const v=/^\d+$/.test(tr.dataset.cr)?+tr.dataset.cr:tr.dataset.cr;selectOnly('rod',v);selectionChanged()})}
/* ---------- авто-подбор сечений труб по типам: «равная прочность» к целевому UR, полные пересчёты ---------- */
function autoSections(){
 if(!M.rods.size){toast('Нет стержней',{type:'warn'});return}
 const byId=new Map(NR_SECTIONS.map(s=>[s.id,s]));
 const cands=NR_SECTIONS.filter(s=>s.kind==='shs'||s.kind==='rhs')
  .sort((a,b)=>calc.optCrit==='cost'?(a.price_rub_m-b.price_rub_m)||(a.mass_kg_m-b.mass_kg_m):a.mass_kg_m-b.mass_kg_m);
 if(cands.length<2){toast('Мало сечений в каталоге',{type:'warn'});return}
 const orig=new Map([...M.rods].map(([k,r])=>[k,r.sec]));
 const restore=()=>orig.forEach((s,k)=>{const r=M.rods.get(k);if(r)r.sec=s});
 pushUndo();
 /* целевое «равное прочность» (ползунок макс. использования T):
    типы с UR>T или f>L/200 поднимаем на шаг (худший первым);
    самый разгруженный тип пробуем опустить на шаг и оставляем, если весь
    каркас снова проходит; прогиб f<=L/200 — жёсткое ограничение. */
 const T=calc.optTarget;
 const cur={},ix={};
 const cntMap={};
 M.rods.forEach(r=>{(cntMap[r.type]=cntMap[r.type]||new Map()).set(r.sec,(cntMap[r.type].get(r.sec)||0)+1)});
 Object.keys(cntMap).forEach(t=>{const best=[...cntMap[t].entries()].sort((a,b)=>b[1]-a[1])[0][0];
  let i=cands.findIndex(c=>c.id===best);
  if(i<0){const dflt=SEC_DEFAULTS[t];i=cands.findIndex(c=>c.id===dflt);if(i<0)i=0}
  cur[t]=cands[i].id;ix[t]=i});
 const steel=()=>{let m=0,c=0;M.rods.forEach(r=>{const s=byId.get(r.sec);if(s){m+=s.mass_kg_m*rodLen(r)/1000;c+=(s.price_rub_m||0)*rodLen(r)/1000}});return{m,c}};
 const t0=steel();
 const apply=()=>M.rods.forEach(r=>r.sec=cur[r.type]);
 const evalT=R=>{const u={},d={};
  R.res.forEach(rr=>{const rd=M.rods.get(+rr.id)||M.rods.get(rr.id);if(!rd)return;
   u[rd.type]=Math.max(u[rd.type]||0,rr.ur);
   if(calc.optDefl&&rr.L>0)d[rd.type]=Math.max(d[rd.type]||0,rr.defl/(rr.L/200))});
  return{u,d}};
 const okAll=R=>{if(!R||R.err)return false;const et=evalT(R);
  return Object.keys(et.u).every(t=>et.u[t]<=T+1e-9&&(et.d[t]||0)<=1+1e-9)};
 apply();let R=solveFrame();
 if(R.err){restore();toast('Подбор прерван: '+R.err,{type:'warn'});return}
 const u0=evalT(R).u;
 const _log=[];window._optLog=_log;
 const locked=new Set();
 let it=0,stuck=null;
 for(;it<300;it++){
  const et=evalT(R);const u=et.u,d=et.d;
  const viol=Object.keys(u).map(t=>[t,Math.max(u[t]/T-1,(d[t]||0)-1)]).filter(x=>x[1]>1e-9).sort((a,b)=>b[1]-a[1]);
  if(viol.length){const t=viol[0][0];
   _log.push({ph:'up',t:(TYPES[t]||{}).prefix||t,ur:+u[t].toFixed(2),d:+(d[t]||0).toFixed(2),sec:cur[t]});
   if(ix[t]<cands.length-1){ix[t]++;cur[t]=cands[ix[t]].id;locked.delete(t);
    apply();R=solveFrame();
    if(R.err){restore();toast('Подбор прерван: '+R.err,{type:'warn'});return}
    continue}
   stuck=t;break}
  const down=Object.keys(u).filter(t=>ix[t]>0&&!locked.has(t)).sort((a,b)=>u[a]-u[b]);
  if(!down.length)break;
  const t=down[0];
  ix[t]--;cur[t]=cands[ix[t]].id;apply();const Rt=solveFrame();
  if(Rt&&!Rt.err&&okAll(Rt)){R=Rt;_log.push({ph:'dn',t:(TYPES[t]||{}).prefix||t,ok:1,sec:cur[t]});continue}
  ix[t]++;cur[t]=cands[ix[t]].id;locked.add(t);_log.push({ph:'dn',t:(TYPES[t]||{}).prefix||t,ok:0})}
 apply();R=solveFrame();
 if(R.err){restore();toast('Подбор прерван: '+R.err,{type:'warn'});return}
 const etF=evalT(R);
 const pass=Object.keys(etF.u).every(t=>etF.u[t]<=T+1e-9&&(etF.d[t]||0)<=1+1e-9);
 if(!pass){restore();R=solveFrame();if(R.err){toast('Подбор не удался',{type:'warn'});return}}
 const t1=steel();
 calc.res=R;calc.byId=new Map(R.res.map(r=>[String(r.id),r]));
 afterChange();
 drawCalc();renderCalcResults();
 const etR=evalT(R);
 const list=(()=>{const m={};M.rods.forEach(r=>{m[r.type]=r.sec});
  return Object.keys(m).map(t=>{const s=byId.get(m[t]);const uB=u0[t]||0,uA=etR.u[t]||0;
   return `${(TYPES[t]||{}).prefix||t}: ${s?s.name:'—'} (${uB.toFixed(2)}→${uA.toFixed(2)})`}).join(' • ')})();
 const maxUf=Math.max(...Object.values(etR.u))||0;
 const el=$('#calcOut');
 if(el)el.insertAdjacentHTML('afterbegin',`<div class="kv"><span>Подбор (цель UR ≤ ${T.toFixed(2)})</span><b style="color:${pass?'#7fe8b8':'#ff7a6a'}">${pass?'равная прочность достигнута':(stuck?`не выровнять: перегруз ${(TYPES[stuck]||{}).prefix||stuck} на вершине каталога`:'исходные сечения восстановлены')}</b></div>
  <div class="kv"><span>Сталь</span><b>${t0.m.toFixed(0)} → ${t1.m.toFixed(0)} кг (${t0.m?((t1.m/t0.m-1)*100).toFixed(1):'0'} %)</b></div>
  <div class="kv"><span>Металл по цене</span><b>${Math.round(t0.c).toLocaleString('ru')} → ${Math.round(t1.c).toLocaleString('ru')} ₽</b></div>
  <div class="kv"><span>UR max / прогиб max</span><b>${maxUf.toFixed(2)} / ${R.maxD.toFixed(1)} мм</b></div>
  <div class="kv"><span>Итераций пересчёта</span><b>${it}</b></div>
  <div class="hint2">${esc(list)} • Ctrl+Z — отменить</div>`);
 toast(`Подбор сечений: ${pass?'равная прочность':'исходные сечения восстановлены'} • сталь ${t1.m.toFixed(0)} кг • UR max ${maxUf.toFixed(2)}`,
  {type:pass?'ok':'warn',timeout:8000})}
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
 <div class="hint2">Снег/эксплуатация/ветер на кровлю: ширина приведения считается по геометрии — соседние параллельные ряды прогонов (или поясов, если прогонов нет). Ветер на плоскости рам — по шагу соседних рам.</div>
 <div class="crow"><label>Множитель нагрузки <b id="multVal">${calc.factor.toFixed(2)}×</b></label>
  <input type="range" id="rngMult" min="0.25" max="3" step="0.05" value="${calc.factor}"></div>
 <div class="btnrow"><button class="btn gold" id="btnCalc">РАСЧЁТ</button><button class="btn" id="btnCalcClear">СБРОС</button></div>
 <div class="psect">ПОДБОР СЕЧЕНИЙ (ТРУБЫ, ПО ТИПАМ)</div>
 <div class="crow"><label>Критерий</label><select id="selOptCrit">${opt('mass',calc.optCrit,'минимум массы')}${opt('cost',calc.optCrit,'минимум стоимости')}</select></div>
 <div class="crow"><label>Макс. использование</label><div class="cval"><input type="range" id="rngOptT" min="30" max="100" step="5" value="${Math.round(calc.optTarget*100)}" style="width:90px"><span class="mono" id="dOptT">${calc.optTarget.toFixed(2)}</span></div></div>
 <label class="ck"><input type="checkbox" id="ckOptDefl" ${calc.optDefl?'checked':''}> Ограничение прогиба f ≤ L/200</label>
 <div class="btnrow"><button class="btn" id="btnOptSec">ПОДБОР СЕЧЕНИЙ</button></div>
 <div class="hint2">Равная прочность: ползунок «Макс. использование» задаёт целевой верх UR (0.3–1.0). Перегруженные типы поднимаются на шаг вверх, самый разгруженный пробно опускается — и остаётся, если весь каркас снова проходит. Прогиб f ≤ L/200 — жёсткое ограничение. Полный пересчёт каркаса на каждом шаге. Отмена — Ctrl+Z.</div>
 <div class="psect">ОТОБРАЖЕНИЕ</div>
 <div class="crow"><label>Тепловая карта</label><select id="selShow">
  <option value="ur" ${calc.show==='ur'?'selected':''}>UR — общая нагрузка</option>
  <option value="n" ${calc.show==='n'?'selected':''}>N — сжатие/растяжение</option>
  <option value="m" ${calc.show==='m'?'selected':''}>M — изгиб</option>
  <option value="defl" ${calc.show==='defl'?'selected':''}>Прогибы</option></select></div>
 <label class="ck"><input type="checkbox" id="ckPalMM" ${calc.palMM?'checked':''}> Палитра тепловых карт — от текущих мин/макс</label>
 <label class="ck"><input type="checkbox" id="ckDefl" ${calc.showDefl?'checked':''}> Деформированная схема (тела профилей, 3D)</label>
 <label class="ck"><input type="checkbox" id="ckDeflAuto" ${calc.deflAuto?'checked':''}> Масштаб — авто (увеличить до наглядности)</label>
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
 W('#rngMult','input',e=>{calc.factor=+e.target.value;$('#multVal').textContent=calc.factor.toFixed(2)+'×'});
 W('#btnCalc','click',()=>runCalc());
 W('#btnCalcClear','click',()=>{calc.res=null;clearCalcDraw();$('#calcOut').innerHTML='<div class="hint2">Расчёт сброшен.</div>';toast('Результаты сброшены')});
 W('#selShow','change',e=>{calc.show=e.target.value;if(calc.res)drawCalc()});
 W('#ckPalMM','change',e=>{calc.palMM=e.target.checked;if(calc.res)drawCalc()});
 W('#btnOptSec','click',()=>autoSections());
 W('#ckOptDefl','change',e=>{calc.optDefl=e.target.checked});
 W('#selOptCrit','change',e=>{calc.optCrit=e.target.value});
 W('#rngOptT','input',e=>{calc.optTarget=+e.target.value/100;const s=$('#dOptT');if(s)s.textContent=calc.optTarget.toFixed(2)});
 W('#ckDefl','change',e=>{calc.showDefl=e.target.checked;if(calc.res)drawCalc()});
 W('#ckDeflAuto','change',e=>{calc.deflAuto=e.target.checked;if(calc.res)drawCalc()});
 W('#rngDefl','input',e=>{calc.deflAuto=false;const ca=$('#ckDeflAuto');if(ca)ca.checked=false;calc.deflScale=+e.target.value;$('#dScaleVal').textContent=calc.deflScale;if(calc.res)drawCalc()})}
/* ---------- app modes ---------- */
function setAppMode(m){appMode=m;
 document.body.classList.toggle('app-loads',m!=='model');
 ['tabModel','tabLoads','tabCut','tabReport'].forEach(id=>{const b=$('#'+id);if(b)b.classList.toggle('on',id==='tab'+m.charAt(0).toUpperCase()+m.slice(1))});
 $('#toolbar').style.display=m==='model'?'':'none';
 if(m==='model'){$('#paneCalc').classList.remove('on');$('#tabCalc').classList.remove('on');$('#tabProps').classList.add('on');$('#paneProps').classList.add('on');if(calc.res)drawCalc();else{clearCalcDraw&&clearCalcDraw()}renderTree&&renderTree()}
 function openCalcPaneOnly(){appMode='loads';document.body.classList.toggle('app-loads',true);
  ['tabModel','tabLoads','tabCut','tabReport'].forEach(id=>{const b=$('#'+id);if(b)b.classList.toggle('on',id==='tabLoads')});
  $('#tabCalc').classList.add('on');
  $('#paneProps').classList.remove('on');$('#paneTree').classList.remove('on');$('#tabProps').classList.remove('on');$('#tabTree').classList.remove('on');
  $('#paneCalc').classList.add('on');if(!$('#paneCalc').innerHTML)$('#paneCalc').innerHTML=calcPaneHTML(),bindCalcPane();
  if(calc.res)drawCalc();updateHint&&updateHint()}
 if(m==='loads'){
  if(mode==='plan'){openCalcPaneOnly();return}
  $('#tabCalc').classList.add('on');
  $('#paneProps').classList.remove('on');$('#paneTree').classList.remove('on');$('#tabProps').classList.remove('on');$('#tabTree').classList.remove('on');
  $('#paneCalc').classList.add('on');if(!$('#paneCalc').innerHTML)$('#paneCalc').innerHTML=calcPaneHTML(),bindCalcPane();
  if(calc.res)drawCalc();updateHint();renderTree&&renderTree()}
 if(m==='cut'){setAppModeQuiet('model');openCutModal()}
 if(m==='report'){setAppModeQuiet('model');openReportModal()}}
function setAppModeQuiet(m){appMode=m;document.body.classList.toggle('app-loads',m!=='model');
 if(typeof rodObjs!=='undefined')rodObjs.forEach((o,id)=>{o.g.visible=!M.hidden.has('r'+id)});
 ['tabModel','tabLoads','tabCut','tabReport'].forEach(id=>{const b=$('#'+id);if(b)b.classList.toggle('on',id==='tab'+m.charAt(0).toUpperCase()+m.slice(1))});
 $('#toolbar').style.display=m==='model'?'':'none';
 if(m==='model'){$('#paneCalc').classList.remove('on');$('#tabProps').classList.add('on');$('#paneProps').classList.add('on')}}
/* ---------- cut: торцы/запилы по биссектрисе, T-стыки, заготовь ---------- */
const CUTD=180/Math.PI;
function cutV(a,b){return[a.x-b.x,a.y-b.y,a.z-b.z]}
function cutN(u){const l=Math.hypot(u[0],u[1],u[2]);return l>1e-9?[u[0]/l,u[1]/l,u[2]/l]:null}
function cutEndData(r,atA){const nA=M.nodes.get(atA?r.a:r.b),nB=M.nodes.get(atA?r.b:r.a);
 if(!nA||!nB)return{txt:'—',e:0};
 const v=cutN(cutV(nA.p,nB.p));if(!v)return{txt:'—',e:0};
 if(nA.type==='support')return{txt:'без запила — опора',e:0};
 const inc=[];
 M.rods.forEach(o=>{if(o.id===r.id)return;let oe=null;
  if(o.a===nA.id)oe=M.nodes.get(o.b);else if(o.b===nA.id)oe=M.nodes.get(o.a);
  if(oe){const d=cutN(cutV(nA.p,oe.p));if(d)inc.push({o,d});return}
  const thru=(nA.host&&nA.host.rod===o.id)||(nA.hosts||[]).some(h=>h&&h.rod===o.id);
  if(thru){const oa=M.nodes.get(o.a),ob=M.nodes.get(o.b);if(!oa||!ob)return;
   const d=cutN(cutV(ob.p,oa.p));if(d){inc.push({o,d});inc.push({o,d:[-d[0],-d[1],-d[2]]})}}});
 if(!inc.length)return{txt:'без запила (свободный край)',e:0};
 const ang=(u,w)=>Math.acos(clamp(u[0]*w[0]+u[1]*w[1]+u[2]*w[2],-1,1))*CUTD;
 const s=rodSec(r),b=s.b_mm||60,h=s.h_mm||60;
 const L=Math.hypot(...cutV(nA.p,nB.p));
 let e2=cutN([-v[1],v[0],0]);if(!e2)e2=[1,0,0];
 const e3=cutN([v[1]*e2[2]-v[2]*e2[1],v[2]*e2[0]-v[0]*e2[2],v[0]*e2[1]-v[1]*e2[0]]);
 for(const q of inc)if(ang(v,q.d)>165)return{txt:'без запила (проходной)',e:0};
 let pair=null;
 for(let i=0;i<inc.length&&!pair;i++)for(let j=i+1;j<inc.length;j++)
  if(ang(inc[i].d,inc[j].d)>155){pair=[inc[i],inc[j]];break}
 if(pair){
  if(pair.some(q=>ang(v,q.d)>155)){const br=inc.filter(q=>pair.indexOf(q)<0);
   return{txt:br.length?`без запила (основной; ветвь ${br.map(q=>q.o.name).join(', ')})`:'без запила (проходной)',e:0}}
  const beta=Math.max(Math.min(...pair.map(q=>ang(v,q.d))),20);
  const mi=rodSec(pair[0].o).mass_kg_m>=rodSec(pair[1].o).mass_kg_m?0:1;
  const main=pair[mi],ms=rodSec(main.o);
  const dM=cutN([main.d[0],main.d[1],main.d[2]]);
  let m2=cutN([-dM[1],dM[0],0]);if(!m2)m2=[1,0,0];
  const m3=cutN([dM[1]*m2[2]-dM[2]*m2[1],dM[2]*m2[0]-dM[0]*m2[2],dM[0]*m2[1]-dM[1]*m2[0]]);
  const al=Math.abs(v[0]*m2[0]+v[1]*m2[1]+v[2]*m2[2]),ga=Math.abs(v[0]*m3[0]+v[1]*m3[1]+v[2]*m3[2]);
  const Wm=(ms.kind==='rhs'?ms.h_mm:ms.b_mm)||60,Hm=(ms.kind==='rhs'?ms.b_mm:ms.h_mm)||60;
  const tA=ms.t_mm||4;
  const sOut=Math.min(al>1e-6?Wm/(2*al):1e9,ga>1e-6?Hm/(2*ga):1e9);
  const sFar=Math.min(al>1e-6?(Wm-2*tA)/(2*al):1e9,ga>1e-6?(Hm-2*tA)/(2*ga):1e9);
  const nest=Math.min(b,h)<=Math.min(Wm-2*tA,Hm-2*tA)+.5&&Math.max(b,h)<=Math.max(Wm-2*tA,Hm-2*tA)+.5;
  return nest?{txt:`вложено в осн. ${main.o.name}: сечение ${b}×${h} в полость ${Wm-2*tA}×${Hm-2*tA}, глубина ${Math.round(sFar)} мм`,e:Math.min(sFar,L*0.4)}
   :{txt:`T-подрез по осн. ${main.o.name}: ${b}×${h} не входит в полость ${Wm-2*tA}×${Hm-2*tA} — впритык к стенке`,e:Math.min(sOut,L*0.4)}}
 const m=inc.reduce((a,q)=>ang(v,q.d)<ang(v,a.d)?q:a,inc[0]);
 const al=ang(v,m.d),n=cutN([v[0]+m.d[0],v[1]+m.d[1],v[2]+m.d[2]]);
 if(!n)return{txt:'без запила',e:0};
 const c2=Math.max(.08,GVEC.dot(n,v));
 const e=Math.min(((b/2)*Math.abs(GVEC.dot(n,e2))+(h/2)*Math.abs(GVEC.dot(n,e3)))/c2,L*0.4),th=90-al/2;
 return{txt:`запил ${Math.abs(al-90)<1?'90°→45°':Math.round(al)+'°→'+th.toFixed(0)+'°'} (${m.o.name})`,e}}
function cutPlan(){const out=[];
M.rods.forEach(r=>{const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return;
 const La=Math.round(a.p.distanceTo(b.p)),A=cutEndData(r,true),B=cutEndData(r,false);
 out.push({r,La,Ls:Math.round(La+A.e+B.e),A,B,sec:rodSec(r)})});
return out}
function openCutModal(){const pl=cutPlan(),bySec=new Map();
pl.forEach(it=>{const a=bySec.get(it.sec.id)||{sec:it.sec,items:[]};a.items.push(it);bySec.set(it.sec.id,a)});
const grs=[...bySec.values()].map(gr=>{const items=gr.items.slice().sort((x,y)=>y.Ls-x.Ls);
 const bin=Math.round((gr.sec.sell_len_m||12)*1000),bins=[];
 items.forEach(it=>{let placed=false;
  for(let i=0;i<bins.length;i++)if(bins[i]>=it.Ls){bins[i]-=it.Ls;placed=true;break}
  if(!placed)bins.push(bin-it.Ls)});
 const total=items.reduce((s,i2)=>s+i2.Ls,0),stockLen=bins.length*bin;
 return{sec:gr.sec,items,nStock:bins.length,util:stockLen?total/stockLen:0,total,
  mass:(gr.sec.mass_kg_m||0)*stockLen/1000,cost:(gr.sec.price_rub_m||0)*stockLen/1000}}).sort((a,b)=>b.total-a.total);
let csv='Сечение;Элемент;L ось мм;+запил A;+запил B;L заготовок мм;Запил A;Запил B\n';
const ex=pl.find(it=>/запил \d/.test(it.A.txt+it.B.txt));
const exH=ex?`Пример ${esc(ex.r.name)}: А «${esc(ex.A.txt)}» +${Math.round(ex.A.e)} мм, Б «${esc(ex.B.txt)}» +${Math.round(ex.B.e)} мм → заготовок ${ex.Ls} мм (ось ${ex.La} мм)`:
 'Пример: угол 90° → запилам 45°; заготовок = ось + (h/2)·ctg(α/2) с обоих концов';
const rows=grs.map(g2=>{
 g2.items.forEach(it=>csv+=`"${g2.sec.name}";"${it.r.name}";${it.La};${Math.round(it.A.e)};${Math.round(it.B.e)};${it.Ls};"${it.A.txt}";"${it.B.txt}"\n`);
 return`<tr class="grp"><td colspan="6"><b>${esc(g2.sec.name)}</b> — ${g2.nStock} штаб × ${g2.sec.sell_len_m||12} м • утил. ${(g2.util*100).toFixed(0)}% • ${g2.mass.toFixed(0)} кг • ${Math.round(g2.cost).toLocaleString('ru')} ₽</td></tr>`+
  g2.items.map(it=>`<tr><td>${esc(it.r.name)}</td><td class="mono">${it.La}</td><td class="mono">+${Math.round(it.A.e)}</td><td class="mono">+${Math.round(it.B.e)}</td><td class="mono"><b>${it.Ls}</b></td><td class="mono dim2">${esc(it.A.txt)} • ${esc(it.B.txt)}</td></tr>`).join('')}).join('');
const mass=grs.reduce((s,g2)=>s+g2.mass,0),cost=grs.reduce((s,g2)=>s+g2.cost,0),
 totL=grs.reduce((s,g2)=>s+g2.total,0),stockL=grs.reduce((s,g2)=>s+g2.nStock*Math.round((g2.sec.sell_len_m||12)*1000),0);
openModal('РАСКРОЙ — резы и запилы по биссектрисе',
`<div class="hint2">Длина заготовки = длина осей + выносы запилов. Правила: опора — торец под 90°; проходной стык (угол &gt; 155°) — без запила; угловой стык — запил по биссектрисе: 90°→45°, угол α→θ=90°−α/2, вынос ≈ (h/2)·ctg(α/2) с проекцией по ширине стенки; T-стык — основной стержень целый, ветвь режется (подрез), вынос = h/2 осн. / sin β.</div>
<div class="kv"><span>Пример расчёта</span><b style="font-size:11px">${exH}</b></div>
<table class="calcTab wide"><tr><th>элемент</th><th>L ось</th><th>+A</th><th>+B</th><th>L загот</th><th>запилы (A • Б)</th></tr>${rows}</table>
<div class="kv"><span>Длина заготовок (с запилами)</span><b>${(totL/1000).toFixed(1)} м</b></div>
<div class="kv"><span>В мерном прокате (${grs.reduce((s,g2)=>s+g2.nStock,0)} шт)</span><b>${(stockL/1000).toFixed(1)} м • отход ${stockL?(100-totL/stockL*100).toFixed(0):0}%</b></div>
<div class="kv"><span>Сталь в покупке (с отходами)</span><b>${mass.toFixed(0)} кг</b></div>
<div class="kv"><span>Ориентировочная стоимость металла</span><b>${Math.round(cost).toLocaleString('ru')} ₽</b></div>`,
[{label:'Копировать CSV',keep:true,fn:()=>navigator.clipboard.writeText(csv).then(()=>toast('CSV скопирован',{type:'ok'}))},{label:'Закрыть',fn:closeModal}])}
/* ---------- report ---------- */
function openReportModal(){
 if(!calc.res){toast('Сначала выполните РАСЧЁТ в режиме «Нагрузки»',{type:'warn'});setAppMode('loads');return}
 const shots=(typeof captureShots==='function')?captureShots():[];
 const R=calc.res,l=calc.loads;
 const top=[...R.res].sort((a,b)=>b.ur-a.ur).slice(0,12);
 openModal('ОТЧЁТ ПО КАРКАСУ',
 `<div class="hint2">«${esc($('#projName').value)}» • ${M.nodes.size} узлов / ${M.rods.size} стержней • стержневая КЭ модель (6 DOF/узел) • нагрузки СП 20.13330, проверки СП 16.13330 (упрощённая φ по λ)</div>
 <div class="kv"><span>Нагрузки</span><b>${l.dead?'собств. вес • ':''}${l.snow?'снег р.'+l.snowRegion+' γf='+GF_SNOW[l.snowRegion]+' • ':''}${l.wind?'ветер р.'+l.windRegion+' м.'+l.terrain+' • ':''}${l.live?'эксплуат. 0.4 кПа + 1 кН • ':''}множитель ×${calc.factor}</b></div>
 <div class="kv"><span>Итог</span><b style="color:${R.maxUR>1?'#ff7a6a':'#7fe8b8'}">UR max ${R.maxUR.toFixed(2)} (${esc(R.urRod)})${R.maxUR>1?' — ПЕРЕГРУЗ':''} • прогиб max ${R.maxD.toFixed(1)} мм (${esc(R.dRod)})</b></div>
 <div class="kv"><span>Сталь / металл</span><b>${R.mass.toFixed(0)} кг • ${Math.round(R.cost).toLocaleString('ru')} ₽</b></div>
 ${shots.length?`<div class="psect">СХЕМЫ (превью)</div><div class="shotPrev">${shots.map(s=>`<figure><img src="${s.data}" alt="${esc(s.t)}"/><figcaption>${esc(s.t)}</figcaption></figure>`).join('')}</div>`:''}
 <div class="psect">НАИБОЛЕЕ ЗАГРУЖЕННЫЕ СТЕРЖНИ</div>
 <table class="calcTab"><tr><th>стержень</th><th>сечение</th><th>N сж, кН</th><th>M, кН·м</th><th>UR</th><th>f, мм</th></tr>
 ${top.map(r=>`<tr class="${r.ur>1?'bad':r.ur>.9?'warn2':''}"><td>${esc(r.name)}</td><td>${esc(r.secName)}</td><td>${(r.Ncomp/1000).toFixed(1)}</td><td>${(r.Mmax/1e6).toFixed(1)}</td><td><b>${r.ur.toFixed(2)}</b></td><td>${r.defl.toFixed(1)}</td></tr>`).join('')}</table>
 <div class="psect">ОПОРНЫЕ РЕАКЦИИ, кН</div>
 <table class="calcTab"><tr><th>опора</th><th>R</th><th>X</th><th>Y</th><th>Z</th></tr>
 ${R.reactArr.map(r=>`<tr><td>${esc(r.name)}</td><td><b>${r.F.toFixed(1)}</b></td><td>${r.fx.toFixed(1)}</td><td>${r.fy.toFixed(1)}</td><td>${r.fz.toFixed(1)}</td></tr>`).join('')}</table>
 <div class="hint2">В HTML-отчёт войдут: 5 видовых схем (включая деформированную), схемы балок с прогибами и N, схемы раскроя по штабам мерного проката, смета, реакции, состав сечений, методика, <b>отказ от ответственности</b>. Автор: DENstis • <a href="mailto:Denstis@gmail.com">Denstis@gmail.com</a>.</div>`,
 [{label:'Скачать HTML-отчёт',keep:true,fn:()=>{const html=(typeof buildReportHTML==='function')?buildReportHTML(shots):null;
   if(!html){toast('Модуль отчёта не загружен (31-report.js)',{type:'err'});return}
   const blob=new Blob([html],{type:'text/html;charset=utf-8'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='roof-report.html';a.click();toast('Отчёт сохранён — со схемами, раскроем и сметой',{type:'ok',timeout:5000})}},
  {label:'Закрыть',fn:closeModal}]);$('#modalCard').classList.add('wide')}
/* boot wiring */
window.addEventListener('load',()=>{
 ['#tabModel','#tabLoads','#tabCut','#tabReport'].forEach((id,i)=>{const b=$(id);if(b)b.onclick=()=>setAppMode(['model','loads','cut','report'][i])});
});
