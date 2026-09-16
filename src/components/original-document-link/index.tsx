import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { normalizeWebViewUrl } from '../../features/webview/url'
import arrow from '../../assets/calendar/original-arrow.svg'
import './index.scss'

type Props = { url?: string; icon: string; title: string; description: string; action?: string }

export default function OriginalDocumentLink({ url, icon, title, description, action = '查看原件' }: Props) {
  const target = normalizeWebViewUrl(url)
  if (!target) return null
  const open = () => {
    void Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(target)}` })
      .catch(() => Taro.showToast({ title: '暂时无法打开，请稍后重试', icon: 'none' }))
  }
  return <View className='original-document-link' role='button' ariaLabel={`${action}：${title}`} onClick={open}>
    <View className='original-document-link__icon'><Image src={icon} mode='aspectFit' /></View>
    <View className='original-document-link__copy'>
      <Text className='original-document-link__title'>{title}</Text>
      <Text className='original-document-link__description'>{description}</Text>
    </View>
    <View className='original-document-link__action'><Text>{action}</Text><Image src={arrow} mode='aspectFit' /></View>
  </View>
}
