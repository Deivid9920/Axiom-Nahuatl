/* ============================================================
   Escena, renderizado, luces y cielo
   ============================================================ */
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 900);

/* --- cielo: cúpula con degradado --- */
const skyUni = {
  top:{value:new THREE.Color('#7fa8c9')}, bot:{value:new THREE.Color('#d9d3dd')},
  off:{value:0.12}, night:{value:0}
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(650, 24, 14),
  new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false,
    uniforms: skyUni,
    vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 top; uniform vec3 bot; uniform float off; varying vec3 vP;
      void main(){ float t=smoothstep(-off, 320.0, vP.y); gl_FragColor=vec4(mix(bot,top,t),1.0); }`
  })
);
scene.add(sky);
scene.fog = new THREE.Fog('#c9c4cf', 120, 520);

/* --- estrellas --- */
const stars = (()=>{
  const n=900, a=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const u=Math.random()*Math.PI*2, v=Math.random()*0.9+0.08, r=600;
    a[i*3]=Math.cos(u)*Math.cos(v)*r; a[i*3+1]=Math.sin(v)*r; a[i*3+2]=Math.sin(u)*Math.cos(v)*r;
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a,3));
  const m=new THREE.PointsMaterial({color:'#dfe8ff', size:1.6, sizeAttenuation:false, transparent:true, opacity:0, depthWrite:false, fog:false});
  const p=new THREE.Points(g,m); scene.add(p); return p;
})();

/* --- luces --- */
const hemi = new THREE.HemisphereLight('#cfe4f2', '#6b6252', 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff2dc', 1.85);
sun.position.set(70, 95, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-85; sun.shadow.camera.right=85;
sun.shadow.camera.top=85; sun.shadow.camera.bottom=-85;
sun.shadow.camera.near=10; sun.shadow.camera.far=260;
sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);
const moon = new THREE.DirectionalLight('#8fa8d8', 0.0);
moon.position.set(-60, 80, -30); scene.add(moon);
const amb = new THREE.AmbientLight('#5a6a86', 0.0); scene.add(amb);
