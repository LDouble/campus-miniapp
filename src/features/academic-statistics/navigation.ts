import Taro from '@tarojs/taro'

export type CourseStatisticsNavigation = {
  courseCode: string
  courseName: string
  teacherName?: string
}

export const openCourseStatistics = ({
  courseCode,
  courseName,
  teacherName = '',
}: CourseStatisticsNavigation) => {
  const query = [
    `course_code=${encodeURIComponent(courseCode.trim())}`,
    `course_name=${encodeURIComponent(courseName.trim())}`,
    `teacher_name=${encodeURIComponent(teacherName.trim())}`,
  ].join('&')
  return Taro.navigateTo({
    url: `/pages/academic/statistics/index?${query}`,
  })
}
