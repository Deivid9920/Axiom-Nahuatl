/* ============================================================
   Lémur mascota, gameplay, nodos, día/noche, bucle
   ============================================================ */

/* --- LÉMUR de cola anillada (primitivas flat-shaded) --- */
const lemur = new THREE.Group();
const lemParts = {};
{
  const furM  = new THREE.MeshStandardMaterial({color:'#d9d4ca', flatShading:true, roughness:0.9});
  const darkM = new THREE.MeshStandardMaterial({color:'#3a3733', flatShading:true, roughness:0.9});
  const whiteM= new THREE.MeshStandardMaterial({color:'#f4f1ea', flatShading:true, roughness:0.85});
  const mk=(geo,m,x,y,z)=>{ const o=new THREE.Mesh(geo,m); o.position.set(x,y,z); o.castShadow=true; lemur.add(o); return o; };

  const body = mk(new THREE.SphereGeometry(0.5,10,8), furM, 0,0.78,0); body.scale.set(0.88,1.0,1.18);
  const belly= mk(new THREE.SphereGeometry(0.36,9,7), whiteM, 0,0.74,0.22); belly.scale.set(0.75,0.9,0.95);
  const head = mk(new THREE.SphereGeometry(0.42,10,8), furM, 0,1.42,0.14); head.scale.set(0.95,0.9,0.95);
  mk(new THREE.SphereGeometry(0.16,7,6), darkM, 0,1.3,0.52).scale.set(1.15,0.85,1.1);   // hocico
  mk(new THREE.SphereGeometry(0.05,6,5), darkM, 0,1.38,0.62);                            // nariz
  for(const sx of [-1,1]) mk(new THREE.SphereGeometry(0.15,7,6), darkM, sx*0.3,1.74,0.08).scale.set(0.7,1,0.5);
  for(const sx of [-1,1]){
    mk(new THREE.SphereGeometry(0.1,7,6), whiteM, sx*0.17,1.5,0.47);
    mk(new THREE.SphereGeometry(0.048,6,5), darkM, sx*0.17,1.5,0.55);
  }
  // extremidades con pivote en el hombro/cadera
  function limb(x,y,z,len,r){
    const p=new THREE.Group(); p.position.set(x,y,z);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.8,len,6), darkM);
    m.position.y=-len/2; m.castShadow=true; p.add(m);
    const foot=new THREE.Mesh(new THREE.SphereGeometry(r*1.15,6,5), darkM);
    foot.position.y=-len; foot.scale.set(1,0.6,1.4); p.add(foot);
    lemur.add(p); return p;
  }
  lemParts.armL = limb(-0.4,1.05,0.28,0.55,0.09);
  lemParts.armR = limb( 0.4,1.05,0.28,0.55,0.09);
  lemParts.legL = limb(-0.26,0.55,0.1,0.55,0.11);
  lemParts.legR = limb( 0.26,0.55,0.1,0.55,0.11);
  // cola anillada hacia arriba
  const tail = new THREE.Group(); tail.position.set(0,0.9,-0.5);
  for(let i=0;i<9;i++){
    const t=i/8, r=0.13-0.03*t;
    const seg=new THREE.Mesh(new THREE.SphereGeometry(r,7,6), i%2?whiteM:darkM);
    seg.position.set(0, t*1.35, -Math.sin(t*1.2)*0.35);
    seg.castShadow=true; tail.add(seg);
  }
  lemur.add(tail); lemParts.tail=tail;
  scene.add(lemur);
  OBJ_TOTAL.n++;
}
lemur.position.set(PATH_PTS[3].x, terrainH(PATH_PTS[3].x,PATH_PTS[3].z), PATH_PTS[3].z);
lemur.scale.setScalar(1.12);

