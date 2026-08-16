import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  inferCourseSuggestion,
  inferMaterialKind,
  normalizeMaterialTitle,
} from '../src/features/course-materials/inference'
import type { MaterialCourseView } from '../src/api/types'
import {
  buildCourseMaterialQuery,
} from '../src/features/course-materials/route'
import type { MaterialUploadDraft } from '../src/features/course-materials/types'
import { getSelectedTempFiles } from '../src/utils/file-selection'
import {
  MAX_MATERIAL_FILE_SIZE,
  isMaterialUploadSessionReusable,
  resolveMaterialCourse,
  selectSupportedMaterialFiles,
  validateMaterialDrafts,
} from '../src/features/course-materials/validation'

const courses: MaterialCourseView[] = [{
  id: 1,
  course_code: 'MATH-002',
  name: '高等数学（二）',
  aliases: ['高数二', '高等数学Ⅱ'],
  education_level: 'undergraduate',
  material_count: 3,
  sort_order: 0,
  status: 'enabled',
  version: 1,
}]

assert.equal(resolveMaterialCourse(courses, { name: '高数二' })?.id, 1)
assert.equal(resolveMaterialCourse(courses, { courseCode: 'math-002' })?.id, 1)
assert.equal(resolveMaterialCourse(courses, { name: '不存在课程' }), undefined)
assert.equal(inferCourseSuggestion('高数二期末真题.pdf', [
  { name: '大学英语' },
  { name: '高数二' },
])?.name, '高数二')
assert.equal(inferMaterialKind('高数二期末真题.pdf'), 'exam')
assert.equal(normalizeMaterialTitle('高数二-期末真题.pdf'), '高数二 期末真题')
const routeParams = new URLSearchParams(buildCourseMaterialQuery({
  courseName: '高等数学（二）',
  courseCode: 'MATH-002',
  periodId: '2025-2026-2',
  periodLabel: '2025-2026 学年春季学期',
  source: 'grades',
}))
assert.equal(routeParams.get('courseName'), '高等数学（二）')
assert.equal(routeParams.get('periodLabel'), '2025-2026 学年春季学期')
assert.equal(routeParams.get('source'), 'grades')

const draft: MaterialUploadDraft = {
  id: 'draft-1',
  filePath: 'wxfile://saved/material.pdf',
  fileName: 'material.pdf',
  fileSize: 1024,
  status: 'draft',
  progress: 0,
}
const metadata = {
  title: '课程资料',
  kind: 'notes' as const,
  courseName: '高等数学（二）',
  courseId: 1,
  description: '',
}
assert.equal(validateMaterialDrafts([draft], metadata), '')
assert.match(validateMaterialDrafts([
  { ...draft, fileSize: MAX_MATERIAL_FILE_SIZE + 1 },
], metadata), /超过 50MB/)
assert.match(validateMaterialDrafts([
  { ...draft, filePath: '', status: 'needs_file' },
], metadata), /需要重新选择/)
assert.match(validateMaterialDrafts(Array.from(
  { length: 6 },
  (_, index) => ({ ...draft, id: `draft-${index}` }),
), metadata), /最多上传 5 个文件/)
assert.equal(isMaterialUploadSessionReusable({
  createIdempotencyKey: 'create-key',
  completeIdempotencyKey: 'complete-key',
  sessionId: 1,
  sessionVersion: 1,
  sessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
}, [{
  ...draft,
  fileId: 2,
  uploadTarget: {
    file_id: 2,
    upload_url: 'https://storage.example/upload',
    upload_method: 'POST',
    file_field: 'file',
    form_fields: {},
    headers: {},
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  },
}]), true)
assert.equal(isMaterialUploadSessionReusable({
  createIdempotencyKey: 'create-key',
  completeIdempotencyKey: 'complete-key',
  sessionId: 1,
  sessionVersion: 1,
  sessionExpiresAt: new Date(Date.now() - 1_000).toISOString(),
}, [draft]), false)

assert.deepEqual(selectSupportedMaterialFiles(undefined), [])
assert.deepEqual(selectSupportedMaterialFiles(null), [])
assert.deepEqual(selectSupportedMaterialFiles({ tempFiles: [] }), [])
assert.deepEqual(selectSupportedMaterialFiles([]), [])

const selectedFiles = selectSupportedMaterialFiles([
  { name: '复习资料.pdf', path: 'wxfile://review.pdf', size: 1024 },
  { name: '课堂笔记.docx', path: 'wxfile://notes.docx', size: 2048 },
  { name: '课程课件.pptx', path: 'wxfile://slides.pptx', size: 4096 },
  { name: '', path: 'wxfile://missing-name.pdf', size: 1024 },
  { name: 'missing-path.pdf', size: 1024 },
  { name: 'invalid-size.pdf', path: 'wxfile://invalid-size.pdf', size: 0 },
  { name: 'too-large.pdf', path: 'wxfile://too-large.pdf', size: MAX_MATERIAL_FILE_SIZE + 1 },
  { name: 'image.png', path: 'wxfile://image.png', size: 1024 },
])
assert.deepEqual(selectedFiles.map((file) => file.name), [
  '复习资料.pdf',
  '课堂笔记.docx',
  '课程课件.pptx',
])
assert.equal(selectSupportedMaterialFiles(Array.from(
  { length: 7 },
  (_, index) => ({
    name: `资料-${index}.pdf`,
    path: `wxfile://material-${index}.pdf`,
    size: 1024,
  }),
)).length, 5)

assert.deepEqual(getSelectedTempFiles(undefined), [])
assert.deepEqual(getSelectedTempFiles(null), [])
assert.deepEqual(getSelectedTempFiles({}), [])
assert.deepEqual(getSelectedTempFiles({ tempFiles: undefined }), [])
assert.deepEqual(getSelectedTempFiles({ tempFiles: [{ path: 'wxfile://safe.pdf' }] }), [
  { path: 'wxfile://safe.pdf' },
])

const materialsStyle = readFileSync(
  resolve(__dirname, '../src/pages/materials/index.scss'),
  'utf8',
)
assert.match(materialsStyle, /\.materials-sheet--filter \{[^}]*max-height: 72vh;/u)
assert.match(materialsStyle, /\.materials-sheet--filter[\s\S]*?\.materials-sheet__body \{[^}]*overflow-y: auto;/u)
assert.match(materialsStyle, /\.materials-sheet--upload-course \{[^}]*height: 76vh;[^}]*max-height: 76vh;/u)

process.stdout.write('course-materials semantic smoke: ok\n')
