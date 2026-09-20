import { identifyCampus, WEST_COAST_CAMPUS, type CampusLocation } from './location'

type PromptPlatform = {
  getLocation: () => Promise<CampusLocation>
  confirmSwitch: () => Promise<boolean>
  locationTimeoutMs?: number
}

type PromptContext = {
  isEligible: () => boolean
  switchCampus: () => void
}

/** 单次小程序运行只尝试一次；不把拒绝结果写入长期存储。 */
export const createCampusLocationPrompt = ({
  getLocation,
  confirmSwitch,
  locationTimeoutMs = 15000,
}: PromptPlatform) => {
  let attempted = false
  let generation = 0

  return {
    cancelPending: () => { generation += 1 },
    dismissForSession: () => { attempted = true; generation += 1 },
    async run({ isEligible, switchCampus }: PromptContext) {
      if (attempted || !isEligible()) return
      attempted = true
      const currentGeneration = generation
      const stillEligible = () => currentGeneration === generation && isEligible()
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        const location = await Promise.race([
          getLocation(),
          new Promise<null>((resolve) => {
            timeout = setTimeout(() => resolve(null), locationTimeoutMs)
          }),
        ])
        clearTimeout(timeout)
        if (!location || !stillEligible() || identifyCampus(location) !== WEST_COAST_CAMPUS) return
        const confirmed = await confirmSwitch()
        // 定位或弹窗期间离开首页、手动选择校区、目标校区停用时放弃旧结果。
        if (confirmed && stillEligible()) switchCampus()
      } catch {
        // 定位拒绝、系统定位关闭或弹窗取消/失败均不影响首页。
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
