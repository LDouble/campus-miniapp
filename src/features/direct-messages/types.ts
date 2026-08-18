// The UI uses product-oriented aliases while API types remain generated from
// the backend OpenAPI document. Repository is the only request boundary.
import type {
  PrivateConversationPage,
  PrivateConversationRead,
  PrivateConversationView,
  PrivateMessagePage,
  PrivateMessagePeer,
  PrivateMessageView,
} from '../../api/types'

export type DirectMessagePeer = PrivateMessagePeer
export type DirectMessage = PrivateMessageView
export type DirectMessageConversation = PrivateConversationView
export type DirectMessagePage = PrivateMessagePage
export type DirectMessageConversationPage = PrivateConversationPage
export type DirectMessageReadWatermark = PrivateConversationRead
