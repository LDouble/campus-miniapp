import { Image, MovableArea, MovableView, Text, View } from '@tarojs/components'
import { useRef, useState } from 'react'
import { getSystemState } from '../../state/system'
import { allServices, type ServiceItem } from './catalog'
import { getServiceIcon, type ServiceShortcutIconTheme } from './icons'
import { moveShortcut } from './preferences'

export default function ShortcutEditor({ keys, available, theme, onChange }: {
  keys: string[]; available: ServiceItem[]; theme: ServiceShortcutIconTheme; onChange: (keys: string[]) => void
}) {
  const [revision, setRevision] = useState(0)
  const drag = useRef<{ key: string; x: number; y: number } | null>(null)
  // 与当前卡片的16px外边距、16px内边距和1px边框对齐。
  const width = (getSystemState().windowInfo.windowWidth || 375) - 62
  const cellWidth = (width + 8) / 5
  const cellHeight = 76
  const update = (next: string[]) => { drag.current = null; onChange(next); setRevision((value) => value + 1) }
  const finishDrag = () => {
    const position = drag.current
    if (!position) return
    const column = Math.max(0, Math.min(4, Math.round(position.x / cellWidth)))
    const row = Math.max(0, Math.round(position.y / cellHeight))
    update(moveShortcut(keys, keys.indexOf(position.key), Math.min(keys.length - 1, row * 5 + column)))
  }
  return (
    <View onTouchEnd={finishDrag} onTouchCancel={() => { drag.current = null; setRevision((value) => value + 1) }}>
      {keys.length === 0 && <Text className='services-empty'>点击下方服务的 + 添加</Text>}
      <MovableArea className='services-sort' style={{ width: `${width}px`, height: `${Math.max(0, Math.ceil(keys.length / 5) * cellHeight - 14)}px` }}>
        {keys.map((key, index) => {
          const item = allServices.find((entry) => entry.key === key)
          const icon = getServiceIcon(key, theme)
          return <MovableView key={`${key}-${revision}`} direction='all' inertia={false} animation={false}
            x={(index % 5) * cellWidth} y={Math.floor(index / 5) * cellHeight}
            style={{ width: `${cellWidth - 8}px`, height: '62px' }}
            onChange={(event) => { if (event.detail.source === 'touch') drag.current = { key, x: event.detail.x, y: event.detail.y } }}
          >
            <View className='services-item'>
              <View className={`services-icon services-icon--${icon.tone}`}>
                <Image src={icon.src} mode='aspectFit' />
                <View className='services-toggle services-toggle--remove' ariaRole='button' ariaLabel={`移除${item?.name || key}`} onTouchStart={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); update(keys.filter((value) => value !== key)) }}><Image src={getServiceIcon('edit-remove', theme).src} mode='aspectFit' /></View>
              </View>
              <Text className='services-item__name'>{item?.name || '暂不可用'}</Text>
              {!available.some((entry) => entry.key === key) && <Text className='services-sort__unavailable'>暂不可用</Text>}
            </View>
          </MovableView>
        })}
      </MovableArea>
    </View>
  )
}
