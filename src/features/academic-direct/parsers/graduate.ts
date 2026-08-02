import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod,
} from '../../../api/types'
import {
  HTMLNode,
  attribute,
  children,
  compactText,
  findAll,
  findFirst,
  findHTMLTable,
  hasClass,
  headersContain,
  isElement,
  positiveSpan,
} from '../html'
import {
  AcademicEncoding,
  TabularRow,
  addHours,
  fieldFloat,
  fieldString,
  fieldTime,
  normalizeGradeLevel,
  parseCourses,
  parseExamTimeRange,
  parseExams,
  parseGrades,
  parseSelections,
} from './common'

const GRADUATE_WEEK_COUNT = 23
const graduateLabeledValuePattern = /^(?:课程名称|课程编号|课程号|任课教师|教师|上课地点|地点|教室|周次)[：:]\s*(.+)$/
const graduateWeekRangePattern = /[\(（]?\s*(\d{1,2})\s*[-—~～至]\s*(\d{1,2})\s*[\)）]?\s*周/g
const graduateWeekNumberPattern = /[\(（]?\s*(\d{1,2})\s*[\)）]?\s*周/g
const graduateSectionPattern = /第?\s*(\d{1,2})(?:\s*[-—~～至]\s*(\d{1,2}))?\s*节/
const graduateExamClockRangePattern = /^\s*(\d{1,2}:\d{2})\s*(?:->|→|[-—~～至])\s*(\d{1,2}:\d{2})\s*$/
const graduateUnreleasedGradeValues = new Set([
  '未选',
  '选课',
  '退换课',
  '正在申请免修',
  '正在修读',
  '在修',
  '正在重修',
])

const integerRange = (start: number, end: number) => (
  Array.from({ length: end - start + 1 }, (_, index) => start + index)
)

const graduateRows = (body: string, requiredHeaders: string[]): TabularRow[] => {
  const table = findHTMLTable(body, requiredHeaders)
  if (!table) throw new Error('研究生教务表格结构无效')
  return table.rows.flatMap((cells) => {
    if (cells.length < table.headers.length) return []
    return [Object.fromEntries(
      table.headers.map((header, index) => [header, compactText(cells[index])]),
    )]
  })
}

const graduatePeriodId = (academicYear: string, term: string) => {
  const matched = /^(\d{4})-(\d{4})$/.exec(academicYear.trim())
  if (!matched || Number(matched[2]) !== Number(matched[1]) + 1) return ''
  if (['夏秋', '秋'].includes(term.trim())) return `${matched[1]}:11`
  if (['春', '春季'].includes(term.trim())) return `${matched[1]}:12`
  return ''
}

const currentGraduatePeriodId = (now = new Date()) => {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 7) return `${year}:11`
  if (month <= 2) return `${year - 1}:11`
  return `${year - 1}:12`
}

export const parseGraduatePeriods = (body: string): AcademicPeriod[] => {
  const rows = graduateRows(body, ['课程编号', '课程名称', '选课学年', '学期'])
  const periods = new Map<string, AcademicPeriod>()
  rows.forEach((row) => {
    const academicYear = fieldString(row, '选课学年')
    const term = fieldString(row, '学期')
    const id = graduatePeriodId(academicYear, term)
    if (!id) return
    const startYear = Number(id.slice(0, 4))
    const spring = id.endsWith(':12')
    const startDate = `${spring ? startYear + 1 : startYear}-${spring ? '03' : '09'}-01`
    const [first, second] = academicYear.split('-', 2)
    periods.set(id, {
      id,
      label: `${academicYear.trim()}学年 ${term.trim()}`,
      short_label: `${first.slice(2)}-${second.slice(2)} ${term.trim()}`,
      start_date: startDate,
      week_count: GRADUATE_WEEK_COUNT,
      is_current: id === currentGraduatePeriodId(),
    })
  })
  return [...periods.values()].sort((left, right) => right.id.localeCompare(left.id))
}

