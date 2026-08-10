import type { components } from '../../api/generated/schema'

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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return `${sameYear ? '' : `${date.getFullYear()}年`}${date.getMonth() + 1}月${date.getDate()}日`
}
