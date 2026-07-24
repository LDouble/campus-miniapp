export interface TimetableCourse {
  id: string
  name: string
  teacher: string
  location: string
  weekday: number
  startSection: number
  endSection: number
  weeks: string
  tone: 'blue' | 'green' | 'orange' | 'rose'
}

export interface GradeItem {
  id: string
  name: string
  category: string
  credit: number
  score: number
  gradePoint: number
  status: 'passed' | 'pending'
}

export const semesterOptions = ['2025-2026 第二学期', '2025-2026 第一学期']

export const timetableCourses: TimetableCourse[] = [
  { id: 'course-1', name: '高等数学 AⅡ', teacher: '陈老师', location: '博学楼 A203', weekday: 1, startSection: 1, endSection: 2, weeks: '1-16周', tone: 'blue' },
  { id: 'course-2', name: '大学英语Ⅱ', teacher: '周老师', location: '明德楼 305', weekday: 1, startSection: 5, endSection: 6, weeks: '1-16周', tone: 'green' },
  { id: 'course-3', name: '数据结构', teacher: '林老师', location: '格物楼 B401', weekday: 2, startSection: 3, endSection: 4, weeks: '1-16周', tone: 'orange' },
  { id: 'course-4', name: '大学物理实验', teacher: '叶老师', location: '实验中心 208', weekday: 3, startSection: 5, endSection: 7, weeks: '双周', tone: 'rose' },
  { id: 'course-5', name: '思想道德与法治', teacher: '郑老师', location: '博雅楼 101', weekday: 4, startSection: 1, endSection: 2, weeks: '1-12周', tone: 'green' },
  { id: 'course-6', name: '程序设计实践', teacher: '许老师', location: '信息楼 机房3', weekday: 5, startSection: 3, endSection: 4, weeks: '1-16周', tone: 'blue' }
]

export const gradeItems: GradeItem[] = [
  { id: 'grade-1', name: '数据结构', category: '专业必修', credit: 4, score: 92, gradePoint: 4.2, status: 'passed' },
  { id: 'grade-2', name: '高等数学 AⅠ', category: '学科基础', credit: 5, score: 88, gradePoint: 3.8, status: 'passed' },
  { id: 'grade-3', name: '大学英语Ⅰ', category: '公共必修', credit: 3, score: 86, gradePoint: 3.6, status: 'passed' },
  { id: 'grade-4', name: '大学物理Ⅰ', category: '学科基础', credit: 4, score: 81, gradePoint: 3.1, status: 'passed' },
  { id: 'grade-5', name: '形势与政策', category: '公共必修', credit: 1, score: 90, gradePoint: 4, status: 'passed' },
  { id: 'grade-6', name: '体育Ⅱ', category: '公共必修', credit: 1, score: 0, gradePoint: 0, status: 'pending' }
]

export function getCoursesForDay (weekday: number) {
  return timetableCourses.filter(course => course.weekday === weekday)
}

export function summarizeGrades (items: GradeItem[]) {
  const published = items.filter(item => item.status === 'passed')
  const credits = published.reduce((sum, item) => sum + item.credit, 0)
  const weightedScore = published.reduce((sum, item) => sum + item.score * item.credit, 0)
  const weightedPoint = published.reduce((sum, item) => sum + item.gradePoint * item.credit, 0)
  return {
    average: credits ? weightedScore / credits : 0,
    gradePoint: credits ? weightedPoint / credits : 0,
    credits,
    passed: published.length
  }
}
