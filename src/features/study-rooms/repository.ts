import { ApiError, apiRequest, createIdempotencyKey } from '../../api/client'
import { studyRoomsPreviewEnabled } from './preview'

export type StudyRoomVisibility = 'public' | 'private'
export type StudyRoomModerationStatus = 'pending' | 'approved' | 'rejected'

export type StudyRoomMember = {
  user_id: number
  username: string
  avatar_url?: string | null
  accumulated_seconds: number
  active_since?: string | null
  is_owner: boolean
}

export type StudyRoomMessage = {
  id: number
  user_id: number
  username: string
  avatar_url?: string | null
  content: string
  moderation_status: StudyRoomModerationStatus
  created_at: string
}

export type StudyRoomSummary = {
  id: number
  title: string
  visibility: StudyRoomVisibility
  capacity: number
  member_count: number
  owner: Pick<StudyRoomMember, 'user_id' | 'username' | 'avatar_url'>
  created_at: string
}

export type StudyRoomDetail = StudyRoomSummary & {
  moderation_status: StudyRoomModerationStatus
  message_cooldown_seconds: number
  members: StudyRoomMember[]
  messages: StudyRoomMessage[]
  viewer_joined: boolean
  viewer_is_owner: boolean
  viewer_user_id: number
  invite_code?: string | null
  next_message_at?: string | null
}

type StudyRoomPage = {
  items: StudyRoomSummary[]
  total: number
}

const previewStartedAt = new Date(Date.now() - 38 * 60 * 1000).toISOString()
const previewNames = ['Ray', '海边自习生', '小蓝', '图书馆常客', '早八战士', '研途', '今天不摸鱼', '南区同学', '专注小组']
const previewMembers: StudyRoomMember[] = previewNames.map((username, index) => ({
  user_id: 1001 + index,
  username,
  avatar_url: null,
  accumulated_seconds: index * 180,
  active_since: new Date(Date.now() - (38 - index * 2) * 60 * 1000).toISOString(),
  is_owner: index === 0,
}))
let previewSequence = 2
let previewRooms: StudyRoomDetail[] = [{
  id: 1,
  title: '期末周安静自习',
  visibility: 'public',
  capacity: 12,
  member_count: previewMembers.length,
  owner: { user_id: 1001, username: 'Ray', avatar_url: null },
  created_at: previewStartedAt,
  moderation_status: 'approved',
  message_cooldown_seconds: 60,
  members: previewMembers,
  messages: [
    { id: 1, user_id: 1002, username: '海边自习生', avatar_url: null, content: '今晚目标：完成两章复习。', moderation_status: 'approved', created_at: previewStartedAt },
    { id: 2, user_id: 1004, username: '图书馆常客', avatar_url: null, content: '一起加油。', moderation_status: 'approved', created_at: previewStartedAt },
  ],
  viewer_joined: true,
  viewer_is_owner: true,
  viewer_user_id: 1001,
  invite_code: null,
  next_message_at: null,
}]

const previewRoom = (id: number) => {
  const room = previewRooms.find((item) => item.id === id)
  if (!room) throw new Error('自习室不存在')
  return room
}

const previewSummary = (room: StudyRoomDetail): StudyRoomSummary => ({
  id: room.id,
  title: room.title,
  visibility: room.visibility,
  capacity: room.capacity,
  member_count: room.members.length,
  owner: room.owner,
  created_at: room.created_at,
})