const graduateGradeValue = (raw: string) => {
  const original = raw.trim()
  if (
    !original
    || graduateUnreleasedGradeValues.has(original)
    || original.includes('正在申请免修')
  ) return null
  if (original.includes('免修')) {
    return { gradeType: 'level' as const, score: null, gradeLevel: '免修' }
  }
  const value = original.includes('|')
    ? original.slice(original.lastIndexOf('|') + 1).trim()
    : original
  if (!value || graduateUnreleasedGradeValues.has(value)) return null
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const score = Number(value)
    if (score < 0 || score > 100) return null
    return { gradeType: 'number' as const, score, gradeLevel: null }
  }
  return {
    gradeType: 'level' as const,
    score: null,
    gradeLevel: normalizeGradeLevel(value) || value,
  }
}

export const parseGraduateGrades = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicGrade[] => {
  if (encoding !== 'html') return parseGrades(body, encoding, periodId)
  return graduateRows(body, [
    '课程编号',
    '课程名称',
    '课程性质',
    '学分',
    '选课学年',
    '学期',
    '修读情况/成绩',
  ]).flatMap((row, index) => {
    const rowPeriodId = graduatePeriodId(
      fieldString(row, '选课学年'),
      fieldString(row, '学期'),
    )
    if (!rowPeriodId || (periodId && rowPeriodId !== periodId)) return []
    const name = fieldString(row, '课程名称')
    const grade = graduateGradeValue(fieldString(row, '修读情况/成绩'))
    if (!name || !grade) return []
    const code = fieldString(row, '课程编号')
    return [{
      id: `${rowPeriodId}:${code}:${index + 1}`,
      period_id: rowPeriodId,
      course_code: code,
      course_name: name,
      course_type: fieldString(row, '课程性质'),
      credit: fieldFloat(row, '学分') || 0,
      grade_type: grade.gradeType,
      score: grade.score,
      grade_level: grade.gradeLevel,
    }]
  })
}

const graduateSelectionStatus = (
  resultText: string,
): AcademicCourseSelection['status'] => {
  if (resultText.includes('未选')) return 'failed'
  if (resultText.includes('正在申请免修') || resultText.includes('退换课')) return 'pending'
  return 'selected'
}

export const parseGraduateSelections = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicCourseSelection[] => {
  if (encoding !== 'html') return parseSelections(body, encoding, periodId)
  return graduateRows(body, [
    '课程编号',
    '课程名称',
    '课程性质',
    '学分',
    '选课学年',
    '学期',
    '修读情况/成绩',
  ]).flatMap((row, index) => {
    const rowPeriodId = graduatePeriodId(
      fieldString(row, '选课学年'),
      fieldString(row, '学期'),
    )
    if (!rowPeriodId || (periodId && rowPeriodId !== periodId)) return []
    const name = fieldString(row, '课程名称')
    if (!name) return []
    const resultText = fieldString(row, '修读情况/成绩')
    if ([...resultText].length > 500) throw new Error('研究生选课结果文本过长')
    const code = fieldString(row, '课程编号')
    return [{
      id: `${rowPeriodId}:${code}:${index + 1}`,
      period_id: rowPeriodId,
      course_code: code,
      course_name: name,
      course_type: fieldString(row, '课程性质'),
      credit: fieldFloat(row, '学分') || 0,
      teacher: fieldString(row, '任课老师', '任课教师'),
      campus: '',
      location: '',
      schedule: '',
      capacity: 0,
      enrolled: 0,
      status: graduateSelectionStatus(resultText),
      ...(resultText ? { result_text: resultText } : {}),
    }]
  })
}

interface CellPlacement {
  node: HTMLNode
  column: number
  rowspan: number
}

