// Ilustración 2D de alta calidad de Axi (lémur mascota oficial de Axiom) estilo cuento/Cuphead 1930s.
// Se convierte a data-URI SVG para cargarla como textura nítida en PixiJS v8 sin dependencias externas.

const AXI_HOLDING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="190" viewBox="0 0 180 190">
  <defs>
    <radialGradient id="furGrad" cx="45%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#B9B2A7"/>
      <stop offset="70%" stop-color="#8F877C"/>
      <stop offset="100%" stop-color="#70685F"/>
    </radialGradient>
    <radialGradient id="faceGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFDF8"/>
      <stop offset="100%" stop-color="#EFE5D5"/>
    </radialGradient>
    <linearGradient id="scarfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F08365"/>
      <stop offset="100%" stop-color="#D4573B"/>
    </linearGradient>
    <radialGradient id="eyeGold" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE07A"/>
      <stop offset="75%" stop-color="#E9B83E"/>
      <stop offset="100%" stop-color="#B87E1A"/>
    </radialGradient>
  </defs>

  <!-- Sombra suave en el suelo -->
  <ellipse cx="92" cy="174" rx="44" ry="11" fill="#2D2A26" opacity="0.22"/>

  <!-- Cola esponjosa anillada de lémur curvada hacia arriba -->
  <path d="M 74 146 C 24 144, 14 92, 34 52 C 44 32, 62 34, 58 50"
        fill="none" stroke="#2D2A26" stroke-width="20" stroke-linecap="round"/>
  <path d="M 74 146 C 24 144, 14 92, 34 52 C 44 32, 62 34, 58 50"
        fill="none" stroke="#F4EFE6" stroke-width="14" stroke-linecap="round"/>
  <!-- Anillos oscuros de la cola -->
  <path d="M 48 139 C 43 135, 40 131, 38 126" fill="none" stroke="#2D2A26" stroke-width="14" stroke-linecap="butt"/>
  <path d="M 27 108 C 25 101, 25 94, 26 88" fill="none" stroke="#2D2A26" stroke-width="14" stroke-linecap="butt"/>
  <path d="M 30 67 C 32 61, 35 55, 38 50" fill="none" stroke="#2D2A26" stroke-width="14" stroke-linecap="butt"/>
  <circle cx="57" cy="48" r="7" fill="#2D2A26"/>

  <!-- Patitas traseras -->
  <ellipse cx="75" cy="166" rx="14" ry="8.5" fill="#5D564E" stroke="#2D2A26" stroke-width="3.2"/>
  <ellipse cx="107" cy="166" rx="14" ry="8.5" fill="#5D564E" stroke="#2D2A26" stroke-width="3.2"/>

  <!-- Cuerpo esponjoso -->
  <path d="M 65 112 C 62 140, 68 164, 92 164 C 116 164, 122 140, 118 112 C 114 96, 70 96, 65 112 Z"
        fill="url(#furGrad)" stroke="#2D2A26" stroke-width="3.5"/>
  <!-- Pancita crema -->
  <ellipse cx="94" cy="136" rx="17" ry="20" fill="#FAF3E7"/>

  <!-- Pañuelo coral con nudo lateral -->
  <path d="M 66 105 Q 92 119 118 105 L 114 94 Q 92 105 70 94 Z"
        fill="url(#scarfGrad)" stroke="#2D2A26" stroke-width="3" stroke-linejoin="round"/>
  <path d="M 67 104 L 53 116 L 63 121 L 73 108 Z"
        fill="#E76F51" stroke="#2D2A26" stroke-width="2.6" stroke-linejoin="round"/>
  <circle cx="70" cy="105" r="5" fill="#F08365" stroke="#2D2A26" stroke-width="2.4"/>

  <!-- Orejas redondeadas con interior rosado cálido -->
  <circle cx="62" cy="48" r="16" fill="url(#furGrad)" stroke="#2D2A26" stroke-width="3.4"/>
  <circle cx="63" cy="49" r="9.5" fill="#F4C7B8"/>
  <circle cx="122" cy="48" r="16" fill="url(#furGrad)" stroke="#2D2A26" stroke-width="3.4"/>
  <circle cx="121" cy="49" r="9.5" fill="#F4C7B8"/>

  <!-- Cabeza con mechones en mejillas -->
  <path d="M 55 70 C 55 43, 129 43, 129 70 C 134 78, 129 90, 121 94 C 110 103, 74 103, 63 94 C 55 90, 50 78, 55 70 Z"
        fill="url(#faceGrad)" stroke="#2D2A26" stroke-width="3.6"/>
  <!-- Coronilla gris suave -->
  <path d="M 69 49 Q 92 38 115 49 Q 105 58 92 56 Q 79 58 69 49 Z"
        fill="#8A8277" stroke="#2D2A26" stroke-width="2.4"/>

  <!-- Antifaz característico de lémur -->
  <ellipse cx="77" cy="72" rx="13" ry="14" fill="#3C3732"/>
  <ellipse cx="107" cy="72" rx="13" ry="14" fill="#3C3732"/>

  <!-- Ojos grandes dorados expresivos con brillos -->
  <circle cx="78" cy="71" r="8.2" fill="url(#eyeGold)"/>
  <circle cx="106" cy="71" r="8.2" fill="url(#eyeGold)"/>
  <circle cx="79.5" cy="71" r="4.4" fill="#2D2A26"/>
  <circle cx="107.5" cy="71" r="4.4" fill="#2D2A26"/>
  <!-- Brillos blancos adorables -->
  <circle cx="76.5" cy="67.5" r="2.6" fill="#FFFFFF"/>
  <circle cx="104.5" cy="67.5" r="2.6" fill="#FFFFFF"/>
  <circle cx="81.5" cy="74" r="1.2" fill="#FFFFFF"/>
  <circle cx="109.5" cy="74" r="1.2" fill="#FFFFFF"/>

  <!-- Mejillitas rosadas -->
  <ellipse cx="66" cy="85" rx="5.5" ry="3.2" fill="#F09A84" opacity="0.65"/>
  <ellipse cx="118" cy="85" rx="5.5" ry="3.2" fill="#F09A84" opacity="0.65"/>

  <!-- Hocico y sonrisa tierna -->
  <ellipse cx="92" cy="81" rx="6.2" ry="4.4" fill="#2D2A26"/>
  <ellipse cx="90.5" cy="79.8" rx="2" ry="1.1" fill="#7D756C"/>
  <path d="M 85 88 Q 92 94 99 88" fill="none" stroke="#2D2A26" stroke-width="2.8" stroke-linecap="round"/>

  <!-- Brazos extendidos a la derecha abrazando/sosteniendo el medallón del nivel -->
  <path d="M 113 114 Q 138 104 156 96" fill="none" stroke="#2D2A26" stroke-width="13" stroke-linecap="round"/>
  <path d="M 113 114 Q 138 104 156 96" fill="none" stroke="#9B9388" stroke-width="7.5" stroke-linecap="round"/>
  <!-- Manita superior -->
  <circle cx="158" cy="95" r="8.5" fill="#FAF3E7" stroke="#2D2A26" stroke-width="3"/>

  <path d="M 114 134 Q 138 136 156 128" fill="none" stroke="#2D2A26" stroke-width="13" stroke-linecap="round"/>
  <path d="M 114 134 Q 138 136 156 128" fill="none" stroke="#9B9388" stroke-width="7.5" stroke-linecap="round"/>
  <!-- Manita inferior -->
  <circle cx="158" cy="128" r="8.5" fill="#FAF3E7" stroke="#2D2A26" stroke-width="3"/>
