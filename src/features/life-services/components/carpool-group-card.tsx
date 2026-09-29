import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { CarpoolTripGroup } from '../repository'
import { formatDateTime } from '../format'
import BusinessRoute from './business-route'
import CarpoolCard from './carpool-card'

const chevronIcon = require('../../../assets/icons/academic-chevron-down.svg')

type Props = {
  group: CarpoolTripGroup
}

const departureRange = (group: CarpoolTripGroup) => {
  const start = formatDateTime(group.departure_start)
  const end = formatDateTime(group.departure_end)
  return start === end ? start : `${start}–${end}`
}

export default function CarpoolGroupCard({ group }: Props) {
  const [expanded, setExpanded] = useState(false)
  const count = group.trip_count || group.trips.length

  return (
    <View className={`carpool-group-card${expanded ? ' carpool-group-card--expanded' : ''}`}>
      <View
        className='carpool-group-card__summary'
        ariaRole='button'
        ariaLabel={`${expanded ? '收起' : '展开'}这组同行行程`}
        onClick={() => setExpanded((current) => !current)}
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
          {group.trips.map((item) => <CarpoolCard key={item.id} item={item} />)}
        </View>
      )}
    </View>
  )
}
