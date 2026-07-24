import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DesignIcon } from './DesignIcon'

const options = [['活动', '发起校园活动', 'check'], ['校园圈', '动态与失物招领', 'edit'], ['二手', '出闲置回血', 'market'], ['跑腿', '花钱求帮忙', 'errand'], ['拼车', '结伴出行', 'community']]

export function PublishSheet ({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  const select = (name: string) => {
    onClose()
    Taro.navigateTo({ url: `/pages/publish/index?type=${encodeURIComponent(name)}` })
  }
  return <View className='sheet-mask' onClick={onClose}>
    <View className='publish-sheet' onClick={event => event.stopPropagation()}>
      <View className='sheet-handle' />
      <View className='publish-grid'>{options.map(([name, desc, icon]) => <View className='publish-option' key={name} onClick={() => select(name)}><View className='publish-icon'><DesignIcon name={icon} /></View><Text className='publish-name'>{name}</Text><Text className='publish-desc'>{desc}</Text></View>)}</View>
      <View className='sheet-close' onClick={onClose}><DesignIcon name='close' /></View>
    </View>
  </View>
}
