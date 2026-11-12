/* ==================== CAMERAS: orbit/pan/zoom, smooth applyCams, fitAll ==================== */
'use strict';
/* ================= CAMERAS ================= */
const activeCam=()=>mode==='plan'?planCam:(ctrl.proj==='persp'?camP:camO);
function viewDir(){const sp=Math.sin(ctrl.ph);return V3(sp*Math.cos(ctrl.th),sp*Math.sin(ctrl.th),Math.cos(ctrl.ph))}
function applyCams(dt){const k=1-Math.exp(-dt*10);
 if(mode==='plan'){pl.ca+=(pl.g.ca-pl.ca)*k;pl.cb+=(pl.g.cb-pl.cb)*k;pl.zoom*=Math.pow(pl.g.zoom/pl.zoom,k);
  const c=pl.o.clone().addScaledVector(pl.u,pl.ca).addScaledVector(pl.v,pl.cb);
  planCam.position.copy(c).addScaledVector(pl.n,30000);planCam.up.copy(pl.v);planCam.lookAt(c);
  const hw=vpW/2/pl.zoom,hh=vpH/2/pl.zoom;
  planCam.left=-hw;planCam.right=hw;planCam.top=hh;planCam.bottom=-hh;planCam.updateProjectionMatrix();
  $('#zoomChip').textContent=Math.round(pl.zoom*1000)/10+'%';}
 else{ctrl.t.lerp(ctrl.g.t,k);ctrl.r*=Math.pow(ctrl.g.r/ctrl.r,k);
  let dth=ctrl.g.th-ctrl.th;dth=Math.atan2(Math.sin(dth),Math.cos(dth));ctrl.th+=dth*k;ctrl.ph+=(ctrl.g.ph-ctrl.ph)*k;
  const dir=viewDir();const pos=ctrl.t.clone().addScaledVector(dir,ctrl.r);
  const blend=clamp((Math.abs(dir.z)-.995)/(0.9999-.995),0,1);
  const up=AZ.clone().lerp(AY,blend).normalize();
  camP.position.copy(pos);camP.up.copy(up);camP.lookAt(ctrl.t);
  camO.position.copy(pos);camO.up.copy(up);camO.lookAt(ctrl.t);
  const hh=ctrl.r*Math.tan(THREE.MathUtils.degToRad(camP.fov/2)),asp=vpW/vpH;
  camO.left=-hh*asp;camO.right=hh*asp;camO.top=hh;camO.bottom=-hh;camO.updateProjectionMatrix();
  cubeMesh.quaternion.copy(activeCam().quaternion).invert()}}
function ndc(cx,cy){const r=renderer.domElement.getBoundingClientRect();return{x:(cx-r.left)/r.width*2-1,y:-((cy-r.top)/r.height)*2+1}}
function rayPlane(cx,cy,o,n){ray.setFromCamera(ndc(cx,cy),activeCam());const p=V3();
 return ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n,o),p)?p:null}
function worldPerPx(){return mode==='plan'?1/pl.zoom:2*ctrl.r*Math.tan(THREE.MathUtils.degToRad(camP.fov/2))/vpH}
function zoomAt(f,cx,cy){if(mode==='plan'){const q=rayPlane(cx,cy,pl.o,pl.n);
  pl.g.zoom=clamp(pl.g.zoom/f,.003,2);
  if(q){const d=q.clone().sub(pl.o);const a=d.dot(pl.u),b=d.dot(pl.v);pl.g.ca=a+(pl.g.ca-a)*f;pl.g.cb=b+(pl.g.cb-b)*f}
  scheduleDecor()}
 else{const nr=clamp(ctrl.g.r*f,250,250000),fr=nr/ctrl.g.r,t0=ctrl.g.t.clone();
  const p=rayPlane(cx,cy,t0,viewDir());
  if(p){const d=p.sub(t0),maxd=ctrl.g.r*.75;
   if(d.lengthSq()>maxd*maxd)d.setLength(maxd);
   ctrl.g.t.copy(t0).addScaledVector(d,1-fr)}
  ctrl.g.r=nr}}
function panBy(dx,dy){if(mode==='plan'){pl.g.ca-=dx/pl.zoom;pl.g.cb+=dy/pl.zoom;scheduleDecor()}
 else{const s=worldPerPx();const m=activeCam().matrixWorld.elements;
  const right=V3(m[0],m[1],m[2]),up=V3(m[4],m[5],m[6]);
  ctrl.g.t.addScaledVector(right,-dx*s).addScaledVector(up,dy*s)}}
function orbitBy(dx,dy){ctrl.g.th-=dx*.0055;ctrl.g.ph=clamp(ctrl.g.ph-dy*.0055,.05,Math.PI-.05)}
function setViewDir(d){const l=d.length();if(!l)return;const dz=clamp(d.z/l,-1,1);
 if(Math.abs(dz)>.999){ctrl.g.ph=dz>0?.015:Math.PI-.015}
 else{ctrl.g.ph=Math.acos(dz);const th=Math.atan2(d.y,d.x);ctrl.g.th=ctrl.th+Math.atan2(Math.sin(th-ctrl.th),Math.cos(th-ctrl.th))}}
function modelBox(){const box=new THREE.Box3();let any=false;
 M.nodes.forEach(n=>{if(!M.hidden.has('n'+n.id)){box.expandByPoint(n.p);any=true}});
 M.rods.forEach(r=>{if(!M.hidden.has('r'+r.id)){box.expandByPoint(M.nodes.get(r.a).p);box.expandByPoint(M.nodes.get(r.b).p);any=true}});
 return any?box:null}
function fitBox(box){if(!box)return;const c=box.getCenter(V3()),s=box.getSize(V3());
 if(mode==='plan'){const d=c.clone().sub(pl.o);pl.g.ca=d.dot(pl.u);pl.g.cb=d.dot(pl.v);
  const sa=Math.max(Math.abs(s.dot(pl.u)),1500),sb=Math.max(Math.abs(s.dot(pl.v)),1500);
  pl.g.zoom=clamp(Math.min(vpW/sa,vpH/sb)*.7,.003,2);scheduleDecor()}
 else{ctrl.g.t.copy(c);ctrl.g.r=clamp(Math.max(s.length(),1500)*1.05,1500,200000)}}
function fitAll(){const box=modelBox();
 if(box)fitBox(box);else if(mode==='plan'){pl.g.ca=3000;pl.g.cb=1500;pl.g.zoom=.055;scheduleDecor()}
 else{ctrl.g.t.copy(V3(3000,1500,0));ctrl.g.r=16000}}
function zoomToSelection(){const box=new THREE.Box3();let any=false;
 sel.nodes.forEach(id=>{const n=M.nodes.get(id);if(n){box.expandByPoint(n.p);any=true}});
 sel.rods.forEach(id=>{const r=M.rods.get(id);if(r){box.expandByPoint(M.nodes.get(r.a).p);box.expandByPoint(M.nodes.get(r.b).p);any=true}});
 if(any)fitBox(box);else fitAll()}
