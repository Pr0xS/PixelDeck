import type { InputHTMLAttributes } from 'react'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
  id?: string
  disabled?: boolean
  className?: string
  knobClassName?: string
  checkedClassName?: string
  uncheckedClassName?: string
  checkedKnobClassName?: string
  uncheckedKnobClassName?: string
  variant?: 'switch' | 'checkbox'
  checkboxClassName?: string
  checkboxProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange' | 'type'>
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  id,
  disabled,
  className = 'relative h-5 w-9 rounded-full transition-colors',
  knobClassName = 'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
  checkedClassName = 'bg-[#7c6ef6]',
  uncheckedClassName = 'bg-[rgba(255,255,255,0.12)]',
  checkedKnobClassName = 'translate-x-[18px]',
  uncheckedKnobClassName = 'translate-x-0',
  variant = 'switch',
  checkboxClassName = 'accent-[#7c6ef6]',
  checkboxProps,
}: ToggleSwitchProps) {
  if (variant === 'checkbox') {
    return (
      <input
        {...checkboxProps}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
        className={checkboxClassName}
      />
    )
  }

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${className} ${checked ? checkedClassName : uncheckedClassName}`}
    >
      <span className={`${knobClassName} ${checked ? checkedKnobClassName : uncheckedKnobClassName}`} />
    </button>
  )
}
