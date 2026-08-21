const validConversationId = (conversationId: number) => (
  Number.isInteger(conversationId) && conversationId > 0
)

export const directMessagesListUrl = '/packages/social/direct-messages/index'

export const directMessageChatUrl = (conversationId: number) => (
  validConversationId(conversationId)
    ? `/packages/social/direct-messages/chat?id=${conversationId}`
    : directMessagesListUrl
)

export const parseDirectMessageConversationId = (value?: string) => {
  const id = Number(value || 0)
  return validConversationId(id) ? id : 0
}
