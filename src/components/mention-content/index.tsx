import { Image, Text, View } from '@tarojs/components'
import type { ContentSegment } from '../../api/types'
import { campusStickers } from '../../assets/stickers'
import { openPublicProfile } from '../../features/profile/public-profile'
import { parseStickerContent } from '../../features/stickers/content'
import './index.scss'

type MentionContentProps = {
  content: string
  segments?: ContentSegment[] | null
  className?: string
  stickerClassName?: string
}

const stickerById = new Map(campusStickers.map((sticker) => [sticker.id, sticker]))

const renderText = (content: string, stickerClassName: string, keyPrefix: string) => (
  parseStickerContent(content).map((part, index) => {
    if (part.type === 'text') {
      return (
        <Text key={`${keyPrefix}-text-${index}`} className='mention-content__text'>
          {part.text}
        </Text>
      )
    }

    const sticker = stickerById.get(part.sticker.id)
    if (!sticker) {
      return (
        <Text key={`${keyPrefix}-fallback-${index}`} className='mention-content__text'>
          [{part.sticker.label}]
        </Text>
      )
    }

    return (
      <Image
        key={`${keyPrefix}-${sticker.id}-${index}`}
        className={['mention-content__sticker', stickerClassName].filter(Boolean).join(' ')}
        src={sticker.src}
        mode='aspectFit'
        lazyLoad
        ariaLabel={sticker.label}
      />
    )
  })
)

export default function MentionContent({
  content,
  segments,
  className = '',
  stickerClassName = '',
}: MentionContentProps) {
  const hasSegments = Array.isArray(segments) && segments.length > 0

  return (
    <View className={['mention-content', className].filter(Boolean).join(' ')}>
      {hasSegments ? segments?.map((segment, index) => {
        if (segment.type !== 'mention' || !segment.user_id) {
          return renderText(segment.text, stickerClassName, `segment-${index}`)
        }

        return (
          <Text
            key={`mention-${segment.user_id}-${index}`}
            className='mention-content__mention'
            onClick={(event) => {
              event.stopPropagation()
              void openPublicProfile(segment.user_id as number)
            }}
          >
            {segment.text}
          </Text>
        )
      }) : renderText(content, stickerClassName, 'fallback')}
    </View>
  )
}

export type { MentionContentProps }