const graduateRowPlacements = (
  row: HTMLNode[],
  activeRowSpans: Record<number, number>,
) => {
  const placements: CellPlacement[] = []
  const newRowSpans: Record<number, number> = {}
  let column = 0
  row.forEach((cell) => {
    while ((activeRowSpans[column] || 0) > 0) column += 1
    const rowspan = positiveSpan(cell, 'rowspan')
    const colspan = positiveSpan(cell, 'colspan')
    placements.push({ node: cell, column, rowspan })
    if (rowspan > 1) {
      for (let offset = 0; offset < colspan; offset += 1) {
        newRowSpans[column + offset] = rowspan - 1
      }
    }
    column += colspan
  })
  Object.keys(activeRowSpans).forEach((rawColumn) => {
    const occupiedColumn = Number(rawColumn)
    if (activeRowSpans[occupiedColumn] <= 1) delete activeRowSpans[occupiedColumn]
    else activeRowSpans[occupiedColumn] -= 1
  })
  Object.entries(newRowSpans).forEach(([rawColumn, remaining]) => {
    activeRowSpans[Number(rawColumn)] = remaining
  })
  return placements
}

const graduateSection = (placements: CellPlacement[], rowIndex: number) => {
  for (const placement of placements) {
    if (placement.column > 1) continue
    const matched = /-?\d+(?:\.\d+)?/.exec(compactText(placement.node))
    const value = matched ? Math.trunc(Number(matched[0])) : 0
    if (value > 0 && value <= 30) return value
  }
  return rowIndex + 1
}

const graduateNodeLines = (node: HTMLNode) => {
  const lines: string[] = []
  let current = ''
  const flush = () => {
    const value = current.replace(/[\s\u00a0]+/g, ' ').trim()
    current = ''
    if (value) lines.push(value)
  }
  const visit = (item: HTMLNode) => {
    if (isElement(item) && ['script', 'style'].includes(String(item.name).toLowerCase())) return
    if (isElement(item, 'br')) {
      flush()
      return
    }
    const block = isElement(item) && ['div', 'p', 'li'].includes(String(item.name).toLowerCase())
    if (block) flush()
    if (item?.type === 'text') current += `${current ? ' ' : ''}${String(item.data || '')}`
    children(item).forEach(visit)
    if (block) flush()
  }
  visit(node)
  flush()
  return lines
}

const graduateMetadataAttributes = (node: HTMLNode) => [
  ...(isElement(node) ? [node] : []),
  ...findAll(node, isElement),
]
  .flatMap((item) => (
    ['title', 'data-content', 'data-original-title']
      .map((name) => attribute(item, name).trim())
      .filter(Boolean)
  ))

const graduateCourseStrongName = (node: HTMLNode) => {
  const strong = findFirst(node, (item) => (
    isElement(item, 'strong') && hasClass(item, 'f14')
  ))
  return strong ? compactText(strong) : ''
}

const graduateLabeledValue = (lines: string[], labels: string[]) => {
  for (const line of lines) {
    const matched = graduateLabeledValuePattern.exec(line)
    if (!matched) continue
    if (labels.some((label) => line.startsWith(`${label}：`) || line.startsWith(`${label}:`))) {
      return matched[1].trim()
    }
  }
  return ''
}

const graduateCourseMetadataLine = (value: string) => (
  ['课程编号', '课程号', '任课教师', '教师', '上课地点', '地点', '教室', '周次']
    .some((prefix) => value.startsWith(`${prefix}：`) || value.startsWith(`${prefix}:`))
  || new RegExp(graduateWeekRangePattern.source).test(value)
  || new RegExp(graduateWeekNumberPattern.source).test(value)
  || graduateSectionPattern.test(value)
)

export const parseGraduateWeeks = (value: string) => {
  const weeks = new Set<number>()
  for (const matched of value.matchAll(graduateWeekRangePattern)) {
    const start = Number(matched[1])
    const end = Number(matched[2])
    if (start < 1 || end < start || end > 30) continue
    for (let week = start; week <= end; week += 1) weeks.add(week)
  }
  for (const matched of value.matchAll(graduateWeekNumberPattern)) {
    const week = Number(matched[1])
    if (week >= 1 && week <= 30) weeks.add(week)
  }
  return [...weeks].sort((left, right) => left - right)
}

