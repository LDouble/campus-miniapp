import { useCallback, useEffect, useState } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { getMiniappRuntimeConfig, getSelectedCampus, loadMiniappRuntimeConfig } from '../../features/runtime-config'
import { isApiError } from '../../api/client'
import { listFoodListings, pickRandomFood, rateFoodListing, type FoodListing } from '../../api/what-to-eat'
import { useCampusShare } from '../../features/share'
import './index.scss'

const icon = require('../../assets/icons/what-to-eat.svg')

const errorMessage = (error: unknown) => isApiError(error) ? error.message : '加载失败，请稍后再试'

export default function WhatToEatPage() {
  const bootstrap = getMiniappRuntimeConfig()
  const [campus, setCampus] = useState(getSelectedCampus(bootstrap))
  const [items, setItems] = useState<FoodListing[]>([])
  const [randomResult, setRandomResult] = useState<FoodListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  useCampusShare(() => ({ title: `${campus}今天吃什么`, path: '/pages/what-to-eat/index' }))

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const config = await loadMiniappRuntimeConfig().catch(() => getMiniappRuntimeConfig())
      const currentCampus = getSelectedCampus(config)
      setCampus(currentCampus)
      const page = await listFoodListings(currentCampus)
      setItems(page.items)
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  usePullDownRefresh(async () => { await refresh(); Taro.stopPullDownRefresh() })

  const chooseRandom = async () => {
    setPicking(true); setError('')
    try { setRandomResult(await pickRandomFood(campus)) }
    catch (nextError) { setError(errorMessage(nextError)) }
    finally { setPicking(false) }
  }

  const rate = async (item: FoodListing) => {
    const choice = await Taro.showActionSheet({ itemList: ['1 分', '2 分', '3 分', '4 分', '5 分'] }).catch(() => null)
    if (!choice) return
    try {
      const updated = await rateFoodListing(item.id, { score: choice.tapIndex + 1 })
      const mergeRating = (entry: FoodListing) => entry.id === updated.listing_id
        ? { ...entry, rating_average: updated.rating_average, rating_count: updated.rating_count, viewer_rating: updated.score }
        : entry
      setItems((current) => current.map(mergeRating))
      if (randomResult?.id === updated.listing_id) setRandomResult(mergeRating(randomResult))
      Taro.showToast({ title: '评分已提交', icon: 'success' })
    } catch (nextError) { Taro.showToast({ title: errorMessage(nextError), icon: 'none' }) }
  }

  return <View className='what-to-eat-page'>
    <CustomNavbar title='今天吃什么' subtitle={campus} showBack />
    <View className='what-to-eat-page__content'>
      <View className='what-to-eat-hero'>
        <View><Text className='what-to-eat-hero__eyebrow'>基于首页已选校区</Text><Text className='what-to-eat-hero__title'>今天，就吃点好的</Text><Text className='what-to-eat-hero__copy'>只从 {campus} 可吃到的正常餐饮项中随机选择。</Text></View>
        <Image src={icon} mode='aspectFit' />
      </View>
      <Button className='what-to-eat-pick' loading={picking} onClick={chooseRandom}>帮我随机选一个</Button>
      {randomResult && <View className='what-to-eat-result'>
        <Text className='what-to-eat-result__label'>这次就吃</Text><Text className='what-to-eat-result__name'>{randomResult.name}</Text>
        <Text>{randomResult.category} · {randomResult.location}</Text>
        <View className='what-to-eat-result__actions'><Text onClick={chooseRandom}>再选一次</Text><Text onClick={() => void rate(randomResult)}>去评分</Text></View>
      </View>}
      <View className='what-to-eat-section-head'><View><Text>校区餐饮清单</Text><Text>共 {items.length} 条</Text></View><Text onClick={() => Taro.navigateTo({ url: '/pages/what-to-eat/submit' })}>我要补充</Text></View>
      {error && <View className='what-to-eat-state'><Text>{error}</Text><Text onClick={refresh}>重新加载</Text></View>}
      {loading ? <View className='what-to-eat-state'>加载中…</View> : items.map((item) => <View key={item.id} className='what-to-eat-card' onClick={() => Taro.navigateTo({ url: `/pages/what-to-eat/detail?id=${item.id}` })}>
        <View className='what-to-eat-card__main'><View className='what-to-eat-card__title-row'><Text>{item.name}</Text>{item.promoted && <Text className='what-to-eat-card__ad'>推广</Text>}</View><Text>{item.category} · {item.location}</Text><View>{item.tags.map((tag) => <Text key={tag} className='what-to-eat-card__tag'>{tag}</Text>)}</View></View>
        <View className='what-to-eat-card__rating' onClick={(event) => { event.stopPropagation(); void rate(item) }}><Text>{item.rating_average.toFixed(1)} 分</Text><Text>{item.rating_count} 人评</Text></View>
      </View>)}
      {!loading && !error && !items.length && <View className='what-to-eat-state'>这个校区还没有餐饮清单，等你来补充。</View>}
    </View>
  </View>
}
