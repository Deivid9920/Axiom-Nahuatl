/* ============================================================
   AXIOM · Isla del Conocimiento — terreno de montaña real
   FIX socavón: el perfil SUBE hacia la cumbre (antes quedaba
   invertido y el centro se hundía como cráter).
   ============================================================ */

const ISLE_R   = 58;                      // radio de la isla (tile 128×128)
const PEAK     = { x: -9, z: -7 };        // cumbre ligeramente descentrada (NW)
const MTN_R    = 46;                      // radio de la montaña
const LVL      = [1.5, 9.2, 17.2, 26.0];  // playa/vega · nivel 1 · nivel 2 · cumbre
const SEA_Y    = 0.30;

const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const smoothstep = (a,b,x)=>{ x=clamp((x-a)/(b-a),0,1); return x*x*(3-2*x); };
const lerp = (a,b,t)=>a+(b-a)*t;

/* --- ruido de valor determinista --- */
function hash2(x,z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function vnoise(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const a=hash2(xi,zi), b=hash2(xi+1,zi), c=hash2(xi,zi+1), d=hash2(xi+1,zi+1);
  const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
function fbm(x,z){ return vnoise(x,z)*0.6 + vnoise(x*2.13+7.3,z*2.13-3.1)*0.28 + vnoise(x*4.31-2.7,z*4.31+5.9)*0.12; }

/* --- perfil base de la montaña: 0 en la costa → LVL[3] en la cumbre ---
   TRES NIVELES EN TERRAZA: mesetas amplias + transiciones cortas y empinadas. */
function mountainH(x,z){
  const d = Math.hypot(x-PEAK.x, z-PEAK.z);
  const p = clamp(1 - d/MTN_R, 0, 1);          // 0 costa → 1 cumbre
  const seg = Math.min(2.999, p*3);
  const i = Math.floor(seg), f = seg-i;
  const b = smoothstep(0.45, 0.88, f);          // meseta ancha, escalón corto
  let h = lerp(LVL[i], LVL[i+1], b);
  h += (fbm(x*0.055+9.2, z*0.055-4.7)-0.5) * (1.4 + p*2.6);   // relieve natural
  return h;
}


const riverCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-4,-0,-16),    // manantial en la meseta alta (a 10.3 de la cumbre)
  new THREE.Vector3(6,-0,-12),
  new THREE.Vector3(13,-0,-2),
  new THREE.Vector3(16,-0,10),
  new THREE.Vector3(13,-0,24),
  new THREE.Vector3(7,-0, 34),
  new THREE.Vector3(-5,-0, 42),
  new THREE.Vector3(-19,-0, 49),   // desembocadura SW
]);
const RS = [];                                    // estaciones del río
{
  const N = 240;
  for(let i=0;i<=N;i++){
    const t=i/N, pt=riverCurve.getPoint(t), tg=riverCurve.getTangent(t).normalize();
    const rC = Math.hypot(pt.x, pt.z);
    const mask = 1 - smoothstep(ISLE_R-7, ISLE_R+2, rC);
    RS.push({ x:pt.x, z:pt.z, tx:tg.x, tz:tg.z, hRaw: Math.max(0.15, mountainH(pt.x,pt.z)*mask) });
  }
  RS[0].h = RS[0].hRaw;                                     // ← antes del bucle (evita NaN)
  for(let i=1;i<RS.length;i++) RS[i].h = Math.min(RS[i].hRaw, RS[i-1].h);   // descenso monótono → cascadas
}
function riverDist(x,z){                          // distancia a la línea central del río
  let best=1e12, bi=0;
  for(let i=0;i<RS.length;i++){
    const dx=x-RS[i].x, dz=z-RS[i].z, q=dx*dx+dz*dz;
    if(q<best){ best=q; bi=i; }
  }
  return { d: Math.sqrt(best), i: bi };
}

/* --- ALTURA FINAL DEL TERRENO (analítica: la usa el motor Y el lémur) --- */
function terrainH(x,z){
  const rC = Math.hypot(x,z);
  const mask = 1 - smoothstep(ISLE_R-7, ISLE_R+2, rC);      // 1 dentro → 0 costa
  let h = mountainH(x,z) * mask;
  h -= smoothstep(ISLE_R-1, ISLE_R+16, rC) * 7;             // lecho marino
  // VEGA costera suave (llanura exterior, sin cráter)
  // Río: excavar cauce con orillas suaves
  const rv = riverDist(x,z);
  if(rv.d < 8.5){
    const w = 3.6;
    const k = 1 - smoothstep(w*0.5, w*1.9, rv.d);           // 1 cauce → 0 orilla
    const bed = RS[rv.i].h - 1.15;
    h = lerp(h, Math.min(h, bed), k);
  }
  return h;
}
function terrainSlope(x,z){
  const e=0.9;
  const hx = terrainH(x+e,z)-terrainH(x-e,z), hz = terrainH(x,z+e)-terrainH(x,z-e);
  return Math.hypot(hx,hz)/(2*e);
}

