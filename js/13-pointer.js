/* ==================== POINTER: drag/marquee/pan/orbit/pinch, node dragging, hover ==================== */
'use strict';
/* ================= POINTER ================= */
const ptr={down:false,btn:-1,x0:0,y0:0,x:0,y:0,moved:false,mode:null,hit:null};
const touches=new Map();let pinchD=0,pinchM=null;
function bindPointer(){const cv=renderer.domElement;
 cv.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});
 cv.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()});
 cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId)}catch(x){}
  if(e.pointerType==='mouse')touches.clear();
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});hideCtx();
  if(touches.size===2){const ts=[...touches.values()];if(ts.length<2)return;pinchD=Math.hypot(ts[0].x-ts[1].x,ts[0].y-ts[1].y);pinchM={x:(ts[0].x+ts[1].x)/2,y:(ts[0].y+ts[1].y)/2};
   if(ptr.mode==='node'&&tx){deserialize(tx);tx=null;rebuildScene()}
   ptr.mode='pinch';ptr.moved=true;return}
  if(e.button===1)e.preventDefault();
  Object.assign(ptr,{down:true,btn:e.button,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,moved:false,mode:null,hit:pickAt(e.clientX,e.clientY)});
  document.body.classList.add('dragging')});
 cv.addEventListener('pointermove',e=>{if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptr.mode==='pinch'&&touches.size===2){const ts=[...touches.values()];
   const d=Math.hypot(ts[0].x-ts[1].x,ts[0].y-ts[1].y);const m={x:(ts[0].x+ts[1].x)/2,y:(ts[0].y+ts[1].y)/2};
   if(pinchD>0)zoomAt(pinchD/d,m.x,m.y);panBy(m.x-pinchM.x,m.y-pinchM.y);pinchD=d;pinchM=m;return}
  if(!ptr.down){hoverAt(e.clientX,e.clientY);return}
  const dx=e.clientX-ptr.x,dy=e.clientY-ptr.y;
  if(!ptr.moved&&Math.hypot(e.clientX-ptr.x0,e.clientY-ptr.y0)>4){ptr.moved=true;beginDrag(e)}
  if(ptr.moved){switch(ptr.mode){
   case'pan':panBy(dx,dy);break;
   case'orbit':orbitBy(dx,dy);break;
   case'marquee':drawMarquee(e);break;
   case'node':dragNode(e);break;
   case'chain':updateGhost(e.clientX,e.clientY);break}}
  ptr.x=e.clientX;ptr.y=e.clientY});
 const up=e=>{touches.delete(e.pointerId);
  if(ptr.mode==='pinch'){if(touches.size<2){ptr.down=false;ptr.mode=null;document.body.classList.remove('dragging')}return}
  if(!ptr.down)return;
  try{cv.releasePointerCapture(e.pointerId)}catch(x){}
  if(!ptr.moved){if(ptr.btn===0)toolClick(e.clientX,e.clientY,e);else if(ptr.btn===2)ctxAt(e.clientX,e.clientY)}
  else finishDrag(e);
  ptr.down=false;ptr.mode=null;$('#marquee').style.display='none';document.body.classList.remove('dragging')};
 cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
 cv.addEventListener('wheel',e=>{e.preventDefault();let d=e.deltaY;
  if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=Math.max(vpH,300);
  zoomAt(Math.exp(clamp(d,-180,180)*.0015),e.clientX,e.clientY)},{passive:false});
 cv.addEventListener('contextmenu',e=>e.preventDefault());
 cv.addEventListener('dblclick',e=>{if(tool!=='select')return;const h=pickAt(e.clientX,e.clientY);if(!h)return;
  if(h.kind==='rod')enterPlanRod(h.id);else if(h.kind==='plane')enterPlanPlane(h.id);
  else if(h.kind==='node'){selectOnly('node',h.id);zoomToSelection()}});
 cv.addEventListener('pointerleave',e=>{touches.delete(e.pointerId);if(!ptr.down){$('#badge').style.display='none';hover={kind:null,id:null};applySelMats();clearGhost()}})}
function beginDrag(e){if(ptr.btn===1){ptr.mode='pan';return}
 if(ptr.btn===2){ptr.mode=(mode==='plan'||e.ctrlKey||e.metaKey)?'pan':'orbit';return}
 if(paste){ptr.mode=mode==='plan'?'pan':'orbit';return}
 if(tool==='select'&&ptr.hit&&ptr.hit.kind==='node'){ptr.mode='node';draggingNode=ptr.hit.id;tx=serialize();return}
 if(tool==='select'){ptr.mode='marquee';return}
 if(ROD_KEYS.includes(tool)&&ptr.hit&&ptr.hit.kind==='node'){ptr.mode='chain';chain.a=M.nodes.get(ptr.hit.id);buildWorkGrid();updateHint();return}
 ptr.mode=mode==='plan'?'pan':'orbit'}
