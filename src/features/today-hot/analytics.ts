import Taro from '@tarojs/taro'

export type TodayHotEvent =
  | 'today_hot_module_exposure'
  | 'today_hot_module_click'
  | 'today_hot_page_arrival'
  | 'today_hot_three_post_engagement'
  | 'today_hot_interaction'
  | 'today_hot_community_cta_click'
  | 'today_hot_community_arrival'

type TodayHotEventPayload = {
  snapshotId?: string | number
  source?: string
  postId?: number
  sessionId: string
  eventId: string
}

const storageKey = 'campus.todayHot.analytics.session.v1'
const sessionTtlMs = 30 * 60_000

type StoredSession = { id: string; createdAt: number; window: number }

const randomPart = () => Math.random().toString(36).slice(2, 12)

const session = (): StoredSession => {
  try {
    const stored = Taro.getStorageSync<StoredSession | null>(storageKey)
    if (stored && typeof stored.id === 'string' && Date.now() - stored.createdAt < sessionTtlMs) return stored
    const next = { id: `th_${Date.now().toString(36)}_${randomPart()}`, createdAt: Date.now(), window: Math.floor(Math.random() * 20) }
    Taro.setStorageSync(storageKey, next)
    return next
  } catch {
    return { id: `th_${Date.now().toString(36)}_${randomPart()}`, createdAt: Date.now(), window: Math.floor(Math.random() * 20) }
  }
}

export const getTodayHotSessionWindow = () => session().window

/**
 * 仅使用微信分析事件，不携带正文、登录凭据或阅读去重 token。分析失败不会影响页面。
 * 事件参数需要在微信公众平台的自定义分析配置中预先声明。
 */
export const reportTodayHotEvent = (
  eventName: TodayHotEvent,
  input: Omit<TodayHotEventPayload, 'sessionId' | 'eventId'> = {},
) => {
  const reporter = (Taro as unknown as {
    reportEvent?: (name: string, data: Record<string, string | number>) => void
  }).reportEvent
  if (!reporter) return

  try {
    reporter(eventName, {
      event_id: `th_${Date.now().toString(36)}_${randomPart()}`,
      session_id: session().id,
      snapshot_id: input.snapshotId ? String(input.snapshotId) : '',
      source: input.source || '',
      post_id: Number.isInteger(input.postId) ? Number(input.postId) : 0,
    })
  } catch {
    // 微信分析配置尚未同步或平台暂不可用时，不能影响正常浏览。
  }
}
