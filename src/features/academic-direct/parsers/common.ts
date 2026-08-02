import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicExam,
  AcademicGrade,
} from '../../../api/types'
import { htmlTables, tableObjectRows } from '../html'

export type TabularRow = Record<string, unknown>
export type AcademicEncoding = 'html' | 'json'

const numberPattern = /-?\d+(?:\.\d+)?/

const objectRows = (values: unknown[]) => (
  values.filter((value): value is TabularRow => (
    !!value && typeof value === 'object' && !Array.isArray(value)
  ))
)

export const unwrapRows = (payload: unknown): TabularRow[] => {
  if (Array.isArray(payload)) return objectRows(payload)
  if (payload && typeof payload === 'object') {
    const object = payload as TabularRow
    for (const key of ['data', 'rows', 'list', 'result', 'items']) {
      const nested = object[key]
      if (Array.isArray(nested)) return objectRows(nested)
      if (nested && typeof nested === 'object') {
        try {
          return unwrapRows(nested)
        } catch {
          // 继续检查下一个标准分页字段。
        }
      }
    }
  }
  throw new Error('教务响应中未找到列表数据')
}

export const tabularRows = (body: string, encoding: AcademicEncoding) => {
  if (encoding === 'json') return unwrapRows(JSON.parse(body))
  const rows = htmlTables(body).flatMap(tableObjectRows)
  if (!rows.length) throw new Error('教务页面中未找到表格数据')
  return rows
}

export const fieldString = (row: TabularRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value === undefined || value === null) continue
    const result = typeof value === 'string' ? value.trim() : String(value).trim()
    if (result) return result
  }
  return ''
}

export const fieldInt = (row: TabularRow, ...keys: string[]) => {
  const matched = numberPattern.exec(fieldString(row, ...keys))
  return matched ? Math.trunc(Number(matched[0])) : 0
}

export const fieldFloat = (row: TabularRow, ...keys: string[]) => {
  const matched = numberPattern.exec(fieldString(row, ...keys))
  if (!matched) return null
  const value = Number(matched[0])
  return Number.isFinite(value) ? value : null
}

export const fieldInts = (row: TabularRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (Array.isArray(value)) {
      return value.map(Number).filter((item) => Number.isInteger(item))
    }
    if (value !== undefined && value !== null) {
      return String(value).match(/-?\d+/g)?.map(Number) || []
    }
  }
  return []
}

const pad = (value: number) => String(value).padStart(2, '0')

