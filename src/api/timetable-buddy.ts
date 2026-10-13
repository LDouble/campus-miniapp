import { apiRequest, createIdempotencyKey } from './client'
import { getPageCacheScope } from '../state/page-cache'
import type { operations } from './generated/schema'
import type {
  TimetableBuddyConnectionView,
  TimetableBuddyCourseView,
  TimetableBuddyInvitationPreviewView,
  TimetableBuddyInvitationView,
  TimetableBuddyMemberScheduleView,
  TimetableBuddyScheduleView,
  TimetableBuddyStateView,
} from './types'
import type {
  TimetableBuddyConnection,
  TimetableBuddyInvitation,
  TimetableBuddyInvitationPreview,
  TimetableBuddyRelationType,
  TimetableBuddyScheduleSide,
  TimetableBuddyShareScope,
  TimetableBuddySlot,
  TimetableBuddyCustomCourse,
} from '../features/timetable-buddy/model'

type ApiRequestOptions = Parameters<typeof apiRequest>[0]

const scopedApiRequest = <T,>(options: ApiRequestOptions) => {
  const scope = getPageCacheScope()
  return apiRequest<T>({
    ...options,
    isScopeCurrent: () => getPageCacheScope() === scope,
  })
}

const mapConnection = (connection: TimetableBuddyConnectionView): TimetableBuddyConnection => ({
  id: connection.id,
  relationType: connection.relation_type,
  members: connection.members.map((member) => ({
    userId: member.user_id,
    nickname: member.nickname || '搭子',
    avatarUrl: member.avatar_url,
    shareScope: member.share_scope,
    paused: member.paused,
  })),
  createdAt: connection.created_at,
})

const mapSide = (side: TimetableBuddyMemberScheduleView): TimetableBuddyScheduleSide => ({
  userId: side.user_id,
  nickname: side.nickname || '搭子',
  shareScope: side.share_scope,
  paused: side.paused,
  syncedAt: side.synced_at,
  dataStatus: side.data_status,
  customCoursesReady: side.custom_courses_ready,
  customCoursesSyncedAt: side.custom_courses_synced_at,
  courses: side.courses.map((course) => ({
    name: course.name,
    weekday: course.weekday,
    sections: course.sections,
    weeks: course.weeks,
    ...(course.location ? { location: course.location } : {}),
  })),
  busySlots: side.busy_slots.map((slot): TimetableBuddySlot => ({
    weekday: slot.weekday,
    section: slot.section,
    weeks: [slot.week],
  })),
})

export const timetableBuddyRepository = {
  async getState() {
    const result = await scopedApiRequest<TimetableBuddyStateView>({ path: '/api/v1/me/timetable-buddy' })
    return { connection: result.connection ? mapConnection(result.connection) : null }
  },

  async createInvitation(input: {
    relationType: TimetableBuddyRelationType
    shareScope: TimetableBuddyShareScope
    expiresInHours: number
  }) {
    const data: operations['CreateTimetableBuddyInvitation']['requestBody']['content']['application/json'] = {
      relation_type: input.relationType,
      share_scope: input.shareScope,
      expires_in_hours: input.expiresInHours,
    }
    const result = await scopedApiRequest<TimetableBuddyInvitationView>({
      path: '/api/v1/me/timetable-buddy/invitations',
      method: 'POST',
      data,
      idempotencyKey: createIdempotencyKey('timetable-buddy:invite'),
    })
    return { token: result.token, expiresAt: result.expires_at } satisfies TimetableBuddyInvitation
  },

  async revokeInvitation(token: string) {
    const data: operations['RevokeTimetableBuddyInvitation']['requestBody']['content']['application/json'] = { token }
    const result = await scopedApiRequest<TimetableBuddyStateView>({
      path: '/api/v1/me/timetable-buddy/invitations', method: 'DELETE', data,
    })
    return { connection: result.connection ? mapConnection(result.connection) : null }
  },

  async previewInvitation(token: string) {
    const data: operations['PreviewTimetableBuddyInvitation']['requestBody']['content']['application/json'] = { token }
    const result = await scopedApiRequest<TimetableBuddyInvitationPreviewView>({
      path: '/api/v1/me/timetable-buddy/invitations/preview', method: 'POST', data,
    })
    return {
      creatorNickname: result.creator_nickname,
      creatorAvatarUrl: result.creator_avatar_url,
      relationType: result.relation_type,
      expiresAt: result.expires_at,
    } satisfies TimetableBuddyInvitationPreview
  },

  async acceptInvitation(token: string) {
    const data: operations['AcceptTimetableBuddyInvitation']['requestBody']['content']['application/json'] = { token }
    const result = await scopedApiRequest<TimetableBuddyStateView>({
      path: '/api/v1/me/timetable-buddy/invitations/accept', method: 'POST', data,
    })
    return { connection: result.connection ? mapConnection(result.connection) : null }
  },

  syncCustomCourses(input: {
    educationLevel: 'undergraduate' | 'graduate'
    periodId: string
    courses: TimetableBuddyCustomCourse[]
  }) {
    const data: operations['SyncMyTimetableBuddyCustomCourses']['requestBody']['content']['application/json'] = {
      education_level: input.educationLevel,
      period_id: input.periodId,
      courses: input.courses satisfies TimetableBuddyCourseView[],
    }
    return scopedApiRequest<TimetableBuddyMemberScheduleView>({
      path: '/api/v1/me/timetable-buddy/custom-courses', method: 'PUT', data,
    }).then(mapSide)
  },

  async getSchedule(input: { educationLevel: 'undergraduate' | 'graduate'; periodId: string; week: number }) {
    const query: operations['GetMyTimetableBuddySchedule']['parameters']['query'] = {
      education_level: input.educationLevel, period_id: input.periodId, week: input.week,
    }
    const result = await scopedApiRequest<TimetableBuddyScheduleView>({
      path: '/api/v1/me/timetable-buddy/schedule',
      query,
    })
    return {
      connection: mapConnection(result.connection),
      me: mapSide(result.me),
      buddy: mapSide(result.buddy),
      commonFreeSlots: result.common_free_slots?.map((slot) => ({ weekday: slot.weekday, section: slot.section, weeks: [slot.week] })) || null,
    }
  },

  async updateSettings(input: { shareScope: TimetableBuddyShareScope; paused: boolean; expectedConnectionId: number }) {
    const data: operations['UpdateMyTimetableBuddySettings']['requestBody']['content']['application/json'] = {
      share_scope: input.shareScope, paused: input.paused, expected_connection_id: input.expectedConnectionId,
    }
    const result = await scopedApiRequest<TimetableBuddyStateView>({
      path: '/api/v1/me/timetable-buddy/settings', method: 'PATCH', data,
    })
    return { connection: result.connection ? mapConnection(result.connection) : null }
  },

  async disconnect(expectedConnectionId: number) {
    const query: operations['DeleteMyTimetableBuddy']['parameters']['query'] = { expected_connection_id: expectedConnectionId }
    const result = await scopedApiRequest<TimetableBuddyStateView>({
      path: '/api/v1/me/timetable-buddy', method: 'DELETE', query,
    })
    return { connection: result.connection ? mapConnection(result.connection) : null }
  },
}
