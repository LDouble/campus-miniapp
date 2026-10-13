import type { Course } from '../../pages/academic/types'
import type { TimetableBuddyCustomCourse } from './model'

const normalizedText = (value?: string) => value?.trim() || ''

const uniqueSorted = (values: number[]) => [...new Set(values)].sort((left, right) => left - right)
const textLength = (value: string) => Array.from(value).length
const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && !!value.trim()
)

const invalidCourseError = () => (
  new Error('课表中存在无效课程（课程名、星期、节次或周次），请刷新课表后再同步')
)

/** buildTimetableBuddyCustomCourses 将本机自定义课程投影为安全的共享补充。 */
export const buildTimetableBuddyCustomCourses = (
  courses: Course[],
  periodId: string,
): TimetableBuddyCustomCourse[] => {
  if (!Array.isArray(courses) || !isNonEmptyString(periodId)) throw invalidCourseError()

  const selectedCourses: Course[] = []
  const seenIdsByPeriod = new Set<string>()
  for (const course of courses) {
    if (!course || typeof course !== 'object') throw invalidCourseError()
    // 调用方可传完整课表；官方课与蹭课不属于自定义课程补充，不能上传。
    if (course.source !== 'custom') continue
    if (
      !isNonEmptyString(course.id)
      || !isNonEmptyString(course.periodId)
      || typeof course.name !== 'string'
      || typeof course.teacher !== 'string'
      || typeof course.location !== 'string'
      || (course.classNum !== undefined && typeof course.classNum !== 'string')
      || (course.note !== undefined && typeof course.note !== 'string')
      || (course.campus !== undefined && typeof course.campus !== 'string')
      || !Number.isInteger(course.weekday)
      || course.weekday < 1
      || course.weekday > 7
      || !Number.isInteger(course.startSection)
      || !Number.isInteger(course.endSection)
      || course.startSection < 1
      || course.endSection > 12
      || course.startSection > course.endSection
      || !Array.isArray(course.weeks)
      || course.weeks.length === 0
      || course.weeks.some((week) => !Number.isInteger(week) || week < 1 || week > 30)
      || typeof course.color !== 'string'
    ) throw invalidCourseError()

    const idByPeriod = `${course.periodId}\u0000${course.id}`
    if (seenIdsByPeriod.has(idByPeriod)) throw invalidCourseError()
    seenIdsByPeriod.add(idByPeriod)
    if (course.periodId === periodId) selectedCourses.push(course)
  }

  return selectedCourses.map((course) => {
    const name = normalizedText(course.name)
    if (!name || textLength(name) > 120) throw invalidCourseError()
    const location = normalizedText(course.location)
    if (textLength(location) > 240) {
      throw new Error('课表中存在过长的上课地点，请检查课程后再同步')
    }
    const sections = Array.from(
      { length: course.endSection - course.startSection + 1 },
      (_, index) => course.startSection + index,
    )
    const weeks = uniqueSorted(course.weeks)
    return { name, weekday: course.weekday, sections, weeks, ...(location ? { location } : {}) }
  })
}

export type TimetableBuddyCustomCourseUploadFlight = {
  signature: string
  promise: Promise<void>
}

/** 同一账号、关系、学期的自定义课程串行写入，避免较早请求覆盖较新的本机状态。 */
export const syncTimetableBuddyCustomCoursesSerially = async <T>(input: {
  key: string
  force: boolean
  inFlight: Map<string, TimetableBuddyCustomCourseUploadFlight>
  isCurrent: () => boolean
  read: () => { signature: string; value: T }
  getSyncedSignature: () => string | undefined
  upload: (value: T) => Promise<unknown>
  recordSynced: (signature: string) => void
}) => {
  while (input.isCurrent()) {
    const { signature, value } = input.read()
    if (!input.force && input.getSyncedSignature() === signature) return

    const current = input.inFlight.get(input.key)
    if (current) {
      if (current.signature === signature) {
        await current.promise
        return
      }
      await current.promise.catch(() => undefined)
      if (!input.isCurrent()) return
      continue
    }

    if (!input.isCurrent()) return
    const flight: TimetableBuddyCustomCourseUploadFlight = {
      signature,
      promise: input.upload(value).then(() => undefined),
    }
    input.inFlight.set(input.key, flight)
    try {
      await flight.promise
      if (input.isCurrent()) input.recordSynced(signature)
    } finally {
      if (input.inFlight.get(input.key) === flight) input.inFlight.delete(input.key)
    }
    return
  }
}