/* --- NODOS de conocimiento --- */
function labelSprite(txt){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128;
  const c=cv.getContext('2d');
  c.fillStyle='rgba(13,16,24,0.82)';
  const r=26,w=500,h=120;
  c.beginPath(); c.roundRect(6,4,w,h,r); c.fill();
  c.strokeStyle='rgba(255,255,255,0.28)'; c.lineWidth=3; c.stroke();
  c.fillStyle='#ffffff'; c.font='600 44px system-ui, sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  c.fillText(txt, 256, 66, 470);
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx, transparent:true, depthWrite:false}));
  sp.scale.set(6.2,1.55,1);
  return sp;
}
const NODES_DATA = [
  { t:'Portal del Torii', L:0, x:PATH_PTS[0].x+2.6, z:PATH_PTS[0].z-1.8,
    b:'Un torii separa el mundo cotidiano de un espacio dedicado al saber. Cada vez que cruzas una puerta de aprendizaje —un curso, un libro, una pregunta nueva— dejas atrás lo que creías saber y entras en territorio de curiosidad.',
    tip:'Consejo: escribe la pregunta que te trajo aquí. Será tu brújula durante toda la travesía.' },
  { t:'Muelle de la Curiosidad', L:0, x:-5, z:-49,
    b:'Los grandes descubrimientos empiezan observando antes de navegar. El muelle es el lugar del explorador: mirar el horizonte, formular hipótesis y preparar el equipo antes de lanzarse a aguas desconocidas.',
    tip:'Consejo: antes de buscar respuestas, dedica un minuto a formular mejor la pregunta.' },
  { t:'Puente del Encuentro', L:0, x:0, z:0, useBridge:true,
    b:'Un puente no elimina al río: lo cruza. Las disciplinas funcionan igual —la matemática dialoga con el arte, la ciencia con la historia—. Las mejores ideas aparecen donde dos orillas se conectan.',
    tip:'Consejo: relaciona lo que aprendes hoy con algo que ya sabías de otro tema.' },
  { t:'Casa del Saber', L:0, x:0, z:0, useHouse:true,
    b:'La lectura es una casa que se habita: cada libro es una habitación nueva. En esta villa el conocimiento se guarda, se comparte y se vuelve historia común; leer en comunidad multiplica lo aprendido.',
    tip:'Consejo: explica en voz alta lo que acabas de leer; enseñar es la mejor forma de aprender.' },
  { t:'Arboleda del Saber', L:1, x:-31.2, z:8.6,
    b:'Bajo el suelo, las raíces de un bosque se conectan entre sí y comparten nutrientes. El conocimiento también crece en red: cada idea nueva echa raíces en las que ya tenías y se hace más fuerte junto a otras.',
    tip:'Consejo: construye mapas mentales; verás cómo las ideas se enlazan entre sí.' },
  { t:'Jardín de la Calma', L:2, x:-11.5, z:-21.5,
    b:'Un jardín de rocas no es adorno: es una invitación a la concentración. La atención es como un músculo; la práctica deliberada, constante y centrada, es lo que convierte esfuerzo en dominio.',
    tip:'Consejo: estudia en bloques cortos y sin distracciones; la calma también se entrena.' },
  { t:'Cumbre del Conocimiento', L:3, x:-9, z:-7,
    b:'Desde la cumbre ves todo el recorrido: la playa, la aldea, el bosque, el jardín. El conocimiento se construye por capas, como esta montaña: cada nivel se apoya firmemente en el anterior. ¡La próxima cumbre es tuya!',
    tip:'Consejo: repasa el camino recorrido cada semana; así consolidas cada nivel antes de subir al siguiente.' },
];
const nodes=[];
{
  const ringGeo=new THREE.TorusGeometry(1.0,0.07,6,26);
  for(const nd of NODES_DATA){
    let x=nd.x, z=nd.z;
    if(nd.useBridge){ const p=5.6; x=BRIDGE.x-BRIDGE.tz*p; z=BRIDGE.z+BRIDGE.tx*p; }   // ⟂ al río
    if(nd.useHouse){ x=27.5; z=18; }
    const h=terrainH(x,z);
    const g=new THREE.Group();
    const ped=mesh(new THREE.CylinderGeometry(0.55,0.7,1.1,7), MAT.stoneD, 0,0.55,0, 0, g);
    mesh(new THREE.CylinderGeometry(0.08,0.1,2.9,5), MAT.woodD, 0,2.2,0, 0, g);
    const flag=mesh(new THREE.BoxGeometry(1.15,0.66,0.05), MAT.red, 0.62,3.3,0, 0, g);
    const ring=new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({color:'#e8b84b', emissive:'#8a6210', emissiveIntensity:0.7, flatShading:true}));
    ring.rotation.x=Math.PI/2; ring.position.y=0.28; g.add(ring);
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(0.34,0),
      new THREE.MeshStandardMaterial({color:'#5aa9ff', emissive:'#2f6fd8', emissiveIntensity:0.9, flatShading:true}));
    gem.position.y=3.55; g.add(gem);
    const sp=labelSprite(nd.t); sp.position.y=4.5; g.add(sp);
    g.position.set(x,h,z); scene.add(g);
    nodes.push({data:nd, g, ring, gem, flag, sp, x, z, visited:false});
    OBJ_TOTAL.n++;
    claim(x,z,1.1,1.1,'nodo:'+nd.t,0,0.8);
  }
}
window.__nodeCount = nodes.length;

