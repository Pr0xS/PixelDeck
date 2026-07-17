import { useState, type CSSProperties, type ReactNode } from 'react'

function normalizeInlineLabel(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

interface InlineEditableLabelProps {
  value: string
  onCommit: (value: string) => void
  className?: string
  inputClassName?: string
  style?: CSSProperties
  inputStyle?: CSSProperties
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  children?: ReactNode
}

export function InlineEditableLabel({
  value,
  onCommit,
  className,
  inputClassName = 'flex-1 text-xs px-1 rounded border border-[#7c6ef6] bg-[#0f0f13] text-[#e8e8f0] focus:outline-none min-w-0',
  style,
  inputStyle,
  editing: controlledEditing,
  onEditingChange,
  children,
}: InlineEditableLabelProps) {
  const [internalEditing, setInternalEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const editing = controlledEditing ?? internalEditing
  const setEditing = (next: boolean) => {
    if (controlledEditing === undefined) setInternalEditing(next)
    onEditingChange?.(next)
  }
  const begin = () => {
    setDraft(value)
    setEditing(true)
  }
  const commit = () => {
    const normalized = normalizeInlineLabel(draft)
    if (normalized) onCommit(normalized)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        autoFocus
        onFocus={(event) => event.target.select()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') cancel()
        }}
        className={inputClassName}
        style={inputStyle}
      />
    )
  }

  return (
    <span
      className={className}
      style={style}
      onDoubleClick={(event) => { event.stopPropagation(); begin() }}
    >
      {value}{children}
    </span>
  )
}
