import { normalizeWechatSubscribeTemplateIds } from '../wechat-subscription/template-ids'

export const HOME_NOTIFICATION_GUIDE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export type HomeNotificationGuideRecord = {
  lastShownAt: number
}

export const resolveHomeNotificationTemplateIds = (
  templates: Record<string, unknown> | null | undefined,
) => normalizeWechatSubscribeTemplateIds(Object.values(templates || {}).flat())

export const shouldShowHomeNotificationGuide = ({
  userId,
  unreadCount,
  templateIds,
  record,
  now = Date.now(),
}: {
  userId: number
  unreadCount: number
  templateIds: unknown
  record: HomeNotificationGuideRecord | null
  now?: number
}) => (
  Number.isInteger(userId)
  && userId > 0
  && Number(unreadCount) > 0
  && normalizeWechatSubscribeTemplateIds(templateIds).length > 0
  && (!record || now - record.lastShownAt >= HOME_NOTIFICATION_GUIDE_COOLDOWN_MS)
)