/* --- ESTADO Y ENTRADA --- */
const $=id=>document.getElementById(id);
const visited=new Set();
try{ (JSON.parse(localStorage.getItem('axiom-isla-nodos')||'[]')).forEach(i=>visited.add(i)); }catch(e){}
function refreshChip(){ $('nodos').innerHTML = `Nodos <b>${visited.size}/7</b><small>(E)</small>`; }
refreshChip();

const keys={};
let modalOpen=false, nightOn=false, nightT=0;
addEventListener('keydown', e=>{
  if(e.code==='Space') e.preventDefault();
  keys[e.code]=true;
  if(e.code==='KeyN' && !e.repeat) toggleNight();
  if(e.code==='KeyC' && !e.repeat) toggleCam();
  if(e.code==='KeyE'){ e.preventDefault(); modalOpen? closeModal() : tryOpenNode(); }
  if(e.code==='Escape' && modalOpen) closeModal();
});
addEventListener('keyup', e=>{ keys[e.code]=false; });
$('mBtn').addEventListener('click', ()=>closeModal());
$('btnNoche').addEventListener('click', ()=>toggleNight());
$('btnCam').addEventListener('click', ()=>toggleCam());
function toggleNight(){
  nightOn=!nightOn;
  $('btnNoche').innerHTML = (nightOn?'Día':'Noche') + ' <small>(N)</small>';
}
function toggleCam(){
  camMode = camMode==='libre'?'seguir':'libre';
  $('btnCam').innerHTML = `Cámara: ${camMode} <small>(C)</small>`;
  if(camMode==='seguir'){ followDist=15; }
}

/* --- NODOS: interacción --- */
let nearNode=null;
function tryOpenNode(){
  if(!nearNode) return;
  const nd=nearNode;
  $('mTag').textContent = 'Nodo de conocimiento · nivel ' + nd.data.L;
  $('mTitle').textContent = nd.data.t;
  $('mBody').textContent = nd.data.b;
  $('mTip').textContent = nd.data.tip;
  $('modal').style.display='flex';
  modalOpen=true;
}
function closeModal(){
  $('modal').style.display='none'; modalOpen=false;
  if(nearNode && !nearNode.visited){
    nearNode.visited=true;
    visited.add(NODES_DATA.indexOf(nearNode.data));
    try{ localStorage.setItem('axiom-isla-nodos', JSON.stringify([...visited])); }catch(e){}
    nearNode.ring.material.color.set('#6fd08c'); nearNode.ring.material.emissive.set('#2c7a48');
    nearNode.gem.material.color.set('#6fd08c'); nearNode.gem.material.emissive.set('#2c7a48');
    nearNode.flag.material = MAT.leafR;
    refreshChip();
  }
}

