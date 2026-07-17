import { useEditorStore } from '@/store'
import type { BrandColor } from '@/types'

const EMPTY_BRAND_COLORS: BrandColor[] = []

/** Select the project palette without allocating a fallback array on every render. */
export function useBrandColors(): BrandColor[] {
  return useEditorStore((state) => state.project.settings.brandColors) ?? EMPTY_BRAND_COLORS
}
