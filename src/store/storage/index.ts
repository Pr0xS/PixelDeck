import { getPixelDeckConfig } from '@/config'
import { localStorageAdapter } from './localStorageAdapter'
import type { ProjectStorageAdapter } from './types'

export function getProjectStorage(): ProjectStorageAdapter {
  return getPixelDeckConfig().projectStorage ?? localStorageAdapter
}

export * from './types'
