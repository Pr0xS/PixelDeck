/**
 * iPad mockup SVG as a string.
 * Screen area is TRULY transparent via SVG mask.
 * ViewBox: 0 0 420 560
 */
export const IPAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 560" fill="none">
  <defs>
    <linearGradient id="ipad-case" x1="22" y1="6" x2="398" y2="554" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#737781"/>
      <stop offset="18%" stop-color="#3b3f48"/>
      <stop offset="60%" stop-color="#20232b"/>
      <stop offset="100%" stop-color="#4a4e57"/>
    </linearGradient>
    <linearGradient id="ipad-edge" x1="210" y1="4" x2="210" y2="556" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.42)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0.06)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>
    </linearGradient>

    <!-- MASK: white = show case, black = transparent screen hole -->
    <mask id="ipad-mask">
      <rect x="4" y="4" width="412" height="552" rx="24" fill="white"/>
      <rect x="12" y="16" width="396" height="528" rx="10" fill="black"/>
    </mask>
  </defs>

  <!-- Slim aluminum tablet body, masked to preserve a transparent display -->
  <rect x="4" y="4" width="412" height="552" rx="24" fill="url(#ipad-case)" mask="url(#ipad-mask)"/>
  <rect x="4" y="4" width="412" height="552" rx="24" fill="none" stroke="url(#ipad-edge)" stroke-width="2" mask="url(#ipad-mask)"/>

  <!-- Recessed glass rim -->
  <rect x="12" y="16" width="396" height="528" rx="10" fill="none" stroke="rgba(0,0,0,0.72)" stroke-width="3"/>
  <rect x="12" y="16" width="396" height="528" rx="10" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>

  <!-- Centered landscape camera and understated right-edge controls -->
  <circle cx="210" cy="10" r="2.7" fill="#11141a"/>
  <circle cx="209.3" cy="9.3" r="0.75" fill="rgba(255,255,255,0.24)"/>
  <rect x="414" y="170" width="6" height="54" rx="3" fill="#252932"/>
  <rect x="415" y="174" width="5" height="20" rx="2.5" fill="#565b66"/>
  <rect x="415" y="200" width="5" height="20" rx="2.5" fill="#565b66"/>
  <rect x="414" y="254" width="6" height="31" rx="3" fill="#30343d"/>
</svg>`

export default IPAD_SVG
