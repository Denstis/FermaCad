/* ==================== GRID & DIMS: plan grid, dimension lines, measures ==================== */
'use strict';
/* ================= GRID & DIMS ================= */
function gridBasis(){if(mode==='plan')return pl;return{o:V3(),u:AX,v:AY,n:AZ}}
/* flat text painted onto the grid plane: no frame, grid color, small */
function gridText(txt,colorHex,worldH,o,u,v,cu,cv2){
 const fs=48;const probe=document.createElement('canvas');let c=probe.getContext('2d');
 c.font=fs+'px ui-monospace,monospace';const w=Math.ceil(c.measureText(txt).width)+10;
 probe.width=w;probe.height=fs+14;c=probe.getContext('2d');
 c.font=fs+'px ui-monospace,monospace';c.fillStyle=colorHex;c.textBaseline='middle';
 c.fillText(txt,5,probe.height/2+2);
 const tex=new THREE.CanvasTexture(probe);
 const gh=worldH,gw=worldH*probe.width/probe.height;
 const C=(du,dv)=>o.clone().addScaledVector(u,cu+du).addScaledVector(v,cv2+dv);
 const p0=C(-gw/2,-gh/2),p1=C(gw/2,-gh/2),p2=C(gw/2,gh/2),p3=C(-gw/2,gh/2);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute([p0.x,p0.y,p0.z,p1.x,p1.y,p1.z,p2.x,p2.y,p2.z,p0.x,p0.y,p0.z,p2.x,p2.y,p2.z,p3.x,p3.y,p3.z],3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));
 const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide,opacity:.95}));
 m.renderOrder=3;return m}
function rebuildGrid(){clearGroup(gGrid);const b=gridBasis();const g=params.grid;const isPlan=mode==='plan';
 let a0=-30000,a1=30000,b0=-30000,b1=30000;
 if(isPlan&&planCtx.kind==='rod'){const r=M.rods.get(planCtx.rodId);const L=r?rodLen(r):5000;a0=-1500;a1=L+1500;b0=-2600;b1=2600}
 const P=(a,bb)=>b.o.clone().addScaledVector(b.u,a).addScaledVector(b.v,bb);
 const minor=[],major=[];const majEvery=5;
 for(let a=Math.ceil(a0/g)*g;a<=a1;a+=g){const arr=(Math.round(a/g)%majEvery===0)?major:minor;arr.push(P(a,b0),P(a,b1))}
 for(let bb=Math.ceil(b0/g)*g;bb<=b1;bb+=g){const arr=(Math.round(bb/g)%majEvery===0)?major:minor;arr.push(P(a0,bb),P(a1,bb))}
 if(minor.length)gGrid.add(lines(minor,isPlan?0x1b2f4d:0x16263f,isPlan?.6:.38));
 if(major.length)gGrid.add(lines(major,isPlan?0x2c4f82:0x23406b,isPlan?.95:.6));
 const ax=[];const isXY=!(isPlan&&planCtx.kind!=='xy');
 if(isXY){gGrid.add(lines([P(a0,0),P(a1,0)],0xff5470,.9));gGrid.add(lines([P(0,b0),P(0,b1)],0x3ddc97,.9));
  if(!isPlan)gGrid.add(lines([V3(0,0,0),V3(0,0,2500)],0x4da6ff,.9))}
 else gGrid.add(lines([P(a0,0),P(a1,0)],0xffb020,.85));
 // labels: flat, painted on the grid plane, grid-colored, small
 const tH=isPlan?clamp(11/pl.zoom,130,650):320;
 const tCol=isPlan?'#4d7ec4':'#3a5f92';
 const stride=isPlan?Math.max(1,Math.ceil((70/pl.zoom)/(g*majEvery))):4;
 let li=0;
 for(let a=Math.ceil(a0/(g*majEvery))*g*majEvery;a<=a1;a+=g*majEvery){if(li++%stride)continue;if(a===0&&isXY)continue;
  gGrid.add(gridText(isPlan&&planCtx.kind==='rod'?fmt(a):fmtAxis(a),tCol,tH,b.o,b.u,b.v,a,-tH*.9))}
 li=0;
 for(let bb=Math.ceil(b0/(g*majEvery))*g*majEvery;bb<=b1;bb+=g*majEvery){if(li++%stride)continue;if(bb===0&&isXY)continue;
  gGrid.add(gridText(isPlan&&planCtx.kind==='rod'?fmt(bb):fmtAxis(bb),tCol,tH,b.o,b.u,b.v,-tH*1.4,bb))}
 const wH=tH*1.6;
 if(isPlan&&planCtx.kind==='rod'){const r=M.rods.get(planCtx.rodId);if(r){const L=rodLen(r);
  const s=labelSprite('L = '+fmt(L)+' мм',{worldH:wH*1.2,border:'#8a6a20',color:'#ffd27a'});s.position.copy(P(L/2,b1-400));gGrid.add(s)}}
 if(!isPlan){const lx=labelSprite('X',{worldH:700,color:'#ff8ba0',border:'#6b2438'});lx.position.set(31500,0,0);lx.userData.autoScale=true;gGrid.add(lx);
  const ly=labelSprite('Y',{worldH:700,color:'#7fe8b8',border:'#1c5a3c'});ly.position.set(0,31500,0);ly.userData.autoScale=true;gGrid.add(ly);
  const lz=labelSprite('Z',{worldH:700,color:'#8fc6ff',border:'#25436e'});lz.position.set(0,0,3200);lz.userData.autoScale=true;gGrid.add(lz)}}
