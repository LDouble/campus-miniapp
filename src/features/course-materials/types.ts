import type {
  CourseMaterialView,
  MaterialFeedbackCategory,
  MaterialUploadTarget,
} from '../../api/types'

export type MaterialKind = CourseMaterialView['material_type']

export type MaterialUploadStatus = 'draft' | 'uploading' | 'uploaded' | 'failed' | 'needs_file'

export interface MaterialCourseSuggestion {
  name: string
  courseCode?: string
  periodId?: string
  visitedAt?: number
}

export interface MaterialUploadDraft {
  id: string
  filePath: string
  persistentFile?: boolean
  fileName: string
  fileSize: number
  status: MaterialUploadStatus
  progress: number
  uploadTarget?: MaterialUploadTarget
  fileId?: number
  errorMessage?: string
}

export interface MaterialUploadMetadata {
  title: string
  kind: MaterialKind
  /** 规范课程使用完整集合；首项同时是兼容接口的主课程。 */
  courseIds: number[]
  /** 未收录课程只能单独作为候选，不能与规范课程混用。 */
  candidateCourseName: string
  /** 草稿 v3 兼容字段；页面升级期间只用于候选名称输入。 */
  courseName: string
  courseId?: number
  description: string
}

export interface MaterialUploadBatch {
  createIdempotencyKey: string
  completeIdempotencyKey: string
  sessionId?: number
  sessionVersion?: number
  sessionExpiresAt?: string
}

export interface MaterialUploadState {
  version: 4
  drafts: MaterialUploadDraft[]
  metadata: MaterialUploadMetadata
  batch: MaterialUploadBatch
}

export interface MaterialRouteContext {
  courseName?: string
  courseCode?: string
  periodId?: string
  periodLabel?: string
  source?: 'schedule' | 'grades' | 'selection' | 'exams'
  action?: 'upload'
  view?: 'mine'
  materialId?: number
}

export const materialKindLabels: Record<MaterialKind, string> = {
  slides: '课件',
  notes: '笔记',
  exam: '试卷',
  homework: '作业',
  review: '复习资料',
  other: '其他',
}

export const materialKinds = Object.keys(materialKindLabels) as MaterialKind[]

export const materialFeedbackLabels: Record<MaterialFeedbackCategory, string> = {
  file_unavailable: '文件无法打开',
  wrong_course: '课程归类有误',
  content_error: '资料内容有误',
  copyright_privacy: '版权或隐私问题',
  other: '其他问题',
}

export const materialFeedbackCategories = Object.keys(
  materialFeedbackLabels,
) as MaterialFeedbackCategory[]
