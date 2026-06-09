/**
 * iPhone 16 Pro mockup SVG as a string.
 * The screen area is TRULY transparent via an SVG mask —
 * the mask paints the entire phone white except the screen (black = transparent).
 * ViewBox: 0 0 390 844
 */
export const IPHONE_16_PRO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" fill="none">
  <defs>
    <linearGradient id="ip-frame" x1="0" y1="0" x2="390" y2="844" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#4a4a56"/>
      <stop offset="30%"  stop-color="#2c2c38"/>
      <stop offset="60%"  stop-color="#1e1e28"/>
      <stop offset="100%" stop-color="#32323e"/>
    </linearGradient>
    <linearGradient id="ip-edge" x1="0" y1="0" x2="0" y2="844" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
    </linearGradient>

    <!-- MASK: white = show frame, black = transparent (screen hole) -->
    <mask id="ip-mask">
      <!-- Entire phone shape visible -->
      <rect x="0" y="0" width="390" height="844" rx="58" fill="white"/>
      <!-- Screen area cut out (black = transparent) -->
      <rect x="14" y="14" width="362" height="816" rx="44" fill="black"/>
    </mask>
  </defs>

  <!-- Frame body — only visible where mask is white (bezel only) -->
  <rect x="0" y="0" width="390" height="844" rx="58"
    fill="url(#ip-frame)" mask="url(#ip-mask)"/>

  <!-- Edge highlight — also masked to bezel only -->
  <rect x="0" y="0" width="390" height="844" rx="58"
    fill="none" stroke="url(#ip-edge)" stroke-width="1.5" mask="url(#ip-mask)"/>

  <!-- Inner bezel shadow ring (dark inner edge of the bezel) -->
  <rect x="14" y="14" width="362" height="816" rx="44"
    fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="5"/>

  <!-- Inner highlight ring (subtle light edge) -->
  <rect x="14" y="14" width="362" height="816" rx="44"
    fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1.5"/>

  <!-- Dynamic Island (floating pill above screen content) -->
  <rect x="145" y="26" width="100" height="34" rx="17" fill="#06060c"/>
  <rect x="145" y="26" width="100" height="34" rx="17"
    fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- Side buttons — volume up -->
  <rect x="-3" y="180" width="5" height="60" rx="2.5" fill="#3a3a46"/>
  <!-- volume down -->
  <rect x="-3" y="258" width="5" height="60" rx="2.5" fill="#3a3a46"/>
  <!-- action button -->
  <rect x="-3" y="130" width="5" height="38" rx="2.5" fill="#3a3a46"/>
  <!-- power -->
  <rect x="388" y="210" width="5" height="90" rx="2.5" fill="#3a3a46"/>

  <!-- Screen glare (very subtle, only over screen — use clip not mask so it sits on top) -->
  <defs>
    <linearGradient id="ip-glare" x1="0" y1="0" x2="190" y2="300" gradientUnits="userSpaceOnUse">
      <stop offset="0%"  stop-color="rgba(255,255,255,0.10)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.0)"/>
    </linearGradient>
    <clipPath id="ip-screen-clip">
      <rect x="14" y="14" width="362" height="816" rx="44"/>
    </clipPath>
  </defs>
  <rect x="14" y="14" width="362" height="816"
    fill="url(#ip-glare)" clip-path="url(#ip-screen-clip)"/>
</svg>`

export default IPHONE_16_PRO_SVG
