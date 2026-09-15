import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, View } from '@tarojs/components'
import type { FavoriteResourceType } from '../../api/types'
import {
  addFavorite,
  getFavoriteState,
  removeFavorite,
} from '../../api/favorites'
import { isApiError } from '../../api/client'
import { isUnavailableFavoriteError } from './errors'
import './favorite-toggle.scss'

const bookmarkIcon = require('../../assets/community/bookmark.svg')
const bookmarkActiveIcon = require('../../assets/community/bookmark-active.svg')

type FavoriteToggleProps = {
  resourceId: number
  resourceType: FavoriteResourceType
  initialFavorited?: boolean
  loadState?: boolean
  compact?: boolean
  onChange?: (favorited: boolean) => void
}

const stateCache = new Map<string, boolean>()
const stateRequests = new Map<string, Promise<boolean>>()

const stateKey = (resourceType: FavoriteResourceType, resourceId: number) => (
  `${resourceType}:${resourceId}`
)

const readState = async (resourceType: FavoriteResourceType, resourceId: number) => {
  const key = stateKey(resourceType, resourceId)
  const cached = stateCache.get(key)
  if (cached !== undefined) return cached
  const pending = stateRequests.get(key)
  if (pending) return pending
  const request = getFavoriteState(resourceId, resourceType)
    .then((state) => {
      stateCache.set(key, state.favorited)
      return state.favorited
    })
    .finally(() => {
      if (stateRequests.get(key) === request) stateRequests.delete(key)
    })
  stateRequests.set(key, request)
  return request
}

export const invalidateFavoriteState = (
  resourceType: FavoriteResourceType,
  resourceId: number,
) => stateCache.delete(stateKey(resourceType, resourceId))

export default function FavoriteToggle({
  resourceId,
  resourceType,
  initialFavorited,
  loadState = true,
  compact = false,
  onChange,
}: FavoriteToggleProps) {
  const [favorited, setFavorited] = useState<boolean | null>(initialFavorited ?? null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!loadState) {
      setFavorited(initialFavorited ?? false)
      return undefined
    }
    let active = true
    void readState(resourceType, resourceId).then((value) => {
      if (active) setFavorited(value)
    }).catch((error) => {
      if (!active) return
      setFavorited(false)
      if (isUnavailableFavoriteError(error)) return
      Taro.showToast({
        title: isApiError(error) ? error.message : '收藏状态加载失败',
        icon: 'none',
      })
    })
    return () => {
      active = false
    }
  }, [initialFavorited, loadState, resourceId, resourceType])

  const toggle = async (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.()
    if (working || favorited === null) return
    setWorking(true)
    try {
      const state = favorited
        ? await removeFavorite(resourceId, resourceType)
        : await addFavorite(resourceId, resourceType)
      stateCache.set(stateKey(resourceType, resourceId), state.favorited)
      setFavorited(state.favorited)
      onChange?.(state.favorited)
      Taro.showToast({ title: state.favorited ? '已收藏' : '已取消收藏', icon: 'success' })
    } catch (error) {
      if (isUnavailableFavoriteError(error)) return
      Taro.showToast({
        title: isApiError(error) ? error.message : '操作失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setWorking(false)
    }
  }

  const loading = favorited === null || working
  return (
    <View
      className={`favorite-toggle ${compact ? 'favorite-toggle--compact' : ''} ${loading ? 'favorite-toggle--loading' : ''}`}
      ariaRole='button'
      ariaLabel={favorited === null ? '收藏状态加载中' : favorited ? '取消收藏' : '收藏'}
      onClick={(event) => void toggle(event)}
    >
      <Image
        className='favorite-toggle__icon'
        src={favorited ? bookmarkActiveIcon : bookmarkIcon}
        mode='aspectFit'
      />
      {!compact && <View className='favorite-toggle__label'>{favorited ? '已收藏' : '收藏'}</View>}
    </View>
  )
}
