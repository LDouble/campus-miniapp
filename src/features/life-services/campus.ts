import Taro from '@tarojs/taro'

export const CAMPUS_OPTIONS = [
  '崂山校区',
  '鱼山校区',
  '西海岸校区',
  '浮山校区',
] as const

export type CampusName = typeof CAMPUS_OPTIONS[number]

const CAMPUS_STORAGE_KEY = 'campus.home.campus.v1'

export const isCampusName = (value: unknown): value is CampusName => (
  typeof value === 'string'
  && CAMPUS_OPTIONS.some((campus) => campus === value)
)

export const preferredCampus = (): CampusName => {
  const stored = Taro.getStorageSync<unknown>(CAMPUS_STORAGE_KEY)
  return isCampusName(stored) ? stored : CAMPUS_OPTIONS[0]
}

export const campusLabel = (campus?: string | null) => (
  campus && campus.trim() ? campus.trim() : '校区待补充'
)
