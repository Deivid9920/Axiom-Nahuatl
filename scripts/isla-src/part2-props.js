/* ============================================================
   Colocación (layout SDK anti-solapes) + propiedades + lémur
   ============================================================ */
const OBJ_TOTAL = { n: 0 };
const OCC = [];   // rects XZ ocupados {x,z,hw,hd}
function rectCorners(x,z,hw,hd,rot){
  const c=Math.cos(rot), s=Math.sin(rot);
  return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([px,pz])=>[x+px*c+pz*s, z-px*s+pz*c]);
}
function overlaps(x,z,hw,hd,rot){
  const A = rectCorners(x,z,hw,hd,rot);
  for(const o of OCC){
    const B = rectCorners(o.x,o.z,o.hw,o.hd,o.rot||0);
    const axes = [[1,0],[0,1],[Math.cos(rot),-Math.sin(rot)],[Math.cos(o.rot||0),-Math.sin(o.rot||0)]];
    let sepAll = true;
    for(const sep of axes){
      let aMin=1e9,aMax=-1e9,bMin=1e9,bMax=-1e9;
      for(const [px,pz] of A){ const d=px*sep[0]+pz*sep[1]; aMin=Math.min(aMin,d); aMax=Math.max(aMax,d); }
      for(const [px,pz] of B){ const d=px*sep[0]+pz*sep[1]; bMin=Math.min(bMin,d); bMax=Math.max(bMax,d); }
      if(aMax<bMin || bMax<aMin){ sepAll=false; break; }
    }
    if(sepAll) return true;                       // solapa en todos los ejes probados
  }
  return false;
}
function claim(x,z,hw,hd,label,rot=0,minGap=1.2){
  const X=x, Z=z;
  if(overlaps(X,Z,hw+minGap,hd+minGap,rot)){ console.warn('solape evitado:',label); return false; }
  OCC.push({x:X,z:Z,hw:hw+minGap,hd:hd+minGap,rot});
  return true;
}
function farFromPath(x,z,d){ let m=1e9; for(const p of PATH_PTS){ const q=Math.hypot(x-p.x,z-p.z); if(q<m)m=q; } return m>d; }
function farFromRiver(x,z,d){ return riverDist(x,z).d > d; }

/* --- camino principal: torii (playa SE) → puente → terrazas → cumbre --- */
const pathCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(34,0,42),    // 0 · torii en la playa
  new THREE.Vector3(24,0,36),
  new THREE.Vector3(13,0,28),    // ~cruce del río (puente)
  new THREE.Vector3(1,0,23),
  new THREE.Vector3(-5,0,11),
  new THREE.Vector3(-9,0,-1),
  new THREE.Vector3(-9,0,-7),    // 6 · cumbre
], false, 'catmullrom', 0.35);
const PATH_N = 460, PATH_PTS = [];
for(let i=0;i<=PATH_N;i++){
  const t=i/PATH_N, p=pathCurve.getPoint(t), tg=pathCurve.getTangent(t).normalize();
  PATH_PTS.push({x:p.x, z:p.z, tx:tg.x, tz:tg.z, h:0});
}
for(const p of PATH_PTS) p.h = terrainH(p.x,p.z);

/* --- punto de cruce camino×río → puente perpendicular --- */
let BRIDGE = null;
{
  let best=1e12, bi=0, bj=0;
  for(let i=8;i<PATH_PTS.length-8;i++){
    for(let j=0;j<RS.length;j++){
      const dx=PATH_PTS[i].x-RS[j].x, dz=PATH_PTS[i].z-RS[j].z, q=dx*dx+dz*dz;
      if(q<best){ best=q; bi=i; bj=j; }
    }
  }
  const rp = RS[bj];
  BRIDGE = { x:rp.x, z:rp.z, tx:rp.tx, tz:rp.tz, h:rp.h, pathI:bi, riverJ:bj };
}

