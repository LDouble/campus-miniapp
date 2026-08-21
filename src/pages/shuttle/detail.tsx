import { useMemo, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { apiDateTimeCampusParts } from '../../utils/date-time'
import {
  loadShuttleRoute,
  ShuttleLoadResult,
  ShuttleRoute,
} from '../../features/shuttle/repository'
import { filterShuttleJourneys } from '../../features/shuttle/local-filter'
import { useCampusShare } from '../../features/share'
import './detail.scss'

const dayTypeLabels: Record<string, string> = {
  holiday: '法定节假日',
  saturday: '周六',
  special: '特殊运行日',
  sunday: '周日',
  vacation: '寒暑假',
  workday: '工作日',
}

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`
}

const formatNextDeparture = (value?: string | null) => {
  if (!value) return ''
  const parts = apiDateTimeCampusParts(value)
  return parts ? parts.time : ''
}

type DetailTab = 'schedule' | 'route'

const minutesUntilDeparture = (value?: string | null) => {
  if (!value) return null
  const difference = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(difference) || difference < 0) return null
  return Math.max(1, Math.ceil(difference / 60000))
}

const compareDateKey = (left: string, right: string) => left.localeCompare(right)

const validStopName = (value?: string) => {
  if (!value) return ''
  try {
    const normalized = decodeURIComponent(value).trim()
    return normalized.length <= 80 ? normalized : ''
  } catch {
    return ''
  }
}

export default function ShuttleDetailPage() {
  const [route, setRoute] = useState<ShuttleRoute | null>(null)
  const [source, setSource] = useState<ShuttleLoadResult['source']>('network')
  const [serviceDate, setServiceDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DetailTab>('schedule')
  const [selectedDeparture, setSelectedDeparture] = useState('')
  const [originStop, setOriginStop] = useState('')
  const [destinationStop, setDestinationStop] = useState('')

  const journey = useMemo(() => {
    if (!route) return null
    const date = serviceDate || route.resolved_schedule.service_date
    return filterShuttleJourneys(
      [route],
      date,
      originStop || undefined,
      destinationStop || undefined,
    )[0] || null
  }, [destinationStop, originStop, route, serviceDate])

  useCampusShare(() => ({
    title: route
      ? `${route.name}｜${journey?.origin || route.origin} → ${journey?.destination || route.destination}`
      : '校园校车｜OUSea',
    path: route ? '/pages/shuttle/detail' : '/pages/shuttle/index',
    query: route ? {
      id: route.id,
      date: serviceDate,
      from: originStop || undefined,
      to: destinationStop || undefined,
    } : undefined,
  }))

  const load = async (id: number, date?: string, from?: string, to?: string) => {
    setLoading(true)
    try {
      const result = await loadShuttleRoute(id, date)
      const nextDate = date || result.item?.resolved_schedule.service_date || ''
      const nextJourney = result.item
        ? filterShuttleJourneys([result.item], nextDate, from || undefined, to || undefined)[0]
        : null
      setRoute(result.item)
      setSource(result.source)
      setServiceDate(nextDate)
      setOriginStop(from || '')
      setDestinationStop(to || '')
      const preferredDeparture = formatNextDeparture(
        nextJourney?.nextDepartureAt,
      )
      setSelectedDeparture(
        preferredDeparture
        || nextJourney?.departureTimes[0]
        || '',
      )
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    const id = Number(options.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      setLoading(false)
      return
    }
    load(id, options.date, validStopName(options.from), validStopName(options.to))
  })

  const refresh = async () => {
    if (!route) return
    await load(route.id, serviceDate, originStop, destinationStop)
    Taro.showToast({ title: '班次已刷新', icon: 'none' })
  }

  const nextTime = journey
    ? formatNextDeparture(journey.nextDepartureAt)
    : ''
  const minutesUntilNext = journey
    ? minutesUntilDeparture(journey.nextDepartureAt)
    : null

  const departureGroups = useMemo(() => {
    if (!route || !journey) return { passed: [], next: '', pending: [] }
    const times = journey.departureTimes
    const nextIndex = nextTime ? times.indexOf(nextTime) : -1
    if (nextIndex >= 0) {
      return {
        passed: times.slice(0, nextIndex),
        next: times[nextIndex],
        pending: times.slice(nextIndex + 1),
      }
    }
    const today = new Date()
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    return compareDateKey(route.resolved_schedule.service_date, todayKey) <= 0
      ? { passed: times, next: '', pending: [] }
      : { passed: [], next: '', pending: times }
  }, [journey, nextTime, route])
  const selectedJourneyTrip = useMemo(() => {
    const trips = journey?.trips || []
    return trips.find((trip) => trip.departureTime === selectedDeparture)
      || trips.find((trip) => trip.departureTime === nextTime)
      || trips[0]
      || null
  }, [journey, nextTime, selectedDeparture])
  const selectedTrip = selectedJourneyTrip?.trip || null
  const selectedStopTimes = selectedJourneyTrip
    ? selectedJourneyTrip.trip.stop_times.slice(
      selectedJourneyTrip.fromIndex,
      selectedJourneyTrip.toIndex + 1,
    )
    : []

  const selectDeparture = (time: string) => {
    setSelectedDeparture(time)
  }

  return (
    <View className='shuttle-detail-page'>
      <CustomNavbar title='班次详情' showBack />

      <View className='shuttle-detail-page__content'>
        {loading && !route && (
          <View className='shuttle-detail-loading'>
            <View />
            <View />
            <View />
          </View>
        )}

        {!loading && !route && (
          <View className='shuttle-detail-empty'>
            <View />
            <Text>线路不存在或已停用</Text>
            <Text onClick={() => Taro.navigateBack()}>返回校车列表</Text>
          </View>
        )}

        {route && (
          <>
            <View className={`shuttle-detail-hero shuttle-detail-hero--${route.service_type}`}>
              <View className='shuttle-detail-hero__top'>
                <View className='shuttle-detail-hero__kind'>
                  <View className='shuttle-detail-hero__bus'>
                    <Image src={require('../../assets/icons/shuttle-figma-white.svg')} mode='aspectFit' />
                  </View>
                  <Text>{route.service_type === 'campus_loop' ? '校内接驳线路' : '跨校区线路'}</Text>
                </View>
              </View>
              <Text className='shuttle-detail-hero__name'>{route.name}</Text>
              <Text className='shuttle-detail-hero__date'>
                {formatDate(route.resolved_schedule.service_date)}
                {' · '}
                {dayTypeLabels[route.resolved_schedule.day_type] || route.resolved_schedule.day_type}
              </Text>
              <View className='shuttle-detail-hero__direction'>
                <View>
                  <Text>出发地</Text>
                  <Text>{journey?.origin || route.origin}</Text>
                </View>
                <View className='shuttle-detail-hero__arrow'>
                  <View />
                  <Text>→</Text>
                  <View />
                </View>
                <View>
                  <Text>目的地</Text>
                  <Text>{journey?.destination || route.destination}</Text>
                </View>
              </View>
              <View className='shuttle-detail-hero__next'>
                <View>
                  <Text>下一班发车</Text>
                  <Text>{route.resolved_schedule.suspended ? '停运' : nextTime || '暂无'}</Text>
                </View>
                <View>
                  <Text>距现在</Text>
                  <Text>{minutesUntilNext ? `${minutesUntilNext} 分钟` : '—'}</Text>
                </View>
              </View>
            </View>

            {source !== 'network' && (
              <View className='shuttle-detail-source'>
                <View />
                <Text>
                  {source === 'cache'
                    ? '当前展示上次成功获取的线路配置'
                    : '网络暂不可用，暂时无法获取线路配置'}
                </Text>
              </View>
            )}

            <View className='shuttle-detail-tabs'>
              {([
                ['schedule', '当日班次'],
                ['route', '路线信息'],
              ] as Array<[DetailTab, string]>).map(([value, label]) => (
                <View
                  key={value}
                  className={activeTab === value ? 'shuttle-detail-tabs__active' : ''}
                  role='button'
                  ariaLabel={`查看${label}`}
                  onClick={() => setActiveTab(value)}
                >
                  {label}
                </View>
              ))}
            </View>

            {activeTab === 'schedule' && (
              <View className='shuttle-detail-panel shuttle-detail-panel--schedule'>
                <View className='shuttle-detail-panel__head'>
                  <View>
                    <Text>当天发车时间</Text>
                    <Text>点击班次查看每一站的具体时间</Text>
                  </View>
                  <Text>{journey?.departureTimes.length || 0} 班</Text>
                </View>
                {!journey?.departureTimes.length ? (
                  <View className='shuttle-detail-panel__empty'>当天没有计划班次</View>
                ) : (
                  <View className='shuttle-departure-groups'>
                    {!!departureGroups.passed.length && (
                      <View className='shuttle-departure-group shuttle-departure-group--passed'>
                        <Text>已发班次</Text>
                        <View className='shuttle-detail-times'>
                          {departureGroups.passed.map((time) => (
                            <View
                              key={time}
                              className={selectedJourneyTrip?.departureTime === time ? 'shuttle-detail-times__selected' : ''}
                              onClick={() => selectDeparture(time)}
                            >
                              {time}
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    {!!departureGroups.next && (
                      <View className='shuttle-departure-group'>
                        <Text>即将发车</Text>
                        <View
                          className={`shuttle-departure-next ${selectedJourneyTrip?.departureTime === departureGroups.next ? 'shuttle-departure-next--selected' : ''}`}
                          onClick={() => selectDeparture(departureGroups.next)}
                        >
                          <View><View /><Text>{departureGroups.next}</Text></View>
                          <Text>{minutesUntilNext ? `${minutesUntilNext} 分钟后` : '下一班'}</Text>
                        </View>
                      </View>
                    )}
                    {!!departureGroups.pending.length && (
                      <View className='shuttle-departure-group'>
                        <Text>待发班次</Text>
                        <View className='shuttle-detail-times'>
                          {departureGroups.pending.map((time) => (
                            <View
                              key={time}
                              className={selectedJourneyTrip?.departureTime === time ? 'shuttle-detail-times__selected' : ''}
                              onClick={() => selectDeparture(time)}
                            >
                              {time}
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
                {selectedTrip && (
                  <View className='shuttle-trip-detail'>
                    <View className='shuttle-trip-detail__head'>
                      <View>
                        <Text>{selectedTrip.label || `${selectedJourneyTrip?.departureTime} 班次`}</Text>
                        <Text>逐站计划时间</Text>
                      </View>
                      <Text>{selectedStopTimes.length} 站</Text>
                    </View>
                    <View className='shuttle-trip-detail__stops'>
                      {selectedStopTimes.map((stopTime, index) => (
                        <View key={`${stopTime.stop_name}-${stopTime.time}`}>
                          <View className='shuttle-trip-detail__rail'>
                            <View />
                            {index < selectedStopTimes.length - 1 && <View />}
                          </View>
                          <Text>{stopTime.stop_name}</Text>
                          <Text>{stopTime.time}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {route.resolved_schedule.note && (
                  <Text className='shuttle-detail-panel__note'>{route.resolved_schedule.note}</Text>
                )}
              </View>
            )}

            {activeTab === 'route' && (
              <>
                <View className='shuttle-detail-panel'>
                  <View className='shuttle-detail-panel__head'>
                    <View>
                      <Text>经停站点</Text>
                      <Text>{route.stops.length} 个站点 · 参考车程 {route.reference_duration_minutes} 分钟</Text>
                    </View>
                  </View>
                  <View className='shuttle-stop-list'>
                    {route.stops.map((stop, index) => (
                      <View key={`${stop.name}-${index}`} className='shuttle-stop-list__item'>
                        <View className='shuttle-stop-list__rail'>
                          <View />
                          {index < route.stops.length - 1 && <View />}
                        </View>
                        <View className='shuttle-stop-list__content'>
                          <View>
                            <Text>{stop.name}</Text>
                            <Text>{stop.campus}</Text>
                          </View>
                          <Text>
                            {index === 0
                              ? '起点'
                              : index === route.stops.length - 1
                                ? '终点'
                                : '经停站'}
                          </Text>
                        </View>
                        {stop.note && <Text className='shuttle-stop-list__note'>{stop.note}</Text>}
                      </View>
                    ))}
                  </View>
                </View>

                <View className='shuttle-detail-panel'>
                  <View className='shuttle-detail-panel__head'>
                    <View>
                      <Text>运行周期</Text>
                      <Text>不同日期可能执行不同班次</Text>
                    </View>
                  </View>
                  <View className='shuttle-weekly-list'>
                    {route.schedules.map((schedule) => (
                      <View key={schedule.day_type}>
                        <View className='shuttle-weekly-list__head'>
                          <Text>{dayTypeLabels[schedule.day_type] || schedule.day_type}</Text>
                          <Text>{schedule.trips.length} 班</Text>
                        </View>
                        <Text className='shuttle-weekly-list__times'>
                          {schedule.trips.length
                            ? schedule.trips
                              .map((trip) => trip.stop_times[0]?.time)
                              .filter(Boolean)
                              .join('　')
                            : '停运'}
                        </Text>
                        {schedule.note && <Text className='shuttle-weekly-list__note'>{schedule.note}</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            {route.notice && (
              <View className='shuttle-detail-notice'>
                <View className='shuttle-detail-notice__mark'>!</View>
                <View>
                  <Text>乘车提示</Text>
                  <Text>{route.notice}</Text>
                </View>
              </View>
            )}

            <Text className='shuttle-detail-disclaimer'>
              本功能不提供车辆实时位置、余座查询和预约服务
            </Text>

            <View className='shuttle-detail-actions'>
              <Button
                hoverClass='none'
                className='shuttle-detail-actions__share'
                openType='share'
                ariaLabel='分享当前校车路线'
              >
                分享路线
              </Button>
              <View
                className='shuttle-detail-actions__refresh'
                role='button'
                ariaLabel='刷新当前线路班次'
                onClick={refresh}
              >
                {loading ? '刷新中…' : '刷新班次'}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
