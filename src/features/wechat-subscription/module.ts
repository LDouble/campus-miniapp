import type { MiniappModuleKey } from '../runtime-config'

export type CurrentMiniappPage = {
  route?: string
  options?: Record<string, string>
}

export const LIFE_HUB_SECTION_STORAGE_KEY = 'campus.lifeHub.section.v1'

const lifeHubSectionModules: Record<string, MiniappModuleKey> = {
  community: 'community',
  errands: 'errand',
  market: 'marketplace',
  carpool: 'carpool',
}

export const resolvePageSubscriptionModule = (
  page: CurrentMiniappPage,
): MiniappModuleKey | null => {
  const route = page.route || ''
  if (route === 'pages/community/index') {
    return lifeHubSectionModules[page.options?.section || ''] || 'community'
  }
  if (route.startsWith('pages/community/')) return 'community'
  if (route.startsWith('pages/errands/')) return 'errand'
  if (route.startsWith('pages/marketplace/')) return 'marketplace'
  if (route.startsWith('pages/carpool/')) return 'carpool'
  if (route.startsWith('pages/academic/schedule/')) return 'academic_schedule'
  if (route.startsWith('pages/academic/grades/')) return 'academic_grades'
  if (route.startsWith('pages/academic/exams/')) return 'academic_exams'
  if (route.startsWith('pages/academic/selection/')) return 'academic_selection'
  if (route.startsWith('pages/academic/statistics/')) return 'academic_statistics'
  if (route.startsWith('pages/calendar/')) return 'calendar'
  if (route.startsWith('pages/materials/')) return 'course_materials'
  if (route.startsWith('pages/empty-classroom/')) return 'empty_classroom'
  if (route.startsWith('pages/shuttle/')) return 'shuttle'
  if (route === 'pages/publish/index') {
    return lifeHubSectionModules[page.options?.section || ''] || null
  }
  return null
}
