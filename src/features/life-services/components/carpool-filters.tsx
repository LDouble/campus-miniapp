import { useEffect, useMemo, useState } from 'react'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import {
  getRecentRouteValues,
  rememberRoutePair,
  ROUTE_SHORTCUTS,
  type RouteHistoryKind,
} from '../route-history'
import FilterSheet from './filter-sheet'
import './filters.scss'

export type CarpoolFilterValue = {
  origin?: string
  destination?: string
  departureDate?: string
  seatsNeeded?: number
}

type Props = {
  value: CarpoolFilterValue
  onChange: (value: CarpoolFilterValue) => void
}

const localDate = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const activeFilterCount = (value: CarpoolFilterValue) => (
  [
    value.origin,
    value.destination,
    value.departureDate,
    value.seatsNeeded,
  ].filter((item) => item !== undefined && item !== '').length
)

const RouteFilterSuggestions = ({
  kind,
  value,
  onSelect,
}: {
  kind: RouteHistoryKind
  value?: string
  onSelect: (value: string) => void
}) => {
  const recent = getRecentRouteValues(kind).filter(
    (item) => !ROUTE_SHORTCUTS.some((shortcut) => shortcut === item),
  )
  const options = [...ROUTE_SHORTCUTS, ...recent]

  return (
    <View className='route-filter-suggestions'>
      <Text>{kind === 'origin' ? '起点常用' : '终点常用'}</Text>
      <ScrollView
        className='route-filter-suggestions__scroll'
        scrollX
        enhanced
        showScrollbar={false}
      >
        <View className='route-filter-suggestions__row'>
          {options.map((item) => (
            <View
              key={item}
              className={value === item
                ? 'route-filter-suggestion route-filter-suggestion--active'
                : 'route-filter-suggestion'}
              hoverClass='route-filter-suggestion--pressed'
              ariaRole='button'
              ariaLabel={`将${kind === 'origin' ? '起点' : '终点'}设为${item}`}
              onClick={() => onSelect(item)}
            >
              {item}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

export default function CarpoolFilters({ value, onChange }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false)
  const [draft, setDraft] = useState<CarpoolFilterValue>(value)
  const today = useMemo(() => localDate(0), [])
  const tomorrow = useMemo(() => localDate(1), [])
  const count = activeFilterCount(value)

  useEffect(() => {
    if (sheetVisible) {
      setDraft({
        origin: value.origin,
        destination: value.destination,
        departureDate: value.departureDate,
        seatsNeeded: value.seatsNeeded,
      })
    }
  }, [
    sheetVisible,
    value.departureDate,
    value.destination,
    value.origin,
    value.seatsNeeded,
  ])

  const summaries = [
    value.origin ? { key: 'origin', label: `从 ${value.origin}` } : null,
    value.destination ? { key: 'destination', label: `到 ${value.destination}` } : null,
    value.departureDate ? { key: 'departureDate', label: value.departureDate } : null,
    value.seatsNeeded ? { key: 'seatsNeeded', label: `${value.seatsNeeded} 人同行` } : null,
  ].filter(Boolean) as Array<{ key: keyof CarpoolFilterValue; label: string }>

  return (
    <>
      <ScrollView className='filter-quick-scroll' scrollX enhanced showScrollbar={false}>
        <View className='filter-quick-row'>
          <View
            className={`filter-chip ${
              !value.departureDate ? 'filter-chip--carpool-active' : ''
            }`}
            hoverClass='filter-chip--pressed'
            onClick={() => onChange({ ...value, departureDate: undefined })}
          >
            不限日期
          </View>
          <View
            className={`filter-chip ${
              value.departureDate === today ? 'filter-chip--carpool-active' : ''
            }`}
            hoverClass='filter-chip--pressed'
            onClick={() => onChange({ ...value, departureDate: today })}
          >
            今天
          </View>
          <View
            className={`filter-chip ${
              value.departureDate === tomorrow ? 'filter-chip--carpool-active' : ''
            }`}
            hoverClass='filter-chip--pressed'
            onClick={() => onChange({ ...value, departureDate: tomorrow })}
          >
            明天
          </View>
          <View
            className={`filter-chip filter-chip--more ${
              count > 0 ? 'filter-chip--carpool-active' : ''
            }`}
            hoverClass='filter-chip--pressed'
            onClick={() => setSheetVisible(true)}
          >
            筛选{count > 0 ? ` ${count}` : ''}
          </View>
        </View>
      </ScrollView>

      {summaries.length > 0 && (
        <ScrollView className='filter-applied-scroll' scrollX enhanced showScrollbar={false}>
          <View className='filter-applied filter-applied--carpool'>
            <Text>已筛选</Text>
            {summaries.map((item) => (
              <View key={item.key}>
                <Text>{item.label}</Text>
                <Text
                  onClick={() => onChange({ ...value, [item.key]: undefined })}
                >
                  移除
                </Text>
              </View>
            ))}
            <Text className='filter-applied__clear' onClick={() => onChange({})}>
              清除全部
            </Text>
          </View>
        </ScrollView>
      )}

      <FilterSheet
        visible={sheetVisible}
        title='筛选同行计划'
        onClose={() => setSheetVisible(false)}
        onReset={() => {
          onChange({})
          setSheetVisible(false)
        }}
        onApply={() => {
          const origin = draft.origin?.trim() || ''
          const destination = draft.destination?.trim() || ''
          rememberRoutePair(origin, destination)
          onChange({
            origin: origin || undefined,
            destination: destination || undefined,
            departureDate: draft.departureDate,
            seatsNeeded: draft.seatsNeeded,
          })
          setSheetVisible(false)
        }}
      >
        <View className='filter-section'>
          <Text className='filter-section__title'>出发路线</Text>
          <Text className='filter-section__description'>地点可只填写其中一项</Text>
          <View className='route-filter-fields'>
            <View className='route-filter-field'>
              <Text>起</Text>
              <KeyboardSafeInput
                value={draft.origin || ''}
                maxlength={60}
                placeholder='输入起点'
                onInput={(event) => setDraft((current) => ({
                  ...current,
                  origin: event.detail.value,
                }))}
              />
            </View>
            <RouteFilterSuggestions
              kind='origin'
              value={draft.origin}
              onSelect={(origin) => setDraft((current) => ({ ...current, origin }))}
            />
            <View className='route-filter-field route-filter-field--destination'>
              <Text>终</Text>
              <KeyboardSafeInput
                value={draft.destination || ''}
                maxlength={60}
                placeholder='输入终点'
                onInput={(event) => setDraft((current) => ({
                  ...current,
                  destination: event.detail.value,
                }))}
              />
            </View>
            <RouteFilterSuggestions
              kind='destination'
              value={draft.destination}
              onSelect={(destination) => setDraft((current) => ({ ...current, destination }))}
            />
          </View>
        </View>

        <View className='filter-section'>
          <Text className='filter-section__title'>出发日期</Text>
          <Picker
            mode='date'
            value={draft.departureDate || today}
            start={today}
            onChange={(event) => setDraft((current) => ({
              ...current,
              departureDate: event.detail.value,
            }))}
          >
            <View className='date-filter-picker'>
              <Text>{draft.departureDate || '不限日期'}</Text>
              <Text>选择日期</Text>
            </View>
          </Picker>
          {draft.departureDate && (
            <View
              className='filter-inline-clear'
              onClick={() => setDraft((current) => ({
                ...current,
                departureDate: undefined,
              }))}
            >
              清除日期
            </View>
          )}
        </View>

        <View className='filter-section'>
          <Text className='filter-section__title'>同行人数</Text>
          <View className='seat-filter-options'>
            {[
              { label: '不限', value: undefined },
              { label: '1 人', value: 1 },
              { label: '2 人', value: 2 },
              { label: '3 人及以上', value: 3 },
            ].map((option) => (
              <View
                key={option.label}
                className={
                  draft.seatsNeeded === option.value
                    ? 'seat-filter-option seat-filter-option--active'
                    : 'seat-filter-option'
                }
                onClick={() => setDraft((current) => ({
                  ...current,
                  seatsNeeded: option.value,
                }))}
              >
                {option.label}
              </View>
            ))}
          </View>
        </View>
      </FilterSheet>
    </>
  )
}
