import { useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import type { BaseEventOrig } from '@tarojs/components/types/common'
import { useDismissCommunityOverlaysOnScroll } from '../../community/use-overlay-dismissal'
import type { DetailFooterAction } from './detail-comments'

const moreIcon = require('../../../assets/icons/more-horizontal.svg')

type DetailOverflowActionsProps = {
  actions: DetailFooterAction[]
  ariaLabel?: string
}

const stopPropagation = (event: BaseEventOrig) => {
  event.stopPropagation()
}

export default function DetailOverflowActions({
  actions,
  ariaLabel = '更多操作',
}: DetailOverflowActionsProps) {
  const [open, setOpen] = useState(false)

  useDismissCommunityOverlaysOnScroll({
    active: open,
    onDismiss: () => setOpen(false),
  })

  if (actions.length === 0) return null

  return (
    <View
      className={`detail-overflow-actions${open ? ' detail-overflow-actions--open' : ''}`}
      onClick={stopPropagation}
    >
      {open && (
        <View
          className='detail-overflow-actions__backdrop'
          onTouchStart={(event) => {
            event.stopPropagation()
            setOpen(false)
          }}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(false)
          }}
        />
      )}
      <Button
        className='detail-overflow-actions__trigger'
        hoverClass='none'
        ariaLabel={ariaLabel}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <Image src={moreIcon} mode='aspectFit' />
      </Button>
      {open && (
        <View className='detail-overflow-actions__menu' ariaRole='menu'>
          {actions.map((action) => (
            <View
              key={action.key}
              className={[
                'detail-overflow-actions__item',
                `detail-overflow-actions__item--${action.emphasis || 'secondary'}`,
                action.busy ? 'detail-overflow-actions__item--busy' : '',
              ].filter(Boolean).join(' ')}
              ariaRole='menuitem'
              ariaLabel={action.busy ? `${action.label}处理中` : action.label}
              onClick={(event) => {
                event.stopPropagation()
                if (action.busy) return
                setOpen(false)
                action.onClick()
              }}
            >
              <Text>{action.busy ? `${action.label}中…` : action.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
