import type { MiniappModuleKey } from '../runtime-config'

export type ServiceItem = {
  key: string
  name: string
  route?: string
  tab?: string
  lifeSection?: 'community' | 'errands' | 'market' | 'carpool'
}

export const serviceModules: Partial<Record<string, MiniappModuleKey>> = {
  schedule: 'academic_schedule',
  simulation: 'academic_schedule',
  grades: 'academic_grades',
  exams: 'academic_exams',
  result: 'academic_selection',
  'pass-rate': 'academic_statistics',
  calendar: 'calendar',
  classroom: 'empty_classroom',
  materials: 'course_materials',
  shuttle: 'shuttle',
  carpool: 'carpool',
  community: 'community',
  market: 'marketplace',
  errands: 'errand',
  clubs: 'club',
  'what-to-eat': 'what_to_eat',
}

export const migratedServiceKeys = new Set([
  'materials',
  'carpool',
  'community',
  'market',
  'errands',
  'clubs',
])

export const serviceGroups: Array<{ title: string; subtitle: string; items: ServiceItem[] }> = [
  {
    title: '教务服务',
    subtitle: '课程与教学信息',
    items: [
      { key: 'schedule', name: '课程表', route: '/pages/academic/schedule/index' },
      { key: 'grades', name: '成绩单', route: '/pages/academic/grades/index' },
      { key: 'exams', name: '考试安排', route: '/pages/academic/exams/index' },
      { key: 'result', name: '选课结果', route: '/pages/academic/selection/index' },
      { key: 'pass-rate', name: '通过率', route: '/pages/academic/statistics/courses' },
      { key: 'course-audit', name: '课程查询', route: '/pages/academic/course-catalog/index' },
      { key: 'general-education', name: '通识查询', route: '/pages/academic/general-education/index' },
      { key: 'simulation', name: '模拟选课', route: '/pages/academic/schedule/index?mode=simulation' },
      { key: 'calendar', name: '校历', route: '/pages/calendar/index' },
    ],
  },
  {
    title: '学习服务',
    subtitle: '学习空间与资源',
    items: [
      { key: 'classroom', name: '空闲教室', route: '/pages/empty-classroom/index' },
      { key: 'materials', name: '学习资料', route: '/pages/materials/index' },
    ],
  },
  {
    title: '校园生活',
    subtitle: '日常校园服务',
    items: [
      { key: 'shuttle', name: '校车', route: '/pages/shuttle/index' },
      { key: 'carpool', name: '找同行', lifeSection: 'carpool' },
      { key: 'community', name: '校园社区', lifeSection: 'community' },
      { key: 'market', name: '二手', lifeSection: 'market' },
      { key: 'errands', name: '校园跑腿', lifeSection: 'errands' },
      { key: 'clubs', name: '社团广场', route: '/pages/clubs/index' },
      { key: 'lottery', name: '校园抽奖', route: '/pages/lottery/index' },
      { key: 'what-to-eat', name: '吃什么', route: '/pages/what-to-eat/index' },
      { key: 'cat-atlas', name: '猫猫图鉴', route: '/pages/cat-atlas/index' },
    ],
  },
]


export const allServices = serviceGroups.flatMap((group) => group.items)
