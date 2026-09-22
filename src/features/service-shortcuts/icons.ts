export type ServiceShortcutIconTheme = 'light' | 'dark'


export type ServiceShortcutIconTone = 'blue' | 'green' | 'pink' | 'purple' | 'orange' | 'cyan'

export type ServiceShortcutIcon = {
  src: string
  tone: ServiceShortcutIconTone
}

type ThemedServiceShortcutIcon = Record<ServiceShortcutIconTheme, ServiceShortcutIcon>
type ServiceShortcutIconVariants = { category: ThemedServiceShortcutIcon }

const serviceShortcutIcons: Record<string, ServiceShortcutIconVariants> = {
  'edit-add': { category: { light: { src: require('../../assets/icons/services-stitch/edit-add-light.svg'), tone: 'blue' }, dark: { src: require('../../assets/icons/services-stitch/edit-add-dark.svg'), tone: 'blue' } } },
  'edit-remove': { category: { light: { src: require('../../assets/icons/services-stitch/edit-remove-light.svg'), tone: 'pink' }, dark: { src: require('../../assets/icons/services-stitch/edit-remove-dark.svg'), tone: 'pink' } } },
  'edit-selected': { category: { light: { src: require('../../assets/icons/services-stitch/edit-selected-light.svg'), tone: 'blue' }, dark: { src: require('../../assets/icons/services-stitch/edit-selected-dark.svg'), tone: 'blue' } } },
  'schedule': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/schedule-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/schedule-category-dark.svg'), tone: 'blue' },
    },
  },
  'grades': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/grades-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/grades-category-dark.svg'), tone: 'blue' },
    },
  },
  'exams': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/exams-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/exams-category-dark.svg'), tone: 'blue' },
    },
  },
  'result': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/result-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/result-category-dark.svg'), tone: 'blue' },
    },
  },
  'course-addition': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/result-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/result-category-dark.svg'), tone: 'blue' },
    },
  },
  'pass-rate': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/pass-rate-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/pass-rate-category-dark.svg'), tone: 'blue' },
    },
  },
  'course-audit': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/course-audit-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/course-audit-category-dark.svg'), tone: 'blue' },
    },
  },
  'general-education': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/general-education-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/general-education-category-dark.svg'), tone: 'blue' },
    },
  },
  'simulation': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/simulation-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/simulation-category-dark.svg'), tone: 'blue' },
    },
  },
  'calendar': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/calendar-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/calendar-category-dark.svg'), tone: 'blue' },
    },
  },
  'classroom': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/classroom-category-light.svg'), tone: 'green' },
      dark: { src: require('../../assets/icons/services-stitch/classroom-category-dark.svg'), tone: 'green' },
    },
  },
  'materials': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/materials-category-light.svg'), tone: 'green' },
      dark: { src: require('../../assets/icons/services-stitch/materials-category-dark.svg'), tone: 'green' },
    },
  },
  'shuttle': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/shuttle-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/shuttle-category-dark.svg'), tone: 'orange' },
    },
  },
  'carpool': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/carpool-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/carpool-category-dark.svg'), tone: 'orange' },
    },
  },
  'community': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/community-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/community-category-dark.svg'), tone: 'orange' },
    },
  },
  'market': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/market-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/market-category-dark.svg'), tone: 'orange' },
    },
  },
  'errands': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/errands-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/errands-category-dark.svg'), tone: 'orange' },
    },
  },
  'clubs': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/clubs-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/clubs-category-dark.svg'), tone: 'orange' },
    },
  },
  'lottery': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/lottery-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/lottery-category-dark.svg'), tone: 'orange' },
    },
  },
  'what-to-eat': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/what-to-eat-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/what-to-eat-category-dark.svg'), tone: 'orange' },
    },
  },
  'cat-atlas': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/cat-atlas-category-light.svg'), tone: 'orange' },
      dark: { src: require('../../assets/icons/services-stitch/cat-atlas-category-dark.svg'), tone: 'orange' },
    },
  },
  'search': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/search-category-light.svg'), tone: 'cyan' },
      dark: { src: require('../../assets/icons/services-stitch/search-category-dark.svg'), tone: 'cyan' },
    },
  },
  'edit': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/edit-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/edit-category-dark.svg'), tone: 'blue' },
    },
  },
  'plus': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/plus-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/plus-category-dark.svg'), tone: 'blue' },
    },
  },
  'close': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/close-category-light.svg'), tone: 'pink' },
      dark: { src: require('../../assets/icons/services-stitch/close-category-dark.svg'), tone: 'pink' },
    },
  },
  'back': {
    category: {
      light: { src: require('../../assets/icons/services-stitch/back-category-light.svg'), tone: 'blue' },
      dark: { src: require('../../assets/icons/services-stitch/back-category-dark.svg'), tone: 'blue' },
    },
  },
}

export function getServiceIcon(
  key: string,
  theme: ServiceShortcutIconTheme,
): ServiceShortcutIcon {
  const icon = serviceShortcutIcons[key]
  return icon?.category[theme] ?? serviceShortcutIcons.schedule.category[theme]
}
