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
  /* Ориентация сечения: у rhs широкая сторона b развёрнута вдоль e3 (вертикали),
     поэтому моменты инерции/сопротивления для изгиба обмениваются между e2/e3.
     I2 — изгиб в плоскости e1-e3 (смещения по e3), I3 — в плоскости e1-e2 (смещения по e2). */
  const rhs=s.kind==='rhs';
  const I2=rhs?p.Iy:p.Ix,I3=rhs?p.Ix:p.Iy;
  const W2=rhs?p.Wy:p.Wx,W3=rhs?p.Wx:p.Wy;
  const k=new Float64Array(144),kd=(i,j,v)=>{k[i*12+j]=v};
  const EA=p.A*E/L,GJ=p.J*G/L;
  kd(0,0,EA);kd(0,6,-EA);kd(6,0,-EA);kd(6,6,EA);
  kd(3,3,GJ);kd(3,9,-GJ);kd(9,3,-GJ);kd(9,9,GJ);
  const cx=I2*E/L**3,cy=I3*E/L**3;
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
  els.push({r,a,b,L,p,E,Ry,R,T,KE,k,ia:idx.get(r.a),ib:idx.get(r.b),sec:s,secName:s.name,matName:m.name,qv:[0,0,0],I2,I3,W2,W3})}
 calc._elsN=els.length;calc._els=els;if(!els.length)return{err:'Нет стержней'};
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
  /* q_loc = R·q_glob (строки R = базис e1,e2,e3); было свёрткой со столбцами (=Rᵀ) —
      для наклонных/вертикальных членов нагрузка поворачивалась на −2α */
   const q1=q[0]*R[0].x+q[1]*R[0].y+q[2]*R[0].z,q2=q[0]*R[1].x+q[1]*R[1].y+q[2]*R[1].z,q3=q[0]*R[2].x+q[1]*R[2].y+q[2]*R[2].z;
  e.qloc=[q1,q2,q3];
  e.f0=[q1*L/2,q2*L/2,q3*L/2,0,-q3*L*L/12,q2*L*L/12,q1*L/2,q2*L/2,q3*L/2,0,q3*L*L/12,-q2*L*L/12];
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
  /* u_loc = T·u_glob — согласовано с сборкой KE = Tᵀ·k·T (было Tᵀ·ug) */
   for(let i=0;i<12;i++){let v=0;for(let j=0;j<12;j++)v+=e.T[i*12+j]*ug[j];ul[i]=v}
  const fe=new Float64Array(12);
  for(let i=0;i<12;i++){let v=0;for(let j=0;j<12;j++)v+=e.k[i*12+j]*ul[j];fe[i]=v+e.f0[i]}
  const[q1,q2,q3]=e.qloc,L=e.L,p=e.p;
  const phi=phiBar(L/Math.min(p.ix,p.iy),e.E,e.Ry);
  const Ns=[],Ms=[],URs=[];
  for(let i=0;i<=8;i++){const s=L*i/8,r2=L-s;
   const N=fe[6]+q1*r2;
   const Me2=fe[10]-fe[8]*r2+q3*r2*r2/2;   /* момент вокруг e2 → прогиб по e3 */
   const Me3=-fe[11]+fe[7]*r2+q2*r2*r2/2;   /* момент вокруг e3 → прогиб по e2 */
   const M=Math.hypot(Me2,Me3);
   const nnc=Math.max(0,-N)/(phi*p.A*e.Ry),mst=(Math.abs(Me2)/e.W2+Math.abs(Me3)/e.W3)/e.Ry;
   Ns.push(N);Ms.push(M);URs.push(N>=0?N/(p.A*e.Ry)+mst:nnc+mst*Math.max(0,1-.8*nnc))}
  const Ncomp=Math.max(0,-Math.min(...Ns)),Nt=Math.max(0,Math.max(...Ns)),Mmax=Math.max(...Ms),ur=Math.max(...URs);
  /* Прогиб в пролёте: точное решение балки (Эрмит + частное для равномерной
     нагрузки) относительно хорды между смещёнными концами; ul — локальные
     перемещения/повороты концов ФЭ-части. */
  const d2=(L/8)*(ul[5]-ul[11])+q2*L**4/(384*e.E*e.I3);
  const d3=-(L/8)*(ul[4]-ul[10])+q3*L**4/(384*e.E*e.I2);
  const e1v=e.R[0];
  const um=[0,1,2].map(d=>(u[e.ia*6+d]+u[e.ib*6+d])/2);
  const along=um[0]*e1v.x+um[1]*e1v.y+um[2]*e1v.z;
  const nodalD=Math.hypot(um[0]-along*e1v.x,um[1]-along*e1v.y,um[2]-along*e1v.z);
  const defl=Math.hypot(d2,d3)+nodalD;
  const seg={t0:e.r.t0==null?0:e.r.t0,t1:e.r.t1==null?1:e.r.t1,L,d2,d3,q2,q3,E:e.E,I2:e.I2,I3:e.I3,
    vA:ul[1],rA3:ul[5],vB:ul[7],rB3:ul[11],wA:ul[2],rA2:ul[4],wB:ul[8],rB2:ul[10],uA1:ul[0],uB1:ul[6]};
  res.push({id:e.r.id,name:e.r.name,secName:e.secName,matName:e.matName,secId:e.sec.id,L,
   Ncomp,Nt,Mmax,ur,defl,d2:+d2.toFixed(3),d3:+d3.toFixed(3),nodalD:+nodalD.toFixed(3),Ns,Ms,URs,t0:e.r.t0==null?0:e.r.t0,t1:e.r.t1==null?1:e.r.t1,seg});
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
  if(!a){a={row:{...rr,id:k,name:(M.rods.get(k)||M.rods.get(Number(k))||{}).name||rr.name,segs:[rr.seg]},sm};agg.set(k,a)}
  else{a.sm.push(...sm);const p0=a.row;
   (p0.segs=p0.segs||[]).push(rr.seg);
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
  const rr=M.rods.get(k)||M.rods.get(Number(k));if(rr)r0.L=rodLen(rr);
  /* Прогиб стержня по ВСЕЙ его оси: максимум отклонения от хорды между концами
      стержня (не кусками) — иначе host-разбиение занижает f (тест инвариантности разбиения). */
   const rod=rr;
   if(rod){const A=M.nodes.get(rod.a),B=M.nodes.get(rod.b),ia=idx.get(rod.a),ib=idx.get(rod.b);
    if(A&&B&&ia!=null&&ib!=null){
     const uA=[u[ia*6],u[ia*6+1],u[ia*6+2]],uB=[u[ib*6],u[ib*6+1],u[ib*6+2]];
     const e1=B.p.clone().sub(A.p),Lr=e1.length();
     if(Lr>1){e1.multiplyScalar(1/Lr);
      let e2=AZ.clone().cross(e1);if(e2.lengthSq()<1e-8)e2=AY.clone().cross(e1);
      e2.normalize();const e3=e1.clone().cross(e2).normalize();
      let md=0;
      (r0.segs||[]).forEach(sg=>{if(!sg||sg.E==null||!(sg.L>0))return;
       for(let i=0;i<=8;i++){const t=i/8,Tg=sg.t0+(sg.t1-sg.t0)*t,f=deflAt(sg,sg.L,t);
        const cx=e1.x*f.u+e2.x*f.v+e3.x*f.w-(uA[0]+(uB[0]-uA[0])*Tg),
              cy=e1.y*f.u+e2.y*f.v+e3.y*f.w-(uA[1]+(uB[1]-uA[1])*Tg),
              cz=e1.z*f.u+e2.z*f.v+e3.z*f.w-(uA[2]+(uB[2]-uA[2])*Tg);
        const al=cx*e1.x+cy*e1.y+cz*e1.z;
        const d=Math.hypot(cx-al*e1.x,cy-al*e1.y,cz-al*e1.z);
        if(d>md)md=d}});
      if(md>0)r0.defl=md}}}
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
/* узлы в деформированной схеме движутся вместе с конструкцией (сварные узлы) */
function applyDeflNodePos(){
  if(typeof nodeObjs==='undefined')return;
  const on=calc.showDefl&&calc.res&&mode!=='plan';
  const s=calc.deflScale;
  M.nodes.forEach(n=>{const o=nodeObjs.get(n.id);if(!o)return;
   if(!on){o.g.position.copy(n.p);return}
   const i=calc.res.nodeOrder?calc.res.nodeOrder.indexOf(n.id):-1;
   if(i<0){o.g.position.copy(n.p);return}
   o.g.position.set(n.p.x+calc.res.u[i*6]*s,n.p.y+calc.res.u[i*6+1]*s,n.p.z+calc.res.u[i*6+2]*s)});
}
/* Точная форма деформированного стержня: Эрмит по концевым локальным перемещениям/поворотам
   (ul ФЭ-части) + частное решение равномерной нагрузки q·x²(L−x)²/(24EI).
   θv = dv/dx = φ3 (поворот вокруг e3), θw = dw/dx = −φ2 (поворот вокруг e2).
   Возвращает локальные: v (по e2), w (по e3), наклоны tv/tw, осевое u — без масштаба. */
function deflAt(sg,L,t){
 const x=L*t,x2=x*x,Lm=L-x,f=x2*Lm*Lm,fp=2*L*L*x-6*L*x2+4*x*x2;
 const H1=1-3*t*t+2*t*t*t,H2=t-2*t*t+t*t*t,H3=3*t*t-2*t*t*t,H4=-t*t+t*t*t;
 const dH1=(-6*t+6*t*t)/L,dH2=1-4*t+3*t*t,dH3=(6*t-6*t*t)/L,dH4=-2*t+3*t*t;
 const c2=sg.q2*f/(24*sg.E*sg.I3),c3=sg.q3*f/(24*sg.E*sg.I2);
 const c2p=sg.q2*fp/(24*sg.E*sg.I3),c3p=sg.q3*fp/(24*sg.E*sg.I2);
 const v=H1*sg.vA+L*H2*sg.rA3+H3*sg.vB+L*H4*sg.rB3+c2;
 const w=H1*sg.wA-L*H2*sg.rA2+H3*sg.wB-L*H4*sg.rB2+c3;
 /* tv/tw = dv/dx, dw/dx: dH1/dH3 уже /L (по x), dH2/dH4 — по t, но член L*H2
      даёт при дифференцировании по x ровно dH2 (L сокращается с dt/dx=1/L) */
 const tv=dH1*sg.vA+dH2*sg.rA3+dH3*sg.vB+dH4*sg.rB3+c2p;
   const tw=dH1*sg.wA-dH2*sg.rA2+dH3*sg.wB-dH4*sg.rB2+c3p;
 const u=sg.uA1+(sg.uB1-sg.uA1)*t;
 return{v,w,tv,tw,u};
}
function clearCalcDraw(){clearGroup(calcGroup());calc._nodeCol=calc._rodCol=null;if(typeof rodObjs!=='undefined')rodObjs.forEach((o,id)=>{o.g.visible=!M.hidden.has('r'+id)});applyDeflNodePos();if(window.applySelMats)applySelMats();const l=$('#calcLegend');if(l)l.style.display='none'}
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
   const dP=id=>{const i=nidx.get(id);if(i==null)return 0;
    return R.u[i*6]*perp.x+R.u[i*6+1]*perp.y+R.u[i*6+2]*perp.z};
   const ids=[rd.a,...(typeof rodSplitIds==='function'?rodSplitIds(rd):[]),rd.b];
   const seqN=ids.map(i=>M.nodes.get(i)).filter(n=>n);if(seqN.length<2)return;
   const segs=(rr.segs&&rr.segs.length===seqN.length-1)?rr.segs:null;
   const pts=[];
   for(let k=0;k<seqN.length-1;k++){
    const nA=seqN[k],nB=seqN[k+1];const vp=nB.p.clone().sub(nA.p);const Lp=vp.length();if(Lp<10)continue;
    const e1p=vp.clone().multiplyScalar(1/Lp);
    let e2p=AZ.clone().cross(e1p);if(e2p.lengthSq()<1e-8)e2p=AY.clone().cross(e1p);
    e2p.normalize();const e3p=e1p.clone().cross(e2p).normalize();
    const sg=segs?segs[k]:{d2:rr.defl,d3:0};
    const full=!!(sg&&sg.E!=null&&sg.L>0);          /* точная форма по коэффициентам seg */
    const e2d=e2p.dot(perp),e3d=e3p.dot(perp);
    const bDot=full?0:(sg.d2||0)*e2d+(sg.d3||0)*e3d;
    const dA=dP(nA.id),dB=dP(nB.id);
    const Np=Math.max(4,Math.round(20*Lp/L));
    for(let i=(k?1:0);i<=Np;i++){const t=i/Np;
     /* вся эпюра (узлы + местный изгиб) в одном масштабе deflScale */
     const off=full?s2*(f=>f.v*e2d+f.w*e3d)(deflAt(sg,sg.L,t))
       :((dA+(dB-dA)*t)+bDot*Math.sin(Math.PI*t))*s2;
     pts.push(nA.p.clone().addScaledVector(e1p,Lp*t).addScaledVector(perp,off))}}
   if(pts.length<2)return;
   gPlan.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat))});
  gPlan.visible=true;
 }else gPlan.visible=false;
 if(calc.showDefl&&mode!=='plan'&&typeof deflBodies==='function'){
  if(calc.deflAuto){let md=0;R.res.forEach(r=>{if(r.defl>md)md=r.defl});
   const box=modelBox();const dim=box?box.getSize(V3()).length():12000;
   calc.deflScale=md>1e-6?Math.round(clamp(dim*0.06/md,1,300)):1;
   const rg=$('#rngDefl'),dv=$('#dScaleVal');if(rg){rg.value=calc.deflScale}if(dv)dv.textContent=calc.deflScale}
  deflBodies(g)}
  applyDeflNodePos();   /* узлы следуют за деформированной конструкцией (сварные) */
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
function rodSig(){try{return [...M.rods.values()].map(r=>r.id+':'+rodSec(r).id).join('|')+'#'+JSON.stringify(calc.loads)+'#'+calc.factor}catch(e){return ''}}
function runCalc(){const t0=performance.now();const R=solveFrame();
 if(!R||R.err){toast((R&&R.err)||'Расчёт не выполнен',{type:'err',timeout:5000});return}
 calc.res=R;calc.byId=new Map(R.res.map(r=>[String(r.id),r]));calc.sig=rodSig();
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
 const steel=()=>{let m=0,c=0;M.rods.forEach(r=>{const s=rodSec(r);if(s){m+=s.mass_kg_m*rodLen(r)/1000;c+=(s.price_rub_m||0)*rodLen(r)/1000}});return{m,c}};
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
 calc.res=R;calc.byId=new Map(R.res.map(r=>[String(r.id),r]));calc.sig=rodSig();
 afterChange();
 drawCalc();renderCalcResults();
 const etR=evalT(R);
 const list=(()=>{const m={};M.rods.forEach(r=>{m[r.type]=rodSec(r)});
  return Object.keys(m).map(t=>{const s=m[t];const uB=u0[t]||0,uA=etR.u[t]||0;
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
/* ---------- умный подбор сечений: физическая модель «требуемое сечение по усилиям» ---------- */
function reqIdx(rr,cands,T,optDefl,Ry,E,pCur){
 /* минимальный индекс каталога под текущие усилия стержня: UR(N,M) <= T + (опц.) прогиб */
 const L=rr.L||1;
 let IyN=0,IxN=0;
 if(optDefl){const lim=L/200-(rr.nodalD||0);
  if(lim>0){IyN=Math.abs(rr.d2||0)*pCur.Iy/lim;IxN=Math.abs(rr.d3||0)*pCur.Ix/lim}}
 const Ns=rr.Ns||[0],Ms=rr.Ms||[0];
 for(let i=0;i<cands.length;i++){const p=secProps(cands[i]);
  if(p.Iy<IyN||p.Ix<IxN)continue;
  const phi=phiBar(L/Math.min(p.ix,p.iy),E,Ry);
  let ok=true;
  for(let k=0;k<Ns.length;k++){const N=Ns[k],mst=(Ms[k]||0)*(1/p.Wy+1/p.Wx)/Ry;
   const nc=Math.max(0,-N)/(phi*p.A*Ry);
   const ur=N>=0?N/(p.A*Ry)+mst:nc+mst*Math.max(0,1-.8*nc);
   if(ur>T){ok=false;break}}
  if(ok)return i}
 return cands.length-1}
function smartSections(){
 if(!M.rods.size){toast('Нет стержней',{type:'warn'});return}
 const cands=NR_SECTIONS.filter(s=>s.kind==='shs'||s.kind==='rhs')
  .sort((a,b)=>calc.optCrit==='cost'?(a.price_rub_m-b.price_rub_m)||(a.mass_kg_m-b.mass_kg_m):a.mass_kg_m-b.mass_kg_m);
 if(cands.length<2){toast('Мало сечений в каталоге',{type:'warn'});return}
 const orig=new Map([...M.rods].map(([k,r])=>[k,r.sec]));
 const restore=()=>orig.forEach((s,k)=>{const r=M.rods.get(k);if(r)r.sec=s});
 pushUndo();
 const T=calc.optTarget,types=[...new Set([...M.rods.values()].map(r=>r.type))];
 const steel=()=>{let m=0,c=0;M.rods.forEach(r=>{const s=rodSec(r);if(s){m+=s.mass_kg_m*rodLen(r)/1000;c+=(s.price_rub_m||0)*rodLen(r)/1000}});return{m,c}};
 const t0=steel();
 const cur={},lenT={},cntMap={};
 M.rods.forEach(r=>{lenT[r.type]=(lenT[r.type]||0)+rodLen(r);
  (cntMap[r.type]=cntMap[r.type]||new Map()).set(r.sec,(cntMap[r.type].get(r.sec)||0)+1)});
 types.forEach(t=>{const best=[...cntMap[t].entries()].sort((a,b)=>b[1]-a[1])[0][0];
  let i=cands.findIndex(c=>c.id===best);
  if(i<0){i=cands.findIndex(c=>c.id===SEC_DEFAULTS[t]);if(i<0)i=0}
  cur[t]=i});
 const apply=()=>M.rods.forEach(r=>r.sec=cands[cur[r.type]].id);
 const okAll=R=>{if(!R||R.err)return false;
  for(const rr of R.res){const rd=M.rods.get(+rr.id)||M.rods.get(rr.id);if(!rd)continue;
   if(rr.ur>T+1e-9)return false;
   if(calc.optDefl&&rr.L>0&&rr.defl>rr.L/200+1e-9)return false}
  return true};
 const _log=[];window._optLog=_log;
 let nSolve=0;
 const solve=()=>{apply();nSolve++;const Q=solveFrame();
  if(Q.err){restore();toast('Подбор прерван: '+Q.err,{type:'warn'});return null}
  return Q};
 let R=solve();if(!R)return;
 let it=0;
 /* фаза C: ремонт исходной схемы — поднимаем типы-нарушители (монотонно вверх) */
 for(;it<60&&!okAll(R);it++){
  const byR=new Map(R.res.map(r=>[String(r.id),r]));
  const viol={};
  M.rods.forEach(r=>{const rr=byR.get(String(r.id));if(!rr)return;
   const s1=rr.ur/(T>1e-9?T:1),s2=(calc.optDefl&&rr.L>0)?rr.defl/(rr.L/200):0;
   const s=Math.max(s1,s2);
   if(s>1+1e-9)viol[r.type]=Math.max(viol[r.type]||0,s)});
  const t=Object.keys(viol).sort((a,b)=>viol[b]-viol[a])[0];
  if(!t)break;
  if(cur[t]>=cands.length-1){restore();toast('Подбор: перегруз на вершине каталога — исходные сечения восстановлены',{type:'warn',timeout:8000});return}
  cur[t]++;R=solve();if(!R)return}
 if(!okAll(R)){restore();toast('Исходная схема не проходит проверки — восстановлена',{type:'warn'});return}
 /* фаза A+B: облегчение — прыжок к req (физическая оценка) со шлюзом okAll,
    иначе шаг вниз по массе; каждое принятие строго снижает стоимость → монотонное завершение */
 let rnd=0,imp=true;
 const massT=t=>(cands[cur[t]].mass_kg_m||0)*(lenT[t]||0);
 for(;imp&&rnd<80;rnd++){imp=false;
  const byR=new Map(R.res.map(r=>[String(r.id),r]));
  const req={};
  M.rods.forEach(r=>{const rr=byR.get(String(r.id));if(!rr)return;
   const m=rodSteel(r);
   req[r.type]=Math.max(req[r.type]||0,reqIdx(rr,cands,T,calc.optDefl,m.Ry_mpa,m.E_mpa,secProps(rodSec(r))))});
  _log.push({ph:'req',it:rnd+1,req,cur:Object.fromEntries(types.map(t=>[t,cur[t]]))});
  const order=types.slice().sort((a,b)=>(req[a]||0)-(req[b]||0));
  for(const t of order){
   if(cur[t]===0)continue;
   const target=Math.max(0,Math.min(cur[t]-1,req[t]||0));
   if(target>=cur[t])continue;
   const sv=cur[t];cur[t]=target;
   const Rt=solve();
   if(!Rt)return;
   if(okAll(Rt)){R=Rt;imp=true;_log.push({ph:'jmp',t:(TYPES[t]||{}).prefix||t,to:target})}
   else cur[t]=sv}
  if(imp)continue;
  const order2=types.slice().sort((a,b)=>massT(b)-massT(a));
  for(const t of order2){
   if(cur[t]===0)continue;
   const sv=cur[t];cur[t]=sv-1;
   const Rt=solve();
   if(!Rt)return;
   if(okAll(Rt)){R=Rt;imp=true;_log.push({ph:'dn',t:(TYPES[t]||{}).prefix||t,to:cur[t]});break}
   cur[t]=sv}}
 R=solve();if(!R)return;
 const pass=okAll(R);
 if(!pass){restore();R=solveFrame();if(R.err){toast('Подбор не удался',{type:'warn'});return}}
 const t1=steel();
 calc.res=R;calc.byId=new Map(R.res.map(r=>[String(r.id),r]));calc.sig=rodSig();
 afterChange();
 drawCalc();renderCalcResults();
 const etU={};R.res.forEach(rr=>{const rd=M.rods.get(+rr.id)||M.rods.get(rr.id);if(rd)etU[rd.type]=Math.max(etU[rd.type]||0,rr.ur)});
 const list=types.map(t=>{const s=cands[cur[t]];
  return `${(TYPES[t]||{}).prefix||t}: ${s.name} (UR ${(etU[t]||0).toFixed(2)})`}).join(' • ');
 const el=$('#calcOut');
 if(el)el.insertAdjacentHTML('afterbegin',`<div class="kv"><span>Умный подбор (UR ≤ ${T.toFixed(2)})</span><b style="color:${pass?'#7fe8b8':'#ff7a6a'}">${pass?'пройден':'исходные сечения восстановлены'}</b></div>
  <div class="kv"><span>Сталь</span><b>${t0.m.toFixed(0)} → ${t1.m.toFixed(0)} кг (${t0.m?((t1.m/t0.m-1)*100).toFixed(1):'0'} %)</b></div>
  <div class="kv"><span>Металл по цене</span><b>${Math.round(t0.c).toLocaleString('ru')} → ${Math.round(t1.c).toLocaleString('ru')} ₽</b></div>
  <div class="kv"><span>UR max / прогиб max</span><b>${R.maxUR.toFixed(2)} / ${R.maxD.toFixed(1)} мм</b></div>
  <div class="kv"><span>Пересчётов каркаса</span><b>${nSolve}</b></div>
  <div class="hint2">${esc(list)} • Ctrl+Z — отменить</div>`);
 toast(`Умный подбор: ${pass?'пройден':'исходные восстановлены'} • сталь ${t1.m.toFixed(0)} кг • UR max ${R.maxUR.toFixed(2)}`,
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
 <div class="btnrow"><button class="btn gold" id="btnOptSmart">УМНЫЙ ПОДБОР</button><button class="btn" id="btnOptSec">РАВНАЯ ПРОЧНОСТЬ</button></div>
 <div class="hint2">«УМНЫЙ ПОДБОР» — физическая модель: для каждого стержня по его усилиям (N, M, прогиб) находится минимальное сечение каталога, тип получает максимум по своим стержням, силы пересчитываются (фикс-поинт), затем спуск по массе. «РАВНАЯ ПРОЧНОСТЬ» — ползунок «Макс. использование» задаёт целевой верх UR (0.3–1.0): перегруженные типы поднимаются, самый разгруженный пробно опускается. Прогиб f ≤ L/200 — жёсткое ограничение в обоих режимах. Отмена — Ctrl+Z.</div>
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
 W('#btnOptSmart','click',()=>smartSections());
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
/* ЕДИНОЕ ЯДРО РАСКРОЯ (docs/FABRICATION.md §4.1): классификация конца стержня
   и геометрия запила. Используют обёртки cutEndData (таблица раскроя) и
   endInfo (3D-призмы) — до v53 логика была продублирована в двух местах
   с расходящимися порогами.
   P: {v — единичное направление ОТ конца ВНУТРЬ стержня;
       L — эталонная длина для ограничения выноса (стержень или сегмент);
       sec — наше сечение (rodSec); isSupport — узел-опора;
       selfId — id нашего стержня (отличие сквозного продолжения от чужого соосного);
       inc — соседние направления в узле [{name,id,d,sec}]: концы соседей
             + оба ±d для стержней, проходящих через узел (host/hosts)}
   Возвращает {kind,txt,e,angle,n,e2,e3,al,main,nest,sOut,sFar,weld,groupKey}:
     kind: 'flat'|'free'|'pass'|'main'|'nest'|'T'|'miter'; e — вынос (мм);
     angle — угол запила к оси (°; miter: θ=90−α/2); n/e2/e3 — геометрия
     плоскости реза (для будущих SVG-чертежей); weld — рисовать сварной
     контур на этом торце (чужой соосный стык встык); groupKey — ключ
     группировки одинаковых деталей. */
/* УЗЕЛ-ОПОРА: плоский торец остаётся только у члена, который меньше других
   «вгрызается» в соседей (на фундаменте он сидит плоско); остальные отодвигаются
   от узла ровно настолько, чтобы их сечение ЦЕЛИКОМ вышло из нераскрытого
   (не запиленного) тела соседа. Раньше здесь безусловно возвращался flat, и
   диагональ у основания стойки уходила внутрь её стены — тела пересекались. */
function supportCut(v,sec,inc,L){
 const flat={kind:'flat',txt:'без запила — опора',e:0,groupKey:'flat'};
 if(!inc.length)return flat;
 const hw=s=>s&&s.kind==='rhs'?[(s.h_mm||60)/2,(s.b_mm||60)/2]:[(s.b_mm||60)/2,(s.h_mm||60)/2];
 const area=s=>(s&&s.b_mm||60)*(s&&s.h_mm||60);
 const ax=d=>{const m2=cutN([-d[1],d[0],0])||[1,0,0];
  return[m2,cutN([d[1]*m2[2]-d[2]*m2[1],d[2]*m2[0]-d[0]*m2[2],d[0]*m2[1]-d[1]*m2[0]])||[0,0,0]]};
 /* наименьший параметр t (от узла вдоль оси vs), начиная с которого сечение
    vs целиком лежит вне призмы соседа q (призма q — нераскрытая, от узла):
    выходим через одно из двух «лиц» сечения соседа либо через его задний
    торец, если наша ось смотрит назад от него */
 const clearOf=(vs,ss,q)=>{
  const[hw2,hw3]=hw(ss||{});
  let e2=cutN([-vs[1],vs[0],0])||[1,0,0];
  const e3=cutN([vs[1]*e2[2]-vs[2]*e2[1],vs[2]*e2[0]-vs[0]*e2[2],vs[0]*e2[1]-vs[1]*e2[0]])||[0,0,0];
  const[m2,m3]=ax(q.d),[Wq,Hq]=hw(q.sec);
  let best=Infinity;
  const face=(mm,half)=>{
   const vm=vs[0]*mm[0]+vs[1]*mm[1]+vs[2]*mm[2];
   if(Math.abs(vm)<1e-6)return;
   const c=hw2*Math.abs(e2[0]*mm[0]+e2[1]*mm[1]+e2[2]*mm[2])+
    hw3*Math.abs(e3[0]*mm[0]+e3[1]*mm[1]+e3[2]*mm[2]);
   const t=(half+c)/Math.abs(vm);
   if(t<best)best=t};
  face(m2,Wq);face(m3,Hq);
  const vd=vs[0]*q.d[0]+vs[1]*q.d[1]+vs[2]*q.d[2];
  if(vd<-1e-6){const c=hw2*Math.abs(e2[0]*q.d[0]+e2[1]*q.d[1]+e2[2]*q.d[2])+
    hw3*Math.abs(e3[0]*q.d[0]+e3[1]*q.d[1]+e3[2]*q.d[2]);
   const t=c/(-vd);if(t<best)best=t}
  return best};
 const all=[{d:v,sec:sec||{}}].concat(inc);
 const clr=all.map((a,i)=>{let m=0;
  for(let j=0;j<all.length;j++){if(j===i)continue;
   const t=clearOf(a.d,a.sec,all[j]);if(isFinite(t)&&t>m)m=t}
  return m});
 /* «опорный» = меньший вынос (меньше влез в соседей), при равенстве — более
    массивное сечение; он остаётся плоским, остальные отступают на свой вынос */
 let bi=0;
 for(let i=1;i<all.length;i++){
  if(clr[i]<clr[bi]-1e-9)bi=i;
  else if(Math.abs(clr[i]-clr[bi])<=1e-9&&area(all[i].sec)>area(all[bi].sec))bi=i}
 if(bi===0)return flat;
 const planes=[];
 for(const q of inc){const nn=cutN([v[0]-q.d[0],v[1]-q.d[1],v[2]-q.d[2]]);if(nn)planes.push(nn)}
 let mi=0,bestC=clearOf(v,sec||{},inc[0]);
 for(let i=1;i<inc.length;i++){const t=clearOf(v,sec||{},inc[i]);if(t>bestC){bestC=t;mi=i}}
 const b=sec&&sec.b_mm||60,h=sec&&sec.h_mm||60;
 const e=Math.min(clr[0],L*0.4);
 return{kind:'T',txt:`T-подрез у опоры по ${inc[mi].name}: сечение ${b}×${h} выходит из тела соседа на ${Math.round(clr[0])} мм`,
  e,planes,main:{name:inc[mi].name,id:inc[mi].id},groupKey:'T'}}
function cutCore(P){
 const v=P.v;
 if(!v)return{kind:'free',txt:'—',e:0,groupKey:'free'};
 /* свои сегменты (стержень разбит host-узлом и подходит к узлу с двух сторон)
    не участвуют в запиле: иначе собственное продолжение даёт ложный pass
    (ang(v,−v)=180°) и запил у стыка не строится */
 const inc=(P.inc||[]).filter(q=>q.id!==P.selfId);
 if(P.isSupport)return supportCut(v,P.sec,inc,P.L);
 if(!inc.length)return{kind:'free',txt:'без запила (свободный край)',e:0,groupKey:'free'};
 const ang=(u,w)=>Math.acos(clamp(u[0]*w[0]+u[1]*w[1]+u[2]*w[2],-1,1))*CUTD;
 /* биссектрисы со ВСЕМИ соседями узла: конец режется ВСЕМИ плоскостями, а
    не только против выбранного «ближайшего» соседа. Раньше у каждого конца
    была одна плоскость против одного соседа, а соседи выбирали РАЗНЫХ
    партнёров (узел 1205: КЛ-2 резал против НП-20, а сам НП-20 — против
    ОР-24) — плоскости расходились и тела пересекались. Взаимно применённая
    биссектриса пары (нормали ±n) строго разводит тела полупространствами. */
 const planes=[];
 for(const q of inc){const nn=cutN([v[0]-q.d[0],v[1]-q.d[1],v[2]-q.d[2]]);if(nn)planes.push(nn)}
 const s=P.sec||{},b=s.b_mm||60,h=s.h_mm||60,L=P.L||0;
 let e2=cutN([-v[1],v[0],0]);if(!e2)e2=[1,0,0];
 const e3=cutN([v[1]*e2[2]-v[2]*e2[1],v[2]*e2[0]-v[0]*e2[2],v[0]*e2[1]-v[1]*e2[0]])||[0,0,0];
 /* проходной: соосное продолжение за концом — торец встык, без запила.
    Своё продолжение (сегменты того же стержня) — кольцо рисует отдельный
    проход butt-швов; чужой соосный — кольцо здесь (weld). */
 for(const q of inc)if(ang(v,q.d)>175)return{kind:'pass',txt:'без запила (проходной)',e:0,
  weld:q.id!==P.selfId,planes,groupKey:'pass'};
 /* сквозной стык: две ветви в узле образуют прямую (>155°) */
 /* выбор пары — не первая попавшаяся: берём пару с членом, ближайшим к
    нашей оси v (с ним наш конец сближается сильнее всего — его стенки
    режут наш торец), при равенстве — самую прямую. На узле 1141 это
    даёт [НП-8,НП-9] (14°), а не вертикаль [КЛ-3,СТ-16] (76°). */
 let pair=null,bestNear=Infinity,bestStr=-1;
 for(let i=0;i<inc.length;i++)for(let j=i+1;j<inc.length;j++){
  const ab=ang(inc[i].d,inc[j].d);if(ab<=155)continue;
  const near=Math.min(ang(v,inc[i].d),ang(v,inc[j].d));
  if(near<bestNear||(near===bestNear&&ab>bestStr)){pair=[inc[i],inc[j]];bestNear=near;bestStr=ab}}
 if(pair){
  /* мы — часть сквозной линии, только если нет почти-параллельного соседа
    (<30°, та же сторона узла — перекрытие тел, конец обязан резаться);
    узел 1141: Р-18↔НП-9 = 166°, но Р-18↔НП-8 = 14° — режем, а не main */
   if(Math.min.apply(null,inc.map(q=>ang(v,q.d)))>30&&pair.some(q=>ang(v,q.d)>155)){const br=inc.filter(q=>pair.indexOf(q)<0);
   const mj=pair.find(q=>ang(v,q.d)>155);
   return{kind:'main',txt:br.length?`без запила (основной; ветвь ${br.map(q=>q.name).join(', ')})`:'без запила (проходной)',
    e:0,planes,main:{name:mj.name,id:mj.id},groupKey:'main'}}
  /* ветвь к сквозному основному: main — по массе погонного сечения.
     Короб main в плоскости сечения (m2 — горизонталь, m3 — сторона 'b' у rhs
     по конвенции вертикали); луч v через короб: sOut — наружная стенка,
     sFar — противоположная внутренняя стенка полости. Если сечение ветви
     влезает в полость main — ВЛОЖЕНИЕ (nest); иначе стык впритык (T). */
  const mi=pair[0].sec.mass_kg_m>=pair[1].sec.mass_kg_m?0:1;
  const main=pair[mi],ms=main.sec;
  const dM=cutN(main.d);
  let m2=cutN([-dM[1],dM[0],0]);if(!m2)m2=[1,0,0];
  const m3=cutN([dM[1]*m2[2]-dM[2]*m2[1],dM[2]*m2[0]-dM[0]*m2[2],dM[0]*m2[1]-dM[1]*m2[0]])||[0,0,0];
  const al=Math.abs(v[0]*m2[0]+v[1]*m2[1]+v[2]*m2[2]),ga=Math.abs(v[0]*m3[0]+v[1]*m3[1]+v[2]*m3[2]);
  const Wm=(ms.kind==='rhs'?ms.h_mm:ms.b_mm)||60,Hm=(ms.kind==='rhs'?ms.b_mm:ms.h_mm)||60;
  const tA=ms.t_mm||4;
  const sOut=Math.min(al>1e-6?Wm/(2*al):1e9,ga>1e-6?Hm/(2*ga):1e9);
  const sFar=Math.min(al>1e-6?(Wm-2*tA)/(2*al):1e9,ga>1e-6?(Hm-2*tA)/(2*ga):1e9);
  const nest=Math.min(b,h)<=Math.min(Wm-2*tA,Hm-2*tA)+.5&&Math.max(b,h)<=Math.max(Wm-2*tA,Hm-2*tA)+.5;
  const e=Math.min(nest?sFar:sOut,L*0.4),mj={name:main.name,id:main.id};
  return nest?{kind:'nest',txt:`вложено в осн. ${main.name}: сечение ${b}×${h} в полость ${Wm-2*tA}×${Hm-2*tA}, глубина ${Math.round(sFar)} мм`,
    e,planes,nest,sOut:Math.min(sOut,L*0.4),sFar,al:ang(v,main.d),main:mj,groupKey:'nest'}
   :{kind:'T',txt:`T-подрез по осн. ${main.name}: ${b}×${h} не входит в полость ${Wm-2*tA}×${Hm-2*tA} — впритык к стенке`,
    e,planes,nest,sOut:Math.min(sOut,L*0.4),sFar,al:ang(v,main.d),main:mj,groupKey:'T'}}
 /* угловой стык (miter): плоскость реза по биссектрисе */
 const m=inc.reduce((a,q)=>ang(v,q.d)<ang(v,a.d)?q:a,inc[0]);
 /* биссектриса: нормаль плоскости запила = v − m.d (разделяет стержни),
    НЕ v + m.d (та плоскость не разделяет — на коньке давала вынос 86.6 вместо 28.9) */
 const al=ang(v,m.d),n=cutN([v[0]-m.d[0],v[1]-m.d[1],v[2]-m.d[2]]);
 if(!n)return{kind:'free',planes,txt:'без запила',e:0,groupKey:'free'};
 const c2=Math.max(.08,Math.abs(GVEC.dot(n,v)));
 const e=Math.min(((b/2)*Math.abs(GVEC.dot(n,e2))+(h/2)*Math.abs(GVEC.dot(n,e3)))/c2,L*0.4),th=90-al/2;
 return{kind:'miter',txt:`запил ${Math.abs(al-90)<1?'90°→45°':Math.round(al)+'°→'+th.toFixed(0)+'°'} (${m.name})`,
  e,planes,angle:th,al,n,e2,e3,main:{name:m.name,id:m.id},groupKey:`miter${Math.round(th)}`}}
/* обёртка: узлы модели → inc[] → ядро (только {txt,e} и ниже по цепочке) */
function cutEndData(r,atA){const nA=M.nodes.get(atA?r.a:r.b),nB=M.nodes.get(atA?r.b:r.a);
 if(!nA||!nB)return{txt:'—',e:0};
 const v=cutN(cutV(nA.p,nB.p));if(!v)return{txt:'—',e:0};
 const inc=[];
 M.rods.forEach(o=>{if(o.id===r.id)return;let oe=null;
  if(o.a===nA.id)oe=M.nodes.get(o.b);else if(o.b===nA.id)oe=M.nodes.get(o.a);
  if(oe){const d=cutN(cutV(nA.p,oe.p));if(d)inc.push({name:o.name,id:o.id,d,sec:rodSec(o)});return}
  const thru=(nA.host&&nA.host.rod===o.id)||(nA.hosts||[]).some(h=>h&&h.rod===o.id);
  if(thru){const oa=M.nodes.get(o.a),ob=M.nodes.get(o.b);if(!oa||!ob)return;
   const d=cutN(cutV(ob.p,oa.p));if(d){inc.push({name:o.name,id:o.id,d,sec:rodSec(o)});
    inc.push({name:o.name,id:o.id,d:[-d[0],-d[1],-d[2]],sec:rodSec(o)})}}});
 return cutCore({v,L:Math.hypot(...cutV(nA.p,nB.p)),sec:rodSec(r),selfId:r.id,inc,
  isSupport:nA.type==='support'})}
/* вклад конца в длину заготовки: у miter вынос (запил по биссектрисе) — край
   заготовки выходит ЗА узел на e (остриё запила), поэтому +e; у T/nest конец
   НЕ доходит до оси на e (впритык к стенке / вложение в полость — ровно то,
   чем обрезает призму buildFullModel: trim=min(e,.45L)), поэтому −e. */
const endLenAdd=E=>((E.kind==='T'||E.kind==='nest')?-(E.e||0):(E.e||0));
function cutPlan(){const out=[];
M.rods.forEach(r=>{const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return;
 const La=Math.round(a.p.distanceTo(b.p)),A=cutEndData(r,true),B=cutEndData(r,false);
 out.push({r,La,Ls:Math.round(La+endLenAdd(A)+endLenAdd(B)),A,B,sec:rodSec(r)})});
return out}
/* ---------- Шаг 2 (docs/FABRICATION.md §4.2): классификация узлов, приоритеты ----
   nodeJoints() → Map<nid, joint>: {id,nid,name,p,type,cls,clsTxt,main,members,ends,
   thru,nBranch,warn}. Классы: support/empty/free/pass/T/K/X/N/corner (см. JCLS).
   Приоритет «кто главный»: опора > сквозной стык (main — по массе погонного
   сечения, как в cutCore) > ветви; у углового узла main=null (оба конца пилятся).
   Кэш: calc.joints + calc.jointsSig (геометрия+сечения) — отчёт/проверки/схемы. */
const JCLS={support:'Опора',empty:'Пустой узел',free:'Свободный край',pass:'Сквозной стык',
 T:'T-узел',K:'K-узел',X:'X-узел',N:'N-узел',corner:'Угловой узел'};
function jointsSig(){try{return[...M.nodes.values()].map(n=>n.id+':'+n.type+':'+n.p.x.toFixed(2)+','+n.p.y.toFixed(2)+','+n.p.z.toFixed(2)).join('|')+'#'+[...M.rods.values()].map(r=>r.id+':'+r.a+'-'+r.b+':'+(r.sec||'')).join('|')}catch(e){return''}}
function nodeJoints(force){
 const sig=jointsSig();
 if(!force&&calc.joints&&calc.jointsSig===sig)return calc.joints;
 const joints=new Map(),ANG=(u,w)=>Math.acos(clamp(u[0]*w[0]+u[1]*w[1]+u[2]*w[2],-1,1))*CUTD;
 M.nodes.forEach((n,nid)=>{
  const ends=[],thru=[];
  M.rods.forEach(r=>{
   const a=M.nodes.get(r.a),b=M.nodes.get(r.b);if(!a||!b)return;
   if(r.a===nid)ends.push({r,atA:true,v:cutN(cutV(a.p,b.p)),E:cutEndData(r,true)});
   else if(r.b===nid)ends.push({r,atA:false,v:cutN(cutV(b.p,a.p)),E:cutEndData(r,false)});
   else{const th=(n.host&&n.host.rod===r.id)||(n.hosts||[]).some(h=>h&&h.rod===r.id);
    if(th){const d=cutN(cutV(a.p,b.p));if(d)thru.push({r,d,neg:[-d[0],-d[1],-d[2]]})}}});
  /* кандидаты направлений ОТ узла наружу: концы + обе стороны проходных */
  const dirs=[];
  ends.forEach((e,i)=>{if(e.v)dirs.push({i,d:e.v})});
  thru.forEach(t=>{dirs.push({d:t.d,t});dirs.push({d:t.neg,t})});
  let pair=null;
  for(let i=0;i<dirs.length&&!pair;i++)for(let j=i+1;j<dirs.length;j++)
   if(ANG(dirs[i].d,dirs[j].d)>155){pair=[dirs[i],dirs[j]];break}
  const rid=x=>x.t?x.t.r.id:ends[x.i].r.id;
  let cls='corner',main=null,nB=0;
  if(n.type==='support')cls='support';
  else if(!ends.length&&!thru.length)cls='empty';
  else if(pair){
   const pr=new Set(pair.map(rid));
   const mainR=[...pr].map(id=>M.rods.get(id)).filter(Boolean)
    .reduce((x,y)=>!x||rodSec(y).mass_kg_m>rodSec(x).mass_kg_m?y:x,null);
   if(mainR)main={id:mainR.id,name:mainR.name};
   const br=new Set([...ends.map(e=>e.r.id),...thru.map(t=>t.r.id)].filter(id=>!pr.has(id)));
   nB=br.size;
   if(nB===0)cls='pass';
   else if(nB===1)cls='T';
   else if(nB===2){
    const rep=[...ends.filter(e=>br.has(e.r.id)).map(e=>e.v),
               ...thru.filter(t=>br.has(t.r.id)).map(t=>t.d)];
    cls=(rep.length>1&&ANG(rep[0],rep[1])>155)?'X':'K'}
   else cls='N'}
  else if(ends.length+thru.length===1)cls='free';
  const members=[...ends.map(e=>({r:e.r,atA:e.atA,thru:false,E:e.E})),
   ...thru.map(t=>({r:t.r,atA:null,thru:true,E:{kind:'pass',txt:'без запила (проходной)',e:0,weld:false,groupKey:'pass'}}))];
  joints.set(nid,{id:nid,nid,name:n.name||nid,p:{x:n.p.x,y:n.p.y,z:n.p.z},type:n.type,
   cls,clsTxt:JCLS[cls]||cls,main,nBranch:nB,members,
   ends:members.filter(m2=>!m2.thru),thru:members.filter(m2=>m2.thru),warn:[]})});
 calc.joints=joints;calc.jointsSig=sig;
 return joints}
/* ---------- Шаг 4 (docs/FABRICATION.md 4.3-4.4): план поэтапной сборки и проверки --
   assemblyPlan() -> {stages, issues}. Этапы по отраслевой последовательности
   (FABRICATION 2.1): столбы -> нижний пояс -> стойки -> верхний пояс -> прогоны -> укосины.
   Проверки: (1) "висит в воздухе" - жадная поэтапная установка: деталь ставится, если хотя бы
   один её конец соединён с уже установленным; (2) коллизии тел - segClosest по не-соседним
   стержням, тиры по вписанной/описанной полуокружности сечения; (3) углы укосин 30-60
   (EC3/CIDECT) и двойной индивидуальный запил; (4) пересечение тел в узле - детали не
   запилены друг к другу (gap >= t1+t2 или нахлест >=25%, либо взаимный запил по биссектрисе). */
const ASM_STAGES=[
 {n:1,txt:'Установка столбов: опоры (анкеры) и колонны',types:['column']},
 {n:2,txt:'Нижний пояс: запил концов, приварка к столбам',types:['bottom']},
 {n:3,txt:'Стойки к нижнему поясу',types:['post']},
 {n:4,txt:'Верхний пояс (стропила)',types:['top']},
 {n:5,txt:'Прогоны и связи каркаса',types:['purlin','custom']},
 {n:6,txt:'Укосины: раскосы, опорные раскосы, связи',types:['diag','sdiag','brace']}];
function stageOf(r){const s=ASM_STAGES.find(s=>s.types.includes(r.type));return s?s.n:5}
function planSig(){return jointsSig()+'|'+[...M.rods.values()].map(r=>r.id+':'+r.type).join(',')}
function assemblyPlan(force){
 const sig=planSig();
 if(!force&&calc.plan&&calc.planSig===sig)return calc.plan;
 const J=nodeJoints();
 const rods=[...M.rods.values()].filter(r=>M.nodes.get(r.a)&&M.nodes.get(r.b));
 const stage=new Map(rods.map(r=>[r.id,stageOf(r)]));
 const stages=ASM_STAGES.map(s=>({...s,rods:rods.filter(r=>stage.get(r.id)===s.n)}));
 const issues=[];
 const add=(sev,code,txt,rdls,st)=>issues.push({sev,code,txt,
  rods:(rdls||[]).map(x=>typeof x==='string'?x:x.name),stage:(st==null?null:st)});
 /* --- (1) Поэтапная установка: деталь не должна "висеть в воздухе" --- */
 const instR=new Set(),instN=new Set();
 M.nodes.forEach((n,id)=>{if(n.type==='support')instN.add(id)});
 const touch=nid=>{if(instN.has(nid))return true;
  const n=M.nodes.get(nid);if(!n)return false;
  if(n.host&&instR.has(n.host.rod))return true;
  if((n.hosts||[]).some(h=>h&&instR.has(h.rod)))return true;
  for(const id of instR){const o=M.rods.get(id);if(o&&(o.a===nid||o.b===nid))return true}
  return false};
 for(const s of stages){
  let pend=s.rods.slice(),moved=true;
  while(moved){moved=false;
   for(let i=0;i<pend.length;i++){const r=pend[i];
    if(touch(r.a)||touch(r.b)){instR.add(r.id);instN.add(r.a);instN.add(r.b);
     pend.splice(i,1);i--;moved=true}}}
  pend.forEach(r=>add('err','float','Этап '+s.n+': '+r.name+
   ' не опирается ни на один установленный ранее элемент — висит в воздухе',[r],s.n))}
 if(calc.res&&typeof calc.res.err==='string'&&/без опоры/i.test(calc.res.err))
  add('err','float','Расчёт: '+calc.res.err,[],null);
 /* --- (2) Коллизии тел: не-соседние стержни (без общего узла и посадок на оси) --- */
 const connected=(A,B)=>{const ids=[A.a,A.b];
  if(ids.includes(B.a)||ids.includes(B.b))return true;
  for(const nid of ids){const n=M.nodes.get(nid);if(!n)continue;
   if(n.host&&n.host.rod===B.id)return true;
   if((n.hosts||[]).some(h=>h&&h.rod===B.id))return true}
  for(const nid of [B.a,B.b]){const n=M.nodes.get(nid);if(!n)continue;
   if(n.host&&n.host.rod===A.id)return true;
   if((n.hosts||[]).some(h=>h&&h.rod===A.id))return true}
  /* узел, посаженный на ОБЕ оси (инструмент X / авто-фикс) — легитимный стык:
     пересечение осей в этом узле не коллизия тел */
  for(const n of M.nodes.values()){const hs=n.hosts||[];
   if(hs.some(h=>h&&h.rod===A.id)&&hs.some(h=>h&&h.rod===B.id))return true}
  return false};
 const secRad=r=>{const s=rodSec(r);return s};
 for(let i=0;i<rods.length;i++)for(let j=i+1;j<rods.length;j++){
  const A=rods[i],B=rods[j];
  if(connected(A,B))continue;
  const a1=M.nodes.get(A.a),a2=M.nodes.get(A.b),b1=M.nodes.get(B.a),b2=M.nodes.get(B.b);
  const s=segClosest(a1.p,a2.p,b1.p,b2.p);if(!s)continue;
  const sa=secRad(A),sb=secRad(B);
  const rInA=Math.min(sa.b_mm||60,sa.h_mm||60)/2,rInB=Math.min(sb.b_mm||60,sb.h_mm||60)/2;
  const rOutA=Math.hypot(sa.b_mm||60,sa.h_mm||60)/2,rOutB=Math.hypot(sb.b_mm||60,sb.h_mm||60)/2;
  const st=Math.max(stage.get(A.id),stage.get(B.id));
  const nm='«'+A.name+'» × «'+B.name+'»';
  const isBracePair=['diag','sdiag','brace'].includes(A.type)&&['diag','sdiag','brace'].includes(B.type);
  const mid=s.t>.05&&s.t<.95&&s.u>.05&&s.u<.95;
  const near=s.t<.02||s.t>.98||s.u<.02||s.u>.98;
  if(s.dd<rInA+rInB){add('err','collide','Этап '+st+': '+nm+
   ' — тела пересекаются (оси в '+Math.round(s.dd)+' мм при сумме вписанных '+Math.round(rInA+rInB)+' мм)'+
   (mid?' — пересечение в чистом поле без узла: посадите узел на пересечении (инструмент X) либо разнесите оси (нахлёст)':
    isBracePair?' — укосины конфликтуют, измените угол/положение':
    near?' — посадите узел на пересечении (инструмент X)':''),[A,B],st);continue}
  if(s.dd<rOutA+rOutB)add('warn','tight','Этап '+st+': '+nm+
   ' — вплотную (оси в '+Math.round(s.dd)+' мм, габариты до '+Math.round(rOutA+rOutB)+' мм)',[A,B],st)}
 /* --- (3) Углы укосин 30-60 и двойной запил --- */
 const braceTypes=['diag','sdiag','brace'];
 rods.filter(r=>braceTypes.includes(r.type)).forEach(r=>{
  const A=cutEndData(r,true),B=cutEndData(r,false);
  [[A,true],[B,false]].forEach(([c,atA])=>{
   if(c.al!=null&&c.main&&(c.al<30||c.al>60))
    add('warn','angle','Этап '+stage.get(r.id)+': «'+r.name+'» — угол '+
     Math.round(c.al)+'° к «'+c.main.name+'» (вне 30–60°, EC3/CIDECT); '+
     'рекомендуется подогнать точку крепления/угол под 45° для одинаковых запилов',[r],stage.get(r.id))});
  if(A.kind==='miter'&&B.kind==='miter'&&Math.abs(A.angle-B.angle)>2)
   add('warn','dbl','Этап '+stage.get(r.id)+': «'+r.name+'» — двойной индивидуальный запил: концы '+
    Math.round(A.angle)+'° и '+Math.round(B.angle)+'°; рассмотрите смену угла раскоса, чтобы оба конца были одинаковыми',[r],stage.get(r.id))});
 /* --- (4) Пересечение тел в узле: детали не запилены друг к другу ---
    Модель материала конца — как в buildFullModel: miter плоскостью через узел
    (вынос -e..L), T/nest обрезаны на min(e,.45L) с обоих концов (trim),
    flat — 0..L. Точки тела сканируются по осям e2/e3 (углы и центр). */
 const frame=(jn,m)=>{const o=M.nodes.get(m.r.a===jn.id?m.r.b:m.r.a);if(!o)return null;
  const u=cutN(cutV(o.p,jn.p));if(!u)return null;
  let e2=cutN([-u[1],u[0],0]);if(!e2)e2=[1,0,0];
  const e3=cutN([u[1]*e2[2]-u[2]*e2[1],u[2]*e2[0]-u[0]*e2[2],u[0]*e2[1]-u[1]*e2[0]])||[0,0,0];
  const sec=rodSec(m.r),L=Math.hypot(...cutV(jn.p,o.p));
  const trim=(m.E.kind==='T'||m.E.kind==='nest')?Math.min(m.E.e||0,L*0.45):0;
  const t0=(m.E.kind==='miter')?-(m.E.e||0):trim;
  return{u,e2,e3,sec,L,t0,t1:L-trim,e:(m.E.kind==='miter')?(m.E.e||0):0,n:m.E.n||null,
   id:m.r.id,name:m.r.name}};
 const inBox=(p,Y)=>{const t=p[0]*Y.u[0]+p[1]*Y.u[1]+p[2]*Y.u[2];
  if(t<Y.t0-1||t>Y.t1+1)return false;
  /* грань реза: материал строго ПОЗАДИ плоскости с запасом 0.5 мм —
     соприкосновение запиленных граней не считается пересечением */
  if(Y.n&&(p[0]*Y.n[0]+p[1]*Y.n[1]+p[2]*Y.n[2])>-0.5)return false;
  const al=p[0]*Y.e2[0]+p[1]*Y.e2[1]+p[2]*Y.e2[2];
  const be=p[0]*Y.e3[0]+p[1]*Y.e3[1]+p[2]*Y.e3[2];
  return Math.abs(al)<=(Y.sec.b_mm||60)/2-0.5&&Math.abs(be)<=(Y.sec.h_mm||60)/2-0.5};
 const overlap=(X,Y)=>{const rX=Math.hypot(X.sec.b_mm||60,X.sec.h_mm||60)/2,
  rY=Math.hypot(Y.sec.b_mm||60,Y.sec.h_mm||60)/2;
  const T=Math.min(X.L,3*(rX+rY)),step=Math.max(Math.min(rX,rY)/2,1);
  const inOwn=(p,P)=>!P.n||(p[0]*P.n[0]+p[1]*P.n[1]+p[2]*P.n[2])<=-0.5;
  const scan=(P,Q)=>{for(let t=P.t0;t<=Math.min(T,P.t1)+1e-6;t+=step)
   for(const al of[-1,0,1])for(const be of[-1,0,1]){
    const p=[0,1,2].map(k=>t*P.u[k]+al*((P.sec.b_mm||60)/2)*P.e2[k]+be*((P.sec.h_mm||60)/2)*P.e3[k]);
    if(!inOwn(p,P))continue; /* не брать материал, вырезанный СОБСТВЕННЫМ запилом */
    if(inBox(p,Q))return true}
   return false};
  return scan(X,Y)||scan(Y,X)};
 J.forEach(j=>{
  const jn=M.nodes.get(j.nid);if(!jn)return;
  const cands=j.members.filter(m=>!m.thru&&['miter','T','nest','flat'].includes(m.E.kind));
  if(cands.length<2)return;
  const fr=new Map();cands.forEach(m=>{const f=frame(jn,m);if(f)fr.set(m.r.id,f)});
  const hitPairs=[];
  for(let i=0;i<cands.length;i++)for(let k=i+1;k<cands.length;k++){
   const ma=cands[i],mb=cands[k];
   /* взаимный запил (каждый срезан по плоскости соседа) — сидят вплотную, не пересекаются */
   if(ma.E.main&&ma.E.main.id===mb.r.id&&mb.E.main&&mb.E.main.id===ma.r.id)continue;
   const fa=fr.get(ma.r.id),fb=fr.get(mb.r.id);
   if(!fa||!fb)continue;
   if(overlap(fa,fb))hitPairs.push([ma,mb])}
  if(!hitPairs.length)return;
  const tsum=Math.round((rodSec(hitPairs[0][0].r).t_mm||4)+(rodSec(hitPairs[0][1].r).t_mm||4));
  const clsHint=(j.cls==='K'||j.cls==='X'||j.cls==='N')?
   ' gap-узел: разнесите раскосы (зазор ≥ t₁+t₂ = '+tsum+' мм) либо нахлёст ≥25%':
   ' для углового/опорного узла — взаимный запил по биссектрисе либо разнесите узлы';
  const names=[...new Set(hitPairs.flatMap(p=>[p[0].r.name,p[1].r.name]))];
  add('warn','nodefit','Узел «'+j.name+'» ('+j.clsTxt+'): тела не запилены друг к другу — '+
   hitPairs.map(p=>'«'+p[0].r.name+'»×«'+p[1].r.name+'»').join(', ')+clsHint,names,null)});
 const plan={stages,issues,sig};
 calc.plan=plan;calc.planSig=sig;
 return plan}
/* Блок проверок сборки (общий для модалки раскроя и модалки отчёта):
   ошибки — всегда, предупреждения — свёрнутым <details> (FABRICATION §4.7). */
function apIssuesHTML(){
 const AP=(typeof assemblyPlan==='function')?assemblyPlan():{issues:[]};
 const aErrs=AP.issues.filter(is=>is.sev==='err'),aWarns=AP.issues.filter(is=>is.sev!=='err');
 const ACODE={float:'висит в воздухе',collide:'коллизии тел',tight:'вплотную',
  angle:'угол раскоса вне 30–60° (EC3/CIDECT)',dbl:'двойной индивидуальный запил',
  nodefit:'тела в узле не запилены друг к другу'};
 if(!AP.issues.length)return`<div class="hint2" style="border-left:3px solid #7fe8b8;padding:4px 8px;margin:4px 0">Проверки сборки: <b style="color:#7fe8b8">ошибок нет ✓</b></div>`;
 return`<div class="hint2" style="border-left:3px solid ${aErrs.length?'#ff5470':'#ffb020'};padding:4px 8px;margin:4px 0">
 <b>Проверки сборки: ${aErrs.length} ошиб. • ${aWarns.length} предупр.</b>
 ${aErrs.map(is=>`<div style="color:#ff5470">✖ ${esc(is.txt)}</div>`).join('')}
 <details style="margin-top:2px"><summary style="cursor:pointer">⚠ Показать предупреждения (${aWarns.length})</summary>
 ${aWarns.map(is=>`<div>⚠ [${esc(ACODE[is.code]||is.code)}] ${esc(is.txt)}</div>`).join('')}
 </details></div>`}
/* ---------- авто-решение ошибок конструкции (галочка в модалке отчёта) ----------
   Исправляется автоматически (по образцу инструмента «X», 30-xnodes):
     collide — посадка узла на пересечении осей (mid) либо конца стержня на ось
               соседа — в пределах HOST_TOL;
     float   — посадка «висящего» конца на ближайший стержень того же или более
               раннего этапа — в пределах HOST_TOL.
   Нерешаемое (углы 30–60, «вплотную», расчёт без опоры, посадки вне допуска)
   остаётся и показывается диалогом autoFixFlow. После правок проверки и расчёт
   пересчитываются принудительно: хосты не входят в planSig/jointsSig. */
function autoFixConstruction(){
 const errs0=assemblyPlan(true).issues.filter(i=>i.sev==='err');
 if(!errs0.length)return{nFixed:0,remaining:[],actions:'ничего не требовалось',changed:false};
 const rods=[...M.rods.values()];
 const byName=new Map(rods.map(r=>[r.name,r]));
 const TOL=HOST_TOL();
 let created=0,hosted=0,undoPushed=false;
 const push1=()=>{if(!undoPushed){pushUndo();undoPushed=true}};
 const fixCollide=(A,B)=>{
  const a1=M.nodes.get(A.a),a2=M.nodes.get(A.b),b1=M.nodes.get(B.a),b2=M.nodes.get(B.b);
  if(!a1||!a2||!b1||!b2)return false;
  const s=segClosest(a1.p,a2.p,b1.p,b2.p);if(!s)return false;
  const mid=s.t>.02&&s.t<.98&&s.u>.02&&s.u<.98;
  if(mid){
   if(s.dd/2>TOL)return false; /* узел не сел бы на оси (допуск HOST_TOL) */
   const p=s.pa.clone().add(s.pb).multiplyScalar(.5);
   let n=findNodeAt(p,TOL*.6);
   push1();
   if(!n){n={id:uid(),p:p.clone(),type:'node',name:'Узел-'+(++M.counters.n),hosts:[],host:null};
    M.nodes.set(n.id,n);bornIds.add(n.id);created++}
   if(hostNodeOn(n,A))hosted++;
   if(hostNodeOn(n,B))hosted++;
   attachNodeToRods(n);return true}
  if(s.t<.02||s.t>.98){const nE=s.t<.02?a1:a2;
   if(nE.type!=='support'&&hostNodeOn(nE,B)){push1();hosted++;attachNodeToRods(nE);return true}}
  if(s.u<.02||s.u>.98){const nE=s.u<.02?b1:b2;
   if(nE.type!=='support'&&hostNodeOn(nE,A)){push1();hosted++;attachNodeToRods(nE);return true}}
  return false};
 const fixFloat=R=>{
  const st=stageOf(R);let ok=false;
  for(const nid of[R.a,R.b]){
   const n=M.nodes.get(nid);if(!n||n.type==='support')continue;
   let best=null,bd=Infinity;
   for(const O of rods){if(O.id===R.id||stageOf(O)>st)continue;
    const oa=M.nodes.get(O.a),ob=M.nodes.get(O.b);if(!oa||!ob)continue;
    const s=segClosest(n.p,n.p,oa.p,ob.p);if(!s)continue;
    if(s.dd<bd){bd=s.dd;best=O}}
   if(best&&bd<=TOL&&hostNodeOn(n,best)){push1();hosted++;attachNodeToRods(n);ok=true}}
  return ok};
 errs0.forEach(is=>{
  if(is.code==='collide'&&is.rods.length>=2){
   const A=byName.get(is.rods[0]),B=byName.get(is.rods[1]);
   if(A&&B)fixCollide(A,B)}
  else if(is.code==='float'&&is.rods.length){
   const R=byName.get(is.rods[0]);if(R)fixFloat(R)}});
 const changed=undoPushed;
 if(changed){afterChange();nodeJoints(true);runCalc()}
 const errs1=assemblyPlan(true).issues.filter(i=>i.sev==='err');
 return{nFixed:Math.max(0,errs0.length-errs1.length),remaining:errs1,
  actions:'создано узлов '+created+', посадок '+hosted,changed}}
/* Оболочка авто-исправления: применяет fix; если ошибки остались — диалог с
   выбором «Продолжить с ошибками» / «Отменить исправления». Возвращает true,
   если диалог показан: модалка отчёта открывается заново колбэком onAfter. */
function autoFixFlow(onAfter){
 let res;
 try{res=autoFixConstruction()}
 catch(e){console.error('autoFix',e);toast('Авто-исправление не выполнено: '+(e&&e.message||e),{type:'err'});return false}
 if(!res.remaining.length){
  toast(res.nFixed?'Авто-исправление ('+res.actions+'): ошибок больше нет':'Ошибок конструкции нет — исправлять нечего',
   {type:'ok',timeout:4500});
  return false}
 const acts=[{label:'Продолжить с ошибками',primary:true,keep:true,
  fn:()=>{closeModal();onAfter&&onAfter()}}];
 if(res.changed)acts.unshift({label:'Отменить исправления',warn:true,keep:true,
  fn:()=>{undo();nodeJoints(true);runCalc();closeModal();onAfter&&onAfter()}});
 const list=res.remaining.slice(0,8).map(is=>`<div style="color:#ff5470">✖ ${esc(is.txt)}</div>`).join('')
  +(res.remaining.length>8?`<div class="hint2">… и ещё ${res.remaining.length-8}</div>`:'');
 openModal('Авто-решение ошибок — не всё исправлено',
  `<div class="hint2">Исправлено: <b>${res.nFixed}</b> из ${res.nFixed+res.remaining.length} (${esc(res.actions)}). Осталось (${res.remaining.length}):</div>${list}
   <div class="hint2">Можно продолжить составление отчёта — эти ошибки останутся в проверках, либо отменить исправления (вернётся исходная модель). Крестиком — закрыть, исправления останутся.</div>`,acts);
 return true}
/* Единый группировщик раскроя (шаг 5, FABRICATION §4.5): одинаковые детали
   внутри сечения (ключ: Ls, запил A, запил B) → позиции Д-n со сквозной
   нумерацией. Одна логика для модалки (openCutModal) и отчёта (31-report:
   чертежи запилов) — номера позиций совпадают во всех разделах. */
function cutGroups(){const pl=cutPlan(),bySec=new Map();
 pl.forEach(it=>{const a=bySec.get(it.sec.id)||{sec:it.sec,items:[]};a.items.push(it);bySec.set(it.sec.id,a)});
 const grs=[...bySec.values()].map(gr=>{const items=gr.items.slice().sort((x,y)=>y.Ls-x.Ls);
  const bin=Math.round((gr.sec.sell_len_m||12)*1000),bins=[];
  items.forEach(it=>{let placed=false;
   for(let i=0;i<bins.length;i++)if(bins[i]>=it.Ls){bins[i]-=it.Ls;placed=true;break}
   if(!placed)bins.push(bin-it.Ls)});
  const total=items.reduce((s,i2)=>s+i2.Ls,0),stockLen=bins.length*bin;
  const gmap=new Map();
  items.forEach(it=>{const k=it.Ls+'|'+it.A.txt+'|'+Math.round(it.A.e)+'|'+it.B.txt+'|'+Math.round(it.B.e);
   const g2=gmap.get(k)||{La:it.La,Ls:it.Ls,A:it.A,B:it.B,parts:[]};
   g2.parts.push(it.r.name);gmap.set(k,g2)});
  const groups=[...gmap.values()].sort((x,y)=>y.Ls-x.Ls);
  return{sec:gr.sec,items,groups,nStock:bins.length,util:stockLen?total/stockLen:0,total,
   mass:(gr.sec.mass_kg_m||0)*stockLen/1000,cost:(gr.sec.price_rub_m||0)*stockLen/1000}}).sort((a,b)=>b.total-a.total);
 let posNo=0;grs.forEach(g2=>g2.groups.forEach(gp=>{gp.pos='Д-'+(++posNo)}));
 return{pl,grs,nPos:posNo}}
function openCutModal(){const {pl,grs,nPos}=cutGroups();
let csv='Сечение;Поз;Кол-во;Детали;L ось мм;+запил A;+запил B;L заготовок мм;Запил A;Запил B\n';
const ex=pl.find(it=>/запил \d/.test(it.A.txt+it.B.txt));
const sgn=v=>(v>0?'+':'')+Math.round(v);
const exH=ex?`Пример ${esc(ex.r.name)}: А «${esc(ex.A.txt)}» ${sgn(endLenAdd(ex.A))} мм, Б «${esc(ex.B.txt)}» ${sgn(endLenAdd(ex.B))} мм → заготовок ${ex.Ls} мм (ось ${ex.La} мм)`:
 'Пример: угол 90° → запилам 45°; заготовок = ось + (h/2)·ctg(α/2) с обоих концов';
const rows=grs.map(g2=>{
 const posRows=g2.groups.map(gp=>{const pos=gp.pos;
  const vA=endLenAdd(gp.A),vB=endLenAdd(gp.B),sA=(vA>0?'+':'')+vA,sB=(vB>0?'+':'')+vB;
  csv+=`"${g2.sec.name}";${pos};${gp.parts.length};"${gp.parts.join(', ')}";${gp.La};${vA};${vB};${gp.Ls};"${gp.A.txt}";"${gp.B.txt}"\n`;
  return`<tr><td class="mono"><b>${pos}</b></td><td class="mono"><b>${gp.parts.length}</b></td><td>${esc(gp.parts.join(', '))}</td><td class="mono">${gp.La}</td><td class="mono">${sA}</td><td class="mono">${sB}</td><td class="mono"><b>${gp.Ls}</b></td><td class="mono dim2">${esc(gp.A.txt)} • ${esc(gp.B.txt)}</td></tr>`}).join('');
 return`<tr class="grp"><td colspan="8"><b>${esc(g2.sec.name)}</b> — ${g2.groups.length} поз. / ${g2.items.length} дет. • ${g2.nStock} штаб × ${g2.sec.sell_len_m||12} м • утил. ${(g2.util*100).toFixed(0)}% • ${g2.mass.toFixed(0)} кг • ${Math.round(g2.cost).toLocaleString('ru')} ₽</td></tr>`+posRows}).join('');
const mass=grs.reduce((s,g2)=>s+g2.mass,0),cost=grs.reduce((s,g2)=>s+g2.cost,0),
 totL=grs.reduce((s,g2)=>s+g2.total,0),stockL=grs.reduce((s,g2)=>s+g2.nStock*Math.round((g2.sec.sell_len_m||12)*1000),0);
/* Шаг 4 (docs/FABRICATION.md §4.7): предупреждения проверок сборки — в начало
   модалки; общий блок apIssuesHTML (тот же, что в модалке отчёта). */
const AP=(typeof assemblyPlan==='function')?assemblyPlan():{issues:[]};
/* сжатый план сборки в модалке (FABRICATION §4.7) — полный в HTML-отчёте */
const planShort=AP.stages?AP.stages.map(s=>`${s.n}. ${s.txt.split(':')[0]} (${s.rods.length})`).join(' → '):'';
openModal('РАСКРОЙ — резы и запилы по биссектрисе',
`${apIssuesHTML()}${planShort?`<div class="hint2"><b>План сборки:</b> ${planShort}</div>`:''}<div class="hint2">Длина заготовки = длина осей + выносы запилов (у Т-подреза/вложения вынос ВЫЧИТАЕТСЯ — конец впритык к стенке либо вложен в полость и не доходит до оси на e; см. 3D-модель). Правила: опора — торец под 90°; проходной стык (угол &gt; 155°) — без запила; угловой стык — запил по биссектрисе: 90°→45°, угол α→θ=90°−α/2, вынос ≈ (h/2)·ctg(α/2) с проекцией по ширине стенки; T-стык — основной стержень целый, ветвь режется (подрез по коробу основного: впритык к стенке либо вложение в полость). Одинаковые детали (одно сечение, длина и оба запила) сгруппированы в одну позицию Д-n.</div>
<div class="kv"><span>Пример расчёта</span><b style="font-size:11px">${exH}</b></div>
<table class="calcTab wide"><tr><th>поз</th><th>кол</th><th>детали</th><th>L ось</th><th>+A</th><th>+B</th><th>L загот</th><th>запилы (A • Б)</th></tr>${rows}</table>
<div class="kv"><span>Позиций раскроя / деталей</span><b>${nPos} / ${pl.length}</b></div>
<div class="kv"><span>Длина заготовок (с запилами)</span><b>${(totL/1000).toFixed(1)} м</b></div>
<div class="kv"><span>В мерном прокате (${grs.reduce((s,g2)=>s+g2.nStock,0)} шт)</span><b>${(stockL/1000).toFixed(1)} м • отход ${stockL?(100-totL/stockL*100).toFixed(0):0}%</b></div>
<div class="kv"><span>Сталь в покупке (с отходами)</span><b>${mass.toFixed(0)} кг</b></div>
<div class="kv"><span>Ориентировочная стоимость металла</span><b>${Math.round(cost).toLocaleString('ru')} ₽</b></div>`,
[{label:'Копировать CSV',keep:true,fn:()=>navigator.clipboard.writeText(csv).then(()=>toast('CSV скопирован',{type:'ok'}))},{label:'Закрыть',fn:closeModal}]);
$('#modalCard').classList.add('wide')}
/* ---------- report ---------- */
/* Отчёт: авто-решение ошибок (галочка в модалке, при необходимости диалог)
   выполняется ДО открытия модалки; reportModalOpen — непосредственно модалка
   (снимки, проверки, модель со всеми запилами для скачивания OBJ/STL).
   skipAutoFix — рекурсивный вызов после авто-исправления, чтобы не зациклиться. */
function openReportModal(skipAutoFix){
 if(!calc.res){toast('Сначала выполните РАСЧЁТ в режиме «Нагрузки»',{type:'warn'});setAppMode('loads');return}
 if(calc.sig!==rodSig()){runCalc();if(!calc.res)return}
 if(!skipAutoFix&&localStorage.getItem('fc.autofix')==='1'&&
    assemblyPlan().issues.some(i=>i.sev==='err')){
  const dlg=autoFixFlow(()=>openReportModal(true));
  if(!dlg)reportModalOpen();
  return}
 reportModalOpen()}
function reportModalOpen(){
 const shots=(typeof captureShots==='function')?captureShots():[];
 const R=calc.res,l=calc.loads;
 const top=[...R.res].sort((a,b)=>b.ur-a.ur).slice(0,12);
 /* модель со всеми запилами создаётся при составлении отчёта — кнопки ниже */
 let modelParts=null;
 if(typeof cutModelParts==='function')try{modelParts=cutModelParts()}catch(e){console.error('cutModelParts',e)}
 const autoOn=localStorage.getItem('fc.autofix')==='1';
 openModal('ОТЧЁТ ПО КАРКАСУ',
 `<div class="hint2">«${esc($('#projName').value)}» • ${M.nodes.size} узлов / ${M.rods.size} стержней • стержневая КЭ модель (6 DOF/узел) • нагрузки СП 20.13330, проверки СП 16.13330 (упрощённая φ по λ)</div>
 <div id="repIssues">${apIssuesHTML()}</div>
 <label class="ck"><input type="checkbox" id="ckAutoFix" ${autoOn?'checked':''}> Авто-решение ошибок конструкции (посадка узлов на пересечениях, соединения) — при необходимости диалог</label>
 <div class="kv"><span>Нагрузки</span><b>${l.dead?'собств. вес • ':''}${l.snow?'снег р.'+l.snowRegion+' γf='+GF_SNOW[l.snowRegion]+' • ':''}${l.wind?'ветер р.'+l.windRegion+' м.'+l.terrain+' • ':''}${l.live?'эксплуат. 0.4 кПа + 1 кН • ':''}множитель ×${calc.factor}</b></div>
 <div class="kv"><span>Итог</span><b style="color:${R.maxUR>1?'#ff7a6a':'#7fe8b8'}">UR max ${R.maxUR.toFixed(2)} (${esc(R.urRod)})${R.maxUR>1?' — ПЕРЕГРУЗ':''} • прогиб max ${R.maxD.toFixed(1)} мм (${esc(R.dRod)})</b></div>
 <div class="kv"><span>Сталь / металл</span><b>${R.mass.toFixed(0)} кг • ${Math.round(R.cost).toLocaleString('ru')} ₽</b></div>
 <div class="kv"><span>Модель со всеми запилами</span><b>${modelParts?modelParts.length+' сегм. • '+modelParts.reduce((s2,p)=>s2+p.tris.length/9,0)+' тр. • OBJ / STL ниже':'не создана (нет 32-meshexport.js)'}</b></div>
 ${shots.length?`<div class="psect">СХЕМЫ (превью)</div><div class="shotPrev">${shots.map(s=>`<figure><img src="${s.data}" alt="${esc(s.t)}"/><figcaption>${esc(s.t)}</figcaption></figure>`).join('')}</div>`:''}
 <div class="psect">НАИБОЛЕЕ ЗАГРУЖЕННЫЕ СТЕРЖНИ</div>
 <table class="calcTab"><tr><th>стержень</th><th>сечение</th><th>N сж, кН</th><th>M, кН·м</th><th>UR</th><th>f, мм</th></tr>
 ${top.map(r=>`<tr class="${r.ur>1?'bad':r.ur>.9?'warn2':''}"><td>${esc(r.name)}</td><td>${esc(r.secName)}</td><td>${(r.Ncomp/1000).toFixed(1)}</td><td>${(r.Mmax/1e6).toFixed(1)}</td><td><b>${r.ur.toFixed(2)}</b></td><td>${r.defl.toFixed(1)}</td></tr>`).join('')}</table>
 <div class="psect">ОПОРНЫЕ РЕАКЦИИ, кН</div>
 <table class="calcTab"><tr><th>опора</th><th>R</th><th>X</th><th>Y</th><th>Z</th></tr>
 ${R.reactArr.map(r=>`<tr><td>${esc(r.name)}</td><td><b>${r.F.toFixed(1)}</b></td><td>${r.fx.toFixed(1)}</td><td>${r.fy.toFixed(1)}</td><td>${r.fz.toFixed(1)}</td></tr>`).join('')}</table>
 <div class="hint2">В HTML-отчёт войдут: 5 видовых схем (включая деформированную), схемы балок с прогибами и N, схемы раскроя по штабам мерного проката (с группировкой одинаковых деталей), схемы стыковки узлов и план поэтапной сборки с проверками (коллизии, углы, «висит в воздухе»), смета, реакции, состав сечений, методика, <b>отказ от ответственности</b>. Автор: DENstis • <a href="mailto:Denstis@gmail.com">Denstis@gmail.com</a>.</div>
 <div class="hint2">Кнопками ниже скачивается <b>модель со всеми запилами</b> (miter по биссектрисе, T-подрезы, вложения): OBJ — для CAD/BIM, STL — для 3D-просмотра/печати; единицы мм, Z вверх.</div>`,
 [{label:'Скачать HTML-отчёт',keep:true,fn:()=>{const html=(typeof buildReportHTML==='function')?buildReportHTML(shots):null;
   if(!html){toast('Модуль отчёта не загружен (31-report.js)',{type:'err'});return}
   const blob=new Blob([html],{type:'text/html;charset=utf-8'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='roof-report.html';a.click();toast('Отчёт сохранён — со схемами, раскроем и сметой',{type:'ok',timeout:5000})}},
  {label:'Скачать OBJ (запилы)',keep:true,fn:()=>{
   if(!modelParts){toast('Модуль экспорта не загружен (32-meshexport.js)',{type:'err'});return}
   exportCutModel('OBJ',modelParts)}},
  {label:'Скачать STL (запилы)',keep:true,fn:()=>{
   if(!modelParts){toast('Модуль экспорта не загружен (32-meshexport.js)',{type:'err'});return}
   exportCutModel('STL',modelParts)}},
  {label:'Закрыть',fn:closeModal}]);$('#modalCard').classList.add('wide');
 /* галочка авто-решения: включение сразу применяет исправления (диалог — при
    необходимости), затем модалка обновляется со свежими проверками */
 const ck=$('#ckAutoFix');
 if(ck)ck.onchange=e=>{
  localStorage.setItem('fc.autofix',e.target.checked?'1':'');
  if(!e.target.checked)return;
  if(!assemblyPlan().issues.some(i=>i.sev==='err')){toast('Ошибок конструкции нет — исправлять нечего',{type:'ok'});return}
  const dlg=autoFixFlow(()=>openReportModal(true));
  if(!dlg)openReportModal(true)}}
/* boot wiring */
window.addEventListener('load',()=>{
 ['#tabModel','#tabLoads','#tabCut','#tabReport'].forEach((id,i)=>{const b=$(id);if(b)b.onclick=()=>setAppMode(['model','loads','cut','report'][i])});
});
