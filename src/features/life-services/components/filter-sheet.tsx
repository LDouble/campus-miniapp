import type { PropsWithChildren } from 'react'
import { View } from '@tarojs/components'
import BottomSheet from '../../../components/bottom-sheet'
import { requestWechatSubscriptionAndStopPropagation } from '../../wechat-subscription'
import './filters.scss'

type Props = PropsWithChildren<{
  visible: boolean
  title: string
  applying?: boolean
  expanded?: boolean
  onClose: () => void
  onReset: () => void
  onApply: () => void
}>

export default function FilterSheet({
  visible,
  title,
  applying = false,
  expanded = false,
  onClose,
  onReset,
  onApply,
  children,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      expanded={expanded}
      onClose={onClose}
      onContentClick={requestWechatSubscriptionAndStopPropagation}
      footer={(
        <View className='filter-sheet__actions'>
          <View
            className='filter-sheet__reset'
            ariaRole='button'
            ariaLabel='重置筛选条件'
            onClick={onReset}
          >
            重置
          </View>
          <View
            className={`filter-sheet__apply ${
              applying ? 'filter-sheet__apply--disabled' : ''
            }`}
            ariaRole='button'
            ariaLabel={applying ? '正在筛选' : '应用筛选并查看结果'}
            onClick={() => !applying && onApply()}
          >
            {applying ? '正在筛选' : '查看结果'}
          </View>
        </View>
      )}
    >
      <View className='filter-sheet__content'>{children}</View>
    </BottomSheet>
  )
}
