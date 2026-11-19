/* ==================== МОДЕЛЬ СО ВСЕМИ ЗАПИЛАМИ: геометрия + экспорт OBJ/STL ==================== */
'use strict';
/* Тела стержней со ВСЕМИ запилами раскроя (единое ядро cutCore через endInfo,
   docs/FABRICATION.md §4.1). В buildFullModel призмы идут от узла до узла с
   плоскими торцами (обрезка только у T/nest) — здесь торцы режутся реальными
   плоскостями реза:
     miter — плоскость через узел с нормалью E.n (остриё выходит за узел,
             соседние концы сходятся без зазора — взаимный запил по биссектрисе);
     T/nest — перпендикуляр оси на min(e, .45L) от узла (подрез к стенке /
              вложение в полость);
     flat/pass/main/free — торец по плоскости узла.
   Сечение полое (внешний контур + отверстие, secContours). Вершина каждого
   торца — точка сечения (al,be), пересечённая с плоскостью реза, поэтому
   триангуляция торцов совпадает с триангуляцией сечения
   (ShapeUtils.triangulateShape), а боковые грани — пары соответствующих
   вершин двух торцов. Обход граней: наружу (как в buildFullModel).
   Единицы мм, Z вверх — как у осевого exportOBJ (17-storage). */
function cutModelParts(){
 const segs=fullSegs(),segAt=new Map();
 segs.forEach(s=>{[[s.na,s.p0,s.p1],[s.nb,s.p1,s.p0]].forEach(([nid,X,oth])=>{
  const d=fN([X.x-oth.x,X.y-oth.y,X.z-oth.z]);if(!d)return;
  const a=segAt.get(nid)||[];a.push({seg:s,d});segAt.set(nid,a)})});
 const parts=[];
 for(const S of segs){
  const s=rodSec(S.r);
  const vA=fN([S.p0.x-S.p1.x,S.p0.y-S.p1.y,S.p0.z-S.p1.z]);
  const vB=fN([S.p1.x-S.p0.x,S.p1.y-S.p0.y,S.p1.z-S.p0.z]);
  if(!vA||!vB)continue;
  const EA=endInfo(S,S.p0,vA,S.na,segAt),EB=endInfo(S,S.p1,vB,S.nb,segAt);
  const trimA=(EA.kind==='T'||EA.kind==='nest')?Math.min(EA.e||0,S.L*0.45):0;
  const trimB=(EB.kind==='T'||EB.kind==='nest')?Math.min(EB.e||0,S.L*0.45):0;
  /* базис сечения — как в buildFullModel: x(b)->e2, y(h)->e3, ось u=vB */
  let e2=fN([-vB[1],vB[0],0]);if(!e2)e2=[1,0,0];
  const e3=fN([vB[1]*e2[2]-vB[2]*e2[1],vB[2]*e2[0]-vB[0]*e2[2],vB[0]*e2[1]-vB[1]*e2[0]]);
  if(!e3)continue;
  const u=vB;
  const all=(s.kind==='rhs'?secContours(s).map(ct=>ct.map(([x,y])=>[y,x])):secContours(s));
  /* параметр t вершины сечения (al,be) на торцевой плоскости: X(t)=p0+t*u+al*e2+be*e3,
     (X−PP)·n=0 → t=((PP−p0)·n − al*(e2·n) − be*(e3·n))/(u·n); у перпендикулярного
     торца (n=|null) — константа def */
  const planeT=(ct,n,PP,def)=>{
   if(!n)return ct.map(()=>def);
   const dn=u[0]*n[0]+u[1]*n[1]+u[2]*n[2];
   if(Math.abs(dn)<1e-6)return ct.map(()=>def);
   const rx=PP.x-S.p0.x,ry=PP.y-S.p0.y,rz=PP.z-S.p0.z;
   const pn=rx*n[0]+ry*n[1]+rz*n[2];
   const e2n=e2[0]*n[0]+e2[1]*n[1]+e2[2]*n[2];
   const e3n=e3[0]*n[0]+e3[1]*n[1]+e3[2]*n[2];
   return ct.map(([al,be])=>(pn-al*e2n-be*e3n)/dn)};
  /* торец: база (T/nest — отступ от узла; flat/pass — по плоскости узла) плюс
     ВСЕ биссектрисы соседей (E.planes); итог = max по плоскостям (пересечение
     полупространств). Взаимные биссектрисы пары (±n) разводят тела строго.
     У miter база-пол игнорируется: остриё выходит за узел, пол задают сами
     биссектрисы (коллинеарная даёт ровно плоскость узла). */
  const capTs=(E,ct,def,PP,isB)=>{
   const miter=E&&E.kind==='miter';
   const use=(E&&E.planes&&E.planes.length)?E.planes:(miter&&E.n?[E.n]:[]);
   if(!use.length)return ct.map(()=>def);
   /* A-конец (t=0): материал t >= t_k -> max; B-конец (t=L): t <= t_k -> min */
   const ts=ct.map(()=>miter?(isB?1e18:-1e18):def);
   for(const n of use){const tk=planeT(ct,n,PP,def);
    for(let i=0;i<ts.length;i++){if(isB?(tk[i]<ts[i]):(tk[i]>ts[i]))ts[i]=tk[i]}}
   return ts};
  /* параметры обоих торцов в общей индексации сечения (внешний контур + отверстия) */
  const tA=[],tB=[];
  all.forEach(ct=>{capTs(EA,ct,trimA,S.p0,false).forEach(t=>tA.push(t));
   capTs(EB,ct,S.L-trimB,S.p1,true).forEach(t=>tB.push(t))});
  /* вырожденный случай (короткий стержень при большом запиле): не даём торцам
     пересечься — минимальная толщина 0.5 мм; остриё miter ограничено 0.4L */
  for(let i=0;i<tA.length;i++){
   if(tA[i]<-S.L*0.4)tA[i]=-S.L*0.4;
   if(tB[i]>S.L*1.4)tB[i]=S.L*1.4;
   if(!(tA[i]<tB[i]-0.5))tA[i]=tB[i]-0.5}
  /* вершины торцов по контурам: capA/capB[ci] — группа контура (внешний/отверстия);
     те же точки использует 3D-сцена (buildFullModel) и сварные контуры */
  const capPts=ts=>{const out=[];let k=0;
   all.forEach(ct=>{const g=[];
    ct.forEach(([al,be])=>{const t=ts[k++];
     g.push([S.p0.x+t*u[0]+al*e2[0]+be*e3[0],
             S.p0.y+t*u[1]+al*e2[1]+be*e3[1],
             S.p0.z+t*u[2]+al*e2[2]+be*e3[2]])});
    out.push(g)});
   return out};
  const cA=capPts(tA),cB=capPts(tB);
  const pos=[];
  const tri=(a,b,c)=>{pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2])};
  /* боковые грани: наружный контур — по обходу, отверстие — против (нормаль
     в полость), b=торец A (t меньше), t=торец B — как в buildFullModel.
     У rhs сечение зеркалится развёрткой [x,y]->[y,x] (кольцо становится CW) —
     обход граней инвертируем; торцы этого не касаются: earcut нормализует
     ориентацию выходных треугольников. */
  const flip=s.kind==='rhs';
  all.forEach((ct,ci)=>{
   for(let i=0;i<ct.length;i++){const j=(i+1)%ct.length;
    const b0=cA[ci][i],b1=cA[ci][j],t0=cB[ci][i],t1=cB[ci][j];
    if((ci>0)!==flip){tri(b0,t1,b1);tri(b0,t0,t1)}else{tri(b0,b1,t1);tri(b0,t1,t0)}}});
  /* торцы: триангуляция сечения одна на оба; A — развёрнутый обход (наружу −u),
     B — прямой (+u); у miter нормаль наклонена к ±E.n — обход сохраняется */
  const flat=all.map(ct=>ct.map(([x,y])=>new THREE.Vector2(x,y)));
  const idx=THREE.ShapeUtils.triangulateShape(flat[0],flat.slice(1));
  const fA=[].concat.apply([],cA),fB=[].concat.apply([],cB);
  idx.forEach(t3=>{tri(fA[t3[2]],fA[t3[1]],fA[t3[0]]);
   tri(fB[t3[0]],fB[t3[1]],fB[t3[2]])});
  if(pos.length)parts.push({name:S.r.name,tris:pos,capA:cA,capB:cB});
 }
 return parts}
