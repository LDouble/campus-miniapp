import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  AcademicQueryChannel,
  getAcademicQueryChannel,
  toggleAcademicQueryChannel,
} from '../../../features/academic-direct/channel'

interface AcademicChannelSwitchProps {
  compact?: boolean
}

const channelLabel: Record<AcademicQueryChannel, string> = {
  server: '服务端',
  direct: '直连',
}

export default function AcademicChannelSwitch({
  compact = false,
}: AcademicChannelSwitchProps) {
  const [channel, setChannel] = useState(getAcademicQueryChannel)
  const [switching, setSwitching] = useState(false)

  const toggle = async () => {
    if (switching) return
    setSwitching(true)
    try {
      const next = toggleAcademicQueryChannel()
      setChannel(next)
      Taro.showToast({
        title: `已切换为${next === 'direct' ? '小程序直连' : '服务端查询'}`,
        icon: 'none',
        duration: 1200,
      })
      const page = Taro.getCurrentPages().slice(-1)[0]
      const route = String(page?.route || '')
      if (route) {
        await Taro.redirectTo({ url: `/${route}` })
      }
    } catch {
      Taro.showToast({ title: '查询通道切换失败', icon: 'none' })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <View
      className={[
        'academic-channel-switch',
        `academic-channel-switch--${channel}`,
        compact ? 'academic-channel-switch--compact' : '',
        switching ? 'academic-channel-switch--disabled' : '',
      ].filter(Boolean).join(' ')}
      hoverClass='academic-channel-switch--pressed'
      ariaRole='button'
      ariaLabel={`当前${channelLabel[channel]}查询，点击切换`}
      onClick={toggle}
    >
      <View />
      <Text>{channelLabel[channel]}</Text>
    </View>
  )
}
