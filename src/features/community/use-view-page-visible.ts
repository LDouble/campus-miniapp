import { useState } from 'react'
import { useDidHide, useDidShow, useUnload } from '@tarojs/taro'
import { flushCommunityPostViews } from './post-view'

/** 在列表加载前订阅生命周期，避免后台请求完成后新挂载的卡片误计曝光。 */
export const useViewPageVisible = () => {
  const [visible, setVisible] = useState(true)
  useDidHide(() => {
    setVisible(false)
    flushCommunityPostViews()
  })
  useUnload(flushCommunityPostViews)
  useDidShow(() => setVisible(true))
  return visible
}
