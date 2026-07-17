import { useEffect, type CSSProperties, type ReactNode } from 'react'

function shouldCloseModalForKey(key: string): boolean {
  return key === 'Escape'
}

interface ModalShellProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  header?: ReactNode
  maxWidth?: string
  backdropClassName?: string
  panelClassName?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
  backdropStyle?: CSSProperties
  panelStyle?: CSSProperties
  closeButtonClassName?: string
  closeButtonStyle?: CSSProperties
  closeLabel?: string
  closeGlyph?: ReactNode
  showCloseButton?: boolean
  closeOnEscape?: boolean
  onEscape?: () => void
  closeOnBackdrop?: boolean
}

export function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
  header,
  maxWidth = 'max-w-2xl',
  backdropClassName = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm',
  panelClassName = 'relative rounded-2xl border shadow-2xl w-full mx-4 flex flex-col overflow-hidden',
  headerClassName = 'px-5 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0',
  bodyClassName,
  footerClassName,
  backdropStyle = { background: 'rgba(0,0,0,0.65)' },
  panelStyle = { background: '#18181f', borderColor: 'rgba(255,255,255,0.1)' },
  closeButtonClassName = 'absolute top-4 right-4 z-10 text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.06)]',
  closeButtonStyle,
  closeLabel = 'Close modal',
  closeGlyph = '✕',
  showCloseButton = true,
  closeOnEscape = true,
  onEscape,
  closeOnBackdrop = true,
}: ModalShellProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const handler = (event: KeyboardEvent) => {
      if (shouldCloseModalForKey(event.key)) (onEscape ?? onClose)()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeOnEscape, onClose, onEscape, open])

  if (!open) return null

  return (
    <div
      className={backdropClassName}
      style={backdropStyle}
      onClick={closeOnBackdrop ? onClose : undefined}
      data-testid="modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`${panelClassName} ${maxWidth}`.trim()}
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        {header ?? (title !== undefined && (
          <div className={headerClassName}>
            <h2 className="text-base font-semibold text-[#e8e8f0]">{title}</h2>
          </div>
        ))}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className={closeButtonClassName}
            style={closeButtonStyle}
            aria-label={closeLabel}
          >
            {closeGlyph}
          </button>
        )}
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
        {footer !== undefined && (
          <div className={footerClassName}>{footer}</div>
        )}
      </div>
    </div>
  )
}
