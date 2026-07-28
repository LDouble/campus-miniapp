import type {
  MaterialUploadTarget,
  MaterialUploadFileInput,
} from '../../api/types'

export type MaterialKind = MaterialUploadFileInput['material_type']

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
  title: string
  kind: MaterialKind
  courseName: string
  courseId?: number
  periodId?: string
  status: MaterialUploadStatus
  progress: number
  uploadTarget?: MaterialUploadTarget
  materialId?: number
  errorMessage?: string
}

export interface MaterialUploadBatch {
  createIdempotencyKey: string
  completeIdempotencyKey: string
  sessionId?: number
  sessionVersion?: number
  sessionExpiresAt?: string
}

export interface MaterialUploadState {
  version: 2
  drafts: MaterialUploadDraft[]
  batch: MaterialUploadBatch
}

export interface MaterialRouteContext {
  courseName?: string
  courseCode?: string
  periodId?: string
  action?: 'upload'
  view?: 'mine'
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