const queryValue = (url: string, name: string) => {
  const matched = new RegExp(`[?&]${encodeURIComponent(name)}=([^&#]*)`).exec(url)
  if (!matched) return ''
  try {
    return decodeURIComponent(matched[1].replace(/\+/g, ' ')).trim()
  } catch {
    return ''
  }
}

const graduateCourseFromNode = (
  node: HTMLNode,
  periodId: string,
  weekday: number,
  startSection: number,
  rowspan: number,
  index: number,
): AcademicCourse | null => {
  const lines = graduateNodeLines(node)
  if (!lines.length) return null
  const allText = [...lines, ...graduateMetadataAttributes(node)].join('\n')
  let name = graduateLabeledValue(lines, ['课程名称']) || graduateCourseStrongName(node)
  const link = isElement(node, 'a')
    ? node
    : findFirst(node, (item) => isElement(item, 'a'))
  const code = graduateLabeledValue(lines, ['课程编号', '课程号'])
    || (link ? queryValue(attribute(link, 'href'), 'kcId') : '')
  let teacher = graduateLabeledValue(lines, ['任课教师', '教师'])
  let location = graduateLabeledValue(lines, ['上课地点', '地点', '教室'])
  if (!name) name = lines.find((line) => !graduateCourseMetadataLine(line)) || ''
  if (!name) return null
  if (!teacher || !location) {
    const metadata = lines.filter((line) => (
      line
      && line !== name
      && line.trim().replace(/[|\u00a0 ]/g, '')
      && !graduateCourseMetadataLine(line)
    ))
    if (!teacher && metadata.length) teacher = String(metadata.shift())
    if (!location && metadata.length) location = metadata.join(' ')
  }
  const weeks = parseGraduateWeeks(allText)
  const identity = code || String(index + 1)
  return {
    id: `${periodId}:${weekday}:${startSection}:${identity}`,
    period_id: periodId,
    course_code: code,
    name,
    teacher,
    campus: '',
    location,
    weekday,
    start_section: startSection,
    end_section: startSection + Math.max(rowspan, 1) - 1,
    weeks: weeks.length ? weeks : integerRange(1, GRADUATE_WEEK_COUNT),
  }
}

const sameNumberValues = (left: number[], right: number[]) => (
  left.length === right.length && left.every((value, index) => value === right[index])
)

const sameGraduateCoursePlacement = (left: AcademicCourse, right: AcademicCourse) => (
  left.period_id === right.period_id
  && left.weekday === right.weekday
  && left.name === right.name
  && left.teacher === right.teacher
  && left.location === right.location
  && sameNumberValues(left.weeks, right.weeks)
  && (!(left.course_code || right.course_code) || left.course_code === right.course_code)
)

const mergeGraduateCourse = (courses: AcademicCourse[], course: AcademicCourse) => {
  for (let index = courses.length - 1; index >= 0; index -= 1) {
    const current = courses[index]
    if (
      !sameGraduateCoursePlacement(current, course)
      || course.start_section > current.end_section + 1
      || course.end_section < current.start_section - 1
    ) continue
    current.start_section = Math.min(current.start_section, course.start_section)
    current.end_section = Math.max(current.end_section, course.end_section)
    return
  }
  courses.push(course)
}