</svg>`

export const AXI_MASCOT_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(AXI_HOLDING_SVG)}`

// Ilustración dinámica de Axi colgado de una liana balanceándose hacia la izquierda (con bufanda y cola al viento)
const AXI_VINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="220" viewBox="0 0 210 220">
  <defs>
    <radialGradient id="vFur" cx="45%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#BEB7AC"/>
      <stop offset="70%" stop-color="#8F877C"/>
      <stop offset="100%" stop-color="#6F675E"/>
    </radialGradient>
    <radialGradient id="vFace" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFDF8"/>
      <stop offset="100%" stop-color="#EFE5D5"/>
    </radialGradient>
    <radialGradient id="vEye" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE07A"/>
      <stop offset="75%" stop-color="#E9B83E"/>
      <stop offset="100%" stop-color="#B87E1A"/>
    </radialGradient>
  </defs>

  <!-- Cola esponjosa anillada ondeando hacia la derecha por la velocidad -->
  <path d="M 112 142 C 156 146, 186 120, 194 84 C 198 68, 184 58, 174 70"
        fill="none" stroke="#2D2A26" stroke-width="20" stroke-linecap="round"/>
  <path d="M 112 142 C 156 146, 186 120, 194 84 C 198 68, 184 58, 174 70"
        fill="none" stroke="#F4EFE6" stroke-width="14" stroke-linecap="round"/>
  <path d="M 138 140 C 145 138, 151 135, 157 132" fill="none" stroke="#2D2A26" stroke-width="14"/>
  <path d="M 172 117 C 176 111, 180 105, 183 99" fill="none" stroke="#2D2A26" stroke-width="14"/>
  <circle cx="176" cy="69" r="7" fill="#2D2A26"/>

  <!-- Piernas flexionadas impulsándose hacia la izquierda -->
  <path d="M 88 152 Q 70 176 58 184" fill="none" stroke="#2D2A26" stroke-width="15" stroke-linecap="round"/>
  <path d="M 88 152 Q 70 176 58 184" fill="none" stroke="#8A8277" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="52" cy="186" rx="13" ry="8" transform="rotate(-18 52 186)" fill="#5A534B" stroke="#2D2A26" stroke-width="3"/>

  <path d="M 106 154 Q 108 180 96 192" fill="none" stroke="#2D2A26" stroke-width="15" stroke-linecap="round"/>
  <path d="M 106 154 Q 108 180 96 192" fill="none" stroke="#8A8277" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="92" cy="196" rx="13" ry="8" transform="rotate(10 92 196)" fill="#5A534B" stroke="#2D2A26" stroke-width="3"/>

  <!-- Cuerpo inclinado hacia adelante -->
  <ellipse cx="98" cy="130" rx="24" ry="30" transform="rotate(-14 98 130)" fill="url(#vFur)" stroke="#2D2A26" stroke-width="3.6"/>
  <ellipse cx="92" cy="132" rx="14" ry="19" transform="rotate(-14 92 132)" fill="#FAF3E7"/>

  <!-- Pañuelo coral ondeando hacia atrás (derecha) -->
  <path d="M 104 102 Q 144 92 166 106 L 154 120 Q 126 112 98 114 Z" fill="#E76F51" stroke="#2D2A26" stroke-width="3" stroke-linejoin="round"/>
  <path d="M 74 102 Q 96 114 114 102 L 110 92 Q 94 101 78 92 Z" fill="#F08365" stroke="#2D2A26" stroke-width="3"/>

  <!-- Brazo superior sujetando firmemente la liana arriba -->
  <path d="M 96 98 Q 92 52 96 22" fill="none" stroke="#2D2A26" stroke-width="15" stroke-linecap="round"/>
  <path d="M 96 98 Q 92 52 96 22" fill="none" stroke="#9B9388" stroke-width="9" stroke-linecap="round"/>
  <circle cx="96" cy="20" r="10" fill="#FAF3E7" stroke="#2D2A26" stroke-width="3.2"/>

  <!-- Brazo izquierdo extendido señalando hacia la izquierda -->
  <path d="M 76 112 Q 48 104 34 94" fill="none" stroke="#2D2A26" stroke-width="13" stroke-linecap="round"/>
  <path d="M 76 112 Q 48 104 34 94" fill="none" stroke="#9B9388" stroke-width="7.5" stroke-linecap="round"/>
  <circle cx="31" cy="92" r="8.5" fill="#FAF3E7" stroke="#2D2A26" stroke-width="3"/>

  <!-- Orejas con interior rosado -->
  <circle cx="66" cy="54" r="15" fill="url(#vFur)" stroke="#2D2A26" stroke-width="3.2"/>
  <circle cx="67" cy="55" r="8.5" fill="#F4C7B8"/>
  <circle cx="118" cy="52" r="15" fill="url(#vFur)" stroke="#2D2A26" stroke-width="3.2"/>
  <circle cx="117" cy="53" r="8.5" fill="#F4C7B8"/>

  <!-- Cabeza mirando alegremente hacia la izquierda -->
  <path d="M 56 76 C 56 48, 124 46, 124 74 C 128 84, 122 96, 112 100 C 100 107, 72 107, 62 98 C 54 92, 52 84, 56 76 Z"
        fill="url(#vFace)" stroke="#2D2A26" stroke-width="3.6"/>
  <path d="M 68 54 Q 90 42 112 52 Q 102 62 90 60 Q 78 62 68 54 Z" fill="#8A8277" stroke="#2D2A26" stroke-width="2.4"/>

  <!-- Antifaz y ojos dorados mirando hacia la izquierda -->
  <ellipse cx="74" cy="76" rx="12" ry="13.5" fill="#3C3732"/>
  <ellipse cx="102" cy="76" rx="12" ry="13.5" fill="#3C3732"/>
  <circle cx="72" cy="75" r="7.8" fill="url(#vEye)"/>
  <circle cx="100" cy="75" r="7.8" fill="url(#vEye)"/>
  <circle cx="70" cy="75" r="4.2" fill="#2D2A26"/>
  <circle cx="98" cy="75" r="4.2" fill="#2D2A26"/>
  <circle cx="68" cy="71.5" r="2.5" fill="#FFFFFF"/>
  <circle cx="96" cy="71.5" r="2.5" fill="#FFFFFF"/>

  <!-- Mejillas y sonrisa aventurera -->
  <ellipse cx="62" cy="88" rx="5" ry="3" fill="#F09A84" opacity="0.65"/>
  <ellipse cx="112" cy="88" rx="5" ry="3" fill="#F09A84" opacity="0.65"/>
  <ellipse cx="86" cy="84" rx="5.8" ry="4" fill="#2D2A26"/>
  <path d="M 78 90 Q 86 98 94 90" fill="none" stroke="#2D2A26" stroke-width="2.8" stroke-linecap="round"/>
</svg>`

export const AXI_VINE_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(AXI_VINE_SVG)}`
