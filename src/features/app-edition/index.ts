export const CAMPUS_APP_EDITIONS = ['full', 'qualification'] as const

export type CampusAppEdition = (typeof CAMPUS_APP_EDITIONS)[number]

export type MigratedFeatureModule =
  | 'community'
  | 'marketplace'
  | 'errand'
  | 'carpool'
  | 'course_materials'
  | 'club'

export const campusAppEdition: CampusAppEdition = __CAMPUS_APP_EDITION__ === 'qualification'
  ? 'qualification'
  : 'full'

export const isQualificationEdition = campusAppEdition === 'qualification'