/* --- piedra del camino (instanciada) --- */
{
  const g = new THREE.BoxGeometry(1.5,0.22,1.05);
  const m = new THREE.MeshStandardMaterial({color:'#b6ad9c', flatShading:true, roughness:1});
  const step = 2, list=[];
  for(let i=0;i<PATH_PTS.length;i+=step){
    const p=PATH_PTS[i];
    const rv = riverDist(p.x,p.z);
    const nearBridge = Math.abs(i-BRIDGE.pathI) < 26;
    if(rv.d < 5.2 && !nearBridge) continue;                 // no piedras dentro del cauce
    if(p.h < 0.4) continue;                                 // ni bajo el agua de mar
    list.push(p);
  }
  const im = new THREE.InstancedMesh(g, m, list.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1,1,1), E = new THREE.Euler();
  list.forEach((p,k)=>{
    const ang = Math.atan2(p.tx,p.tz) + (hash2(k*3.7,k*1.3)-0.5)*0.5;
    E.set(0,ang,(hash2(k,k*2.1)-0.5)*0.1); Q.setFromEuler(E);
    const sh = 0.85+hash2(k*2.3,k*9.1)*0.4;
    S.set(sh,1,0.9+hash2(k*4.4,k)*0.3);
    const jx=(hash2(k*5.1,k)-0.5)*0.5, jz=(hash2(k,k*7.7)-0.5)*0.5;
    M.compose(new THREE.Vector3(p.x+jx, p.h+0.10, p.z+jz), Q, S);
    im.setMatrixAt(k,M);
  });
  im.castShadow = im.receiveShadow = true;
  scene.add(im);
  OBJ_TOTAL.n += list.length;
}

