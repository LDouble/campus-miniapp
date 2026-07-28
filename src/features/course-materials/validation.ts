import type { MaterialCourseView, MaterialUploadFileInput } from '../../api/types'
import type {
  MaterialCourseSuggestion,
  MaterialUploadBatch,
  MaterialUploadDraft,
} from './types'

export const supportedMaterialExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx'] as const
export const MAX_MATERIAL_FILES = 5
export const MAX_MATERIAL_FILE_SIZE = 50 * 1024 * 1024

const normalizedCourseText = (value: string) => (
  value.toLowerCase().replace(/[\s()（）_\-—–·.]/g, '')
)

export const materialExtension = (filename: string) => (
  filename.split('.').pop()?.toLowerCase() || ''
)

export const isSupportedMaterialFile = (filename: string) => (
  supportedMaterialExtensions.includes(
    materialExtension(filename) as typeof supportedMaterialExtensions[number],
  )
)

export const validateMaterialDrafts = (drafts: MaterialUploadDraft[]) => {
  if (!drafts.length) return '请先选择资料文件'
  if (drafts.length > MAX_MATERIAL_FILES) return '单次最多上传 5 个文件'
  for (const draft of drafts) {
    if (!draft.title.trim() || !draft.courseName.trim()) return '请补全标题和课程'
    if (!draft.filePath || draft.status === 'needs_file') return `${draft.fileName} 需要重新选择`
    if (!isSupportedMaterialFile(draft.fileName)) return `${draft.fileName} 的文件类型暂不支持`
    if (!Number.isFinite(draft.fileSize) || draft.fileSize <= 0) return `${draft.fileName} 的文件大小无效`
    if (draft.fileSize > MAX_MATERIAL_FILE_SIZE) return `${draft.fileName} 超过 50MB`
  }
  return ''
}

export const isMaterialUploadSessionReusable = (
  batch: MaterialUploadBatch,
  drafts: MaterialUploadDraft[],
  now = Date.now(),
) => (
  !!batch.sessionId
  && batch.sessionVersion !== undefined
  && !!batch.sessionExpiresAt
  && Date.parse(batch.sessionExpiresAt) > now + 5_000
  && drafts.every((draft) => (
    !!draft.uploadTarget
    && !!draft.materialId
    && draft.uploadTarget.material_id === draft.materialId
  ))
)

export const resolveMaterialCourse = (
  courses: MaterialCourseView[],
  value: { id?: number; name?: string; courseCode?: string },
) => {
  if (value.id) {
    const byId = courses.find((course) => course.id === value.id)
    if (byId) return byId
  }
  const code = value.courseCode?.trim().toLowerCase()
  if (code) {
    const byCode = courses.find((course) => course.course_code.trim().toLowerCase() === code)
    if (byCode) return byCode
  }
  const name = normalizedCourseText(value.name || '')
  if (!name) return undefined
  return courses.find((course) => (
    normalizedCourseText(course.name) === name
    || (course.aliases || []).some((alias) => normalizedCourseText(alias) === name)
  ))
}

export const mergeCourseSuggestions = (
  courses: MaterialCourseView[],
  cached: MaterialCourseSuggestion[],
) => {
  const result = new Map<string, MaterialCourseSuggestion>()
  cached
    .slice()
    .sort((left, right) => (right.visitedAt || 0) - (left.visitedAt || 0))
    .forEach((course) => {
      const key = normalizedCourseText(course.name)
      if (key && !result.has(key)) result.set(key, course)
    })
  courses.forEach((course) => {
    const values = [course.name, ...(course.aliases || [])]
    values.forEach((name) => {
      const key = normalizedCourseText(name)
      if (!key || result.has(key)) return
      result.set(key, {
        name: course.name,
        courseCode: course.course_code,
      })
    })
  })
  return [...result.values()]
}

export const mimeTypes: Record<string, MaterialUploadFileInput['mime_type']> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
