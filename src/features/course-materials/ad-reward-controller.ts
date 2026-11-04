/** AdRewardSession 保存一次领取所需的凭证，仅驻留当前页面内存。 */
export interface AdRewardSession {
  id: number
  session_token: string
  expires_at: string
}

/** AdRewardPhase 描述当前页面的广告领取状态。 */
export type AdRewardPhase = 'idle' | 'loading' | 'preparing' | 'visible' | 'claiming'

/** createAdRewardController 管理广告会话、重复触摸、重试及离页时的异步失效。 */
export function createAdRewardController<T>(dependencies: {
  create: () => Promise<AdRewardSession>
  claim: (session: AdRewardSession, key: string) => Promise<T>
  createKey: () => string
  scope: () => string
  change: (phase: AdRewardPhase) => void
  success: (quota: T) => void
  error: (message: string) => void
  now?: () => number
}) {
  let phase: AdRewardPhase = 'idle'
  let generation = 0
  let session: AdRewardSession | null = null
  let wasPresented = false
  let resumePending = false
  let claimKey = ''
  let scope = ''
  const now = dependencies.now ?? Date.now
  const change = (next: AdRewardPhase) => { phase = next; dependencies.change(next) }
  const close = () => {
    generation += 1
    session = null
    wasPresented = false
    resumePending = false
    change('idle')
  }
  const current = (version: number) => version === generation && scope === dependencies.scope()
  return {
    close,
    dispose() { generation += 1; session = null; wasPresented = false; resumePending = false; phase = 'idle' },
    presented() { if (phase === 'visible') wasPresented = true },
    background() {
      resumePending = wasPresented && phase === 'visible'
    },
    async foreground() {
      if (!resumePending) return
      resumePending = false
      // 前台恢复仅作为已展示广告会话的兜底，与点击共用幂等领取。
      await this.tap()
    },
    async open() {
      if (phase !== 'idle') return
      const version = ++generation
      scope = dependencies.scope()
      change('loading')
      try {
        const result = await dependencies.create()
        if (!current(version)) return
        if (!Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at) <= now()) {
          throw new Error('广告领取会话已过期，请重试')
        }
        session = result
        claimKey = dependencies.createKey()
        change('preparing')
      } catch (error) {
        if (!current(version)) return
        close()
        dependencies.error(error instanceof Error ? error.message : '广告入口暂不可用，请稍后重试')
      }
    },
    ready() {
      if (phase === 'preparing' && scope === dependencies.scope()) change('visible')
    },
    fail(message: string) {
      if (phase === 'idle') return
      close()
      dependencies.error(message)
    },
    async tap() {
      if (phase !== 'visible' || !session) return
      if (scope !== dependencies.scope()) { close(); return }
      if (Date.parse(session.expires_at) <= now()) {
        close()
        dependencies.error('广告领取会话已过期，请重新打开')
        return
      }
      const version = generation
      change('claiming')
      try {
        const result = await dependencies.claim(session, claimKey)
        if (!current(version)) return
        close()
        dependencies.success(result)
      } catch (error) {
        if (!current(version)) return
        change('visible')
        dependencies.error(error instanceof Error ? error.message : '领取失败，请再点一次广告重试')
      }
    },
  }
}
