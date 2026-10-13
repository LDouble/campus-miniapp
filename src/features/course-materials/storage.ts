import Taro from '@tarojs/taro'
import { getActiveAcademicUserId } from '../../api/academic-credential'
import { academicStorage } from '../../pages/academic/storage'
import type {
  MaterialCourseSuggestion,
  MaterialKind,
  MaterialUploadDraft,
  MaterialUploadMetadata,
  MaterialUploadState,
  MaterialUploadStatus,
} from './types'

const UPLOAD_DRAFTS_KEY_PREFIX = 'courseMaterials.uploadDrafts.v4.'
const LEGACY_UPLOAD_DRAFTS_KEY = 'courseMaterials.uploadDrafts.v1'
const LEGACY_UPLOAD_DRAFTS_V2_KEY_PREFIX = 'courseMaterials.uploadDrafts.v2.'
const LEGACY_UPLOAD_DRAFTS_V3_KEY_PREFIX = 'courseMaterials.uploadDrafts.v3.'
const RECENT_COURSES_KEY_PREFIX = 'courseMaterials.recentCourses.v1.'
const validKinds = new Set<MaterialKind>([
  'slides',
  'notes',
  'exam',
  'homework',
  'review',
  'other',
])
const validStatuses = new Set<MaterialUploadStatus>([
  'draft',
  'uploading',
  'uploaded',
  'failed',
  'needs_file',
])

const validUserId = (userId: number) => Number.isSafeInteger(userId) && userId > 0
const draftsKey = (userId: number) => `${UPLOAD_DRAFTS_KEY_PREFIX}${userId}`
const recentCoursesKey = (userId: number) => `${RECENT_COURSES_KEY_PREFIX}${userId}`

const isDraft = (value: unknown): value is MaterialUploadDraft => {
  if (!value || typeof value !== 'object') return false
  const draft = value as MaterialUploadDraft
  return (
    typeof draft.id === 'string'
    && typeof draft.filePath === 'string'
    && (draft.persistentFile === undefined || typeof draft.persistentFile === 'boolean')
    && typeof draft.fileName === 'string'
    && typeof draft.fileSize === 'number'
    && validStatuses.has(draft.status)
    && typeof draft.progress === 'number'
  )
}

const isMetadata = (value: unknown): value is MaterialUploadMetadata => {
  if (!value || typeof value !== 'object') return false
  const metadata = value as MaterialUploadMetadata
  return (
    typeof metadata.title === 'string'
    && validKinds.has(metadata.kind)
    && Array.isArray(metadata.courseIds)
    && metadata.courseIds.every((id) => Number.isSafeInteger(id) && id > 0)
    && typeof metadata.candidateCourseName === 'string'
    && typeof metadata.courseName === 'string'
    && typeof metadata.description === 'string'
  )
}

const isUploadState = (value: unknown): value is MaterialUploadState => {
  if (!value || typeof value !== 'object') return false
  const state = value as MaterialUploadState
  return (
    state.version === 4
    && Array.isArray(state.drafts)
    && state.drafts.every(isDraft)
    && isMetadata(state.metadata)
    && !!state.batch
    && typeof state.batch.createIdempotencyKey === 'string'
    && typeof state.batch.completeIdempotencyKey === 'string'
  )
}

const fileExists = async (filePath: string) => {
  if (!filePath) return false
  try {
    await new Promise<void>((resolve, reject) => {
      Taro.getFileSystemManager().getFileInfo({
        filePath,
        success: () => resolve(),
        fail: reject,
      })
    })
    return true
  } catch {
    return false
  }
}

export const persistMaterialFile = async (tempFilePath: string) => {
  try {
    const result = await Taro.saveFile({ tempFilePath })
    if ('savedFilePath' in result && result.savedFilePath) {
      return { filePath: result.savedFilePath, persistent: true }
    }
  } catch {
    // 保存空间不足时仍允许本次会话上传；再次进入时会要求重新选择。
  }
  return { filePath: tempFilePath, persistent: false }
}

export const removePersistedMaterialFiles = async (drafts: MaterialUploadDraft[]) => {
  await Promise.allSettled(drafts.filter((draft) => (
    draft.filePath && draft.persistentFile
  )).map((draft) => (
    Taro.removeSavedFile({ filePath: draft.filePath })
  )))
}

