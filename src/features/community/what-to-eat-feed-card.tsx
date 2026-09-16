import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { FoodListing } from '../../api/what-to-eat'
import './what-to-eat-feed-card.scss'

const icon = require('../../assets/icons/what-to-eat.svg')

type Props = {
  item: FoodListing
  picking?: boolean
  onPick: () => void
  onOpen: () => void
}

export default function WhatToEatFeedCard({ item, picking = false, onPick, onOpen }: Props) {
  return (
    <View className='what-to-eat-feed-card' role='button' onClick={onOpen}>
      <View className='what-to-eat-feed-card__head'>
        <View className='what-to-eat-feed-card__eyebrow'>
          <View className='what-to-eat-feed-card__spark' aria-hidden />
          <Text>今天吃什么</Text>
        </View>
        <Text className='what-to-eat-feed-card__campus'>{item.campus}</Text>
      </View>
      <View className='what-to-eat-feed-card__body'>
        {item.image_urls[0]
          ? <Image className='what-to-eat-feed-card__image' src={item.image_urls[0]} mode='aspectFill' />
          : <View className='what-to-eat-feed-card__placeholder' aria-hidden><Image src={icon} mode='aspectFit' /></View>}
        <View className='what-to-eat-feed-card__info'>
          <Text className='what-to-eat-feed-card__name'>{item.name}</Text>
          <Text className='what-to-eat-feed-card__meta'>{item.category} · {item.location}</Text>
          <Text className='what-to-eat-feed-card__copy'>不纠结，今天就吃这个</Text>
        </View>
      </View>
      <View className='what-to-eat-feed-card__foot'>
        <View
          className='what-to-eat-feed-card__action what-to-eat-feed-card__action--secondary'
          role='button'
          onClick={(event) => {
            event.stopPropagation()
            onPick()
          }}
        >
          {picking ? '换个口味…' : '换一个'}
        </View>
        <View
          className='what-to-eat-feed-card__action'
          role='button'
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          看看详情
        </View>
      </View>
    </View>
  )
}

export const openWhatToEatDetail = (item: Pick<FoodListing, 'id'>) => {
  void Taro.navigateTo({ url: `/pages/what-to-eat/detail?id=${item.id}` })
}
