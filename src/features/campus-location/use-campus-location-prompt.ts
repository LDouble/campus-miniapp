import { useEffect, useRef } from 'react'
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro'
import { enabledCampuses, getMiniappRuntimeConfig, getSelectedCampus } from '../runtime-config'
import { createCampusLocationPrompt } from './controller'
import { LAOSHAN_CAMPUS, WEST_COAST_CAMPUS } from './location'

const prompt = createCampusLocationPrompt({
  getLocation: () => Taro.getLocation({
    type: 'gcj02',
    isHighAccuracy: true,
    highAccuracyExpireTime: 5000,
  }),
  confirmSwitch: async () => {
    const result = await Taro.showModal({
      title: '切换到西海岸校区？',
      content: '检测到你当前位于西海岸校区附近，是否将校区和作息时间切换为西海岸校区？',
      confirmText: '切换',
      cancelText: '暂不切换',
    })
    return result.confirm
  },
})

export const useCampusLocationPrompt = (ready: boolean, onSwitch: (campus: string) => void) => {
  const active = useRef(true)
  const context = useRef({ ready, onSwitch })
  context.current = { ready, onSwitch }
  const cancelPending = () => {
    active.current = false
    prompt.cancelPending()
  }
  useDidShow(() => { active.current = true })
  useDidHide(cancelPending)
  useUnload(cancelPending)
  useEffect(() => cancelPending, [])

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp' || !ready) return
    void prompt.run({
      isEligible: () => {
        const config = getMiniappRuntimeConfig()
        return active.current && context.current.ready
          && getSelectedCampus(config) === LAOSHAN_CAMPUS
          && enabledCampuses(config).includes(WEST_COAST_CAMPUS)
      },
      switchCampus: () => context.current.onSwitch(WEST_COAST_CAMPUS),
    })
  }, [ready])

  return prompt.dismissForSession
}
