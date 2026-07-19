import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
  optionClassName?: string
  activeClassName?: string
  inactiveClassName?: string
  renderOption?: (option: SegmentedOption<T>, selected: boolean) => ReactNode
}

function isSegmentSelected<T extends string>(value: T, option: SegmentedOption<T>): boolean {
  return value === option.value
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = 'grid grid-cols-3 gap-2',
  optionClassName = 'rounded-lg border px-2 py-2 text-xs transition-colors',
  activeClassName = 'border-[#7c6ef6] bg-[#7c6ef6] text-white',
  inactiveClassName = 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]',
  renderOption,
}: SegmentedControlProps<T>) {
  return (
    <div className={className} role="group">
      {options.map((option) => {
        const selected = isSegmentSelected(value, option)
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`${optionClassName} ${selected ? activeClassName : inactiveClassName}`}
          >
            {renderOption ? renderOption(option, selected) : option.label}
          </button>
        )
      })}
    </div>
  )
}
