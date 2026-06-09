/**
 * Google Pixel 9 mockup SVG as a string.
 * Screen area is TRULY transparent via SVG mask.
 * ViewBox: 0 0 380 820
 */
export const PIXEL_9_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 820" fill="none">
  <defs>
    <linearGradient id="p9-frame" x1="0" y1="0" x2="380" y2="820" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#3a3a42"/>
      <stop offset="40%"  stop-color="#252530"/>
      <stop offset="100%" stop-color="#1c1c26"/>
    </linearGradient>
    <linearGradient id="p9-edge" x1="0" y1="0" x2="0" y2="820" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.15)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.03)"/>
    </linearGradient>

    <!-- MASK: white = show frame, black = transparent (screen hole) -->
    <mask id="p9-mask">
      <rect x="0" y="0" width="380" height="820" rx="46" fill="white"/>
      <rect x="14" y="16" width="352" height="788" rx="36" fill="black"/>
    </mask>

    <clipPath id="p9-screen-clip">
      <rect x="14" y="16" width="352" height="788" rx="36"/>
    </clipPath>
    <linearGradient id="p9-glare" x1="0" y1="16" x2="190" y2="300" gradientUnits="userSpaceOnUse">
      <stop offset="0%"  stop-color="rgba(255,255,255,0.09)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.0)"/>
    </linearGradient>
  </defs>

  <!-- Frame body — masked to bezel only -->
  <rect x="0" y="0" width="380" height="820" rx="46"
    fill="url(#p9-frame)" mask="url(#p9-mask)"/>

  <!-- Edge highlight -->
  <rect x="0" y="0" width="380" height="820" rx="46"
    fill="none" stroke="url(#p9-edge)" stroke-width="1.5" mask="url(#p9-mask)"/>

  <!-- Inner bezel shadow -->
  <rect x="14" y="16" width="352" height="788" rx="36"
    fill="none" stroke="rgba(0,0,0,0.50)" stroke-width="4.5"/>

  <!-- Inner highlight ring -->
  <rect x="14" y="16" width="352" height="788" rx="36"
    fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>

  <!-- Punch-hole camera (Pixel: single centered circle) -->
  <circle cx="190" cy="42" r="12" fill="#06060c"/>
  <circle cx="190" cy="42" r="13.5" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <!-- Side buttons — volume rocker (long single bar, Pixel style) -->
  <rect x="-3" y="280" width="5" height="120" rx="2.5" fill="#38383f"/>
  <!-- Power button -->
  <rect x="383" y="240" width="5" height="70" rx="2.5" fill="#38383f"/>

  <!-- Screen glare -->
  <rect x="14" y="16" width="352" height="788"
    fill="url(#p9-glare)" clip-path="url(#p9-screen-clip)"/>
</svg>`

export default PIXEL_9_SVG
