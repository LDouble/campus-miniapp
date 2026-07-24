import Taro, { useReady } from '@tarojs/taro'
import { useState } from 'react'

export function useStatusBarHeight () {
  const [height, setHeight] = useState(0)
  useReady(() => setHeight(Taro.getWindowInfo().statusBarHeight || 0))
  return height
}
