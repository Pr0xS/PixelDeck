/**
 * Wear OS watch mockup SVG as a string.
 * Screen area is TRULY transparent via SVG mask.
 * ViewBox: 0 0 480 480
 */
export const WEAR_OS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" fill="none">
  <defs>
    <radialGradient id="wo-case" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(178 128) rotate(55) scale(445)">
      <stop offset="0%" stop-color="#5b5d65"/>
      <stop offset="36%" stop-color="#292a33"/>
      <stop offset="76%" stop-color="#15161e"/>
      <stop offset="100%" stop-color="#34353e"/>
    </radialGradient>
    <linearGradient id="wo-edge" x1="240" y1="14" x2="240" y2="466" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.30)"/>
      <stop offset="52%" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.38)"/>
    </linearGradient>

    <!-- MASK: white = show case, black = transparent circular screen hole -->
    <mask id="wo-mask">
      <circle cx="240" cy="240" r="226" fill="white"/>
      <rect x="31" y="31" width="418" height="418" rx="209" fill="black"/>
    </mask>
  </defs>

  <!-- Side controls — drawn BEFORE the case so the masked case body covers each
       buried root and only the protruding head reads outside the bezel.
       Case R=226 @ (240,240), inset from R=232 to free 6px of right-hand headroom
       so the main control can protrude at dead 3 o'clock without clipping the
       480 viewBox (same intent as apple-watch.ts, but by shrinking r rather than
       shifting cx, which keeps the case concentric with the screen and with the
       fw/2 rotation pivot). Each rect spans [r_in, r_out] on the +x axis and is
       rotated CCW by its polar angle about the case centre, so it is tangent by
       construction. Main: 12px protrusion @ 0deg. Secondary: 10px @ 32deg. -->
  <rect x="458" y="204" width="20" height="72" rx="10" fill="#30313a"
    stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
  <rect x="461" y="212" width="12" height="56" rx="6" fill="#4a4b54"/>

  <rect x="458" y="218" width="18" height="44" rx="9" fill="#30313a"
    stroke="rgba(255,255,255,0.09)" stroke-width="1" transform="rotate(-32 240 240)"/>
  <rect x="461" y="225" width="10" height="30" rx="5" fill="#4a4b54"
    transform="rotate(-32 240 240)"/>

  <!-- Round case — masked to the bezel only -->
  <circle cx="240" cy="240" r="226" fill="url(#wo-case)" mask="url(#wo-mask)"/>
  <circle cx="240" cy="240" r="226" fill="none" stroke="url(#wo-edge)" stroke-width="2" mask="url(#wo-mask)"/>

  <!-- Raised inner glass rim -->
  <circle cx="240" cy="240" r="209" fill="none" stroke="rgba(0,0,0,0.70)" stroke-width="5"/>
  <circle cx="240" cy="240" r="209" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1.25"/>
</svg>`

export default WEAR_OS_SVG
