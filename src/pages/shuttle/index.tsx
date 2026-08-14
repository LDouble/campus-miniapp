import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
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
  ShuttleRoute,
} from '../../features/shuttle/repository'
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

const nextTime = (route: ShuttleRoute) => {
  const value = route.resolved_schedule.next_departure_at
  if (!value) return ''
  const parts = apiDateTimeCampusParts(value)
  return parts ? parts.time : ''
}

const minutesUntil = (route: ShuttleRoute) => {
  const value = route.resolved_schedule.next_departure_at
  if (!value) return null
  const milliseconds = apiDateTimeTimestamp(value) - Date.now()
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null
  return Math.max(1, Math.ceil(milliseconds / 60000))
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

const validServiceFilter = (value?: string): ServiceFilter | undefined => (
  value === 'campus_loop' || value === 'intercampus' ? value : undefined
)

export default function ShuttlePage() {
  const bootstrap = getMiniappRuntimeConfig()
  const [campuses, setCampuses] = useState(() => enabledCampuses(bootstrap))
  const [campus, setCampus] = useState(() => getSelectedCampus(bootstrap))
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all')
  const [serviceDate, setServiceDate] = useState(() => shuttleDateKey(new Date()))
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
    if (nextDate) setServiceDate(nextDate)
    if (nextServiceFilter) setServiceFilter(nextServiceFilter)
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

  const nextRoute = useMemo(() => (
    result.items
      .filter((item) => item.resolved_schedule.next_departure_at)
      .sort((left, right) => (
        apiDateTimeTimestamp(left.resolved_schedule.next_departure_at)
        - apiDateTimeTimestamp(right.resolved_schedule.next_departure_at)
      ))[0]
  ), [result.items])

  const openRoute = (route: ShuttleRoute) => {
    Taro.navigateTo({
      url: `/pages/shuttle/detail?id=${route.id}&date=${serviceDate}`,
    })
  }

  return (
    <View className='shuttle-page'>
      <CustomNavbar title='校园校车' subtitle='静态班次查询' showBack />

      <View className='shuttle-page__content'>
        <View className='shuttle-hero'>
          <View className='shuttle-hero__eyebrow'>
            <View />
            <Text>下一班</Text>
          </View>
          {nextRoute ? (
            <>
              <View className='shuttle-hero__main'>
                <View>
                  <Text className='shuttle-hero__time'>{nextTime(nextRoute)}</Text>
                  <Text className='shuttle-hero__countdown'>
                    {minutesUntil(nextRoute)
                      ? `${minutesUntil(nextRoute)} 分钟后发车`
                      : '后续班次'}
                  </Text>
                </View>
                <View className='shuttle-hero__type'>
                  {nextRoute.service_type === 'campus_loop' ? '校内' : '校际'}
                </View>
              </View>
              <Text className='shuttle-hero__route'>{nextRoute.name}</Text>
              <Text className='shuttle-hero__direction'>
                {nextRoute.origin} → {nextRoute.destination}
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
          {[0, 1].map((offset) => {
            const date = new Date()
            date.setHours(0, 0, 0, 0)
            date.setDate(date.getDate() + offset)
            return (
              <View
                key={offset}
                className={serviceDate === shuttleDateKey(date) ? 'shuttle-date-tabs__active' : ''}
                onClick={() => setServiceDate(shuttleDateKey(date))}
              >
                <Text>{dayLabel(date, offset)}</Text>
                <Text>{date.getMonth() + 1}月{date.getDate()}日</Text>
              </View>
            )
          })}
        </View>

        <ScrollView className='shuttle-campus-filter' scrollX enhanced showScrollbar={false}>
          <View
            className={campus === '全部校区' ? 'shuttle-campus-filter__active' : ''}
            onClick={() => setCampus('全部校区')}
          >
            全部校区
          </View>
          {campuses.map((item) => (
            <View
              key={item}
              className={campus === item ? 'shuttle-campus-filter__active' : ''}
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
              onClick={() => setServiceFilter(value)}
            >
              {label}
            </View>
          ))}
        </View>

        <View className='shuttle-section-title'>
          <Text>运行线路</Text>
          <Text>{loading ? '查询中' : `${result.items.length} 条`}</Text>
        </View>

        {loading && result.items.length === 0 && (
          <View className='shuttle-loading'>
            {[0, 1].map((item) => <View key={item} />)}
          </View>
        )}

        {!loading && result.items.length === 0 && (
          <View className='shuttle-empty'>
            <View className='shuttle-empty__icon'><View /><View /><View /></View>
            <Text>没有匹配的运行线路</Text>
            <Text>可以切换校区、类型或查看明天班次</Text>
          </View>
        )}

        {result.items.map((route) => {
          const departureTimes = route.resolved_schedule.departure_times
          const visibleTimes = departureTimes.slice(0, 4)
          const extra = Math.max(0, departureTimes.length - visibleTimes.length)
          return (
            <View
              key={route.id}
              className='shuttle-route-card'
              hoverClass='shuttle-route-card--pressed'
              onClick={() => openRoute(route)}
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
                  <Text>{route.resolved_schedule.suspended ? '停运' : nextTime(route) || '无后续'}</Text>
                  <Text>{route.resolved_schedule.suspended ? '当天' : '下一班'}</Text>
                </View>
              </View>

              <View className='shuttle-route-card__direction'>
                <View className='shuttle-route-card__station'>
                  <View />
                  <Text>{route.origin}</Text>
                </View>
                <View className='shuttle-route-card__line'>
                  <View />
                  <Text>{route.stops.length} 站 · 约 {route.reference_duration_minutes} 分钟</Text>
                  <View />
                </View>
                <View className='shuttle-route-card__station shuttle-route-card__station--end'>
                  <View />
                  <Text>{route.destination}</Text>
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
