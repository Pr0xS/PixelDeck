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
    <linearGradient id="wo-edge" x1="240" y1="8" x2="240" y2="472" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.30)"/>
      <stop offset="52%" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.38)"/>
    </linearGradient>

    <!-- MASK: white = show case, black = transparent circular screen hole -->
    <mask id="wo-mask">
      <circle cx="240" cy="240" r="232" fill="white"/>
      <rect x="31" y="31" width="418" height="418" rx="209" fill="black"/>
    </mask>
  </defs>

  <!-- Round case — masked to the bezel only -->
  <circle cx="240" cy="240" r="232" fill="url(#wo-case)" mask="url(#wo-mask)"/>
  <circle cx="240" cy="240" r="232" fill="none" stroke="url(#wo-edge)" stroke-width="2" mask="url(#wo-mask)"/>

  <!-- Raised inner glass rim -->
  <circle cx="240" cy="240" r="209" fill="none" stroke="rgba(0,0,0,0.70)" stroke-width="5"/>
  <circle cx="240" cy="240" r="209" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1.25"/>

  <!-- Two restrained side controls suggest a classic Wear OS case -->
  <rect x="454" y="174" width="18" height="50" rx="8" fill="#30313a"/>
  <rect x="454" y="256" width="18" height="50" rx="8" fill="#30313a"/>
  <rect x="457" y="178" width="13" height="42" rx="6.5" fill="#4a4b54"/>
  <rect x="457" y="260" width="13" height="42" rx="6.5" fill="#4a4b54"/>
</svg>`

export default WEAR_OS_SVG
