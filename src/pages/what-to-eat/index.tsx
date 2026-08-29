import { useCallback, useEffect, useState } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  enabledCampuses,
  getMiniappRuntimeConfig,
  getSelectedCampus,
  loadMiniappRuntimeConfig,
  saveSelectedCampus,
} from '../../features/runtime-config'
import { isApiError } from '../../api/client'
import { listFoodListings, pickRandomFood, type FoodListing } from '../../api/what-to-eat'
import { useCampusShare } from '../../features/share'
import { showActionSheetSelection } from '../../utils/action-sheet'
import StarRating from './star-rating'
import './index.scss'

const icon = require('../../assets/icons/what-to-eat.svg')

const errorMessage = (error: unknown) => isApiError(error) ? error.message : '加载失败，请稍后再试'

export default function WhatToEatPage() {
  const bootstrap = getMiniappRuntimeConfig()
  const [campus, setCampus] = useState(getSelectedCampus(bootstrap))
  const [campuses, setCampuses] = useState(() => enabledCampuses(bootstrap))
  const [items, setItems] = useState<FoodListing[]>([])
  const [randomResult, setRandomResult] = useState<FoodListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  useCampusShare(() => ({ title: `${campus}今天吃什么`, path: '/pages/what-to-eat/index' }))

  const refresh = useCallback(async (requestedCampus?: string) => {
    setLoading(true)
    setError('')
    setRandomResult(null)
    try {
      const config = await loadMiniappRuntimeConfig().catch(() => getMiniappRuntimeConfig())
      const availableCampuses = enabledCampuses(config)
      setCampuses(availableCampuses)
      const currentCampus = requestedCampus && availableCampuses.includes(requestedCampus)
        ? requestedCampus
        : getSelectedCampus(config)
      setCampus(currentCampus)
      const page = await listFoodListings(currentCampus)
      setItems(page.items)
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  usePullDownRefresh(async () => { await refresh(); Taro.stopPullDownRefresh() })

  const chooseCampus = async () => {
    const tapIndex = await showActionSheetSelection(campuses)
    if (tapIndex === null) return
    const nextCampus = campuses[tapIndex]
    if (!nextCampus || nextCampus === campus) return
    saveSelectedCampus(nextCampus)
    await refresh(nextCampus)
  }

  const chooseRandom = async () => {
    setPicking(true)
    setError('')
    try {
      setRandomResult(await pickRandomFood(campus))
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setPicking(false)
    }
  }

  const openDetail = (item: FoodListing, review = false) => {
    void Taro.navigateTo({ url: `/pages/what-to-eat/detail?id=${item.id}${review ? '&review=1' : ''}` })
  }

  return <View className='what-to-eat-page'>
    <CustomNavbar title='今天吃什么' subtitle={campus} showBack />
    <View className='what-to-eat-page__content'>
      <View className='what-to-eat-hero'>
        <View className='what-to-eat-hero__content'>
          <View className='what-to-eat-hero__campus-row'>
            <View className='what-to-eat-hero__campus-badge'>
              <Text className='what-to-eat-hero__campus'>{campus}</Text>
            </View>
            <View
              className='what-to-eat-hero__campus-action'
              role='button'
              ariaLabel={`切换校区，当前${campus}`}
              onClick={() => void chooseCampus()}
            >
              切换校区
            </View>
          </View>
          <Text className='what-to-eat-hero__eyebrow'>不纠结，交给我</Text>
          <Text className='what-to-eat-hero__title'>今天吃什么？</Text>
          <Text className='what-to-eat-hero__copy'>从校区口碑餐饮里，随机挑一份刚好的。</Text>
        </View>
        <View className='what-to-eat-hero__icon' aria-hidden>
          <Image src={icon} mode='aspectFit' />
        </View>
      </View>

      <Button
        className='what-to-eat-pick'
        hoverClass='none'
        loading={picking}
        disabled={loading || picking}
        onClick={() => void chooseRandom()}
      >
        帮我随机选一个
      </Button>

      {randomResult && <View className='what-to-eat-result'>
        <View className='what-to-eat-result__topline'>
          <Text className='what-to-eat-result__label'>今日推荐</Text>
          <Text className='what-to-eat-result__hint'>命中你的胃</Text>
        </View>
        <View className='what-to-eat-result__content'>
          {randomResult.image_urls[0]
            ? <Image className='what-to-eat-result__image' src={randomResult.image_urls[0]} mode='aspectFill' />
            : <View className='what-to-eat-result__placeholder' aria-hidden><Image src={icon} mode='aspectFit' /></View>}
          <View className='what-to-eat-result__info'>
            <Text className='what-to-eat-result__name'>{randomResult.name}</Text>
            <Text className='what-to-eat-result__meta'>{randomResult.category} · {randomResult.location}</Text>
            {randomResult.tags.length > 0 && <View className='what-to-eat-result__tags'>
              {randomResult.tags.slice(0, 2).map((tag) => <Text key={tag} className='what-to-eat-result__tag'>{tag}</Text>)}
            </View>}
          </View>
        </View>
        <View className='what-to-eat-result__actions'>
          <View
            className='what-to-eat-text-action'
            role='button'
            onClick={(event) => {
              event.stopPropagation()
              void chooseRandom()
            }}
          >
            换一个
          </View>
          <View
            className='what-to-eat-text-action'
            role='button'
            onClick={(event) => {
              event.stopPropagation()
              openDetail(randomResult)
            }}
          >
            查看详情
          </View>
        </View>
      </View>}

      <View className='what-to-eat-section-head'>
        <View className='what-to-eat-section-head__title-group'>
          <View className='what-to-eat-section-head__title-line'>
            <View className='what-to-eat-section-head__marker' aria-hidden />
            <Text className='what-to-eat-section-head__title'>校区餐饮</Text>
          </View>
          <Text className='what-to-eat-section-head__count'>{items.length} 家可选</Text>
        </View>
        <View
          className='what-to-eat-section-head__action'
          role='button'
          onClick={() => void Taro.navigateTo({ url: '/pages/what-to-eat/submit' })}
        >
          补充餐饮
        </View>
      </View>

      {error && <View className='what-to-eat-state what-to-eat-state--error'>
        <Text>{error}</Text>
        <View
          className='what-to-eat-state__action'
          role='button'
          hoverClass='none'
          onClick={() => void refresh()}
        >
          重新加载
        </View>
      </View>}

      {loading ? <View className='what-to-eat-state'>加载中…</View> : items.map((item) => <View
        key={item.id}
        className='what-to-eat-card'
        role='button'
        onClick={() => openDetail(item)}
      >
        {item.image_urls[0]
          ? <Image className='what-to-eat-card__image' src={item.image_urls[0]} mode='aspectFill' />
          : <View className='what-to-eat-card__placeholder' aria-hidden><Image src={icon} mode='aspectFit' /></View>}
        <View className='what-to-eat-card__body'>
          <View className='what-to-eat-card__main'>
            <View className='what-to-eat-card__title-row'>
              <Text className='what-to-eat-card__title'>{item.name}</Text>
              {item.promoted && <Text className='what-to-eat-card__ad'>推广</Text>}
            </View>
            <Text className='what-to-eat-card__meta'>{item.category} · {item.location}</Text>
            {item.tags.length > 0 && <View className='what-to-eat-card__tags'>
              {item.tags.slice(0, 2).map((tag) => <Text key={tag} className='what-to-eat-card__tag'>{tag}</Text>)}
            </View>}
          </View>
          <View
            className='what-to-eat-card__rating'
            role='button'
            ariaLabel={`${item.name}评分 ${item.rating_average.toFixed(1)} 分，共 ${item.rating_count} 人评`}
            onClick={(event) => {
              event.stopPropagation()
              openDetail(item, true)
            }}
          >
            <StarRating
              value={item.rating_average}
              size='sm'
              label={`查看${item.name}星级评分`}
            />
            <Text className='what-to-eat-card__score'>{item.rating_average.toFixed(1)}</Text>
            <Text className='what-to-eat-card__rating-count'>{item.rating_count} 人评</Text>
          </View>
        </View>
      </View>)}

      {!loading && !error && !items.length && <View className='what-to-eat-state what-to-eat-state--empty'>
        <Text>这个校区还没有餐饮清单。</Text>
        <View
          className='what-to-eat-state__action'
          role='button'
          hoverClass='none'
          onClick={() => void Taro.navigateTo({ url: '/pages/what-to-eat/submit' })}
        >
          去补充
        </View>
      </View>}
    </View>
  </View>
}
