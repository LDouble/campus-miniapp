import { Image, Text, View } from '@tarojs/components'
import { campusStickers } from '../../assets/stickers'
import { parseStickerContent } from '../../features/stickers/content'

type StickerContentProps = {
  content: string
  className?: string
  stickerClassName?: string
}

const stickerById = new Map(campusStickers.map((sticker) => [sticker.id, sticker]))

export default function StickerContent({
  content,
  className = '',
  stickerClassName = '',
}: StickerContentProps) {
  const parts = parseStickerContent(content)

  return (
    <View className={['sticker-content', className].filter(Boolean).join(' ')}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <Text key={`text-${index}`} className='sticker-content__text'>{part.text}</Text>
        }

        const sticker = stickerById.get(part.sticker.id)
        if (!sticker) return <Text key={`fallback-${index}`} className='sticker-content__text'>[{part.sticker.label}]</Text>

        return (
          <Image
            key={`${sticker.id}-${index}`}
            className={['sticker-content__sticker', stickerClassName].filter(Boolean).join(' ')}
            src={sticker.src}
            mode='aspectFit'
            lazyLoad
            ariaLabel={sticker.label}
          />
        )
      })}
    </View>
  )
}

export type { StickerContentProps }