function buildCutOBJ(parts,name){
 const f=v=>(isFinite(v)?v.toFixed(4):'0');
 const gs=t=>String(t).replace(/[\r\n]+/g,' ').trim()||'part';
 let s='# ФЕРМА·CAD — модель со всеми запилами (miter по биссектрисе / T-подрез / вложение)\n'+
  '# единицы: мм, Z — вертикаль; обход граней против часовой снаружи (right-hand)\n'+
  '# '+new Date().toLocaleString('ru-RU')+'\n'+
  'o '+gs(name)+'\n';
 let cur='',vi=1,n=0;
 for(const p of parts){
  if(p.name!==cur){cur=p.name;s+='g '+gs(cur)+'\n'}
  const t=p.tris;
  for(let i=0;i<t.length;i+=9){
   let ok=true;
   for(let k=0;k<9;k++)if(!isFinite(t[i+k])){ok=false;break}
   if(!ok)continue;
   s+='v '+f(t[i])+' '+f(t[i+1])+' '+f(t[i+2])+'\n'+
      'v '+f(t[i+3])+' '+f(t[i+4])+' '+f(t[i+5])+'\n'+
      'v '+f(t[i+6])+' '+f(t[i+7])+' '+f(t[i+8])+'\n'+
      'f '+vi+' '+(vi+1)+' '+(vi+2)+'\n';
   vi+=3;n++;
  }}
 return{s,n}}
