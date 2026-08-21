import { useEffect, useState } from 'react'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Text, View, WebView } from '@tarojs/components'
import { decodeWebViewUrl } from '../../features/webview/url'
import {
  applyCampusThemeToCurrentPage,
  applyCampusThemeToNativeChrome,
} from '../../features/theme-preference'
import './index.scss'

export default function WebViewPage() {
  const [source, setSource] = useState('')
  const [error, setError] = useState('')

  useDidShow(() => {
    applyCampusThemeToNativeChrome()
  })

  useEffect(() => {
    applyCampusThemeToCurrentPage()
  }, [])

  useLoad((options) => {
    const target = decodeWebViewUrl(options.url)
    setSource(target)
    setError(target ? '' : '链接无效或不是安全的 HTTPS 地址')
  })

  if (source && !error) {
    return (
      <WebView
        src={source}
        onError={() => setError('网页加载失败，请确认域名已配置为小程序业务域名')}
      />
    )
  }

  return (
    <View className='webview-error'>
      <View className='webview-error__mark'>!</View>
      <Text className='webview-error__title'>暂时无法打开网页</Text>
      <Text className='webview-error__description'>{error || '链接正在加载'}</Text>
      <View
        className='webview-error__action'
        ariaRole='button'
        ariaLabel='返回上一页'
        onClick={() => Taro.navigateBack()}
      >
        返回上一页
      </View>
    </View>
  )
}
