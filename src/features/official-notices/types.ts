import type { components } from '../../api/generated/schema'
import { apiDateTimeCampusParts } from '../../utils/date-time'

export type OfficialNotice = components['schemas']['OfficialNoticeView']
export type OfficialNoticePage = components['schemas']['OfficialNoticePage']
export type OfficialNoticeFeed = components['schemas']['OfficialNoticeFeed']
export type OfficialNoticeSource = components['schemas']['OfficialNoticeSource']
export type OfficialNoticeCategory = components['schemas']['OfficialNoticeCategory']

export const officialNoticeSourceLabels: Record<OfficialNoticeSource, string> = {
  school: '学校通知',
  undergraduate: '本科生院',
  graduate: '研究生院',
  department: '院系通知',
}

export const officialNoticeCategoryLabels: Record<OfficialNoticeCategory, string> = {
  teaching: '教学通知',
  training: '培养管理',
  awards: '评奖评优',
  campus: '校园事务',
  career: '就业实习',
  other: '其他',
}

export const formatOfficialNoticeDate = (value: string) => {
  const parts = apiDateTimeCampusParts(value)
  const now = apiDateTimeCampusParts(new Date().toISOString())
  if (!parts || !now) return ''
  const sameYear = parts.year === now.year
  return `${sameYear ? '' : `${parts.year}年`}${parts.month}月${parts.day}日`
}

export const formatOfficialNoticeCompactDate = (value: string) => {
  const parts = apiDateTimeCampusParts(value)
  const now = apiDateTimeCampusParts(new Date().toISOString())
  if (!parts || !now) return ''
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  return parts.year === now.year ? `${month}/${day}` : `${parts.year}/${month}/${day}`
}
