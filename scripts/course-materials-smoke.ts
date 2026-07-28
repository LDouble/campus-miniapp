import { strict as assert } from 'node:assert'
import {
  inferCourseSuggestion,
  inferMaterialKind,
  normalizeMaterialTitle,
} from '../src/features/course-materials/inference'
import type { MaterialCourseView } from '../src/api/types'
import type { MaterialUploadDraft } from '../src/features/course-materials/types'
import {
  MAX_MATERIAL_FILE_SIZE,
  isMaterialUploadSessionReusable,
  resolveMaterialCourse,
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

const draft: MaterialUploadDraft = {
  id: 'draft-1',
  filePath: 'wxfile://saved/material.pdf',
  fileName: 'material.pdf',
  fileSize: 1024,
  title: '课程资料',
  kind: 'notes',
  courseName: '高等数学（二）',
  courseId: 1,
  status: 'draft',
  progress: 0,
}
assert.equal(validateMaterialDrafts([draft]), '')
assert.match(validateMaterialDrafts([
  { ...draft, fileSize: MAX_MATERIAL_FILE_SIZE + 1 },
]), /超过 50MB/)
assert.match(validateMaterialDrafts([
  { ...draft, filePath: '', status: 'needs_file' },
]), /需要重新选择/)
assert.match(validateMaterialDrafts(Array.from(
  { length: 6 },
  (_, index) => ({ ...draft, id: `draft-${index}` }),
)), /最多上传 5 个文件/)
assert.equal(isMaterialUploadSessionReusable({
  createIdempotencyKey: 'create-key',
  completeIdempotencyKey: 'complete-key',
  sessionId: 1,
  sessionVersion: 1,
  sessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
}, [{
  ...draft,
  materialId: 2,
  uploadTarget: {
    material_id: 2,
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

process.stdout.write('course-materials semantic smoke: ok\n')
