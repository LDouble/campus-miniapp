import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { plainStickerContent } from '../stickers/content'
import { usePostExposure } from '../community/use-post-exposure'
import { getTodayHotSessionWindow, reportTodayHotEvent } from './analytics'
import { todayHotRepository, type TodayHotEntry } from './repository'
import { readReducedMotion } from './motion'
import { carouselIntervalMs, carouselSwipeStep, nextCarouselIndex } from './carousel'
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
  const current = items[index]
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
      setIndex((value) => nextItems.length ? value % nextItems.length : 0)
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
  const canAutoplay = enabled && items.length > 1 && pageVisible && foreground && entryVisible && !touching && !reducedMotion
  useEffect(() => {
    if (!canAutoplay) return undefined
    const timer = setInterval(() => setIndex((value) => nextCarouselIndex(value, items.length)), carouselIntervalMs(interval))
    return () => clearInterval(timer)
  }, [canAutoplay, interval, items.length])
  usePostExposure({
    selector: '#today-hot-home-entry',
    enabled: enabled && pageVisible,
    onExposure: () => reportTodayHotEvent('today_hot_module_exposure', { snapshotId: snapshotId || undefined, source: 'home' }),
    onVisibilityChange: setEntryVisible,
  })
  if (!enabled) return null
  const copy = summaryFor(current)
  const open = () => {
    const item = currentRef.current
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
    const step = carouselSwipeStep(delta, items.length)
    if (step) {
      touchMoved.current = true
      setIndex((value) => nextCarouselIndex(value, items.length, step))
    }
    setTouching(false)
  }
  return <View id='today-hot-home-entry' className='today-hot-entry' ariaRole='button' ariaLabel={`大家在聊：${copy}`} onTouchStart={startTouch} onTouchEnd={finishTouch} onTouchCancel={() => { touchStartY.current = null; setTouching(false) }} onClick={() => { if (!touchMoved.current) open() }}>
    <View className='today-hot-entry__brand'>
      <Image className='today-hot-entry__art' src={hotBanner} mode='scaleToFill' />
      <Text className='today-hot-entry__brand-title'>大家在聊</Text>
    </View>
    {items.length > 1 && !reducedMotion ? (
      <Swiper className='today-hot-entry__ticker' vertical circular current={index} duration={280} disableTouch indicatorDots={false}>
        {items.map((item) => <SwiperItem key={item.post_id}>
          <View className='today-hot-entry__row'><Text className='today-hot-entry__summary'>{summaryFor(item)}</Text></View>
        </SwiperItem>)}
      </Swiper>
    ) : <View className='today-hot-entry__ticker today-hot-entry__row'><Text className='today-hot-entry__summary'>{copy}</Text></View>}
  </View>
}