/* --- helpers de construcción --- */
function mesh(geo, mat, x,y,z, ry=0, parent=scene){
  const o = new THREE.Mesh(geo,mat); o.position.set(x,y,z); o.rotation.y=ry;
  o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
const MAT = {
  wood:  new THREE.MeshStandardMaterial({color:'#8a5a35', flatShading:true, roughness:0.9}),
  woodD: new THREE.MeshStandardMaterial({color:'#5f3d22', flatShading:true, roughness:0.95}),
  plank: new THREE.MeshStandardMaterial({color:'#a9764a', flatShading:true, roughness:0.9}),
  red:   new THREE.MeshStandardMaterial({color:'#c0392b', flatShading:true, roughness:0.75}),
  dark:  new THREE.MeshStandardMaterial({color:'#2e2a28', flatShading:true, roughness:0.9}),
  stone: new THREE.MeshStandardMaterial({color:'#9b968c', flatShading:true, roughness:1}),
  stoneD:new THREE.MeshStandardMaterial({color:'#77726a', flatShading:true, roughness:1}),
  wall:  new THREE.MeshStandardMaterial({color:'#e8dcc3', flatShading:true, roughness:0.95}),
  roof:  new THREE.MeshStandardMaterial({color:'#3f5d7a', flatShading:true, roughness:0.8, side:THREE.DoubleSide}),
  leafP: new THREE.MeshStandardMaterial({color:'#4e7d43', flatShading:true, roughness:1}),
  leafR: new THREE.MeshStandardMaterial({color:'#6fa054', flatShading:true, roughness:1}),
  trunk: new THREE.MeshStandardMaterial({color:'#6d4a2c', flatShading:true, roughness:1}),
  gold:  new THREE.MeshStandardMaterial({color:'#e8b84b', flatShading:true, roughness:0.4, metalness:0.5, emissive:'#5c4210'}),
};

/* --- TORII: entrada alineada con el camino (se atraviesa caminando) --- */
const TORII = PATH_PTS[0];
{
  const g = new THREE.Group();
  const H = 5.2, SEP = 2.3;
  for(const sx of [-1,1]){
    mesh(new THREE.CylinderGeometry(0.34,0.42,H,7), MAT.red, sx*SEP, H/2, 0, 0, g);
    mesh(new THREE.CylinderGeometry(0.45,0.45,0.5,7), MAT.dark, sx*SEP, H+0.2, 0, 0, g);
  }
  mesh(new THREE.BoxGeometry(7.4,0.5,0.8), MAT.dark, 0, H+0.55, 0, 0, g);        // kasagi
  mesh(new THREE.BoxGeometry(6.2,0.42,0.66), MAT.red, 0, H+1.0, 0, 0, g);
  mesh(new THREE.BoxGeometry(5.6,0.36,0.5), MAT.red, 0, H-1.15, 0, 0, g);        // nuki
  mesh(new THREE.BoxGeometry(0.4,1.0,0.4), MAT.red, 0, H-0.55, 0, 0, g);         // gakuzuka
  const p = TORII;
  g.position.set(p.x, terrainH(p.x,p.z)-0.15, p.z);
  g.rotation.y = Math.atan2(p.tx, p.tz);                                          // plano ⟂ al camino
  scene.add(g); OBJ_TOTAL.n++;
  claim(p.x,p.z,4.4,2.6,'torii',g.rotation.y,2);
}

/* --- CASA DEL SABER: fuera del río, puerta hacia el camino --- */
{
  const HX=22, HZ=16;
  const hy = terrainH(HX,HZ);
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(7,3.4,5.6), MAT.wall, 0,1.7,0, 0, g);
  // techo a dos aguas (prisma)
  const rg = new THREE.BufferGeometry();
  const w=4.15, d=3.3, peakY=6.0, baseY=3.35;
  const V=[ -w,baseY,-d,  w,baseY,-d,  0,peakY,-d,   -w,baseY, d,  0,peakY, d,  w,baseY, d,
            -w,baseY,-d, 0,peakY,-d, 0,peakY, d,  -w,baseY, d,
             w,baseY, d, 0,peakY, d, 0,peakY,-d,  w,baseY,-d ];
  const I=[0,1,2, 3,4,5, 6,7,8, 9,10,11, 12,13,14, 15,16,17];
  rg.setAttribute('position', new THREE.Float32BufferAttribute(V,3));
  rg.setIndex(I); rg.computeVertexNormals();
  const roof = new THREE.Mesh(rg, MAT.roof); roof.castShadow=true; g.add(roof);
  mesh(new THREE.BoxGeometry(1.1,2.1,0.15), MAT.woodD, 0,1.05,2.85, 0, g);        // puerta
  for(const wx of [-2.2,2.2]) mesh(new THREE.BoxGeometry(1.2,1.0,0.12), MAT.gold, wx,1.9,2.83, 0, g);
  mesh(new THREE.BoxGeometry(3.4,0.22,2.0), MAT.plank, 0,0.12,3.6, 0, g);         // porche
  for(const px of [-1.5,1.5]) mesh(new THREE.CylinderGeometry(0.09,0.09,2.1,5), MAT.woodD, px,1.05,4.4, 0, g);
  mesh(new THREE.BoxGeometry(0.8,1.6,0.8), MAT.stoneD, 2.6,4.1,-0.9, 0, g);       // chimenea
  g.position.set(HX,hy-0.1,HZ);
  const to = PATH_PTS[Math.round(PATH_N*0.42)];                                    // mira hacia el camino
  g.rotation.y = Math.atan2(to.x-HX, to.z-HZ);
  scene.add(g); OBJ_TOTAL.n += 8;
  claim(HX,HZ,4.6,3.6,'casa',g.rotation.y,2.5);
}

/* --- PUENTE perpendicular al río (fix: atan2 sin +PI/2, deck largo en X local) --- */
{
  const b = BRIDGE;
  const g = new THREE.Group();
  const LEN = 9.0, WID = 2.6;
  mesh(new THREE.BoxGeometry(LEN,0.35,WID), MAT.plank, 0,0,0, 0, g);
  // tablas
  for(let i=-3;i<=3;i++) mesh(new THREE.BoxGeometry(0.9,0.09,WID-0.1), MAT.wood, i*1.25,0.23,0, 0, g);
  for(const sx of [-1,1]){
    mesh(new THREE.BoxGeometry(LEN,0.1,0.14), MAT.woodD, 0,1.0, sx*(WID/2), 0, g);   // pasamanos
    for(let px=-3;px<=3;px++) mesh(new THREE.BoxGeometry(0.12,1.0,0.12), MAT.woodD, px*1.25,0.55, sx*(WID/2), 0, g);
  }
  for(const ex of [-1,1]) mesh(new THREE.CylinderGeometry(0.35,0.4,3.2,6), MAT.woodD, ex*(LEN/2-0.4),-1.2,0, 0, g);
  g.position.set(b.x, b.h+0.35, b.z);
  g.rotation.y = Math.atan2(b.tx, b.tz);          // eje Z local ⇒ tangente del río ⇒ X local cruza el río
  scene.add(g); OBJ_TOTAL.n += 4;
  claim(b.x,b.z,LEN/2,WID/2+1,'puente',g.rotation.y,1.5);
}