export const studyRoomsRepository = {
  list: () => studyRoomsPreviewEnabled ? Promise.resolve<StudyRoomPage>({
    items: previewRooms.filter((room) => room.visibility === 'public').map(previewSummary),
    total: previewRooms.filter((room) => room.visibility === 'public').length,
  }) : apiRequest<StudyRoomPage>({
    path: '/api/v1/study-rooms',
    query: { visibility: 'public', status: 'approved' },
  }),

  create: (input: {
    title: string
    capacity: number
    visibility: StudyRoomVisibility
    messageCooldownSeconds: number
  }) => {
    if (studyRoomsPreviewEnabled) {
      previewSequence += 1
      const created: StudyRoomDetail = {
        id: previewSequence,
        title: input.title,
        visibility: input.visibility,
        capacity: input.capacity,
        member_count: 1,
        owner: { user_id: 1001, username: 'Ray', avatar_url: null },
        created_at: new Date().toISOString(),
        moderation_status: 'approved',
        message_cooldown_seconds: input.messageCooldownSeconds,
        members: [{ user_id: 1001, username: 'Ray', avatar_url: null, accumulated_seconds: 0, active_since: new Date().toISOString(), is_owner: true }],
        messages: [],
        viewer_joined: true,
        viewer_is_owner: true,
        viewer_user_id: 1001,
        invite_code: input.visibility === 'private' ? `preview-${previewSequence}` : null,
        next_message_at: null,
      }
      previewRooms = [created, ...previewRooms]
      return Promise.resolve(created)
    }
    return apiRequest<StudyRoomDetail>({
    path: '/api/v1/study-rooms',
    method: 'POST',
    idempotencyKey: createIdempotencyKey('study-room'),
    data: {
      title: input.title,
      capacity: input.capacity,
      visibility: input.visibility,
      message_cooldown_seconds: input.messageCooldownSeconds,
    },
    })
  },

  get: (id: number, invite?: string) => studyRoomsPreviewEnabled ? Promise.resolve(previewRoom(id)) : apiRequest<StudyRoomDetail>({
    path: `/api/v1/study-rooms/${id}`,
    query: { invite },
  }),

  join: (id: number, invite?: string) => studyRoomsPreviewEnabled ? Promise.resolve(previewRoom(id)) : apiRequest<StudyRoomDetail>({
    path: `/api/v1/study-rooms/${id}/members`,
    method: 'POST',
    idempotencyKey: createIdempotencyKey(`study-room:${id}:join`),
    data: { invite_code: invite },
  }),

  leave: (id: number) => studyRoomsPreviewEnabled ? Promise.resolve() : apiRequest<void>({
    path: `/api/v1/study-rooms/${id}/members/me`,
    method: 'DELETE',
  }),

  listMembers: (id: number) => studyRoomsPreviewEnabled ? Promise.resolve({ items: previewRoom(id).members }) : apiRequest<{ items: StudyRoomMember[] }>({
    path: `/api/v1/study-rooms/${id}/members`,
  }),

  listMessages: (id: number, afterId?: number) => studyRoomsPreviewEnabled ? Promise.resolve({ items: previewRoom(id).messages.filter((item) => !afterId || item.id > afterId) }) : apiRequest<{ items: StudyRoomMessage[] }>({
    path: `/api/v1/study-rooms/${id}/messages`,
    query: { after_id: afterId },
  }),

  sendMessage: (id: number, content: string) => {
    if (studyRoomsPreviewEnabled) {
      const room = previewRoom(id)
      const now = Date.now()
      const nextMessageAt = room.next_message_at ? Date.parse(room.next_message_at) : 0
      if (nextMessageAt > now) {
        const retryAfterMs = nextMessageAt - now
        return Promise.reject(new ApiError(
          429,
          'study_room_message_cooldown',
          `${Math.ceil(retryAfterMs / 1000)} 秒后可发言`,
          '',
          { retry_after_seconds: Math.ceil(retryAfterMs / 1000) },
          retryAfterMs,
        ))
      }
      const createdAt = new Date(now).toISOString()
      const message: StudyRoomMessage = { id: Math.max(0, ...room.messages.map((item) => item.id)) + 1, user_id: 1001, username: 'Ray', avatar_url: null, content, moderation_status: 'approved', created_at: createdAt }
      room.messages = [...room.messages, message]
      room.next_message_at = room.message_cooldown_seconds > 0
        ? new Date(now + room.message_cooldown_seconds * 1000).toISOString()
        : null
      return Promise.resolve(message)
    }
    return apiRequest<StudyRoomMessage>({
    path: `/api/v1/study-rooms/${id}/messages`,
    method: 'POST',
    idempotencyKey: createIdempotencyKey(`study-room:${id}:message`),
    data: { content },
    })
  },

  updateMessageCooldown: (id: number, seconds: number) => {
    if (studyRoomsPreviewEnabled) {
      const room = previewRoom(id)
      room.message_cooldown_seconds = seconds
      const lastViewerMessage = [...room.messages]
        .reverse()
        .find((message) => message.user_id === room.viewer_user_id)
      const nextMessageAt = lastViewerMessage
        ? Date.parse(lastViewerMessage.created_at) + seconds * 1000
        : 0
      room.next_message_at = seconds > 0 && nextMessageAt > Date.now()
        ? new Date(nextMessageAt).toISOString()
        : null
      return Promise.resolve(room)
    }
    return apiRequest<StudyRoomDetail>({
    path: `/api/v1/study-rooms/${id}/message-cooldown`,
    method: 'PUT',
    data: { seconds },
    })
  },
}
