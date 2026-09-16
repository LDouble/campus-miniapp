import { View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { legacySocialTargetUrl } from './legacy-social-routes'

export const createLegacySocialPage = (page: string) => function LegacySocialPage() {
  const [targetUrl, setTargetUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const openPage = (url: string) => {
    setFailed(false)
    void Taro.redirectTo({ url }).catch(() => setFailed(true))
  }
  useLoad((options) => {
    const url = legacySocialTargetUrl(page, options)
    setTargetUrl(url)
    openPage(url)
  })
  return (
    <View ariaRole={failed ? 'button' : 'status'} onClick={() => failed && openPage(targetUrl)}>
      {failed ? '打开页面失败，点击重试' : '正在打开页面…'}
    </View>
  )
}