/* --- MUELLE en la playa norte --- */
{
  const DX=-2, DZ=-53;
  const dir = Math.atan2(DX, DZ);                  // hacia fuera de la isla
  const hy = terrainH(DX,DZ);
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(3.2,0.24,7.5), MAT.plank, 0,0.5,1.6, 0, g);
  for(const px of [-1.4,1.4]) for(const pz of [-1.4,1.2,3.8])
    mesh(new THREE.CylinderGeometry(0.14,0.14,3.4,5), MAT.woodD, px,hy-0.9,pz, 0, g);
  g.position.set(DX,hy,DZ); g.rotation.y = dir;
  scene.add(g); OBJ_TOTAL.n += 1;
  claim(DX,DZ,2.4,4.6,'muelle',dir,2);
}

/* --- FAROLES de piedra a lo largo del camino --- */
{
  const lampGlow = [];
  for(let i=14;i<PATH_N-6;i+=34){
    const p=PATH_PTS[i];
    const px=-p.tz, pz=p.tx, side=(i/34)%2===0?1:-1;
    const lx=p.x+px*2.4*side, lz=p.z+pz*2.4*side;
    if(!farFromRiver(lx,lz,5.0)) continue;
    const h=terrainH(lx,lz); if(h<0.6) continue;
    const g=new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.22,0.3,1.0,6), MAT.stoneD, 0,0.5,0, 0, g);
    mesh(new THREE.BoxGeometry(0.55,0.55,0.55), MAT.stone, 0,1.25,0, 0.3, g);
    const cap = mesh(new THREE.ConeGeometry(0.55,0.4,6), MAT.stoneD, 0,1.72,0, 0, g);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),
      new THREE.MeshStandardMaterial({color:'#ffd98a', emissive:'#ffb84d', emissiveIntensity:0.15}));
    bulb.position.set(0,1.25,0); g.add(bulb);
    g.position.set(lx,h,lz); scene.add(g); OBJ_TOTAL.n++;
    lampGlow.push(bulb);
    claim(lx,lz,0.5,0.5,'farol',0,0.6);
  }
  window.__lampGlow = lampGlow;
}

/* --- reserva de rects grandes ANTES de sembrar vegetación (evita invasiones) --- */
claim(-16,-18,4.6,4.6,'jardin-pre',0,1.6);      // jardín zen
claim(-32,  8,6.0,6.0,'arboleda-pre',0,1.0);    // arboleda

