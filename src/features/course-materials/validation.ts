import type { MaterialCourseView, MaterialUploadFileInput } from '../../api/types'
import { apiDateTimeTimestamp } from '../../utils/date-time'
import type {
  MaterialCourseSuggestion,
  MaterialUploadBatch,
  MaterialUploadDraft,
  MaterialUploadMetadata,
} from './types'

export const supportedMaterialExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx'] as const
export const MAX_MATERIAL_FILES = 5
export const MAX_MATERIAL_FILE_SIZE = 50 * 1024 * 1024

export interface SelectedMaterialFile {
  name: string
  path: string
  size: number
}

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

export const selectSupportedMaterialFiles = (files: unknown): SelectedMaterialFile[] => {
  if (!Array.isArray(files)) return []
  return files.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const file = value as Partial<SelectedMaterialFile>
    if (
      typeof file.name !== 'string'
      || !file.name.trim()
      || typeof file.path !== 'string'
      || !file.path
      || typeof file.size !== 'number'
      || !Number.isFinite(file.size)
      || file.size <= 0
      || file.size > MAX_MATERIAL_FILE_SIZE
      || !isSupportedMaterialFile(file.name)
    ) return []
    return [{ name: file.name, path: file.path, size: file.size }]
  }).slice(0, MAX_MATERIAL_FILES)
}

export const validateMaterialDrafts = (
  drafts: MaterialUploadDraft[],
  metadata: MaterialUploadMetadata,
) => {
  if (!drafts.length) return '请先选择资料文件'
  if (drafts.length > MAX_MATERIAL_FILES) return '单次最多上传 5 个文件'
  if (!metadata.title.trim() || !metadata.courseName.trim()) return '请补全资料名称和课程'
  for (const draft of drafts) {
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
  && apiDateTimeTimestamp(batch.sessionExpiresAt) > now + 5_000
  && drafts.every((draft) => (
    !!draft.uploadTarget
    && !!draft.fileId
    && draft.uploadTarget.file_id === draft.fileId
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
    const byCode = courses.filter((course) => {
      const sourceCodes = course.source_course_codes || []
      return [course.course_code, ...sourceCodes]
        .some((candidate) => candidate.trim().toLowerCase() === code)
    })
    // PR #274 支持合并后的来源课程代码。无论规范代码还是来源代码，多个候选
    // 都表示服务端数据仍有歧义，不能把资料误归到数组中的第一门课程。
    if (byCode.length === 1) return byCode[0]
    // 有课程代码时绝不能回退到同名/别名：名称可能跨学期或跨院系复用，且代码
    // 未建档也不能把资料错误地关联到另一门同名课程。
    return undefined
  }
  const name = normalizedCourseText(value.name || '')
  if (!name) return undefined
  const byName = courses.filter((course) => (
    normalizedCourseText(course.name) === name
    || (course.aliases || []).some((alias) => normalizedCourseText(alias) === name)
  ))
  return byName.length === 1 ? byName[0] : undefined
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
