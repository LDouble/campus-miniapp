import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { plainStickerContent } from '../stickers/content'
import { usePostExposure } from '../community/use-post-exposure'
import { getTodayHotSessionWindow, reportTodayHotEvent } from './analytics'
import { todayHotRepository, type TodayHotEntry } from './repository'
import { readReducedMotion } from './motion'
import { carouselIntervalMs, carouselSwipeStep, nextCarouselIndex, groupDiscussionItems } from './carousel'
import './today-hot.scss'

const hotBanner = require('../../assets/icons/everyone-chatting.svg')

const reduceMotion = () => { try { return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const summaryFor = (item: TodayHotEntry) => plainStickerContent(item.content || '').replace(/\s+/g, ' ').trim() || (item.images?.length ? '图片动态' : '校园动态')

export default function TodayHotHomeEntry({ pageVisible }: { pageVisible: boolean }) {
  const [items, setItems] = useState<TodayHotEntry[]>([])
  const [snapshotId, setSnapshotId] = useState<number | null>(null)
  const [interval, setIntervalSeconds] = useState(5)
  const [index, setIndex] = useState(0)
  const [touching, setTouching] = useState(false)
  const [foreground, setForeground] = useState(true)
  const [entryVisible, setEntryVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(reduceMotion)
  const groups = useMemo(() => groupDiscussionItems(items), [items])
  const current = groups[index]?.[0]
  const currentRef = useRef<TodayHotEntry | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchMoved = useRef(false)
  const shownOnce = useRef(false)
  currentRef.current = current || null
  const enabled = Boolean(snapshotId && current)
  const load = useCallback(async () => {
    try {
      const result = await todayHotRepository.getHome(getTodayHotSessionWindow())
      const nextItems = result.enabled ? result.items.slice(0, 30) : []
      setItems(nextItems); setSnapshotId(result.enabled ? result.snapshot_id || null : null)
      setIntervalSeconds(carouselIntervalMs(result.carousel_interval_seconds) / 1000)
      setIndex((value) => nextItems.length ? value % Math.ceil(nextItems.length / 2) : 0)
    } catch { setItems([]); setSnapshotId(null) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    let mounted = true
    void readReducedMotion(Taro.getSystemSetting, reduceMotion).then((reduced) => {
      if (mounted) setReducedMotion(reduced)
    })
    return () => { mounted = false }
  }, [])
  useDidShow(() => {
    setForeground(true)
    if (shownOnce.current) void load()
    shownOnce.current = true
  })
  useDidHide(() => setForeground(false))
  const canAutoplay = enabled && groups.length > 1 && pageVisible && foreground && entryVisible && !touching && !reducedMotion
  useEffect(() => {
    if (!canAutoplay) return undefined
    const timer = setInterval(() => setIndex((value) => nextCarouselIndex(value, groups.length)), carouselIntervalMs(interval))
    return () => clearInterval(timer)
  }, [canAutoplay, interval, groups.length])
  usePostExposure({
    selector: '#today-hot-home-entry',
    enabled: enabled && pageVisible,
    onExposure: () => reportTodayHotEvent('today_hot_module_exposure', { snapshotId: snapshotId || undefined, source: 'home' }),
    onVisibilityChange: setEntryVisible,
  })
  if (!enabled) return null
  const copy = summaryFor(current)
  const open = (selected?: TodayHotEntry) => {
    const item = selected || currentRef.current
    if (!item || !snapshotId) return
    setTouching(true)
    reportTodayHotEvent('today_hot_module_click', { snapshotId, source: 'home', postId: item.post_id })
    void Taro.navigateTo({ url: `/pages/today-hot/index?snapshot_id=${encodeURIComponent(snapshotId)}&post_id=${item.post_id}&source=home` }).finally(() => setTouching(false))
  }
  const startTouch = (event: unknown) => {
    const touchEvent = event as { touches?: Array<{ clientY?: number }> }
    touchStartY.current = touchEvent.touches?.[0]?.clientY ?? null
    touchMoved.current = false
    setTouching(true)
  }
  const finishTouch = (event: unknown) => {
    const touchEvent = event as { changedTouches?: Array<{ clientY?: number }> }
    const endY = touchEvent.changedTouches?.[0]?.clientY
    const delta = touchStartY.current === null || typeof endY !== 'number' ? 0 : endY - touchStartY.current
    touchStartY.current = null
    // 只响应短促的上下轻扫；长距离滑动优先交给首页正常滚动。
    const step = carouselSwipeStep(delta, groups.length)
    if (step) {
      touchMoved.current = true
      setIndex((value) => nextCarouselIndex(value, groups.length, step))
    }
    setTouching(false)
  }
  const renderGroup = (group: TodayHotEntry[], groupIndex: number) => <View className='today-hot-entry__group'>
    {group.map((item, row) => <View key={item.post_id} className={`today-hot-entry__row today-hot-entry__row--${row + 1}`} onClick={(event) => { event.stopPropagation(); if (!touchMoved.current) open(item) }}>
      <Text className='today-hot-entry__number'>{groupIndex * 2 + row + 1}</Text>
      <Text className='today-hot-entry__summary'>{summaryFor(item)}</Text>
    </View>)}
  </View>
  return <View id='today-hot-home-entry' className='today-hot-entry' ariaRole='button' ariaLabel={`大家在聊：${copy}`} onTouchStart={startTouch} onTouchEnd={finishTouch} onTouchCancel={() => { touchStartY.current = null; setTouching(false) }} onClick={() => { if (!touchMoved.current) open() }}>
    <View className='today-hot-entry__brand'>
      <View className='today-hot-entry__icon'><Image className='today-hot-entry__art' src={hotBanner} mode='aspectFit' /></View>
      <Text className='today-hot-entry__brand-title'>大家在聊</Text>
    </View>
    {groups.length > 1 && !reducedMotion ? (
      <Swiper className='today-hot-entry__ticker' vertical circular current={index} duration={600} disableTouch indicatorDots={false}>
        {groups.map((group, groupIndex) => <SwiperItem key={group[0].post_id}>{renderGroup(group, groupIndex)}</SwiperItem>)}
      </Swiper>
    ) : <View className='today-hot-entry__ticker'>{renderGroup(groups[index], index)}</View>}
    <View className='today-hot-entry__more'><Text>热聊榜</Text><View className='today-hot-entry__chevron' /></View>
  </View>
}
