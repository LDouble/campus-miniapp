import { Image, Text, View } from '@tarojs/components'
import type { ActivityPopupCandidate } from '../../api/activity-popups'

export type ActivityPopupState = {
  candidate: ActivityPopupCandidate
  displayId: string
}

type ActivityPopupProps = {
  popup: ActivityPopupState
  onPresented: () => void
  onClose: () => void
  onClick: () => void
  onImageError: () => void
}

const ActivityPopup = ({ popup, onPresented, onClose, onClick, onImageError }: ActivityPopupProps) => (
  <View className='activity-popup' onClick={onClose}>
    <View
      className='activity-popup__card'
      ariaRole='dialog'
      ariaLabel='活动推荐'
      onClick={(event) => event.stopPropagation()}
    >
      <View
        className='activity-popup__image-action'
        ariaRole='button'
        ariaLabel='查看活动详情'
        onClick={onClick}
      >
        <Image
          className='activity-popup__image'
          src={popup.candidate.image_url}
          mode='widthFix'
          onLoad={onPresented}
          onError={onImageError}
          ariaLabel='活动图片'
        />
      </View>
      <View
        className='activity-popup__close'
        ariaRole='button'
        ariaLabel='关闭活动弹窗'
        onClick={onClose}
      >
        <Text>关闭</Text>
      </View>
      <View
        className='activity-popup__action'
        ariaRole='button'
        ariaLabel='查看活动详情'
        onClick={onClick}
      >
        <Text>查看活动</Text>
      </View>
    </View>
  </View>
)

export default ActivityPopup