export const materialDraftStorage = {
  read: async (userId: number): Promise<MaterialUploadState | null> => {
    if (!validUserId(userId)) return null
    try {
      Taro.removeStorageSync(LEGACY_UPLOAD_DRAFTS_KEY)
      Taro.removeStorageSync(`${LEGACY_UPLOAD_DRAFTS_V2_KEY_PREFIX}${userId}`)
      const legacyV3 = Taro.getStorageSync<unknown>(`${LEGACY_UPLOAD_DRAFTS_V3_KEY_PREFIX}${userId}`)
      const value = Taro.getStorageSync<unknown>(draftsKey(userId))
      const migrated = !isUploadState(value) && legacyV3 && typeof legacyV3 === 'object'
        ? (() => {
            const legacy = legacyV3 as {
              drafts?: unknown
              metadata?: { courseId?: unknown; courseName?: unknown; title?: unknown; kind?: unknown; description?: unknown }
              batch?: unknown
            }
            const courseId = legacy.metadata?.courseId
            const courseName = legacy.metadata?.courseName
            if (!Array.isArray(legacy.drafts) || !legacy.metadata || !legacy.batch) return null
            return {
              version: 4 as const,
              drafts: legacy.drafts,
              metadata: {
                title: typeof legacy.metadata.title === 'string' ? legacy.metadata.title : '',
                kind: legacy.metadata.kind,
                courseIds: Number.isSafeInteger(courseId) && Number(courseId) > 0 ? [Number(courseId)] : [],
                candidateCourseName: typeof courseName === 'string' && !Number.isSafeInteger(courseId) ? courseName : '',
                courseName: typeof courseName === 'string' ? courseName : '',
                description: typeof legacy.metadata.description === 'string' ? legacy.metadata.description : '',
              },
              batch: legacy.batch,
            }
          })()
        : value
      if (!isUploadState(migrated)) return null
      if (migrated !== value) {
        // 先落盘 v4，再清理 v3，避免迁移中断丢失草稿。
        Taro.setStorageSync(draftsKey(userId), migrated)
        Taro.removeStorageSync(`${LEGACY_UPLOAD_DRAFTS_V3_KEY_PREFIX}${userId}`)
      }
      const drafts = await Promise.all(migrated.drafts.map(async (draft) => {
        const exists = !!draft.persistentFile && await fileExists(draft.filePath)
        if (!exists) {
          return {
            ...draft,
            filePath: '',
            status: 'needs_file' as const,
            progress: 0,
            uploadTarget: undefined,
            fileId: undefined,
            errorMessage: '本地文件已失效，请重新选择',
          }
        }
        if (draft.status === 'uploading') {
          return {
            ...draft,
            status: 'failed' as const,
            progress: 0,
            errorMessage: '上传被中断，请重试',
          }
        }
        return draft
      }))
      return { ...migrated, drafts }
    } catch {
      return null
    }
  },
  write: (userId: number, state: MaterialUploadState) => {
    if (!validUserId(userId)) return
    try {
      Taro.setStorageSync(draftsKey(userId), state)
    } catch {
      Taro.showToast({ title: '上传草稿保存失败', icon: 'none' })
    }
  },
  clear: (userId: number) => {
    if (!validUserId(userId)) return
    try {
      Taro.removeStorageSync(draftsKey(userId))
    } catch {
      // 清理失败时保留草稿，下次进入仍可恢复。
    }
  },
}

const readRecentCourses = (userId: number): MaterialCourseSuggestion[] => {
  if (!validUserId(userId)) return []
  try {
    const value = Taro.getStorageSync<unknown>(recentCoursesKey(userId))
    if (!Array.isArray(value)) return []
    return value.filter((item): item is MaterialCourseSuggestion => (
      !!item
      && typeof item === 'object'
      && typeof item.name === 'string'
      && (item.courseCode === undefined || typeof item.courseCode === 'string')
      && (item.periodId === undefined || typeof item.periodId === 'string')
      && (item.visitedAt === undefined || typeof item.visitedAt === 'number')
    ))
  } catch {
    return []
  }
}

export const rememberCourseSuggestion = (course: MaterialCourseSuggestion) => {
  const userId = getActiveAcademicUserId()
  if (!validUserId(userId) || !course.name.trim()) return
  const normalized = course.name.trim().toLowerCase()
  const values = [
    { ...course, name: course.name.trim(), visitedAt: Date.now() },
    ...readRecentCourses(userId).filter((item) => item.name.trim().toLowerCase() !== normalized),
  ].slice(0, 30)
  try {
    Taro.setStorageSync(recentCoursesKey(userId), values)
  } catch {
    // 最近课程只是补全增强，不影响主流程。
  }
}

export const rememberCourseSuggestions = (courses: MaterialCourseSuggestion[]) => {
  const userId = getActiveAcademicUserId()
  if (!validUserId(userId) || !courses.length) return
  const combined = [...courses, ...readRecentCourses(userId)]
  const seen = new Set<string>()
  const values = combined.flatMap((course) => {
    const name = course.name.trim()
    const key = name.toLowerCase()
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ ...course, name }]
  }).slice(0, 100)
  try {
    Taro.setStorageSync(recentCoursesKey(userId), values)
  } catch {
    // 课程候选缓存失败不影响学业页面。
  }
}

export const getRecentCourseSuggestions = (): MaterialCourseSuggestion[] => {
  const userId = getActiveAcademicUserId()
  const recent = readRecentCourses(userId)
  const cache = academicStorage.getScheduleCache(userId)
  if (!cache) return recent
  const suggestions = [...recent]
  const seen = new Set(recent.map((course) => course.name.trim().toLowerCase()))
  Object.entries(cache.coursesByPeriod).forEach(([periodId, courses]) => {
    courses.forEach((course) => {
      const key = course.name.trim().toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      suggestions.push({ name: course.name.trim(), periodId })
    })
  })
  return suggestions
}
