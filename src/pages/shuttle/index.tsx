import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  enabledCampuses,
  getMiniappRuntimeConfig,
  getSelectedCampus,
  loadMiniappRuntimeConfig,
} from '../../features/runtime-config'
import {
  loadShuttleRoutes,
  shuttleDateKey,
  ShuttleLoadResult,
} from '../../features/shuttle/repository'
import {
  filterShuttleJourneys,
  shuttleDestinationOptions,
  shuttleOriginOptions,
  ShuttleJourney,
} from '../../features/shuttle/local-filter'
import { takeWechatAiHandoffQuery } from '../../features/wechat-ai/handoff'
import { useCampusShare } from '../../features/share'
import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../utils/date-time'
import './index.scss'

type ServiceFilter = 'all' | 'campus_loop' | 'intercampus'

const weekday = (date: Date) => (
  ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
)

const dayLabel = (date: Date, offset: number) => (
  `${offset === 0 ? '今天' : '明天'} · ${weekday(date)}`
)

const nextTime = (value?: string) => {
  if (!value) return ''
  const parts = apiDateTimeCampusParts(value)
  return parts ? parts.time : ''
}

const minutesUntil = (value?: string) => {
  if (!value) return null
  const milliseconds = apiDateTimeTimestamp(value) - Date.now()
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null
  return Math.max(1, Math.ceil(milliseconds / 60000))
}

const dateDescription = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '选择日期'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const sourceText = (source: ShuttleLoadResult['source']) => {
  if (source === 'cache') return '网络暂不可用，正在展示上次成功获取的班次'
  if (source === 'unavailable') return '网络暂不可用，暂时无法获取已发布线路'
  return ''
}

const validServiceDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime()) || shuttleDateKey(date) !== value) return undefined
  return date.getFullYear() >= 2020 && date.getFullYear() <= 2100 ? value : undefined
}

const validCampus = (value?: string) => {
  const normalized = value?.trim() || ''
  return normalized && normalized.length <= 40 ? normalized : undefined
}

const validStopName = (value?: string) => {
  if (!value) return undefined
  try {
    const normalized = decodeURIComponent(value).trim()
    return normalized && normalized.length <= 80 ? normalized : undefined
  } catch {
    return undefined
  }
}

const validServiceFilter = (value?: string): ServiceFilter | undefined => (
  value === 'campus_loop' || value === 'intercampus' ? value : undefined
)

