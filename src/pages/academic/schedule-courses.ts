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

export const setCoursesForPeriod = (
  coursesByPeriod: CoursesByPeriod,
  periodId: string,
  courses: Course[],
): CoursesByPeriod => ({
  ...sanitizeCoursesByPeriod(coursesByPeriod),
  [periodId]: requireCoursesForPeriod(courses, periodId),
})
