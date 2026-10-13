/** 课表搭子关系类型，与服务端 OpenAPI 枚举保持一致。 */
export type TimetableBuddyRelationType = 'friend' | 'study_partner' | 'cp' | 'unspecified'

/** 对搭子可见的课表范围。 */
export type TimetableBuddyShareScope = 'busy' | 'details'

export type TimetableBuddySlot = {
  weekday: number
  section: number
  weeks: number[]
}

/** 本机自定义课程补充；官方课与蹭课由服务端归档读取。 */
export type TimetableBuddyCustomCourse = {
  name: string
  weekday: number
  sections: number[]
  weeks: number[]
  location?: string
}

export type TimetableBuddyVisibleCourse = TimetableBuddyCustomCourse

export type TimetableBuddyDataStatus = 'ready' | 'unavailable' | 'incomplete' | 'identity_unavailable'

export type TimetableBuddyScheduleSide = {
  userId: number
  nickname: string
  courses?: TimetableBuddyVisibleCourse[]
  busySlots?: TimetableBuddySlot[]
  /** 官方课程归档的最近观察时间。 */
  syncedAt: string | null
  dataStatus: TimetableBuddyDataStatus
  customCoursesReady: boolean
  customCoursesSyncedAt: string | null
  shareScope: TimetableBuddyShareScope
  paused: boolean
}

export type TimetableBuddyMember = {
  userId: number
  nickname: string
  avatarUrl?: string | null
  shareScope: TimetableBuddyShareScope
  paused: boolean
}

export type TimetableBuddyConnection = {
  id: number
  relationType: TimetableBuddyRelationType
  members: TimetableBuddyMember[]
  createdAt: string
}

export type TimetableBuddyInvitation = {
  token: string
  expiresAt: string
}

export type TimetableBuddyInvitationPreview = {
  creatorNickname: string
  creatorAvatarUrl?: string | null
  relationType: TimetableBuddyRelationType
  expiresAt: string
}

/** 校验一次性邀请令牌的公开格式，避免无效参数触发邀请接口。 */
export const isTimetableBuddyInvitationToken = (value: string) => /^[a-f0-9]{64}$/u.test(value)

export const timetableBuddyRelationLabel = (relation: TimetableBuddyRelationType) => ({
  friend: '朋友',
  study_partner: '学习搭子',
  cp: '课表 CP',
  unspecified: '未指定',
}[relation])

export const timetableBuddyScopeLabel = (scope: TimetableBuddyShareScope) => (
  scope === 'details' ? '课程详情' : '仅忙闲'
)