/* --- CÁMARA --- */
let camMode='libre', az=0.85, el=0.95, dist=97, followDist=15;
const camTarget=new THREE.Vector3(0,7,0);
const camPos=new THREE.Vector3();
function sph(az_,el_,d_){ return new THREE.Vector3(Math.sin(az_)*Math.cos(el_)*d_, Math.sin(el_)*d_, Math.cos(az_)*Math.cos(el_)*d_); }
let dragging=false, lastX=0, lastY=0, panMode=false;
renderer.domElement.addEventListener('pointerdown', e=>{
  dragging=true; panMode=e.shiftKey; lastX=e.clientX; lastY=e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
addEventListener('pointerup', ()=>{ dragging=false; });
addEventListener('pointermove', e=>{
  if(!dragging) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  if(panMode && camMode==='libre'){
    const k=dist*0.0016;
    const fx=-Math.sin(az), fz=-Math.cos(az);           // adelante (en plano)
    const rx=Math.cos(az), rz=-Math.sin(az);            // derecha
    camTarget.x += (-rx*dx + fx*dy)*k;
    camTarget.z += (-rz*dx + fz*dy)*k;
    const r=Math.hypot(camTarget.x,camTarget.z);
    if(r>72){ camTarget.x*=72/r; camTarget.z*=72/r; }
  }else{
    az -= dx*0.0052;
    el = clamp(el + dy*0.0042, 0.10, 1.48);
  }
});
renderer.domElement.addEventListener('wheel', e=>{
  e.preventDefault();
  dist = clamp(dist*Math.exp(e.deltaY*0.0011), camMode==='libre'?8:6, camMode==='libre'?180:44);
},{passive:false});

/* --- MOVIMIENTO DEL LÉMUR --- */
const vel=new THREE.Vector3();
let vy=0, grounded=true, walkPhase=0, faceYaw=0;
const WALK=7.6, RUN=13.2, GRAV=30, JUMPV=11.5;
function updateLemur(dt){
  const f=(keys['KeyW']?1:0)-(keys['KeyS']?1:0);
  const s=(keys['KeyD']?1:0)-(keys['KeyA']?1:0);
  const run=keys['ShiftLeft']||keys['ShiftRight'];
  let mx=0,mz=0;
  if((f||s) && !modalOpen){
    const fx=-Math.sin(az), fz=-Math.cos(az);
    const rx=Math.cos(az), rz=-Math.sin(az);
    mx = fx*f + rx*s; mz = fz*f + rz*s;
    const l=Math.hypot(mx,mz)||1; mx/=l; mz/=l;
    const sp=run?RUN:WALK;
    const nx=lemur.position.x+mx*sp*dt, nz=lemur.position.z+mz*sp*dt;
    // no adentrarse en alta mar
    if(Math.hypot(nx,nz)<ISLE_R+14 && terrainH(nx,nz)>-1.4){ lemur.position.x=nx; lemur.position.z=nz; }
    faceYaw = Math.atan2(mx,mz);
  }
  vel.set(mx,0,mz);
  const ground = terrainH(lemur.position.x, lemur.position.z);
  if((keys['Space']) && grounded && !modalOpen){ vy=JUMPV; grounded=false; }
  vy-=GRAV*dt; lemur.position.y+=vy*dt;
  if(lemur.position.y<=ground){ lemur.position.y=ground; vy=0; grounded=true; }
  const moving = (mx||mz)?1:0;
  faceYaw = lemur.rotation.y + shortest(faceYaw-lemur.rotation.y)*(moving?Math.min(1,dt*12):0);
  lemur.rotation.y = faceYaw;
  // animación
  walkPhase += dt*(moving?(run?15:10):2.2);
  const sw = moving?0.62:0.05;
  const c=Math.sin(walkPhase);
  lemParts.legL.rotation.x =  c*sw; lemParts.legR.rotation.x = -c*sw;
  lemParts.armL.rotation.x = -c*sw*0.8; lemParts.armR.rotation.x = c*sw*0.8;
  if(!grounded){ lemParts.armL.rotation.x=-1.2; lemParts.armR.rotation.x=-1.2; lemParts.legL.rotation.x=0.5; lemParts.legR.rotation.x=-0.4; }
  lemur.position.y += moving&&grounded ? Math.abs(c)*0.06 : 0;
  lemParts.tail.rotation.z = Math.sin(perfT*2.6)*0.16;
  lemParts.tail.rotation.x = -0.12 + (moving?0.1:0);
}
function shortest(a){ return Math.atan2(Math.sin(a),Math.cos(a)); }

/* --- DÍA / NOCHE --- */
const skyDay={top:new THREE.Color('#7fa8c9'), bot:new THREE.Color('#d9d3dd')};
const skyNight={top:new THREE.Color('#0b1030'), bot:new THREE.Color('#1c2340')};
const fogDay=new THREE.Color('#c9c4cf'), fogNight=new THREE.Color('#141a30');
const seaDay=new THREE.Color('#3f8fb0'), seaNight=new THREE.Color('#12395c');
function updateNight(dt){
  const tgt=nightOn?1:0;
  nightT += clamp(tgt-nightT, -dt*0.8, dt*0.8);
  const t=smoothstep(0,1,nightT);
  sun.intensity=lerp(1.85,0.05,t);
  hemi.intensity=lerp(0.85,0.16,t);
  moon.intensity=lerp(0,0.5,t);
  amb.intensity=lerp(0,0.32,t);
  skyUni.top.value.copy(skyDay.top).lerp(skyNight.top,t);
  skyUni.bot.value.copy(skyDay.bot).lerp(skyNight.bot,t);
  scene.fog.color.copy(fogDay).lerp(fogNight,t);
  sea.material.color.copy(seaDay).lerp(seaNight,t);
  stars.material.opacity=t*0.9;
  for(const b of window.__lampGlow) b.material.emissiveIntensity=lerp(0.15,2.4,t);
}

/* --- BUCLE --- */
let perfT=0, lastT=performance.now();
function tick(){
  requestAnimationFrame(tick);
  const now=performance.now();
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; perfT+=dt;
  updateLemur(dt);
  updateNight(dt);
  // cámara
  let desired;
  if(camMode==='libre'){ desired=camTarget.clone().add(sph(az,el,dist)); }
  else{
    const t=lemur.position.clone().add(new THREE.Vector3(0,1.9,0));
    desired=t.add(sph(az,0.34+el*0.12,followDist));
  }
  camPos.lerp(desired, 1-Math.exp(-dt*7));
  camera.position.copy(camPos);
  camera.lookAt(camMode==='libre'?camTarget:lemur.position.clone().add(new THREE.Vector3(0,1.5,0)));
  // sol sigue para sombras estables
  sun.target.position.copy(camMode==='libre'?camTarget:lemur.position);
  sun.position.copy(sun.target.position).add(new THREE.Vector3(70,95,40));
  // nodos
  let best=1e9, bn=null;
  for(const nd of nodes){
    nd.ring.rotation.z += dt*0.8;
    nd.gem.rotation.y += dt*1.4;
    nd.gem.position.y = 3.55 + Math.sin(perfT*2+nd.x)*0.12;
    nd.sp.material.opacity = dist>70?0.0:1;   // etiquetas lejos: ocultas
    if(!nd.visited && camMode!=='libre'){ /* nada */ }
    const q=Math.hypot(lemur.position.x-nd.x, lemur.position.z-nd.z);
    if(q<best){ best=q; bn=nd; }
  }
  nearNode = (best<4.8 && !modalOpen)? bn : null;
  if(nearNode){ $('prompt').style.display='block'; $('promptTxt').textContent = (nearNode.visited?'Revisar nodo: ':'Abrir nodo: ')+nearNode.data.t; }
  else $('prompt').style.display='none';
  // rocas flotantes
  for(const fl of floaters){ fl.g.position.y = fl.y0 + Math.sin(perfT*fl.sp+fl.ph)*0.9; fl.g.rotation.y += dt*0.05; }
  renderer.render(scene,camera);
}
addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
$('sub').textContent = `Prototipo jugable — three.js r180 · 3 niveles · ${OBJ_TOTAL.n} objetos`;

/* --- hooks para verificación automatizada (capturas) --- */
window.__cam=(a,e,d,tx=0,tz=0)=>{ az=a*Math.PI/180; el=e*Math.PI/180; dist=d; camTarget.set(tx,Math.max(2,terrainH(tx,tz)+2),tz); camMode='libre'; };
window.__lemurTo=(i)=>{ const p=PATH_PTS[clamp(i|0,0,PATH_N)]; lemur.position.set(p.x,terrainH(p.x,p.z),p.z); camMode='seguir'; };
window.__night=(b)=>{ nightOn=!!b; nightT=nightOn?1:0; $('btnNoche').innerHTML=(nightOn?'Día':'Noche')+' <small>(N)</small>'; };
window.__state=()=>({ ready:true, err:window.__err, nodes:visited.size, objs:OBJ_TOTAL.n,
  lemur:[lemur.position.x,lemur.position.y,lemur.position.z].map(v=>+v.toFixed(1)),
  bridge:BRIDGE, falls:falls.length });
tick();
