/* ==================== STATE: model, selection, params, camera state, material cache ==================== */
'use strict';
/* ================= STATE ================= */
function freshModel(){return{name:'Новый проект',nodes:new Map(),rods:new Map(),planes:new Map(),groups:new Map(),counters:{n:0,o:0,r:0,p:0,g:0},hidden:new Set(),measures:[],views:[]}}
let M=freshModel();
let sel={nodes:new Set(),rods:new Set(),planes:new Set()};
let mode='plan',planCtx={kind:'xy'},tool='support',chain={a:null},planePick=[],measPick=null,paste=null,clipboard=null,hover={kind:null,id:null};
let ever3d=false,savedOnce=false,tx=null,draggingNode=null,dimsDirty=false,shadowsDirty=true;
const bornIds=new Set();
let params={grid:500,colH:2500,snapGrid:true,snapNode:true,snapOrtho:true,dims3d:false,shadows:true,clAxis:'x',clStep:3000,clCount:3,nodeR:70,rodScale:1,planeOp:.08};
try{const p=JSON.parse(localStorage.getItem('fc.params'));if(p)Object.assign(params,p)}catch(e){}
const undoStack=[],redoStack=[];
const selCount=()=>sel.nodes.size+sel.rods.size+sel.planes.size;
/* ================= THREE SETUP ================= */
let renderer,scene,camP,camO,planCam,gGrid,gRods,gNodes,gPlanes,gDims,gMeasure,gGhost,gWork,selBoxH,dirLight,ground;
let cubeRenderer,cubeScene,cubeCam,cubeMesh,cubeMats=[];
const nodeObjs=new Map(),rodObjs=new Map(),planeObjs=new Map();
let pickNodes=[],pickRods=[],pickPlanes=[];
const ray=new THREE.Raycaster();
let vpW=800,vpH=600;
const ctrl={t:V3(3000,1500,0),r:16000,th:-Math.PI/4,ph:1.05,g:{t:V3(3000,1500,0),r:16000,th:-Math.PI/4,ph:1.05},proj:'persp'};
const pl={o:V3(),u:AX.clone(),v:AY.clone(),n:AZ.clone(),ca:3000,cb:1500,zoom:.055,g:{ca:3000,cb:1500,zoom:.055}};
let unitSphere,unitCyl,unitCone,unitBox,matInvis,matGhostEl;
const matCache=new Map(),texCache=new Map();
function linColor(h){return new THREE.Color(h).convertSRGBToLinear()}
function matFor(key,color,state){const k=key+'|'+state;if(matCache.has(k))return matCache.get(k);
 let c=linColor(color),e=linColor(color),ei=.12;
 if(state==='hov'){e=linColor(color);ei=.55}
 if(state==='sel'){c=linColor(color).lerp(new THREE.Color(1,1,1),.4);e=new THREE.Color(1,1,1);ei=.4}
 const m=new THREE.MeshStandardMaterial({color:c,metalness:.35,roughness:.45,emissive:e,emissiveIntensity:ei});
 matCache.set(k,m);return m}
const rodMat=(t,s)=>matFor('r'+t,TYPES[t].color,s);
const nodeMat=(t,s)=>matFor('n'+t,t==='support'?SUP_COLOR:NODE_COLOR,s);