/* --- malla del terreno con colores por vértice --- */
const terrainGeo = new THREE.PlaneGeometry(150,150,168,168);
terrainGeo.rotateX(-Math.PI/2);
{
  const pos = terrainGeo.attributes.position;
  const col = new Float32Array(pos.count*3);
  const GRID = 169, CELL = 150/168;                 // rejilla 169×169 de PlaneGeometry
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    pos.setY(i, terrainH(x,z));
  }
  const C = {
    sandLo:new THREE.Color('#b9a77c'), sand:new THREE.Color('#dcc78f'),
    grassA:new THREE.Color('#79a75e'), grassB:new THREE.Color('#5d8f4a'),
    grassHi:new THREE.Color('#93bd6c'), cliff:new THREE.Color('#8f7f68'),
    rock:new THREE.Color('#87827a'), peak:new THREE.Color('#a3a7ad'),
    sea:new THREE.Color('#8fae9b')
  };
  const c = new THREE.Color();
  const deepSea = new THREE.Color('#2e7d9e');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    const h=pos.getY(i);
    // pendiente desde vecinos de la rejilla (rápido)
    const gx=i%GRID, gz=(i/GRID)|0;
    const hx1=pos.getY(i - (gx>0?1:0)), hx2=pos.getY(i + (gx<GRID-1?1:0));
    const hz1=pos.getY(i - (gz>0?GRID:0)), hz2=pos.getY(i + (gz<GRID-1?GRID:0));
    const sl=Math.max(
      Math.abs(hx2-hx1)/((gx>0&&gx<GRID-1?2:1)*CELL),
      Math.abs(hz2-hz1)/((gz>0&&gz<GRID-1?2:1)*CELL)
    );
    const n=fbm(x*0.09+3.3,z*0.09+8.8);
    if(h<0.15) c.copy(C.sea);
    else if(h<2.1) c.copy(C.sand).lerp(C.sandLo, smoothstep(1.2,-0.2,h)*0.6);
    else if(h>22.5) c.copy(C.peak).lerp(C.rock, clamp((26-h)/4,0,1)*0.55);
    else if(sl>0.85) c.copy(C.cliff).lerp(C.rock, clamp((sl-0.85)/0.8,0,1));
    else {
      c.copy(C.grassA).lerp(C.grassB,n);
      if(h>12) c.lerp(C.rock, smoothstep(12,17,h)*0.35);
      if(n>0.62) c.lerp(C.grassHi,0.4);
    }
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  // desvanecer el borde del plano (lecho marino) hacia tono de agua profunda
  for(let i=0;i<pos.count;i++){
    const rC=Math.hypot(pos.getX(i), pos.getZ(i));
    const k=smoothstep(64, 73, rC)*0.9;
    col[i*3]  = lerp(col[i*3],   deepSea.r, k);
    col[i*3+1]= lerp(col[i*3+1], deepSea.g, k);
    col[i*3+2]= lerp(col[i*3+2], deepSea.b, k);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(col,3));
  terrainGeo.computeVertexNormals();
}
const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, metalness:0}));
terrain.receiveShadow = true;
terrain.castShadow = false;
scene.add(terrain);

/* --- mar --- */
const sea = new THREE.Mesh(
  new THREE.CircleGeometry(800, 64).rotateX(-Math.PI/2),
  new THREE.MeshStandardMaterial({color:'#3f8fb0', transparent:true, opacity:0.93, roughness:0.35, metalness:0.05})
);
sea.position.y = SEA_Y;
scene.add(sea);

/* --- lámina de agua del río (cinta sobre el cauce) --- */
const falls = [];
{
  const W = 3.2, vts=[], idx=[], uvs=[];
  for(let i=0;i<RS.length;i++){
    const s=RS[i], px=-s.tz, pz=s.tx;                 // perpendicular en XZ
    const y = s.h - 0.35;
    vts.push(s.x+px*W, y, s.z+pz*W,  s.x-px*W, y, s.z-pz*W);
    uvs.push(0,i/RS.length, 1,i/RS.length);
    if(i<RS.length-1){ const a=i*2; idx.push(a,a+2,a+1, a+1,a+2,a+3); }
    // cascada donde el cauce cae de golpe (escalón de terraza)
    if(i>0 && RS[i-1].h - s.h > 2.6){
      const yTop = RS[i-1].h - 0.30;
      falls.push({x:s.x, z:s.z, yTop, yBot:y, w:W, px, pz});
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vts,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(idx); g.computeVertexNormals();
  const water = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:'#5ec2de', transparent:true, opacity:0.8, roughness:0.25, side:THREE.DoubleSide}));
  scene.add(water);
  for(const f of falls){
    const q = new THREE.Mesh(new THREE.PlaneGeometry(f.w*2, Math.max(1.2,f.yTop-f.yBot)),
      new THREE.MeshStandardMaterial({color:'#bfe9f5', transparent:true, opacity:0.55, side:THREE.DoubleSide, roughness:0.2}));
    q.position.set(f.x, (f.yTop+f.yBot)/2, f.z);
    q.rotation.y = Math.atan2(-f.pz, f.px);         // hoja vertical, ancho ⟂ al flujo
    scene.add(q);
  }
}
