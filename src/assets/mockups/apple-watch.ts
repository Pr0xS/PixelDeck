/**
 * Apple Watch mockup SVG as a string.
 * Screen area is TRULY transparent via SVG mask.
 * ViewBox: 0 0 422 514
 */
export const APPLE_WATCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 422 514" fill="none">
  <defs>
    <linearGradient id="aw-case" x1="8" y1="8" x2="414" y2="506" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5b5c65"/>
      <stop offset="24%" stop-color="#30313b"/>
      <stop offset="62%" stop-color="#171821"/>
      <stop offset="100%" stop-color="#3d3e48"/>
    </linearGradient>
    <linearGradient id="aw-edge" x1="0" y1="0" x2="0" y2="514" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="48%" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.34)"/>
    </linearGradient>

    <!-- MASK: white = show case, black = transparent screen hole -->
    <mask id="aw-mask">
      <rect x="8" y="8" width="398" height="498" rx="108" fill="white"/>
      <rect x="25" y="25" width="372" height="464" rx="83" fill="black"/>
    </mask>
  </defs>

  <!-- Curved aluminum case — masked to the bezel only -->
  <rect x="8" y="8" width="398" height="498" rx="108"
    fill="url(#aw-case)" mask="url(#aw-mask)"/>
  <rect x="8" y="8" width="398" height="498" rx="108"
    fill="none" stroke="url(#aw-edge)" stroke-width="2" mask="url(#aw-mask)"/>

  <!-- Screen edge gives the thin bezel a little depth without filling the display -->
  <rect x="25" y="25" width="372" height="464" rx="83"
    fill="none" stroke="rgba(0,0,0,0.68)" stroke-width="5"/>
  <rect x="25" y="25" width="372" height="464" rx="83"
    fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.25"/>

  <!-- Digital Crown and side button -->
  <rect x="402" y="179" width="15" height="76" rx="7.5" fill="#252631"/>
  <rect x="405" y="184" width="12" height="66" rx="6" fill="#4a4b55"/>
  <rect x="406" y="274" width="10" height="53" rx="5" fill="#353640"/>
  <path d="M408 191V244M412 191V244" stroke="rgba(0,0,0,0.30)" stroke-width="1"/>
</svg>`

export default APPLE_WATCH_SVG
