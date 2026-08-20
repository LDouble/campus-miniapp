import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import UserAvatar from '../../components/user-avatar'
import { plainStickerContent } from '../stickers/content'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
} from './author'
import './fresh-barrage.scss'

type Props = {
  posts: CampusCirclePostView[]
  onOpen: (post: CampusCirclePostView) => void
}

let hasShownFreshBarrage = false

const barrageContent = (post: CampusCirclePostView) => (
  plainStickerContent(post.content || '').trim() || '分享了一组校园图片'
)

const barrageTextLength = (content: string) => (
  Array.from(content).reduce((length, character) => (
    length + (/^[\u0000-\u00ff]$/.test(character) ? 0.55 : 1)
  ), 0)
)

const barrageItemWidth = (post: CampusCirclePostView) => (
  Math.min(90 + barrageTextLength(barrageContent(post)) * 24, 600)
)

const arrangeBarrageLanes = (posts: CampusCirclePostView[]) => {
  if (posts.length < 4) {
    return [
      posts.filter((_, index) => index % 2 === 0),
      posts.filter((_, index) => index % 2 === 1),
    ]
  }

  const [first, ...rest] = posts
  const firstTextLength = barrageTextLength(barrageContent(first))
  const firstWidth = barrageItemWidth(first)
  const restWidths = rest.map(barrageItemWidth)
  const restTotal = restWidths.reduce((total, width) => total + width, 0) + (rest.length - 1) * 12
  const longestRest = Math.max(...restWidths)
  const totalsAreClose = restTotal >= firstWidth * 0.72 && restTotal <= firstWidth * 1.38
  const firstIsClearlyLonger = firstTextLength >= 16 && firstWidth >= longestRest * 1.55

  if (firstIsClearlyLonger && totalsAreClose) {
    return [[first], rest]
  }

  return [
    posts.filter((_, index) => index % 2 === 0),
    posts.filter((_, index) => index % 2 === 1),
  ]
}

export default function FreshBarrage({ posts, onOpen }: Props) {
  const [visible, setVisible] = useState(false)
  const barragePosts = posts.slice(0, 4)
  const barrageLanes = arrangeBarrageLanes(barragePosts)

  useEffect(() => {
    if (hasShownFreshBarrage || barragePosts.length === 0) return undefined

    const showTimer = setTimeout(() => {
      hasShownFreshBarrage = true
      setVisible(true)
    }, 800)
    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, 11200)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [barragePosts.length])

  if (!visible || barragePosts.length === 0) return null

  return (
    <View className='fresh-barrage' ariaRole='presentation'>
      {barrageLanes.map((lanePosts, laneIndex) => (
        lanePosts.length > 0 && (
          <View
            key={`lane-${laneIndex}`}
            className={`fresh-barrage__lane fresh-barrage__lane--${laneIndex}`}
          >
            {lanePosts.map((post) => {
              const content = barrageContent(post)
              return (
                <View
                  key={post.id}
                  className='fresh-barrage__item'
                  hoverClass='fresh-barrage__item--pressed'
                  ariaRole='button'
                  ariaLabel={`查看校园动态：${content}`}
                  onClick={() => {
                    setVisible(false)
                    onOpen(post)
                  }}
                >
                  <UserAvatar
                    src={communityAuthorAvatarUrl(post)}
                    className='fresh-barrage__avatar'
                    imageClassName='fresh-barrage__avatar-image'
                    fallback={communityAuthorInitial(post)}
                    userId={post.author_deleted ? 0 : post.author_id}
                    lazyLoad
                  />
                  <Text className='fresh-barrage__content'>{content}</Text>
                </View>
              )
            })}
          </View>
        )
      ))}
    </View>
  )
}
