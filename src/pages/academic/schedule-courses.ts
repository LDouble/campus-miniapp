import { Course } from './types'

export type CoursesByPeriod = Record<string, Course[]>

export const getCourseScheduleKey = (course: Course) => [
  course.periodId,
  course.id,
  course.weekday,
  course.startSection,
  course.endSection,
  course.weeks.join(','),
].join(':')

export const filterCoursesForPeriod = (
  courses: Course[],
  periodId: string,
) => courses.filter((course) => course.periodId === periodId)

export const requireCoursesForPeriod = (
  courses: Course[],
  periodId: string,
) => {
  const matching = filterCoursesForPeriod(courses, periodId)
  if (matching.length !== courses.length) {
    throw new Error('academic course period mismatch')
  }
  return matching
}

export const sanitizeCoursesByPeriod = (
  coursesByPeriod: CoursesByPeriod,
): CoursesByPeriod => Object.fromEntries(
  Object.entries(coursesByPeriod).filter(([periodId, courses]) => (
    filterCoursesForPeriod(courses, periodId).length === courses.length
  )),
)

export const getCoursesForPeriod = (
  coursesByPeriod: CoursesByPeriod,
  periodId: string,
) => filterCoursesForPeriod(coursesByPeriod[periodId] || [], periodId)

export const getCoursesForWeek = (
  courses: Course[],
  week: number,
) => courses.filter((course) => course.weeks.includes(week))

/** 当前周优先；同周冲突时，以教务课程作为课表卡片的展示课程。 */
export const compareCoursesForDisplay = (left: Course, right: Course, week: number) => {
  const currentDifference = Number(right.weeks.includes(week)) - Number(left.weeks.includes(week))
  if (currentDifference) return currentDifference

  const nextWeek = (course: Course) => Math.min(
    ...course.weeks.filter((courseWeek) => courseWeek >= week),
    Number.POSITIVE_INFINITY,
  )
  const nextWeekDifference = nextWeek(left) - nextWeek(right)
  if (nextWeekDifference) return nextWeekDifference

  const officialDifference = Number(right.source === 'official') - Number(left.source === 'official')
  return officialDifference || left.id.localeCompare(right.id)
}

export const getCourseDisplaySpan = (courses: Course[]) => ({
  startSection: Math.min(...courses.map((course) => course.startSection)),
  endSection: Math.max(...courses.map((course) => course.endSection)),
})

export const setCoursesForPeriod = (
  coursesByPeriod: CoursesByPeriod,
  periodId: string,
  courses: Course[],
): CoursesByPeriod => ({
  ...sanitizeCoursesByPeriod(coursesByPeriod),
  [periodId]: requireCoursesForPeriod(courses, periodId),
})

const normalizedClassNum = (course: Course) => course.classNum?.trim() || ''

/**
 * 模拟选课以教务已选课为准。教务同一选课号的多个上课时段必须全部保留；
 * 只隐藏选课号相同且非空的本地草稿，缺失选课号时不按课程名猜测关联。
 */
export const mergeSimulationCourses = (
  localDraftCourses: Course[],
  selectedScheduleCourses: Course[],
) => {
  const selectedClassNums = new Set(
    selectedScheduleCourses.map(normalizedClassNum).filter(Boolean),
  )
  return [
    ...selectedScheduleCourses,
    ...localDraftCourses.filter((course) => {
      const classNum = normalizedClassNum(course)
      return !classNum || !selectedClassNums.has(classNum)
    }),
  ]
}

/** getCourseDisplayGroups 以本周课程确定卡片范围，其他周课程仅补充详情。 */
export const getCourseDisplayGroups = (courses: Course[], week: number) => {
  const overlaps = (left: Course, right: Course) => (
    left.weekday === right.weekday
    && left.startSection <= right.endSection
    && right.startSection <= left.endSection
  )
  const collectGroups = (items: Course[]) => {
    let groups: Course[][] = []
    items.forEach((item) => {
      const touching = groups.filter((group) => group.some((member) => overlaps(member, item)))
      groups = groups.filter((group) => !touching.includes(group))
      groups.push([item, ...touching.flat()])
    })
    return groups
  }
  const currentCourses = getCoursesForWeek(courses, week)
  const inactiveCourses = courses.filter((course) => !course.weeks.includes(week))
  const currentGroups = collectGroups(currentCourses)
  // 非本周课程不能把本周相邻的独立卡片连接起来，也不能扩大其占用节次。
  const remainingInactive = inactiveCourses.filter((course) => (
    !currentCourses.some((current) => overlaps(current, course))
  ))
  return [...currentGroups, ...collectGroups(remainingInactive)].map((members) => {
    const primary = [...members].sort((left, right) => compareCoursesForDisplay(left, right, week))[0]
    const relatedCourses = courses.filter((course) => (
      members.some((member) => overlaps(member, course))
    )).sort((left, right) => compareCoursesForDisplay(left, right, week))
    return {
      course: primary,
      courses: relatedCourses,
      ...getCourseDisplaySpan(members),
    }
  }).sort((left, right) => (
    left.course.weekday - right.course.weekday || left.startSection - right.startSection
  ))
}