function dimLine(g,a,b,off,axis,worldH,color=0x6fd3ff){ // axis 'x': horizontal dim, off = perpendicular offset
 const P=axis==='x'?(t,o)=>V3(t,o,0):(t,o)=>V3(o,t,0);
 const p1=P(a,0),p2=P(b,0),d1=P(a,off),d2=P(b,off);const ext=Math.sign(off)*250;
 const pts=[p1,P(a,off+ext),p2,P(b,off+ext),d1,d2];
 const t=worldH*.22;
 const tick=p=>axis==='x'?[p.clone().add(V3(-t,-t,0)),p.clone().add(V3(t,t,0))]:[p.clone().add(V3(-t,t,0)),p.clone().add(V3(t,-t,0))];
 pts.push(...tick(d1),...tick(d2));
 g.add(lines(pts,color,.85));
 const len=Math.abs(b-a);if(len<1)return;
 const s=labelSprite(fmt(len),{worldH,border:'#1e5a7a',color:'#aee4ff'});
 s.position.copy(P((a+b)/2,off)).add(axis==='x'?V3(0,worldH*.75,0):V3(-worldH*1.4,0,0));g.add(s)}
function rebuildDims(){clearGroup(gDims);
 const show=(mode==='plan'&&planCtx.kind==='xy')||(mode==='3d'&&params.dims3d);if(!show)return;
 const sup=nodeArr().filter(n=>n.type==='support');if(sup.length<2)return;
 const wH=mode==='plan'?clamp(16/pl.zoom,220,1400):700;
 const rows=new Map(),cols=new Map();
 sup.forEach(n=>{const y=Math.round(n.p.y),x=Math.round(n.p.x);
  if(!rows.has(y))rows.set(y,[]);rows.get(y).push(n.p.x);
  if(!cols.has(x))cols.set(x,[]);cols.get(x).push(n.p.y)});
 rows.forEach((xs,y)=>{if(xs.length<2)return;xs.sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)dimLine(gDims,xs[i],xs[i+1],y-1100,'x',wH);
  if(xs.length>2)dimLine(gDims,xs[0],xs[xs.length-1],y-2100,'x',wH,0xffb020)});
 cols.forEach((ys,x)=>{if(ys.length<2)return;ys.sort((a,b)=>a-b);
  for(let i=0;i<ys.length-1;i++)dimLine(gDims,ys[i],ys[i+1],x-1100,'y',wH);
  if(ys.length>2)dimLine(gDims,ys[0],ys[ys.length-1],x-2100,'y',wH,0xffb020)})}
function buildMeasures(){clearGroup(gMeasure);
 M.measures.forEach((m,i)=>{if(M.hidden.has('m'+i))return;const d=m.b.clone().sub(m.a);const L=d.length();const u=d.clone().normalize();
  let perp=u.clone().cross(AZ);if(perp.length()<.1)perp=u.clone().cross(AX);perp.normalize().multiplyScalar(200);
  const pts=[m.a,m.b,m.a.clone().sub(perp),m.a.clone().add(perp),m.b.clone().sub(perp),m.b.clone().add(perp)];
  gMeasure.add(lines(pts,0xffc53d,.95));
  const s=labelSprite(fmt(L)+' мм',{worldH:400,border:'#8a6a20',color:'#ffe2a0'});
  s.position.copy(m.a).addScaledVector(d,.5).addScaledVector(perp,1.6);s.userData.autoScale=true;gMeasure.add(s)});
 $('#measCount').textContent=M.measures.length}
const scheduleDecor=debounce(()=>{if(mode==='plan'){rebuildGrid();rebuildDims()}},160);
