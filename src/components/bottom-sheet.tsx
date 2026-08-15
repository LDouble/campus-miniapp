import { useEffect, type PropsWithChildren, type ReactNode } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { setCustomTabBarHidden } from '../utils/tabbar'
import './bottom-sheet.scss'

type SheetClickEvent = {
  stopPropagation: () => void
}

type Props = PropsWithChildren<{
  visible: boolean
  title: string
  expanded?: boolean
  footer?: ReactNode
  closeLabel?: string
  onClose: () => void
  onContentClick?: (event: SheetClickEvent) => void
}>

export default function BottomSheet({
  visible,
  title,
  expanded = false,
  footer,
  closeLabel = '关闭',
  onClose,
  onContentClick,
  children,
}: Props) {
  useEffect(() => {
    if (!visible) return undefined
    setCustomTabBarHidden(visible)
    return () => setCustomTabBarHidden(false)
  }, [visible])

  if (!visible) return null

  return (
    <View className='bottom-sheet-layer' onClick={onClose}>
      <View
        className={`bottom-sheet ${expanded ? 'bottom-sheet--expanded' : ''}`}
        ariaRole='dialog'
        ariaLabel={title}
        onClick={(event) => {
          if (onContentClick) {
            onContentClick(event)
            return
          }
          event.stopPropagation()
        }}
      >
        <View className='bottom-sheet__handle' />
        <View className='bottom-sheet__header'>
          <Text>{title}</Text>
          <View
            className='bottom-sheet__close'
            ariaRole='button'
            ariaLabel={`${closeLabel}${title}`}
            hoverClass='bottom-sheet__close--pressed'
            onClick={onClose}
          >
            {closeLabel}
          </View>
        </View>
        <ScrollView className='bottom-sheet__content' scrollY enhanced showScrollbar={false}>
          {children}
        </ScrollView>
        {footer ? <View className='bottom-sheet__footer'>{footer}</View> : null}
      </View>
    </View>
  )
}
