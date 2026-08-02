import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod,
} from '../../../api/types'
import {
  attribute,
  children,
  compactText,
  directTableCells,
  findAll,
  findFirst,
  hasClass,
  isElement,
  parseHTML,
  splitLabeledText,
  hasAttribute,
} from '../html'
import {
  AcademicEncoding,
  parseExams,
  parseGrades,
  parseSelections,
} from './common'

const scheduleTimePattern = /(\d+(?:-\d+)?(?:[,，、]\d+(?:-\d+)?)*)周/g
const scheduleSectionPattern = /[\[【]\s*(\d+)(?:\s*[-~至]\s*(\d+))?\s*节[\]】]/
const undergraduatePeriodIdPattern = /^\d{4}-\d{4}-[123]$/

const padDate = (value: number) => String(value).padStart(2, '0')

const inferredUndergraduatePeriodStart = (periodId: string) => {
  const [rawFirstYear, rawSecondYear, rawTerm] = periodId.split('-')
  const firstYear = Number(rawFirstYear)
  const secondYear = Number(rawSecondYear)
  const term = Number(rawTerm)
  if (
    !Number.isInteger(firstYear)
    || secondYear !== firstYear + 1
    || ![1, 2, 3].includes(term)
  ) return ''
  let year = firstYear
  let month = 7
  if (term === 2) month = 9
  if (term === 3) {
    year = secondYear
    month = 3
  }
  const start = new Date(Date.UTC(year, month - 1, 1))
  const day = start.getUTCDay()
  const daysToMonday = (8 - day) % 7
  start.setUTCDate(start.getUTCDate() + daysToMonday)
  return `${start.getUTCFullYear()}-${padDate(start.getUTCMonth() + 1)}-${padDate(start.getUTCDate())}`
}

export const parseUndergraduatePeriods = (body: string): AcademicPeriod[] => {
  const root = parseHTML(body)
  const selector = findFirst(root, (node) => (
    isElement(node, 'select')
    && ['name', 'id'].some((name) => attribute(node, name) === 'xnxq01id')
  ))
  if (!selector) throw new Error('本科教务学期选择器无效')
  const periods = children(selector).flatMap((option): AcademicPeriod[] => {
    if (!isElement(option, 'option')) return []
    const id = attribute(option, 'value').trim()
    const label = compactText(option)
    if (!undergraduatePeriodIdPattern.test(id) || !label) return []
    return [{
      id,
      label,
      short_label: label,
      start_date: inferredUndergraduatePeriodStart(id),
      week_count: 20,
      is_current: hasAttribute(option, 'selected'),
    }]
  })
  if (!periods.length) throw new Error('本科教务未返回可用学期')
  return periods
}

const positiveAttributeInt = (node: any, name: string, fallback: number) => {
  const value = Number.parseInt(attribute(node, name), 10)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export const parseUndergraduateScheduleTime = (value: string) => {
  const sectionMatch = scheduleSectionPattern.exec(value)
  if (!sectionMatch) return { weeks: [], startSection: 0, endSection: 0 }
  const startSection = Number(sectionMatch[1])
  const endSection = Number(sectionMatch[2] || sectionMatch[1])
  const weekSet = new Set<number>()
  for (const matched of value.matchAll(scheduleTimePattern)) {
    matched[1].split(/[,，、]/).forEach((part) => {
      const [rawStart, rawEnd] = part.trim().split('-', 2)
      const start = Number(rawStart)
      const end = Number(rawEnd || rawStart)
      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) return
      for (let week = start; week <= end && week <= 30; week += 1) {
        weekSet.add(week)
      }
    })
  }
  const weeks = [...weekSet]
    .filter((week) => {
      if (value.includes('单') && !value.includes('双')) return week % 2 === 1
      if (value.includes('双') && !value.includes('单')) return week % 2 === 0
      return true
    })
    .sort((left, right) => left - right)
  return { weeks, startSection, endSection }
}

const parseUndergraduateCourseCell = (
  cell: any,
  periodId: string,
  weekday: number,
  offset: number,
) => findAll(cell, (node) => (
  isElement(node, 'li') && hasClass(node, 'qz-toolitiplists')
)).flatMap((item, itemIndex): AcademicCourse[] => {
  const nameNode = findFirst(item, (node) => hasClass(node, 'qz-tooltipContent-title'))
  const detailsNode = findFirst(
    item,
    (node) => hasClass(node, 'qz-tooltipContent-detaillists'),
  )
  if (!nameNode || !detailsNode) return []
  const name = compactText(nameNode)
  if (!name) return []
  const details = Object.fromEntries(
    children(detailsNode)
      .filter((node) => isElement(node) && hasClass(node, 'qz-tooltipContent-detailitem'))
      .map((node) => splitLabeledText(compactText(node)))
      .filter(([key]) => !!key),
  )
  const schedule = parseUndergraduateScheduleTime(details['时间'] || '')
  if (
    !schedule.weeks.length
    || schedule.startSection <= 0
    || schedule.endSection < schedule.startSection
  ) return []
  const courseCode = String(details['课程号'] || '').trim()
  const id = String(details['选课号'] || '').trim()
    || `${periodId}:${courseCode || 'course'}:${weekday}:${schedule.startSection}:${offset + itemIndex + 1}`
  return [{
    id,
    period_id: periodId,
    course_code: courseCode,
    name,
    teacher: String(details['老师'] || '').trim(),
    campus: '',
    location: String(details['地点'] || '').trim(),
    weekday,
    start_section: schedule.startSection,
    end_section: schedule.endSection,
    weeks: schedule.weeks,
  }]
})

export const parseUndergraduateCourses = (
  body: string,
  periodId: string,
): AcademicCourse[] => {
  const root = parseHTML(body)
  const table = findFirst(root, (node) => (
    isElement(node, 'table') && hasClass(node, 'qz-weeklyTable')
  ))
  if (!table) throw new Error('本科课表结构无效')
  const rows = findAll(table, (node) => isElement(node, 'tr'))
  const result: AcademicCourse[] = []
  rows.forEach((row) => {
    const cells = directTableCells(row)
    const labelIndex = cells.findIndex((cell) => hasClass(cell, 'qz-weeklyTable-label'))
    if (labelIndex < 0 || !compactText(cells[labelIndex]).includes('大节')) return
    let weekday = 1
    cells.slice(labelIndex + 1).forEach((cell) => {
      const width = positiveAttributeInt(
        cell,
        'colsize',
        positiveAttributeInt(cell, 'colspan', 1),
      )
      if (hasClass(cell, 'qz-hasCourse')) {
        result.push(...parseUndergraduateCourseCell(
          cell,
          periodId,
          weekday,
          result.length,
        ))
      }
      weekday += width
    })
  })
  return result
}

export const parseUndergraduateGrades = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicGrade[] => parseGrades(body, encoding, periodId)

export const parseUndergraduateExams = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicExam[] => parseExams(body, encoding, periodId)

export const parseUndergraduateSelections = (
  body: string,
  encoding: AcademicEncoding,
  periodId: string,
): AcademicCourseSelection[] => parseSelections(body, encoding, periodId)
