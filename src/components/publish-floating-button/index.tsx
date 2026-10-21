import { Image, Text, View } from '@tarojs/components'
import { isQualificationEdition } from '../../features/app-edition'
import { openCustomTabBarPublish } from '../../utils/tabbar'
import './index.scss'

export default function PublishFloatingButton() {
  if (isQualificationEdition) return null

  return (
    <View
      className='publish-floating-button'
      ariaRole='button'
      ariaLabel='发布校园动态'
      onClick={() => openCustomTabBarPublish()}
    >
      <Image
        className='publish-floating-button__icon'
        src={require('../../assets/tabbar/publish.svg')}
        mode='aspectFit'
      />
      <Text>发布</Text>
    </View>
  )
}