function buildCutSTL(parts){
 const f=v=>(isFinite(v)?v.toFixed(4):'0');
 let s='solid fermcad_cuts\n',n=0;
 for(const p of parts){const t=p.tris;
  for(let i=0;i<t.length;i+=9){
   const ax=t[i],ay=t[i+1],az=t[i+2],bx=t[i+3],by=t[i+4],bz=t[i+5],
         cx=t[i+6],cy=t[i+7],cz=t[i+8];
   if(!isFinite(ax)||!isFinite(ay)||!isFinite(az)||!isFinite(bx)||!isFinite(by)||
      !isFinite(bz)||!isFinite(cx)||!isFinite(cy)||!isFinite(cz))continue;
   const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
   let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
   const L=Math.hypot(nx,ny,nz);
   if(!(L>1e-9))continue;
   nx/=L;ny/=L;nz/=L;
   s+='facet normal '+f(nx)+' '+f(ny)+' '+f(nz)+'\n  outer loop\n'+
      '    vertex '+f(ax)+' '+f(ay)+' '+f(az)+'\n'+
      '    vertex '+f(bx)+' '+f(by)+' '+f(bz)+'\n'+
      '    vertex '+f(cx)+' '+f(cy)+' '+f(cz)+'\n'+
      '  endloop\nendfacet\n';
   n++;
  }}
 s+='endsolid fermcad_cuts\n';
 return{s,n}}
function exportCutModel(fmt,parts){
 if(!parts||!parts.length){toast('Нет стержней для экспорта модели',{type:'warn'});return}
 const inp=$('#projName');
 M.name=(inp&&inp.value.trim())||M.name||'Проект';
 const t0=performance.now();
 const r=(fmt==='STL')?buildCutSTL(parts):buildCutOBJ(parts,M.name);
 if(!r.n){toast('Пустая геометрия — нечего экспортировать',{type:'err'});return}
 download(M.name+'_запилы.'+fmt.toLowerCase(),r.s,'text/plain;charset=utf-8');
 toast('Модель '+fmt+' со всеми запилами: '+r.n+' тр. • '+parts.length+
  ' сегм. • '+(r.s.length/1048576).toFixed(2)+' МБ • '+Math.round(performance.now()-t0)+' мс',
  {type:'ok',timeout:5500})}
