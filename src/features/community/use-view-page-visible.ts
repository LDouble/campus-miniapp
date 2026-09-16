import { useState } from 'react'
import { useDidHide, useDidShow } from '@tarojs/taro'

/** 在列表加载前订阅生命周期，避免后台请求完成后新挂载的卡片误计曝光。 */
export const useViewPageVisible = () => {
  const [visible, setVisible] = useState(true)
  useDidHide(() => setVisible(false))
  useDidShow(() => setVisible(true))
  return visible
}
