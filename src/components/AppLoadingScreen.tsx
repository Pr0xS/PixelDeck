import { useEffect, useState } from 'react'

const EXIT_DURATION_MS = 240

interface AppLoadingScreenProps {
  visible: boolean
}

export function AppLoadingScreen({ visible }: AppLoadingScreenProps) {
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    if (visible) return

    const timeoutId = window.setTimeout(() => setMounted(false), EXIT_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [visible])

  if (!mounted) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading PixelDeck"
      className={`fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-[#0f0f13] transition-opacity duration-200 ease-out ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 43%, rgba(124,110,246,0.13) 0, rgba(124,110,246,0.035) 24%, transparent 52%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.025)]"
      />

      <div className="relative flex -translate-y-2 flex-col items-center">
        <div className="pixeldeck-loader-enter flex items-center gap-3.5">
          <svg
            width="40"
            height="40"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ filter: 'drop-shadow(0 14px 32px rgba(0,0,0,0.4)) drop-shadow(0 0 24px rgba(124,110,246,0.25))' }}
          >
            <defs>
              <linearGradient id="pd-loader-left" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b49eff" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
              <linearGradient id="pd-loader-right" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9d6ef6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>

            {/* Left card — purple */}
            <rect x="2" y="3" width="13" height="26" rx="3" fill="url(#pd-loader-left)" />
            <rect x="4.5" y="9" width="8" height="1.5" rx="0.75" fill="white" fillOpacity="0.6" />
            <rect x="4.5" y="12" width="5.5" height="1.5" rx="0.75" fill="white" fillOpacity="0.35" />
            <rect x="4.5" y="16" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.15" />

            {/* Right card — violet → pink */}
            <rect x="17" y="3" width="13" height="26" rx="3" fill="url(#pd-loader-right)" />
            <rect x="19.5" y="9" width="8" height="1.5" rx="0.75" fill="white" fillOpacity="0.6" />
            <rect x="19.5" y="12" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.35" />
            <rect x="19.5" y="16" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.15" />
          </svg>
          <span className="text-[24px] font-semibold tracking-[-0.045em] text-[#f0eff8]">
            Pixel<span className="text-[#9b8fff]">Deck</span>
          </span>
        </div>

        <div className="pixeldeck-loader-enter pixeldeck-loader-enter-delay mt-7 flex w-full flex-col items-center gap-[13px]">
          <div className="pixeldeck-loader-words" aria-hidden="true">
            <span className="pixeldeck-loader-label">loading</span>
            <span className="pixeldeck-loader-window">
              <span className="pixeldeck-loader-word-track">
                <span>assets</span>
                <span>layouts</span>
                <span>slides</span>
                <span>thumbnails</span>
                <span>formats</span>
                <span>locales</span>
                <span>assets</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