/* --- vegetación instanciada (árboles, rocas, hierba, flores) --- */
{
  const dummy = new THREE.Object3D();
  const pines=[], rounds=[], rocksA=[], grass=[], flowers=[];
  const okSpot = (x,z,needH=1.8)=>{
    if(Math.hypot(x,z) > ISLE_R-3) return false;
    const h=terrainH(x,z); if(h<needH||h>21) return false;
    if(terrainSlope(x,z)>0.85) return false;
    if(!farFromRiver(x,z,6.2)) return false;
    if(!farFromPath(x,z,3.6)) return false;
    for(const o of OCC){ if(Math.abs(x-o.x)<o.hw+1.6 && Math.abs(z-o.z)<o.hd+1.6) return false; }
    return true;
  };
  let tries=0;
  while(pines.length+rounds.length < 92 && tries++<4000){
    const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*(ISLE_R-6);
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(!okSpot(x,z)) continue;
    const h=terrainH(x,z);
    const rec={x,z,y:h-0.15, s:0.8+Math.random()*0.7, ry:Math.random()*Math.PI*2};
    (h>10.5||Math.random()<0.35? pines:rounds).push(rec);
    OCC.push({x,z,hw:1.4*rec.s,hd:1.4*rec.s,rot:0});
  }
  tries=0;
  while(rocksA.length < 42 && tries++<2500){
    const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*(ISLE_R-2);
    const x=Math.cos(a)*r, z=Math.sin(a)*r, h=terrainH(x,z);
    if(h<0.1) continue;
    if(!farFromRiver(x,z,4.6) || !farFromPath(x,z,2.6)) continue;
    let bad=false; for(const o of OCC){ if(Math.abs(x-o.x)<o.hw+0.8 && Math.abs(z-o.z)<o.hd+0.8){bad=true;break;} }
    if(bad) continue;
    rocksA.push({x,z,y:h-0.2,s:0.5+Math.random()*1.3,ry:Math.random()*Math.PI*2});
    OCC.push({x,z,hw:0.8,hd:0.8,rot:0});
  }
  tries=0;
  while(grass.length < 170 && tries++<3000){
    const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*(ISLE_R-4);
    const x=Math.cos(a)*r, z=Math.sin(a)*r, h=terrainH(x,z);
    if(h<1.9||h>19) continue;
    if(!farFromRiver(x,z,4.4)) continue;
    grass.push({x,z,y:h,s:0.6+Math.random()*0.8,ry:Math.random()*Math.PI});
  }
  tries=0;
  while(flowers.length < 90 && tries++<2500){
    const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*(ISLE_R-4);
    const x=Math.cos(a)*r, z=Math.sin(a)*r, h=terrainH(x,z);
    if(h<1.9||h>11) continue;
    if(!farFromRiver(x,z,4.4) || !farFromPath(x,z,2.2)) continue;
    flowers.push({x,z,y:h,s:0.5+Math.random()*0.5});
  }
  function inst(g, m, arr, yOff=0, sMul=1){
    const im=new THREE.InstancedMesh(g,m,arr.length);
    arr.forEach((o,i)=>{
      dummy.position.set(o.x,o.y+yOff*o.s,o.z);
      dummy.rotation.set(0,o.ry||0,0);
      dummy.scale.setScalar(o.s*sMul);
      dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix);
    });
    im.castShadow=true; im.receiveShadow=true; scene.add(im); return im;
  }
  // pinos: tronco + 2 conos
  {
    const tr=inst(new THREE.CylinderGeometry(0.16,0.26,1.5,6), MAT.trunk, pines, 0.75);
    const c1=new THREE.InstancedMesh(new THREE.ConeGeometry(1.25,2.4,7), MAT.leafP, pines.length);
    const c2=new THREE.InstancedMesh(new THREE.ConeGeometry(0.9,1.9,7), MAT.leafP, pines.length);
    pines.forEach((o,i)=>{
      dummy.position.set(o.x,o.y+2.4*o.s,o.z); dummy.rotation.set(0,o.ry,0); dummy.scale.setScalar(o.s); dummy.updateMatrix(); c1.setMatrixAt(i,dummy.matrix);
      dummy.position.y=o.y+3.9*o.s; dummy.updateMatrix(); c2.setMatrixAt(i,dummy.matrix);
    });
    c1.castShadow=c2.castShadow=true; scene.add(c1); scene.add(c2);
    OBJ_TOTAL.n += pines.length;
  }
  // árboles redondos: tronco + copa icosaédrica
  {
    inst(new THREE.CylinderGeometry(0.2,0.3,1.7,6), MAT.trunk, rounds, 0.85);
    const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.35,0), MAT.leafR, rounds.length);
    rounds.forEach((o,i)=>{
      dummy.position.set(o.x,o.y+2.5*o.s,o.z); dummy.rotation.set(0,o.ry,0); dummy.scale.set(o.s*1.15,o.s,o.s*1.15);
      dummy.updateMatrix(); crown.setMatrixAt(i,dummy.matrix);
    });
    crown.castShadow=true; scene.add(crown);
    OBJ_TOTAL.n += rounds.length;
  }
  inst(new THREE.DodecahedronGeometry(1,0), MAT.stone, rocksA, 0.45);
  OBJ_TOTAL.n += rocksA.length;
  inst(new THREE.ConeGeometry(0.16,0.55,4), MAT.leafP, grass, 0.26);
  OBJ_TOTAL.n += grass.length;
  {
    const im=inst(new THREE.SphereGeometry(0.11,6,5), new THREE.MeshStandardMaterial({flatShading:true, roughness:0.8}), flowers, 0.3);
    const cols=['#e26d5c','#eec95c','#d978b5','#7ea4e0','#e8e5da'];
    flowers.forEach((o,i)=> im.setColorAt(i, new THREE.Color(cols[i%cols.length])));
    OBJ_TOTAL.n += flowers.length;
  }
}

