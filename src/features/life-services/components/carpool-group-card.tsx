import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import {
  lifeServicesRepository,
  type CarpoolSearch,
  type CarpoolTripGroup,
} from '../repository'
import { formatDateTime } from '../format'
import BusinessRoute from './business-route'
import CarpoolCard from './carpool-card'

const chevronIcon = require('../../../assets/icons/academic-chevron-down.svg')

type Props = {
  group: CarpoolTripGroup
  search: CarpoolSearch
}

const departureRange = (group: CarpoolTripGroup) => {
  const start = formatDateTime(group.departure_start)
  const end = formatDateTime(group.departure_end)
  return start === end ? start : `${start}–${end}`
}

export default function CarpoolGroupCard({ group, search }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [trips, setTrips] = useState(group.trips)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(group.trip_count)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const count = group.trip_count || group.trips.length
  const canLoadMore = trips.length < total

  const loadTrips = async (nextPage: number, append: boolean) => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const result = await lifeServicesRepository.listCarpoolGroupTrips(
        group.anchor_trip_id,
        { ...search, page: nextPage },
      )
      setTrips((current) => append ? [...current, ...result.items] : result.items)
      setPage(result.page)
      setTotal(Number(result.total))
    } catch {
      setError('加载行程失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = () => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (nextExpanded && group.has_more && page === 0) void loadTrips(1, false)
  }

  return (
    <View className={`carpool-group-card${expanded ? ' carpool-group-card--expanded' : ''}`}>
      <View
        className='carpool-group-card__summary'
        ariaRole='button'
        ariaLabel={`${expanded ? '收起' : '展开'}这组同行行程`}
        onClick={toggleExpanded}
      >
        <BusinessRoute
          startLabel='出发地'
          start={group.origin}
          endLabel='目的地'
          end={group.destination}
        />
        <View className='carpool-group-card__meta'>
          <Text>{departureRange(group)} 出发</Text>
          <Text>{count} 条同行行程</Text>
        </View>
        <View className='carpool-group-card__toggle'>
          <Text>{expanded ? '收起这组行程' : '查看这组行程'}</Text>
          <Image
            className={expanded ? 'carpool-group-card__chevron carpool-group-card__chevron--expanded' : 'carpool-group-card__chevron'}
            src={chevronIcon}
            mode='aspectFit'
          />
        </View>
      </View>
      {expanded && (
        <View className='carpool-group-card__trips'>
          {trips.map((item) => <CarpoolCard key={item.id} item={item} />)}
          {loading && <View className='carpool-group-card__state'>正在加载行程</View>}
          {!loading && error && (
            <View className='carpool-group-card__state carpool-group-card__state--error'>
              <Text>{error}</Text>
              <Text onClick={() => void loadTrips(page || 1, page > 0)}>重新加载</Text>
            </View>
          )}
          {!loading && !error && canLoadMore && (
            <View
              className='carpool-group-card__load-more'
              ariaRole='button'
              ariaLabel='加载更多同行行程'
              onClick={() => void loadTrips(page + 1, true)}
            >
              继续加载
            </View>
          )}
        </View>
      )}
    </View>
  )
}