const normalizeShanghaiDateTime = (value: string) => {
  const matched = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?(?:[ T]\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(
    value.trim(),
  )
  if (!matched) return ''
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = matched
  const numbers = [year, month, day, hour, minute, second].map(Number)
  if (
    numbers.some((item) => !Number.isFinite(item))
    || numbers[1] < 1
    || numbers[1] > 12
    || numbers[2] < 1
    || numbers[2] > 31
    || numbers[3] > 23
    || numbers[4] > 59
    || numbers[5] > 59
  ) return ''
  return `${numbers[0]}-${pad(numbers[1])}-${pad(numbers[2])}`
    + `T${pad(numbers[3])}:${pad(numbers[4])}:${pad(numbers[5])}+08:00`
}

export const fieldTime = (row: TabularRow, ...keys: string[]) => (
  normalizeShanghaiDateTime(fieldString(row, ...keys))
)

export const parseExamTimeRange = (value: string) => {
  const matched = /^\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*[~～\-至]\s*(\d{1,2}:\d{2})\s*$/.exec(
    value,
  )
  if (!matched) return null
  const startAt = normalizeShanghaiDateTime(`${matched[1]} ${matched[2]}`)
  const endAt = normalizeShanghaiDateTime(`${matched[1]} ${matched[3]}`)
  if (!startAt || !endAt || Date.parse(endAt) <= Date.parse(startAt)) return null
  return { startAt, endAt }
}

export const addHours = (value: string, hours: number) => {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return ''
  const shifted = new Date(timestamp + hours * 60 * 60 * 1000)
  const local = new Date(shifted.getTime() + 8 * 60 * 60 * 1000)
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`
    + `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}+08:00`
}

export const normalizeGradeLevel = (raw: string) => {
  switch (raw.trim()) {
    case '优秀':
    case '良好':
    case '中等':
    case '免修':
      return raw.trim()
    case '及格':
    case '合格':
    case '通过':
      return '及格'
    case '不及格':
    case '不合格':
    case '未通过':
      return '不及格'
    default:
      return ''
  }
}

export const normalizeSelectionStatus = (
  raw: string,
): AcademicCourseSelection['status'] => {
  const value = raw.trim().toLowerCase()
  if (value === 'selected' || value === 'pending' || value === 'failed') return value
  if (['待', '确认中', '处理中', '预选'].some((keyword) => value.includes(keyword))) {
    return 'pending'
  }
  if (['落选', '未选', '失败', '退选', '取消'].some((keyword) => value.includes(keyword))) {
    return 'failed'
  }
  return 'selected'
}

const fallbackId = (periodId: string, code: string, index: number) => (
  `${periodId}:${code || 'record'}:${index + 1}`
)

export const parseCourses = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicCourse[] => tabularRows(body, encoding).flatMap((row, index) => {
  const name = fieldString(row, 'name', 'course_name', 'courseName', 'kcmc', 'kc_mc', '课程名称')
  if (!name) return []
  const code = fieldString(row, 'course_code', 'courseCode', 'kch', 'kcdm', '课程号')
  const weeks = fieldInts(row, 'weeks', 'week_list', 'zcd', '上课周次')
  return [{
    id: fieldString(row, 'id', 'course_id', 'courseId', 'jx0404id')
      || fallbackId(periodId, code, index),
    period_id: fieldString(row, 'period_id', 'semesterId', 'xnxqdm', 'xnxqid') || periodId,
    course_code: code,
    name,
    teacher: fieldString(row, 'teacher', 'teacherName', 'jsxm', '授课教师'),
    campus: fieldString(row, 'campus', 'campusName', 'xqmc', '校区'),
    location: fieldString(row, 'location', 'classroom', 'jsmc', '上课地点'),
    weekday: fieldInt(row, 'weekday', 'dayOfWeek', 'xqj', '星期'),
    start_section: fieldInt(row, 'start_section', 'startSection', 'ksjc', '开始节次'),
    end_section: fieldInt(row, 'end_section', 'endSection', 'jsjc', '结束节次'),
    weeks: weeks.length ? weeks : [1],
  }]
})

export const parseGrades = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicGrade[] => tabularRows(body, encoding).flatMap((row, index) => {
  const name = fieldString(row, 'course_name', 'courseName', 'kcmc', 'kc_mc', '课程名称')
  if (!name) return []
  const code = fieldString(row, 'course_code', 'courseCode', 'kch', '课程号')
  let score = fieldFloat(row, 'score', 'cj', 'zcjstr', 'zcj', '成绩')
  const normalizedLevel = normalizeGradeLevel(
    fieldString(row, 'grade_level', 'level', 'dj', 'zcjstr', '等级'),
  )
  if (normalizedLevel) score = null
  return [{
    id: fieldString(row, 'id', 'grade_id', 'cj0708id')
      || fallbackId(periodId, code, index),
    period_id: fieldString(row, 'period_id', 'semesterId', 'xnxqdm', 'xqstr', 'xnxqid')
      || periodId,
    course_code: code,
    course_name: name,
    course_type: fieldString(
      row,
      'course_type',
      'courseType',
      'kcxzmc',
      'kccm',
      '课程性质',
    ),
    credit: fieldFloat(row, 'credit', 'xf', '学分') || 0,
    grade_type: score === null ? 'level' : 'number',
    score,
    grade_level: normalizedLevel || null,
  }]
})

export const parseExams = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicExam[] => tabularRows(body, encoding).flatMap((row, index) => {
  const name = fieldString(
    row,
    'course_name',
    'courseName',
    'kcmc',
    'kskcmc',
    '课程名称',
  )
  if (!name) return []
  const code = fieldString(row, 'course_code', 'courseCode', 'kch', '课程号')
  const range = parseExamTimeRange(fieldString(row, 'kssj', '考试时间'))
  const startAt = range?.startAt || fieldTime(row, 'start_at', 'startAt', 'kssj', '考试时间')
  let endAt = range?.endAt || fieldTime(row, 'end_at', 'endAt', 'jssj')
  if (!endAt && startAt) endAt = addHours(startAt, 2)
  const rawPhase = fieldString(row, 'phase', 'examPhase', 'ksxzmc', '考试性质')
  const phase = ['期中', '期末', '补考', '入学'].includes(rawPhase)
    ? rawPhase as AcademicExam['phase']
    : '期末'
  return [{
    id: fieldString(row, 'id', 'exam_id', 'kw0410id', 'kw0413id')
      || fallbackId(periodId, code, index),
    period_id: fieldString(row, 'period_id', 'semesterId', 'xnxqdm', 'xnxqid') || periodId,
    course_code: code,
    course_name: name,
    start_at: startAt,
    end_at: endAt,
    campus: fieldString(row, 'campus', 'campusName', 'ksxq', 'xqmc', '校区'),
    location: fieldString(row, 'location', 'classroom', 'jsmc', 'js_mc', '考试地点'),
    seat: fieldString(row, 'seat', 'seatNo', 'zwh', '座位号'),
    phase,
    method: fieldString(row, 'method', 'examMethod', 'ksfs', '考试方式'),
    materials: fieldString(row, 'materials', 'allowedMaterials', '可带资料'),
    notice: fieldString(row, 'notice', 'remark', 'bz', 'bzywmc', '备注'),
  }]
})

export const parseSelections = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicCourseSelection[] => tabularRows(body, encoding).flatMap((row, index) => {
  const name = fieldString(row, 'course_name', 'courseName', 'kcmc', 'kc_mc', '课程名称')
  if (!name) return []
  const code = fieldString(row, 'course_code', 'courseCode', 'kch', '课程号')
  const selectedAt = fieldTime(row, 'selected_at', 'selectedAt', 'xksj', '选课时间')
  const note = fieldString(row, 'note', 'remark', 'bz', '备注')
  return [{
    id: fieldString(row, 'id', 'selection_id', 'jx02id')
      || fallbackId(periodId, code, index),
    period_id: fieldString(row, 'period_id', 'semesterId', 'xnxqdm', 'xnxqid') || periodId,
    course_code: code,
    course_name: name,
    course_type: fieldString(
      row,
      'course_type',
      'courseType',
      'kcxzmc',
      'kcxz_mc',
      'kclb_mc',
      '课程性质',
    ),
    credit: fieldFloat(row, 'credit', 'xf', '学分') || 0,
    teacher: fieldString(row, 'teacher', 'teacherName', 'jsxm', 'xm', '授课教师'),
    campus: fieldString(row, 'campus', 'campusName', 'xqmc', '校区'),
    location: fieldString(row, 'location', 'classroom', 'jsmc', 'skdd', '地点'),
    schedule: fieldString(row, 'schedule', 'courseTime', 'sksj', '上课时间'),
    capacity: fieldInt(row, 'capacity', 'maxCount', 'krl', '容量'),
    enrolled: fieldInt(row, 'enrolled', 'selectedCount', 'yxrs', '已选人数'),
    status: normalizeSelectionStatus(
      fieldString(row, 'status', 'selectionStatus', 'xkzt', '选课状态'),
    ),
    ...(selectedAt ? { selected_at: selectedAt } : {}),
    ...(note ? { note } : {}),
  }]
})
