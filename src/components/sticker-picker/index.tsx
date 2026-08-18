import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { CampusSticker } from '../../assets/stickers'
import { campusStickers } from '../../assets/stickers'

const smileIcon = require('../../assets/icons/smile.svg')

const RECENT_STICKERS_STORAGE_KEY = 'campus_recent_sticker_ids'
const MAX_RECENT_STICKERS = 7
const stickerById = new Map(campusStickers.map((sticker) => [sticker.id, sticker]))

const readRecentStickerIds = () => {
  try {
    const stored = Taro.getStorageSync<string[]>(RECENT_STICKERS_STORAGE_KEY)
    if (!Array.isArray(stored)) return []
    return stored.filter((id, index) => stickerById.has(id) && stored.indexOf(id) === index).slice(0, MAX_RECENT_STICKERS)
  } catch {
    return []
  }
}

type StickerPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (sticker: CampusSticker) => void
  className?: string
}

export default function StickerPicker({
  open,
  onOpenChange,
  onSelect,
  className = '',
}: StickerPickerProps) {
  const [recentIds, setRecentIds] = useState<string[]>(readRecentStickerIds)
  const recentStickers = recentIds.flatMap((id) => {
    const sticker = stickerById.get(id)
    return sticker ? [sticker] : []
  })

  const selectSticker = (sticker: CampusSticker) => {
    const nextRecentIds = [sticker.id, ...recentIds.filter((id) => id !== sticker.id)].slice(0, MAX_RECENT_STICKERS)
    setRecentIds(nextRecentIds)
    try {
      Taro.setStorageSync(RECENT_STICKERS_STORAGE_KEY, nextRecentIds)
    } catch {
      // 缓存不可用不影响表情选择。
    }
    onSelect(sticker)
  }

  const renderSticker = (sticker: CampusSticker, keyPrefix: string) => {
    return (
      <View
        key={`${keyPrefix}-${sticker.id}`}
        className='sticker-picker__item'
        hoverClass='sticker-picker__item--pressed'
        hoverStartTime={20}
        hoverStayTime={100}
        ariaRole='button'
        ariaLabel={`${sticker.label}表情`}
        onClick={() => selectSticker(sticker)}
      >
        <Image src={sticker.src} mode='aspectFit' lazyLoad />
      </View>
    )
  }

  return (
    <View className={['sticker-picker', className].filter(Boolean).join(' ')}>
      <View
        className={open ? 'sticker-picker__trigger sticker-picker__trigger--active' : 'sticker-picker__trigger'}
        hoverClass='sticker-picker__trigger--pressed'
        hoverStartTime={20}
        hoverStayTime={100}
        ariaRole='button'
        ariaLabel={open ? '收起校园鲨表情' : '选择校园鲨表情'}
        onClick={() => onOpenChange(!open)}
      >
        <Image
          className='sticker-picker__trigger-icon'
          src={smileIcon}
          mode='aspectFit'
        />
      </View>

      {open && (
        <View className='sticker-picker__panel' ariaRole='group' ariaLabel='校园鲨表情列表'>
          <ScrollView className='sticker-picker__scroll' scrollY enhanced showScrollbar={false}>
            {recentStickers.length > 0 && (
              <View className='sticker-picker__section'>
                <Text className='sticker-picker__section-title'>最近使用</Text>
                <View className='sticker-picker__recent-list'>
                  {recentStickers.map((sticker) => renderSticker(sticker, 'recent'))}
                </View>
              </View>
            )}
            <View className='sticker-picker__section'>
              <Text className='sticker-picker__section-title'>全部表情</Text>
              <View className='sticker-picker__list'>
                {campusStickers.map((sticker) => renderSticker(sticker, 'all'))}
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  )
}

export type { StickerPickerProps }
