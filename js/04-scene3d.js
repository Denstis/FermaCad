/* ==================== SCENE 3D: renderer init, lights, nav cube, sprites, primitives ==================== */
'use strict';
/* ---- renderer ---- */
function initRenderer(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
 renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 renderer.domElement.className='gl';$('#vp').prepend(renderer.domElement)}
/* ---- scene, cameras, lights, groups, shared geometries ---- */
function initSceneLights(){
 scene=new THREE.Scene();
 camP=new THREE.PerspectiveCamera(50,1,5,400000);camO=new THREE.OrthographicCamera(-1,1,1,-1,5,400000);planCam=new THREE.OrthographicCamera(-1,1,1,-1,1,90000);
 scene.add(new THREE.HemisphereLight(linColor(0xbdd8ff),linColor(0x2a2118),.75));
 dirLight=new THREE.DirectionalLight(linColor(0xfff0dd),1.15);dirLight.castShadow=true;
 dirLight.shadow.mapSize.set(2048,2048);dirLight.shadow.bias=-.0004;
 scene.add(dirLight);scene.add(dirLight.target);
 const rim=new THREE.DirectionalLight(linColor(0x4da6ff),.5);rim.position.set(-12000,14000,6000);scene.add(rim);
 ground=new THREE.Mesh(new THREE.PlaneGeometry(240000,240000),new THREE.ShadowMaterial({opacity:.3}));
 ground.position.z=-6;ground.receiveShadow=true;scene.add(ground);
 gGrid=new THREE.Group();gRods=new THREE.Group();gNodes=new THREE.Group();gPlanes=new THREE.Group();gDims=new THREE.Group();gMeasure=new THREE.Group();gGhost=new THREE.Group();gWork=new THREE.Group();
 scene.add(gGrid,gRods,gNodes,gPlanes,gDims,gMeasure,gGhost,gWork);
 selBoxH=new THREE.Box3Helper(new THREE.Box3(),0xffb020);selBoxH.visible=false;selBoxH.material.transparent=true;selBoxH.material.opacity=.7;scene.add(selBoxH);
 unitSphere=new THREE.SphereGeometry(1,18,14);unitCyl=new THREE.CylinderGeometry(1,1,1,12);unitCone=new THREE.ConeGeometry(1,1,4);unitBox=new THREE.BoxGeometry(1,1,1);
 matInvis=new THREE.MeshBasicMaterial();matGhostEl=new THREE.MeshBasicMaterial({color:linColor(0x3a5578),transparent:true,opacity:.2,depthWrite:false})}
/* ---- navigation cube (canvas-painted face materials) ---- */
function cubeFaceMaterial(txt,cc,i){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,256,256);g.addColorStop(0,'#1b2f52');g.addColorStop(1,'#0e1c36');x.fillStyle=g;x.fillRect(0,0,256,256);
 x.strokeStyle='#2c4f82';x.lineWidth=14;x.strokeRect(7,7,242,242);x.strokeStyle=cc;x.lineWidth=4;x.strokeRect(18,18,220,220);
 if(i===5){x.translate(256,256);x.rotate(Math.PI)}
 x.fillStyle='#dff1ff';x.font='800 52px Inter,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,128);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return new THREE.MeshBasicMaterial({map:t})}
function initNavCube(){
 cubeRenderer=new THREE.WebGLRenderer({canvas:$('#cubeCanvas'),antialias:true,alpha:true});
 cubeRenderer.setPixelRatio(Math.min(devicePixelRatio,2));cubeRenderer.setSize(110,110,false);cubeRenderer.outputEncoding=THREE.sRGBEncoding;
 cubeScene=new THREE.Scene();cubeCam=new THREE.PerspectiveCamera(38,1,.1,10);cubeCam.position.set(0,0,3.1);
 const faces=[['ПРАВО','#4da6ff'],['ЛЕВО','#4da6ff'],['ЗАД','#8ba3c7'],['ПЕРЕД','#3ddc97'],['ВЕРХ','#ffb020'],['НИЗ','#5d7699']];
 cubeMats=faces.map(([txt,cc],i)=>cubeFaceMaterial(txt,cc,i));
 cubeMesh=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.35,1.35),cubeMats);cubeScene.add(cubeMesh);
 cubeScene.add(new THREE.LineSegments(new THREE.EdgesGeometry(cubeMesh.geometry),new THREE.LineBasicMaterial({color:linColor(0x6fb0ff),transparent:true,opacity:.9})))}
