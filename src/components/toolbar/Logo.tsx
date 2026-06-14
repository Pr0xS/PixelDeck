/**
 * PixelDeck brand mark + wordmark.
 *
 * Icon: two portrait screenshot cards (left = purple, right = violet→pink),
 * representing a "deck" of App Store screenshots.
 *
 * SVG gradient IDs use the unique prefix `pd-lc-` to avoid conflicts when
 * multiple SVGs are present in the document.
 */
export function Logo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Icon mark */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pd-lc-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b49eff" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="pd-lc-right" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9d6ef6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Left card — purple */}
        <rect x="2" y="3" width="13" height="26" rx="3" fill="url(#pd-lc-left)" />
        <rect x="4.5" y="9" width="8" height="1.5" rx="0.75" fill="white" fillOpacity="0.6" />
        <rect x="4.5" y="12" width="5.5" height="1.5" rx="0.75" fill="white" fillOpacity="0.35" />
        <rect x="4.5" y="16" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.15" />

        {/* Right card — violet → pink */}
        <rect x="17" y="3" width="13" height="26" rx="3" fill="url(#pd-lc-right)" />
        <rect x="19.5" y="9" width="8" height="1.5" rx="0.75" fill="white" fillOpacity="0.6" />
        <rect x="19.5" y="12" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.35" />
        <rect x="19.5" y="16" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.15" />
      </svg>

      {/* Wordmark */}
      <span
        style={{
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          fontWeight: 300,
          color: '#c8c8d8',
          whiteSpace: 'nowrap',
        }}
      >
        Pixel
        <span style={{ fontWeight: 700, color: '#a78bfa' }}>Deck</span>
      </span>
    </div>
  )
}