/* --- JARDÍN DE LA CALMA (meseta nivel 2, oeste) con valla y arena rastrillada --- */
{
  const GX=-16, GZ=-18, gy=terrainH(GX,GZ);
  const g=new THREE.Group();
  const sand=new THREE.Mesh(new THREE.CircleGeometry(4.0,24).rotateX(-Math.PI/2),
    new THREE.MeshStandardMaterial({color:'#e4d9bd', flatShading:true, roughness:1}));
  sand.position.y=0.06; sand.receiveShadow=true; g.add(sand);
  for(const [rx,rz,s] of [[-1.7,-1.0,0.7],[1.8,0.5,0.9],[0.3,1.7,0.5],[-0.6,-1.8,0.45]]){
    mesh(new THREE.DodecahedronGeometry(s,0), MAT.stoneD, rx,s*0.5,rz, rx, g);
  }
  for(let a=0;a<14;a++){
    const t=a/14*Math.PI*2;
    mesh(new THREE.BoxGeometry(0.16,0.9,0.16), MAT.woodD, Math.cos(t)*4.35,0.45,Math.sin(t)*4.35, 0, g);
  }
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6),
    new THREE.MeshStandardMaterial({color:'#ffe1a1', emissive:'#ffbe5c', emissiveIntensity:0.2}));
  lamp.position.set(0,1.5,0); g.add(lamp);
  mesh(new THREE.CylinderGeometry(0.09,0.12,1.4,5), MAT.stoneD, 0,0.7,0, 0, g);
  window.__lampGlow.push(lamp);
  g.position.set(GX,gy,GZ); scene.add(g); OBJ_TOTAL.n += 19;
}

/* --- ARBOLEDA (nodo del nivel 1) --- */
{
  const CX=-32, CZ=8;
  for(let i=0;i<8;i++){
    const t=i/8*Math.PI*2, x=CX+Math.cos(t)*4.6, z=CZ+Math.sin(t)*4.6;
    const h=terrainH(x,z), s=1.0+hash2(i*7.3,i)*0.5;
    const tr=mesh(new THREE.CylinderGeometry(0.2,0.32,1.8*s,6), MAT.trunk, x,h+0.9*s,z);
    const cr=mesh(new THREE.IcosahedronGeometry(1.5*s,0), MAT.leafR, x,h+2.7*s,z, hash2(i,i*3));
    cr.scale.set(1.15*s,s,1.15*s);
    OBJ_TOTAL.n++;
  }
  claim(CX,CZ,6,6,'arboleda',0,1);
}

/* --- ROCAS FLOTANTES (acento místico) --- */
const floaters=[];
{
  const mats=[MAT.stone, MAT.stoneD];
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2+0.5, r=68+hash2(i,3)*16;
    const x=Math.cos(a)*r, z=Math.sin(a)*r, y=6.5+hash2(i,9)*8;
    const g=new THREE.Group();
    const n=2+((i%2)|0);
    for(let k=0;k<n;k++){
      const rk=mesh(new THREE.DodecahedronGeometry(1.6-hash2(i,k)*0.9,0), mats[k%2],
        (hash2(k,i)-0.5)*3.2, (hash2(i,k)-0.5)*1.6, (hash2(k+1,i)-0.5)*3.2, hash2(i*3,k), g);
      rk.castShadow=false;
    }
    g.position.set(x,y,z); scene.add(g);
    floaters.push({g, y0:y, ph:hash2(i,5)*6.28, sp:0.3+hash2(i,7)*0.3});
    OBJ_TOTAL.n += n;
  }
}
