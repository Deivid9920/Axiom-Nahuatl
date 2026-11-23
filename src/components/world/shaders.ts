// R36 — shaders y materiales animados del mundo: uniforms globales de viento,
// inyección de vaivén por shader, cúpula del cielo y agua con olas analíticas.
// Extraídos tal cual de landscape3d.tsx (refactor por extracción, sin cambios).
import type * as THREE from 'three'

// Uniforms globales compartidos por todos los materiales con viento
export const sharedU = { uTime: { value: 0 }, uWind: { value: 0.5 } }

// Inyección de viento: las copas y la hierba se mecen (más arriba, más)
export function addWindSway(mat: THREE.Material, ampX: number, ampZ: number, hMin: number, hMax: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedU.uTime
    shader.uniforms.uWind = sharedU.uWind
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 axWp = instanceMatrix * vec4(transformed, 1.0);
        float axH = smoothstep(${hMin.toFixed(2)}, ${hMax.toFixed(2)}, axWp.y);
        transformed.x += sin(uTime * 1.45 + axWp.x * 0.42 + axWp.z * 0.61) * uWind * axH * ${ampX.toFixed(3)};
        transformed.z += cos(uTime * 1.05 + axWp.x * 0.31 + axWp.z * 0.44) * uWind * axH * ${ampZ.toFixed(3)};
      #endif`
    )
  }
}

// Cielo: cúpula con degradado + halo cálido alrededor del sol
export const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
export const SKY_FS = `
varying vec3 vDir;
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunTint;
void main(){
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(uHor, uTop, pow(h, 0.58));
  float glow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 5.0);
  col += uSunTint * glow * 0.32;
  gl_FragColor = vec4(col, 1.0);
}`

// Agua: 3 olas sumadas en el vertex shader, normales analíticas, fresnel
export const WATER_VS = `
uniform float uTime;
varying vec3 vWp; varying float vH;
float wH(vec2 p, float t){
  return sin(p.x * 0.55 + t * 1.35) * 0.085
       + sin(p.y * 0.85 + t * 1.9) * 0.06
       + sin((p.x + p.y) * 0.32 + t * 0.8) * 0.11;
}
void main(){
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  float h = wH(wp.xz, uTime);
  wp.y += h; vH = h; vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
export const WATER_FS = `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSunDir; uniform float uSunI;
varying vec3 vWp; varying float vH;
void main(){
  float e = 0.14;
  float hX = sin((vWp.x + e) * 0.55 + uTime * 1.35) * 0.085 + sin(vWp.z * 0.85 + uTime * 1.9) * 0.06 + sin((vWp.x + e + vWp.z) * 0.32 + uTime * 0.8) * 0.11;
  float hZ = sin(vWp.x * 0.55 + uTime * 1.35) * 0.085 + sin((vWp.z + e) * 0.85 + uTime * 1.9) * 0.06 + sin((vWp.x + vWp.z + e) * 0.32 + uTime * 0.8) * 0.11;
  vec3 n = normalize(vec3(-(hX - vH) / e, 1.0, -(hZ - vH) / e));
  vec3 viewDir = normalize(cameraPosition - vWp);
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);
  vec3 col = mix(uDeep, uShallow, clamp(0.35 + fres * 0.75 + vH * 0.9, 0.0, 1.0));
  vec3 sun = normalize(uSunDir);
  float dist = length(cameraPosition - vWp);
  float spec = pow(max(dot(reflect(-sun, n), viewDir), 0.0), 42.0) * exp(-dist * 0.02);
  col += vec3(1.0, 0.95, 0.8) * spec * uSunI;
  gl_FragColor = vec4(col, 0.94);
}`

// R38 — cascada: lámina vertical con vetas que bajan, espuma en el labio y
// disolución en bruma al pie (la isla flota: el agua se pierde en la niebla)
export const WATERFALL_VS = `
uniform float uTime;
varying vec2 vUv; varying vec3 vWp;
void main(){
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  // la lámina se despega del borde al caer (curva hacia fuera)
  wp.x += sign(wp.x) * (1.0 - smoothstep(-10.5, -0.4, wp.y)) * 0.55;
  vUv = uv; vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
export const WATERFALL_FS = `
uniform float uTime; uniform vec3 uColA; uniform vec3 uColB; uniform float uSunI;
varying vec2 vUv; varying vec3 vWp;
void main(){
  float y = vUv.y;   // 1 arriba (labio) · 0 abajo (bruma)
  float w = vUv.x;   // 0..1 a lo ancho de la lámina
  // hebras verticales finas y sutiles sobre una lámina clara
  float streak = pow(max(sin(w * 46.0 + sin(y * 5.0 + w * 3.0) * 0.7), 0.0), 3.0);
  // trenes de oleaje que descienden (movimiento sin op-art)
  float trains = 0.5 + 0.5 * sin(y * 11.0 - uTime * 2.3 + w * 21.0);
  vec3 base = mix(uColA, vec3(0.97, 0.99, 1.0), 0.55);
  vec3 col = base * (0.9 + streak * 0.5);
  col = mix(col, base * 0.68, (1.0 - trains) * 0.3);
  col += vec3(1.0, 0.98, 0.9) * streak * 0.12 * uSunI;
  col = mix(col, vec3(1.0), smoothstep(0.86, 1.0, y) * 0.65);                    // espuma en el labio
  col = mix(col, vec3(0.98, 1.0, 1.0), (1.0 - smoothstep(0.05, 0.45, y)) * 0.5); // bruma al pie
  float alpha = 0.85
    * smoothstep(0.0, 0.1, y)                               // se disuelve en bruma abajo
    * smoothstep(0.0, 0.04, w) * (1.0 - smoothstep(0.96, 1.0, w)); // bordes suaves
  gl_FragColor = vec4(col, alpha);
}`
