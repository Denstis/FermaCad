/* ==================== PICKING & SNAP: raycast picking, plan/3D snapping ==================== */
'use strict';
/* ================= PICKING & SNAP ================= */
function pickAt(cx,cy,opts={}){ray.setFromCamera(ndc(cx,cy),activeCam());
 const cn=ctxNodeIds(),cr=ctxRodIds();
 let list=[];
 const kinds=opts.kinds||['node','rod','plane'];
 if(kinds.includes('node'))list=list.concat(pickNodes.filter(p=>{const id=p.userData.id;return!M.hidden.has('n'+id)&&(mode!=='plan'||cn.has(id))}));
 if(kinds.includes('rod'))list=list.concat(pickRods.filter(p=>{const id=p.userData.id;return!M.hidden.has('r'+id)&&(mode!=='plan'||cr.has(id))}));
 if(kinds.includes('plane')&&mode==='3d')list=list.concat(pickPlanes.filter(p=>!M.hidden.has('p'+p.userData.id)));
 const hits=ray.intersectObjects(list,false);
 if(!hits.length)return null;const h=hits[0];return{kind:h.object.userData.kind,id:h.object.userData.id,point:h.point}}
function raySegT(a,b){ray.setFromCamera; const u=ray.ray.direction,v=b.clone().sub(a),w=ray.ray.origin.clone().sub(a);
 const B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(v.clone().sub(a).add(a).sub(a)); // careful below
 const den=C-B*B;if(Math.abs(den)<1e-9)return null;
 const Ev=v.dot(w);const t=(Ev-B*D)/den;const s=B*t-D;
 return{t:clamp(t,0,1),s}}
function snapPlan(cx,cy){const q=rayPlane(cx,cy,pl.o,pl.n);if(!q)return null;
 const d=q.clone().sub(pl.o);let a=d.dot(pl.u),b=d.dot(pl.v);
 const tol=12/pl.zoom;const ids=ctxNodeIds();const nodes=[...ids].map(id=>M.nodes.get(id));
 if(params.snapNode){let best=null,bd=tol*1.5;
  for(const n of nodes){const dd=n.p.clone().sub(pl.o);const na=dd.dot(pl.u),nb=dd.dot(pl.v);
   const dist=Math.hypot(a-na,b-nb);if(dist<bd){bd=dist;best={n,na,nb}}}
  if(best)return{a:best.na,b:best.nb,p:best.n.p.clone(),type:'node',node:best.n}}
 if(planCtx.kind==='rod'){const r=M.rods.get(planCtx.rodId);const L=rodLen(r);a=clamp(a,0,L);b=0;
  const cands=[];
  nodes.forEach(n=>{const na=n.p.clone().sub(pl.o).dot(pl.u);cands.push({v:na,t:'node'})});
  [.5,1/3,2/3,.25,.75].forEach(f=>cands.push({v:L*f,t:'frac',f}));
  if(params.snapGrid){cands.push({v:Math.round(a/params.grid)*params.grid,t:'grid'});cands.push({v:L-Math.round((L-a)/params.grid)*params.grid,t:'grid'})}
  let best=null,bd=tol*1.8;
  cands.forEach(c=>{const dd=Math.abs(a-c.v);if(dd<bd&&c.v>=-1&&c.v<=L+1){bd=dd;best=c}});
  if(best){a=clamp(best.v,0,L);return{a,b:0,p:pl.o.clone().addScaledVector(pl.u,a),type:best.t,rodT:a/L,frac:best.f}}
  return{a,b:0,p:pl.o.clone().addScaledVector(pl.u,a),type:'free',rodT:a/L}}
 let gx=null,gy=null,gxd=tol,gyd=tol;
 if(params.snapOrtho)for(const n of nodes){const dd=n.p.clone().sub(pl.o);const na=dd.dot(pl.u),nb=dd.dot(pl.v);
  if(Math.abs(a-na)<gxd){gxd=Math.abs(a-na);gx=na}
  if(Math.abs(b-nb)<gyd){gyd=Math.abs(b-nb);gy=nb}}
 let type='free';
 if(gx!==null&&gy!==null){a=gx;b=gy;type='ortho'}
 else if(gx!==null){a=gx;if(params.snapGrid)b=Math.round(b/params.grid)*params.grid;type='orthoX'}
 else if(gy!==null){b=gy;if(params.snapGrid)a=Math.round(a/params.grid)*params.grid;type='orthoY'}
 else if(params.snapGrid){a=Math.round(a/params.grid)*params.grid;b=Math.round(b/params.grid)*params.grid;type='grid'}
 return{a,b,p:pl.o.clone().addScaledVector(pl.u,a).addScaledVector(pl.v,b),type,gx,gy}}
function snap3D(cx,cy,workZ,allowRod=true){const hit=pickAt(cx,cy,{kinds:['node','rod']});
 if(hit&&hit.kind==='node'&&params.snapNode){const n=M.nodes.get(hit.id);return{p:n.p.clone(),type:'node',node:n}}
 if(hit&&hit.kind==='rod'&&allowRod){const r=M.rods.get(hit.id);const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
  ray.setFromCamera(ndc(cx,cy),activeCam());const st=raySegT(a,b);
  if(st){const L=a.distanceTo(b);let t=st.t;const cands=[0,1,.5,1/3,2/3,.25,.75];
   let best=null,bd=(14*worldPerPx())/L;
   cands.forEach(f=>{if(Math.abs(t-f)<bd){bd=Math.abs(t-f);best=f}});
   const dg=Math.round((t*L)/params.grid)*params.grid/L;
   if(params.snapGrid&&Math.abs(t-dg)<bd){best=clamp(dg,0,1)}
   if(best!==null)t=best;
   return{p:a.clone().lerp(b,t),type:'rod',rod:r,t}}}
 const p=rayPlane(cx,cy,V3(0,0,workZ),AZ);if(!p)return null;
 const tol=12*worldPerPx();let gx=null,gy=null,gxd=tol,gyd=tol;
 if(params.snapOrtho)for(const n of M.nodes.values()){if(Math.abs(n.p.z-workZ)>1)continue;
  if(Math.abs(p.x-n.p.x)<gxd){gxd=Math.abs(p.x-n.p.x);gx=n.p.x}
  if(Math.abs(p.y-n.p.y)<gyd){gyd=Math.abs(p.y-n.p.y);gy=n.p.y}}
 let type='free';
 if(gx!==null&&gy!==null){p.x=gx;p.y=gy;type='ortho'}
 else if(gx!==null){p.x=gx;if(params.snapGrid)p.y=Math.round(p.y/params.grid)*params.grid;type='orthoX'}
 else if(gy!==null){p.y=gy;if(params.snapGrid)p.x=Math.round(p.x/params.grid)*params.grid;type='orthoY'}
 else if(params.snapGrid){p.x=Math.round(p.x/params.grid)*params.grid;p.y=Math.round(p.y/params.grid)*params.grid;type='grid'}
 p.z=workZ;return{p,type,gx,gy,workZ}}
const SNAP_RU={node:'УЗЕЛ',grid:'СЕТКА',ortho:'⟂ + ∥',orthoX:'⟂ X',orthoY:'∥ Y',frac:'ДОЛЯ L',free:'СВОБОДНО',rod:'НА СТЕРЖНЕ'};
