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
          <div className="relative grid h-10 w-10 grid-cols-2 gap-[3px] rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#18181f] p-[7px] shadow-[0_14px_50px_rgba(0,0,0,0.4),0_0_35px_rgba(124,110,246,0.12)]">
            <span className="rounded-[3px] bg-[#9b8fff]" />
            <span className="rounded-[3px] bg-[#7c6ef6]" />
            <span className="rounded-[3px] bg-[#7c6ef6]" />
            <span className="rounded-[3px] border border-[rgba(203,191,255,0.22)] bg-[rgba(124,110,246,0.12)]" />
          </div>
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
