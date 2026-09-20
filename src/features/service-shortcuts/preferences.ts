import Taro from '@tarojs/taro'
import { allServices } from './catalog'

export const SHORTCUT_STORAGE_KEY = 'campus.home.serviceShortcuts.v1'
export const MAX_SHORTCUTS = 9
export const DEFAULT_SHORTCUTS = ['schedule', 'grades', 'exams', 'classroom', 'pass-rate', 'market', 'calendar', 'shuttle', 'carpool']
const known = new Set(allServices.map((item) => item.key))

export function normalizeShortcuts(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SHORTCUTS]
  return [...new Set(value.filter((key): key is string => typeof key === 'string' && known.has(key)))].slice(0, MAX_SHORTCUTS)
}
export function readShortcuts(): string[] {
  try {
    const saved = Taro.getStorageSync(SHORTCUT_STORAGE_KEY)
    return saved?.version === 1 && Array.isArray(saved.keys) ? normalizeShortcuts(saved.keys) : [...DEFAULT_SHORTCUTS]
  } catch { return [...DEFAULT_SHORTCUTS] }
}
export function saveShortcuts(keys: string[]): boolean {
  try {
    Taro.setStorageSync(SHORTCUT_STORAGE_KEY, { version: 1, keys: normalizeShortcuts(keys) })
    return true
  } catch { return false }
}
export function moveShortcut(keys: string[], from: number, to: number): string[] {
  if (from < 0 || from >= keys.length || to < 0 || to >= keys.length) return keys
  const next = [...keys]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
