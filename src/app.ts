import { useEffect } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'
import { clearExpiredTaroCookieStorage } from './lib/http-session/taro-cookie-storage'
// 全局样式
import './app.scss'

function App(props) {
  // 可以使用所有的 React Hooks
  useEffect(() => {
    try {
      clearExpiredTaroCookieStorage()
    } catch {
      // 存储清理失败不阻塞启动；发起直连请求时会再次校验会话。
    }
  }, [])

  // 对应 onShow
  useDidShow(() => {})

  // 对应 onHide
  useDidHide(() => {})

  return props.children
}

export default App
