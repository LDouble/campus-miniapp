import type { CourseAdditionResultRecord } from '../types'

/**
 * 加课结果缓存的存储后端。生产使用 Taro storage；测试注入内存实现以验证
 * 真实读写序列（写入身份作用域切换时不得污染旧身份记录）。
 */
export type AdditionCacheBackend = {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

type AdditionCacheRecord = {
  version: 1
  platformUserId: number
  identityScope: string
  additionsByPeriod: Record<string, CourseAdditionResultRecord[]>
  additionsUpdatedAtByPeriod: Record<string, number>
}

const ADDITION_RECORDS_KEY_PREFIX = 'academic.additionRecords.v1.'

const cacheKey = (platformUserId: number) => `${ADDITION_RECORDS_KEY_PREFIX}${platformUserId}`

const isValidRecord = (
  value: unknown,
  platformUserId: number,
  identityScope: string,
): value is AdditionCacheRecord => {
  if (!value || typeof value !== 'object') return false
  const record = value as AdditionCacheRecord
  return record.version === 1
    && record.platformUserId === platformUserId
    && record.identityScope === identityScope
    && typeof record.additionsByPeriod === 'object'
    && typeof record.additionsUpdatedAtByPeriod === 'object'
}

export const createAdditionCache = (backend: AdditionCacheBackend) => ({
  getAdditionRecords: (
    platformUserId: number,
    identityScope: string,
    periodId: string,
  ): { records: CourseAdditionResultRecord[]; updatedAt: number } | null => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0 || !identityScope || !periodId) {
      return null
    }
    const raw = backend.get(cacheKey(platformUserId))
    if (!isValidRecord(raw, platformUserId, identityScope)) return null
    return {
      records: raw.additionsByPeriod[periodId] || [],
      updatedAt: raw.additionsUpdatedAtByPeriod[periodId] || 0,
    }
  },
  setAdditionRecords: (
    platformUserId: number,
    identityScope: string,
    periodId: string,
    records: CourseAdditionResultRecord[],
  ) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0 || !identityScope || !periodId) {
      return
    }
    const raw = backend.get(cacheKey(platformUserId))
    const current = isValidRecord(raw, platformUserId, identityScope) ? raw : null
    // 身份作用域变化（或首次写入）时清空加课两张 map，只保留本次记录，
    // 避免新身份读到旧身份的学期缓存。
    const additionsByPeriod = current
      ? { ...current.additionsByPeriod, [periodId]: records }
      : { [periodId]: records }
    const additionsUpdatedAtByPeriod = current
      ? { ...current.additionsUpdatedAtByPeriod, [periodId]: Date.now() }
      : { [periodId]: Date.now() }
    backend.set(cacheKey(platformUserId), {
      version: 1,
      platformUserId,
      identityScope,
      additionsByPeriod,
      additionsUpdatedAtByPeriod,
    })
  },
})

export type AdditionCache = ReturnType<typeof createAdditionCache>
