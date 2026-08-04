import { useEffect, type PropsWithChildren } from 'react'
import { Text, View } from '@tarojs/components'
import { setCustomTabBarHidden } from '../../../utils/tabbar'
import { requestWechatSubscriptionAndStopPropagation } from '../../wechat-subscription'
import './filters.scss'

type Props = PropsWithChildren<{
  visible: boolean
  title: string
  applying?: boolean
  onClose: () => void
  onReset: () => void
  onApply: () => void
}>

export default function FilterSheet({
  visible,
  title,
  applying = false,
  onClose,
  onReset,
  onApply,
  children,
}: Props) {
  useEffect(() => {
    setCustomTabBarHidden(visible)
    return () => setCustomTabBarHidden(false)
  }, [visible])

  if (!visible) return null

  return (
    <View className='filter-sheet-layer' onClick={onClose}>
      <View
        className='filter-sheet'
        ariaRole='dialog'
        ariaLabel={title}
        onClick={requestWechatSubscriptionAndStopPropagation}
      >
        <View className='filter-sheet__handle' />
        <View className='filter-sheet__header'>
          <Text>{title}</Text>
          <View
            className='filter-sheet__close'
            ariaRole='button'
            ariaLabel='关闭筛选'
            hoverClass='filter-sheet__close--pressed'
            onClick={onClose}
          >
            关闭
          </View>
        </View>
        <View className='filter-sheet__content'>{children}</View>
        <View className='filter-sheet__actions'>
          <View
            className='filter-sheet__reset'
            hoverClass='filter-sheet__reset--pressed'
            onClick={onReset}
          >
            重置
          </View>
          <View
            className={`filter-sheet__apply ${
              applying ? 'filter-sheet__apply--disabled' : ''
            }`}
            hoverClass={applying ? 'none' : 'filter-sheet__apply--pressed'}
            onClick={() => !applying && onApply()}
          >
            {applying ? '正在筛选' : '查看结果'}
          </View>
        </View>
      </View>
    </View>
  )
}