function drawMarquee(e){const r=$('#vp').getBoundingClientRect();const m=$('#marquee');
 const x=Math.min(ptr.x0,e.clientX)-r.left,y=Math.min(ptr.y0,e.clientY)-r.top;
 const w=Math.abs(e.clientX-ptr.x0),h=Math.abs(e.clientY-ptr.y0);
 Object.assign(m.style,{display:'block',left:x+'px',top:y+'px',width:w+'px',height:h+'px'})}
function applyMarquee(e,add){const r=renderer.domElement.getBoundingClientRect();const cam=activeCam();
 const x0=Math.min(ptr.x0,e.clientX),x1=Math.max(ptr.x0,e.clientX),y0=Math.min(ptr.y0,e.clientY),y1=Math.max(ptr.y0,e.clientY);
 const inside=p=>{const v=p.clone().project(cam);const sx=(v.x+1)/2*r.width+r.left,sy=(1-v.y)/2*r.height+r.top;
  return sx>=x0&&sx<=x1&&sy>=y0&&sy<=y1};
 if(!add){sel.nodes.clear();sel.rods.clear();sel.planes.clear()}
 const cn=ctxNodeIds(),cr=ctxRodIds();
 M.nodes.forEach(n=>{if(!M.hidden.has('n'+n.id)&&(mode!=='plan'||cn.has(n.id))&&inside(n.p))sel.nodes.add(n.id)});
 M.rods.forEach(rd=>{if(M.hidden.has('r'+rd.id)||(mode==='plan'&&!cr.has(rd.id)))return;
  const a=M.nodes.get(rd.a).p,b=M.nodes.get(rd.b).p;
  if(inside(a.clone().lerp(b,.5))||(inside(a)&&inside(b)))sel.rods.add(rd.id)});
 selectionChanged()}
function dragNode(e){const n=M.nodes.get(draggingNode);if(!n)return;let p=null;
 if(mode==='plan'){const s=snapPlan(e.clientX,e.clientY);if(s)p=s.p;
  if(planCtx.kind==='rod'&&s)p=pl.o.clone().addScaledVector(pl.u,clamp(s.a,0,rodLen(M.rods.get(planCtx.rodId))))}
 else if(n.host){const r=M.rods.get(n.host.rod);if(r){const a=M.nodes.get(r.a).p,b=M.nodes.get(r.b).p;
   ray.setFromCamera(ndc(e.clientX,e.clientY),activeCam());const st=raySegT(a,b);if(st)p=a.clone().lerp(b,st.t)}}
 else{const s=snap3D(e.clientX,e.clientY,n.p.z,false);if(s)p=s.p}
 if(p){moveNodeTo(n,p);refreshAfterMove(n);setBadge(e.clientX,e.clientY,{p:n.p,type:n.host?'rod':'free'},n.name+(n.host?' • по оси стержня':''))}}
function finishDrag(e){if(ptr.mode==='marquee')applyMarquee(e,e.ctrlKey||e.metaKey);
 else if(ptr.mode==='node'){if(tx){undoStack.push(tx);if(undoStack.length>100)undoStack.shift();redoStack.length=0;tx=null;updateUndoUI()}
  draggingNode=null;afterChange()}
 else if(ptr.mode==='chain'){const h=pickAt(e.clientX,e.clientY,{kinds:['node']});
  if(h&&chain.a&&h.id!==chain.a.id){pushUndo();const r=addRod(chain.a.id,h.id,tool);
   if(r){chain.a=M.nodes.get(h.id);buildWorkGrid();afterChange()}else{toast('Стержень уже существует',{type:'warn',timeout:1500})}}
  else if(!h){chain.a=null;clearGroup(gWork);updateHint()}
  clearGhost()}}
function hoverAt(cx,cy){const h=pickAt(cx,cy);
 const nk=h?h.kind:null,ni=h?h.id:null;
 if(nk!==hover.kind||ni!==hover.id){hover={kind:nk,id:ni};applySelMats();
  renderer.domElement.style.cursor=tool==='select'?(h?'pointer':'default'):'crosshair'}
 updateGhost(cx,cy)}