function initThree(){
 initRenderer();initSceneLights();initNavCube();
 const ro=new ResizeObserver(resize);ro.observe($('#vp'));resize()}
function resize(){const r=$('#vp').getBoundingClientRect();vpW=Math.max(50,r.width);vpH=Math.max(50,r.height);
 renderer.setSize(vpW,vpH);camP.aspect=vpW/vpH;camP.updateProjectionMatrix();scheduleDecor()}
/* ================= SPRITES ================= */
function drawLabelCanvas(text,opt){const{color='#dff1ff',bg='rgba(8,16,32,.9)',border='#3a6ea8',fs=42}=opt;
 const c=document.createElement('canvas');const x=c.getContext('2d');x.font=`700 ${fs}px 'JetBrains Mono',monospace`;
 const w=Math.ceil(x.measureText(text).width)+36,h=fs+26;c.width=w;c.height=h;
 x.font=`700 ${fs}px 'JetBrains Mono',monospace`;x.fillStyle=bg;const rr=12;
 x.beginPath();x.moveTo(rr,0);x.arcTo(w,0,w,h,rr);x.arcTo(w,h,0,h,rr);x.arcTo(0,h,0,0,rr);x.arcTo(0,0,w,0,rr);x.fill();
 x.strokeStyle=border;x.lineWidth=3;x.stroke();x.fillStyle=color;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2+2);
 const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.minFilter=THREE.LinearFilter;return tex}
function labelSprite(text,opt={}){const{color='#dff1ff',bg='rgba(8,16,32,.9)',border='#3a6ea8',worldH=300,fs=42}=opt;
 const key=[text,color,bg,border,fs].join('|');let tex=texCache.get(key);
 if(!tex){tex=drawLabelCanvas(text,opt);
  if(texCache.size>500){const k0=texCache.keys().next().value;texCache.get(k0).dispose();texCache.delete(k0)}texCache.set(key,tex)}
 const m=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});const s=new THREE.Sprite(m);
 s.scale.set(worldH*tex.image.width/tex.image.height,worldH,1);s.renderOrder=30;s.userData.sprite=true;s.userData.ar=tex.image.width/tex.image.height;return s}
function clearGroup(g){for(let i=g.children.length-1;i>=0;i--){const o=g.children[i];g.remove(o);
 o.traverse(n=>{if(n.userData.own&&n.geometry)n.geometry.dispose();if(n.userData.sprite)n.material.dispose();else if(n.userData.ownMat&&n.material)n.material.dispose()})}}
function lines(pts,color,opacity=1,own=true,dashed=false){const geo=new THREE.BufferGeometry().setFromPoints(pts);
 let m;if(dashed){m=new THREE.LineDashedMaterial({color:linColor(color),transparent:true,opacity,dashSize:180,gapSize:120,depthTest:false});}
 else m=new THREE.LineBasicMaterial({color:linColor(color),transparent:true,opacity,depthTest:false});
 const l=dashed?new THREE.Line(geo,m):new THREE.LineSegments(geo,m);if(dashed)l.computeLineDistances();
 l.renderOrder=12;l.userData.own=own;l.userData.ownMat=true;return l}
function setCyl(mesh,a,b,r){const d=b.clone().sub(a);const len=Math.max(d.length(),.001);
 mesh.position.copy(a).addScaledVector(d,.5);mesh.quaternion.setFromUnitVectors(YUP,d.normalize());mesh.scale.set(r,len,r)}
