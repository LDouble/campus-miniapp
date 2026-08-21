import { apiRequest } from '../../api/client'
import type { operations } from '../../api/generated/schema'
import type { DirectMessageSendPayload } from './composer'
import type {
  DirectMessage,
  DirectMessageConversation,
  DirectMessageConversationPage,
  DirectMessagePage,
  DirectMessageReadWatermark,
} from './types'
import type { PrivateMessageUnreadCount } from '../../api/types'

const privateMessagePath = (conversationId: number) => (
  `/api/v1/private-messages/conversations/${conversationId}`
)

export type DirectMessageCursorQuery = {
  cursor?: string
  afterId?: number
  pageSize?: number
}

export const privateMessagesRepository = {
  createConversation(peerId: number) {
    return apiRequest<DirectMessageConversation>({
      path: '/api/v1/private-messages/conversations',
      method: 'POST',
      data: { peer_id: peerId },
    })
  },

  listConversations(query: DirectMessageCursorQuery = {}) {
    return apiRequest<DirectMessageConversationPage>({
      path: '/api/v1/private-messages/conversations',
      query: {
        cursor: query.cursor,
        page_size: query.pageSize || 20,
      },
    })
  },

  getConversation(conversationId: number) {
    return apiRequest<DirectMessageConversation>({
      path: privateMessagePath(conversationId),
    })
  },

  listMessages(conversationId: number, query: DirectMessageCursorQuery = {}) {
    const requestQuery: NonNullable<operations['ListPrivateMessages']['parameters']['query']> = {
      cursor: query.cursor,
      after_id: query.afterId,
      page_size: query.pageSize || 40,
    }
    return apiRequest<DirectMessagePage>({
      path: `${privateMessagePath(conversationId)}/messages`,
      query: requestQuery,
    })
  },

  sendMessage(
    conversationId: number,
    payload: DirectMessageSendPayload,
    idempotencyKey: string,
  ) {
    const data: operations['CreatePrivateMessage']['requestBody']['content']['application/json'] = payload.kind === 'image'
      ? { media_id: payload.mediaId }
      : { content: payload.content }
    return apiRequest<DirectMessage>({
      path: `${privateMessagePath(conversationId)}/messages`,
      method: 'POST',
      data,
      idempotencyKey,
    })
  },

  markRead(conversationId: number, messageId: number) {
    return apiRequest<DirectMessageReadWatermark>({
      path: `${privateMessagePath(conversationId)}/read-watermark`,
      method: 'PUT',
      data: { message_id: messageId },
    })
  },

  unreadCount() {
    return apiRequest<PrivateMessageUnreadCount>({
      path: '/api/v1/private-messages/unread-count',
    })
  },
}
