import { Text, View } from '@tarojs/components'

type BusinessRouteProps = {
  startLabel: string
  start: string
  endLabel: string
  end: string
  variant?: 'card' | 'detail'
}

export default function BusinessRoute({
  startLabel,
  start,
  endLabel,
  end,
  variant = 'card',
}: BusinessRouteProps) {
  const isDetail = variant === 'detail'
  const rootClass = isDetail
    ? 'detail-route detail-route--horizontal'
    : 'business-route'
  const placeClass = isDetail ? 'detail-route__place' : 'business-route__place'
  const trackClass = isDetail ? 'detail-route__rail' : 'business-route__track'

  return (
    <View className={rootClass}>
      <View className={trackClass}><View /><View /><View /></View>
      <View className={placeClass}>
        <Text>{startLabel}</Text>
        <Text>{start}</Text>
      </View>
      <View className={isDetail
        ? placeClass
        : `${placeClass} business-route__place--destination`}
      >
        <Text>{endLabel}</Text>
        <Text>{end}</Text>
      </View>
    </View>
  )
}
