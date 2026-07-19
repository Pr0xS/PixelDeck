import type { InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  onValueChange: (value: number, rawValue: string) => void
}

export function NumberInput({ onValueChange, ...props }: NumberInputProps) {
  return (
    <input
      {...props}
      type="number"
      onChange={(event) => onValueChange(Number(event.target.value), event.target.value)}
    />
  )
}
