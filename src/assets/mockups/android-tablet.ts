/**
 * Android tablet mockup SVG as a string.
 * Screen area is TRULY transparent via SVG mask.
 * ViewBox: 0 0 400 640
 */
export const ANDROID_TABLET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" fill="none">
  <defs>
    <radialGradient id="android-tablet-case" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(124 104) rotate(57) scale(620)">
      <stop offset="0%" stop-color="#5b606a"/>
      <stop offset="34%" stop-color="#30353e"/>
      <stop offset="76%" stop-color="#171b22"/>
      <stop offset="100%" stop-color="#393e48"/>
    </radialGradient>
    <linearGradient id="android-tablet-edge" x1="200" y1="4" x2="200" y2="636" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.36)"/>
      <stop offset="48%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.48)"/>
    </linearGradient>

    <!-- MASK: white = show case, black = transparent screen hole -->
    <mask id="android-tablet-mask">
      <rect x="4" y="4" width="392" height="632" rx="24" fill="white"/>
      <rect x="12" y="20" width="376" height="600" rx="9" fill="black"/>
    </mask>
  </defs>

  <!-- Matte Android tablet shell, masked to preserve a transparent display -->
  <rect x="4" y="4" width="392" height="632" rx="24" fill="url(#android-tablet-case)" mask="url(#android-tablet-mask)"/>
  <rect x="4" y="4" width="392" height="632" rx="24" fill="none" stroke="url(#android-tablet-edge)" stroke-width="2" mask="url(#android-tablet-mask)"/>

  <!-- Fine inner glass edge -->
  <rect x="12" y="20" width="376" height="600" rx="9" fill="none" stroke="rgba(0,0,0,0.74)" stroke-width="3"/>
  <rect x="12" y="20" width="376" height="600" rx="9" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>

  <!-- Front camera, volume rocker, and a separate power key -->
  <circle cx="200" cy="12" r="2.8" fill="#10141a"/>
  <circle cx="199.3" cy="11.3" r="0.75" fill="rgba(255,255,255,0.22)"/>
  <rect x="394" y="182" width="6" height="62" rx="3" fill="#272c35"/>
  <rect x="395" y="186" width="5" height="25" rx="2.5" fill="#515762"/>
  <rect x="395" y="215" width="5" height="25" rx="2.5" fill="#515762"/>
  <rect x="394" y="276" width="6" height="32" rx="3" fill="#323842"/>
</svg>`

export default ANDROID_TABLET_SVG
