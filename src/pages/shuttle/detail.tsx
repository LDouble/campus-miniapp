import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  loadShuttleRoute,
  ShuttleLoadResult,
  ShuttleRoute,
} from '../../features/shuttle/repository'
import './detail.scss'

const dayTypeLabels: Record<string, string> = {
  holiday: '法定节假日',
  special: '特殊运行日',
  vacation: '寒暑假',
  weekend: '周末',
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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function ShuttleDetailPage() {
  const [route, setRoute] = useState<ShuttleRoute | null>(null)
  const [source, setSource] = useState<ShuttleLoadResult['source']>('network')
  const [serviceDate, setServiceDate] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (id: number, date?: string) => {
    setLoading(true)
    try {
      const result = await loadShuttleRoute(id, date)
      setRoute(result.item)
      setSource(result.source)
      setServiceDate(date || result.item?.resolved_schedule.service_date || '')
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
    load(id, options.date)
  })

  const refresh = async () => {
    if (!route) return
    await load(route.id, serviceDate)
    Taro.showToast({ title: '班次已刷新', icon: 'none' })
  }

  const nextTime = route
    ? formatNextDeparture(route.resolved_schedule.next_departure_at)
    : ''

  return (
    <View className='shuttle-detail-page'>
      <CustomNavbar title='线路详情' subtitle='计划班次' showBack />

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
            <View className='shuttle-detail-hero'>
              <View className='shuttle-detail-hero__top'>
                <Text className='shuttle-detail-hero__kind'>
                  {route.service_type === 'campus_loop' ? '校内小公交' : '校际校车'}
                </Text>
                <Text className='shuttle-detail-hero__date'>
                  {formatDate(route.resolved_schedule.service_date)}
                </Text>
              </View>
              <Text className='shuttle-detail-hero__name'>{route.name}</Text>
              <View className='shuttle-detail-hero__direction'>
                <View>
                  <Text>起点</Text>
                  <Text>{route.origin}</Text>
                </View>
                <View className='shuttle-detail-hero__arrow'>
                  <View />
                  <Text>{route.stops.length} 站</Text>
                  <View />
                </View>
                <View>
                  <Text>终点</Text>
                  <Text>{route.destination}</Text>
                </View>
              </View>
              <View className='shuttle-detail-hero__next'>
                <View>
                  <Text>{route.resolved_schedule.suspended ? '当天停运' : nextTime || '当天无后续班次'}</Text>
                  <Text>
                    {dayTypeLabels[route.resolved_schedule.day_type] || route.resolved_schedule.day_type}
                    {' · '}
                    参考车程 {route.reference_duration_minutes} 分钟
                  </Text>
                </View>
                {!route.resolved_schedule.suspended && nextTime && (
                  <Text>下一班</Text>
                )}
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

            <View className='shuttle-detail-panel'>
              <View className='shuttle-detail-panel__head'>
                <View>
                  <Text>当天班次</Text>
                  <Text>{dayTypeLabels[route.resolved_schedule.day_type] || '运行日'}</Text>
                </View>
                <Text>{route.resolved_schedule.departure_times.length} 班</Text>
              </View>
              {route.resolved_schedule.departure_times.length ? (
                <View className='shuttle-detail-times'>
                  {route.resolved_schedule.departure_times.map((time) => (
                    <View
                      key={time}
                      className={time === nextTime ? 'shuttle-detail-times__next' : ''}
                    >
                      <Text>{time}</Text>
                      {time === nextTime && <Text>下一班</Text>}
                    </View>
                  ))}
                </View>
              ) : (
                <View className='shuttle-detail-panel__empty'>当天没有计划班次</View>
              )}
              {route.resolved_schedule.note && (
                <Text className='shuttle-detail-panel__note'>
                  {route.resolved_schedule.note}
                </Text>
              )}
            </View>

            <View className='shuttle-detail-panel'>
              <View className='shuttle-detail-panel__head'>
                <View>
                  <Text>停靠站点</Text>
                  <Text>到站时间为计划偏移，不代表实时位置</Text>
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
                        {index === 0 ? '发车点' : `约 +${stop.offset_minutes} 分钟`}
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
                  <Text>周期班次</Text>
                  <Text>工作日和周末分别配置</Text>
                </View>
              </View>
              <View className='shuttle-weekly-list'>
                {route.schedules.map((schedule) => (
                  <View key={schedule.day_type}>
                    <View className='shuttle-weekly-list__head'>
                      <Text>{dayTypeLabels[schedule.day_type] || schedule.day_type}</Text>
                      <Text>{schedule.departure_times.length} 班</Text>
                    </View>
                    <Text className='shuttle-weekly-list__times'>
                      {schedule.departure_times.length
                        ? schedule.departure_times.join('　')
                        : '停运'}
                    </Text>
                    {schedule.note && <Text className='shuttle-weekly-list__note'>{schedule.note}</Text>}
                  </View>
                ))}
              </View>
            </View>

            {route.notice && (
              <View className='shuttle-detail-notice'>
                <View className='shuttle-detail-notice__mark'>!</View>
                <View>
                  <Text>乘车提示</Text>
                  <Text>{route.notice}</Text>
                </View>
              </View>
            )}

            <View
              className='shuttle-detail-refresh'
              hoverClass='shuttle-detail-refresh--pressed'
              onClick={refresh}
            >
              刷新班次
            </View>
            <Text className='shuttle-detail-disclaimer'>
              本功能不提供车辆实时位置、余座查询和预约服务
            </Text>
          </>
        )}
      </View>
    </View>
  )
}
