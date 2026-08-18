import type {
  DirectMessage,
  DirectMessageConversation,
} from './types'

export const canLoadDirectMessagePage = (
  loading: boolean,
  hasMore: boolean,
  nextCursor: string | null,
) => !loading && hasMore && Boolean(nextCursor)

export type DirectMessageHistoryPagination = {
  hasMore: boolean
  nextCursor: string | null
}

export const historyPaginationFromDirectMessagePoll = (
  afterId: number,
  page: { has_more: boolean; next_cursor?: string | null },
): DirectMessageHistoryPagination | null => {
  if (afterId > 0) return null
  return {
    hasMore: page.has_more,
    nextCursor: page.next_cursor || null,
  }
}

export const mergeDirectMessageConversations = (
  current: DirectMessageConversation[],
  incoming: DirectMessageConversation[],
) => {
  const items = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => items.set(item.id, item))
  return [...items.values()]
}

export const mergeDirectMessages = (
  current: DirectMessage[],
  incoming: DirectMessage[],
) => {
  const items = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => items.set(item.id, item))
  return [...items.values()].sort((left, right) => left.id - right.id)
}

export const displayedLastReceivedMessageId = (
  messages: DirectMessage[],
  currentUserId: number,
) => {
  const received = messages.filter((item) => item.sender_id !== currentUserId)
  return received.length ? received[received.length - 1].id : 0
}