export default function ShuttlePage() {
  const bootstrap = getMiniappRuntimeConfig()
  const [campuses, setCampuses] = useState(() => enabledCampuses(bootstrap))
  const [campus, setCampus] = useState(() => getSelectedCampus(bootstrap))
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all')
  const [serviceDate, setServiceDate] = useState(() => shuttleDateKey(new Date()))
  const [originStop, setOriginStop] = useState('')
  const [destinationStop, setDestinationStop] = useState('')
  const [result, setResult] = useState<ShuttleLoadResult>({
    items: [],
    source: 'network',
    updatedAt: 0,
  })
  const [loading, setLoading] = useState(true)
  const handoffCampus = useRef<string>()

  useCampusShare(() => ({
    title: `校园校车｜${campus}`,
    path: '/pages/shuttle/index',
    query: {
      campus: campus === '全部校区' ? undefined : campus,
      date: serviceDate,
      serviceType: serviceFilter === 'all' ? undefined : serviceFilter,
      from: originStop || undefined,
      to: destinationStop || undefined,
    },
  }))

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await loadShuttleRoutes({
        campus: campus === '全部校区' ? undefined : campus,
        serviceType: serviceFilter === 'all' ? undefined : serviceFilter,
        date: serviceDate,
      })
      setResult(next)
    } finally {
      setLoading(false)
    }
  }, [campus, serviceDate, serviceFilter])

  useLoad((options) => {
    const handoffQuery = takeWechatAiHandoffQuery(options, 'pages/shuttle/index')
    const nextDate = validServiceDate(handoffQuery.date)
    const nextCampus = validCampus(handoffQuery.campus)
    const nextServiceFilter = validServiceFilter(handoffQuery.serviceType)
    const nextOriginStop = validStopName(handoffQuery.from)
    const nextDestinationStop = validStopName(handoffQuery.to)
    if (nextDate) setServiceDate(nextDate)
    if (nextServiceFilter) setServiceFilter(nextServiceFilter)
    if (nextOriginStop) setOriginStop(nextOriginStop)
    if (nextDestinationStop) setDestinationStop(nextDestinationStop)
    if (nextCampus) {
      handoffCampus.current = nextCampus
      if (campuses.includes(nextCampus)) {
        setCampus(nextCampus)
        handoffCampus.current = undefined
      }
    }
  })

  useEffect(() => {
    loadMiniappRuntimeConfig().then((config) => {
      const available = enabledCampuses(config)
      const requestedCampus = handoffCampus.current
      setCampuses(available)
      setCampus((current) => (
        requestedCampus && available.includes(requestedCampus)
          ? requestedCampus
          : current === '全部校区' || available.includes(current)
          ? current
          : getSelectedCampus(config)
      ))
      handoffCampus.current = undefined
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  usePullDownRefresh(async () => {
    await refresh()
    Taro.stopPullDownRefresh()
  })

  const originOptions = useMemo(
    () => shuttleOriginOptions(result.items),
    [result.items],
  )
  const destinationOptions = useMemo(
    () => shuttleDestinationOptions(result.items, originStop || undefined),
    [originStop, result.items],
  )
  useEffect(() => {
    if (loading) return
    if (originStop && !originOptions.includes(originStop)) {
      setOriginStop('')
      setDestinationStop('')
      return
    }
    if (destinationStop && !destinationOptions.includes(destinationStop)) {
      setDestinationStop('')
    }
  }, [destinationOptions, destinationStop, loading, originOptions, originStop])
  const journeys = useMemo(
    () => filterShuttleJourneys(
      result.items,
      serviceDate,
      originStop || undefined,
      destinationStop || undefined,
    ),
    [destinationStop, originStop, result.items, serviceDate],
  )
  const nextJourney = useMemo(() => (
    journeys
      .filter((item) => item.nextDepartureAt)
      .sort((left, right) => (
        apiDateTimeTimestamp(left.nextDepartureAt)
        - apiDateTimeTimestamp(right.nextDepartureAt)
      ))[0]
  ), [journeys])

  const openRoute = (journey: ShuttleJourney) => {
    const stopQuery = [
      originStop ? `from=${encodeURIComponent(originStop)}` : '',
      destinationStop ? `to=${encodeURIComponent(destinationStop)}` : '',
    ].filter(Boolean).join('&')
    Taro.navigateTo({
      url: `/pages/shuttle/detail?id=${journey.route.id}&date=${serviceDate}${stopQuery ? `&${stopQuery}` : ''}`,
    })
  }

  const selectOrigin = (index: number) => {
    const nextOrigin = ['', ...originOptions][index] || ''
    setOriginStop(nextOrigin)
    if (
      destinationStop
      && !shuttleDestinationOptions(result.items, nextOrigin || undefined).includes(destinationStop)
    ) setDestinationStop('')
  }

  const selectDestination = (index: number) => {
    setDestinationStop(['', ...destinationOptions][index] || '')
  }

  const clearStopFilter = () => {
    setOriginStop('')
    setDestinationStop('')
  }

  const swapStops = () => {
    if (!originStop || !destinationStop) return
    if (!shuttleDestinationOptions(result.items, destinationStop).includes(originStop)) {
      Taro.showToast({ title: '暂无反向直达班次', icon: 'none' })
      return
    }
    setOriginStop(destinationStop)
    setDestinationStop(originStop)
  }

  const quickDates = [0, 1].map((offset) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + offset)
    return { date, key: shuttleDateKey(date), offset }
  })
  const customDateActive = !quickDates.some((item) => item.key === serviceDate)

  return (
    <View className='shuttle-page'>
      <CustomNavbar title='校园校车' subtitle='静态班次查询' showBack />

      <View className='shuttle-page__content'>
        <View className='shuttle-hero'>
          <View className='shuttle-hero__eyebrow'>
            <View />
            <Text>下一班</Text>
          </View>
          {nextJourney ? (
            <>
              <View className='shuttle-hero__main'>
                <View>
                  <Text className='shuttle-hero__time'>{nextTime(nextJourney.nextDepartureAt)}</Text>
                  <Text className='shuttle-hero__countdown'>
                    {minutesUntil(nextJourney.nextDepartureAt)
                      ? `${minutesUntil(nextJourney.nextDepartureAt)} 分钟后发车`
                      : '后续班次'}
                  </Text>
                </View>
                <View className='shuttle-hero__type'>
                  {nextJourney.route.service_type === 'campus_loop' ? '校内' : '校际'}
                </View>
              </View>
              <Text className='shuttle-hero__route'>{nextJourney.route.name}</Text>
              <Text className='shuttle-hero__direction'>
                {nextJourney.origin} → {nextJourney.destination}
              </Text>
            </>
          ) : (
            <View className='shuttle-hero__empty'>
              <Text>当天暂无可用班次</Text>
              <Text>切换日期或下拉刷新试试</Text>
            </View>
          )}
          <View className='shuttle-hero__footer'>
            <Text>仅展示计划班次</Text>
            <Text>不含车辆实时位置</Text>
          </View>
        </View>

        {result.source !== 'network' && (
          <View className={`shuttle-source shuttle-source--${result.source}`}>
            <View />
            <Text>{sourceText(result.source)}</Text>
          </View>
        )}

        <View className='shuttle-date-tabs'>
          {quickDates.map(({ date, key, offset }) => {
            return (
              <View
                key={offset}
                className={`shuttle-date-tabs__item ${serviceDate === key ? 'shuttle-date-tabs__active' : ''}`}
                hoverClass='shuttle-date-tabs__pressed'
                role='button'
                ariaLabel={`查看${dayLabel(date, offset)}班次`}
                onClick={() => setServiceDate(key)}
              >
                <Text>{dayLabel(date, offset)}</Text>
                <Text>{date.getMonth() + 1}月{date.getDate()}日</Text>
              </View>
            )
          })}
          <Picker
            mode='date'
            value={serviceDate}
            start='2020-01-01'
            end='2100-12-31'
            onChange={(event) => setServiceDate(String(event.detail.value))}
          >
            <View className={`shuttle-date-tabs__item ${customDateActive ? 'shuttle-date-tabs__active' : ''}`}>
              <Text>{customDateActive ? `已选 · ${weekday(new Date(`${serviceDate}T00:00:00`))}` : '自选日期'}</Text>
              <Text>{customDateActive ? dateDescription(serviceDate) : '选择日期'}</Text>
            </View>
          </Picker>
        </View>

        <ScrollView className='shuttle-campus-filter' scrollX enhanced showScrollbar={false}>
          <View
            className={campus === '全部校区' ? 'shuttle-campus-filter__active' : ''}
            hoverClass='shuttle-campus-filter__pressed'
            role='button'
            ariaLabel='筛选全部校区校车'
            onClick={() => setCampus('全部校区')}
          >
            全部校区
          </View>
          {campuses.map((item) => (
            <View
              key={item}
              className={campus === item ? 'shuttle-campus-filter__active' : ''}
              hoverClass='shuttle-campus-filter__pressed'
              role='button'
              ariaLabel={`筛选${item}校车`}
              onClick={() => setCampus(item)}
            >
              {item.replace('校区', '')}
            </View>
          ))}
        </ScrollView>

        <View className='shuttle-type-filter'>
          {([
            ['all', '全部线路'],
            ['campus_loop', '校内小公交'],
            ['intercampus', '校际校车'],
          ] as Array<[ServiceFilter, string]>).map(([value, label]) => (
            <View
              key={value}
              className={serviceFilter === value ? 'shuttle-type-filter__active' : ''}
              hoverClass='shuttle-type-filter__pressed'
              role='button'
              ariaLabel={`筛选${label}`}
              onClick={() => setServiceFilter(value)}
            >
              {label}
            </View>
          ))}
        </View>

        <View className='shuttle-stop-filter'>
          <View className='shuttle-stop-filter__head'>
            <View>
              <Text>按上下车站筛选</Text>
              <Text>仅显示可按此方向直达的班次</Text>
            </View>
            {!!(originStop || destinationStop) && (
              <View hoverClass='shuttle-stop-filter__pressed' onClick={clearStopFilter}>清除</View>
            )}
          </View>
          <View className='shuttle-stop-filter__body'>
            <Picker
              range={['不限', ...originOptions]}
              value={Math.max(0, ['', ...originOptions].indexOf(originStop))}
              onChange={(event) => selectOrigin(Number(event.detail.value))}
            >
              <View className={`shuttle-stop-filter__station ${originStop ? 'shuttle-stop-filter__station--selected' : ''}`}>
                <Text>出发点</Text>
                <Text>{originStop || '选择上车站'}</Text>
              </View>
            </Picker>
            <View
              className={`shuttle-stop-filter__swap ${originStop && destinationStop ? '' : 'shuttle-stop-filter__swap--disabled'}`}
              hoverClass={originStop && destinationStop ? 'shuttle-stop-filter__pressed' : 'none'}
              role='button'
              ariaLabel='交换出发点和目的地'
              onClick={swapStops}
            >
              ⇄
            </View>
            <Picker
              range={['不限', ...destinationOptions]}
              value={Math.max(0, ['', ...destinationOptions].indexOf(destinationStop))}
              onChange={(event) => selectDestination(Number(event.detail.value))}
            >
              <View className={`shuttle-stop-filter__station shuttle-stop-filter__station--end ${destinationStop ? 'shuttle-stop-filter__station--selected' : ''}`}>
                <Text>目的地</Text>
                <Text>{destinationStop || '选择下车站'}</Text>
              </View>
            </Picker>
          </View>
        </View>

        <View className='shuttle-section-title'>
          <Text>运行线路</Text>
          <Text>{loading ? '查询中' : `${journeys.length} 条`}</Text>
        </View>

        {loading && result.items.length === 0 && (
          <View className='shuttle-loading'>
            {[0, 1].map((item) => <View key={item} />)}
          </View>
        )}

        {!loading && journeys.length === 0 && (
          <View className='shuttle-empty'>
            <View className='shuttle-empty__icon'><View /><View /><View /></View>
            <Text>{originStop || destinationStop ? '没有可直达的班次' : '没有匹配的运行线路'}</Text>
            <Text>{originStop || destinationStop ? '尝试调整上下车站或选择其他日期' : '可以切换校区、类型或选择其他日期'}</Text>
          </View>
        )}

        {journeys.map((journey) => {
          const route = journey.route
          const departureTimes = journey.departureTimes
          const visibleTimes = departureTimes.slice(0, 4)
          const extra = Math.max(0, departureTimes.length - visibleTimes.length)
          return (
            <View
              key={route.id}
              className='shuttle-route-card'
              hoverClass='shuttle-route-card--pressed'
              role='button'
              ariaLabel={`查看${route.name}线路详情`}
              onClick={() => openRoute(journey)}
            >
              <View className='shuttle-route-card__head'>
                <View>
                  <Text className='shuttle-route-card__kind'>
                    {route.service_type === 'campus_loop' ? '校内小公交' : '校际校车'}
                  </Text>
                  <Text className='shuttle-route-card__name'>{route.name}</Text>
                </View>
                <View className={[
                  'shuttle-route-card__next',
                  route.resolved_schedule.suspended ? 'shuttle-route-card__next--off' : '',
                ].filter(Boolean).join(' ')}
                >
                  <Text>{route.resolved_schedule.suspended ? '停运' : nextTime(journey.nextDepartureAt) || '无后续'}</Text>
                  <Text>{route.resolved_schedule.suspended ? '当天' : '下一班'}</Text>
                </View>
              </View>

              <View className='shuttle-route-card__direction'>
                <View className='shuttle-route-card__station'>
                  <View />
                  <Text>{journey.origin}</Text>
                </View>
                <View className='shuttle-route-card__line'>
                  <View />
                  <Text>{journey.stopCount} 站 · 约 {journey.durationMinutes} 分钟</Text>
                  <View />
                </View>
                <View className='shuttle-route-card__station shuttle-route-card__station--end'>
                  <View />
                  <Text>{journey.destination}</Text>
                </View>
              </View>

              <View className='shuttle-route-card__times'>
                {visibleTimes.length ? visibleTimes.map((time) => (
                  <Text key={time}>{time}</Text>
                )) : <Text className='shuttle-route-card__times-empty'>当天暂无发车时间</Text>}
                {extra > 0 && <Text>+{extra}</Text>}
              </View>

              <View className='shuttle-route-card__foot'>
                <Text>{route.campuses.join(' · ')}</Text>
                <Text>查看班次与站点 ›</Text>
              </View>
            </View>
          )
        })}

        <View className='shuttle-page__disclaimer'>
          参考车程为计划值，临时调班和道路拥堵请以学校现场通知为准
        </View>
      </View>
    </View>
  )
}