export const parseGraduateCourses = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicCourse[] => {
  if (encoding !== 'html') return parseCourses(body, encoding, periodId)
  const table = findHTMLTable(body, [
    '时间',
    '星期一',
    '星期二',
    '星期三',
    '星期四',
    '星期五',
    '星期六',
    '星期日',
  ])
  if (!table) throw new Error('研究生课表结构无效')
  const result: AcademicCourse[] = []
  const rowSpans: Record<number, number> = {}
  table.rows.forEach((row, rowIndex) => {
    const placements = graduateRowPlacements(row, rowSpans)
    const section = graduateSection(placements, rowIndex)
    placements.forEach((placement) => {
      if (placement.column < 2 || placement.column > 8 || !compactText(placement.node)) return
      const nodes = findAll(placement.node, (node) => (
        isElement(node, 'a')
        && (hasClass(node, 'c666') || !!graduateCourseStrongName(node))
      ))
      const courseNodes = nodes.length ? nodes : [placement.node]
      courseNodes.forEach((node, nodeIndex) => {
        const course = graduateCourseFromNode(
          node,
          periodId,
          placement.column - 1,
          section,
          placement.rowspan,
          result.length + nodeIndex,
        )
        if (course) mergeGraduateCourse(result, course)
      })
    })
  })
  return result
}

const graduateDateTime = (date: string, clock: string) => {
  const raw = `${date.trim()} ${clock.trim()}`
  const normalized = raw
    .replace(/^(\d{4})年(\d{1,2})月(\d{1,2})日/, '$1-$2-$3')
    .replace(/\//g, '-')
  return fieldTime({ value: normalized }, 'value')
}

const graduateExamTimes = (row: TabularRow) => {
  const timeRange = fieldString(row, '考试时间')
  const parsedRange = parseExamTimeRange(timeRange)
  if (parsedRange) return parsedRange
  const date = fieldString(row, '考试日期')
  const clockRange = graduateExamClockRangePattern.exec(timeRange)
  if (clockRange) {
    const startAt = graduateDateTime(date, clockRange[1])
    const endAt = graduateDateTime(date, clockRange[2])
    if (startAt && endAt && Date.parse(endAt) > Date.parse(startAt)) {
      return { startAt, endAt }
    }
  }
  const startText = fieldString(row, '开始时间', '考试开始时间')
  const endText = fieldString(row, '结束时间', '考试结束时间')
  const startAt = date && startText
    ? graduateDateTime(date, startText)
    : fieldTime(row, '开始时间', '考试开始时间', '考试时间')
  let endAt = date && endText
    ? graduateDateTime(date, endText)
    : fieldTime(row, '结束时间', '考试结束时间')
  if (!endAt && startAt) endAt = addHours(startAt, 2)
  return { startAt, endAt }
}

const graduateExamPhase = (value: string): AcademicExam['phase'] => (
  ['期中', '补考', '入学', '期末'].find((phase) => value.includes(phase))
  || '期末'
) as AcademicExam['phase']

export const parseGraduateExams = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicExam[] => {
  if (encoding !== 'html') return parseExams(body, encoding, periodId)
  const table = findHTMLTable(body, ['课程名称'])
  if (table && (
    headersContain(table.headers, '考试时间')
    || headersContain(table.headers, '考试日期')
  )) {
    return table.rows.flatMap((cells, index) => {
      if (cells.length < table.headers.length) return []
      const row = Object.fromEntries(
        table.headers.map((header, cellIndex) => [
          header,
          compactText(cells[cellIndex]),
        ]),
      )
      const name = fieldString(row, '课程名称', '考试课程')
      if (!name) return []
      const code = fieldString(row, '开课号', '课程编号', '课程号')
      const times = graduateExamTimes(row)
      return [{
        id: `${periodId}:${code}:${index + 1}`,
        period_id: periodId,
        course_code: code,
        course_name: name,
        start_at: times.startAt,
        end_at: times.endAt,
        campus: fieldString(row, '校区', '考试校区'),
        location: fieldString(row, '考试地点', '考场', '地点'),
        seat: fieldString(row, '座位号', '座号'),
        phase: graduateExamPhase(fieldString(row, '考试性质', '考试类型')),
        method: fieldString(row, '考试方式'),
        materials: fieldString(row, '可带资料'),
        notice: fieldString(row, '备注'),
      }]
    })
  }
  if (
    body.includes('考试安排')
    && /name=["']xn["']/.test(body)
    && /name=["']xj["']/.test(body)
  ) return []
  throw new Error('研究生考试安排页面结构无效')
}
