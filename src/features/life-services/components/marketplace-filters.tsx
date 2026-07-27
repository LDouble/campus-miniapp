import { useEffect, useMemo, useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import FilterSheet from './filter-sheet'
import './filters.scss'

export type MarketplaceFilterValue = {
  minPriceCents?: number
  maxPriceCents?: number
}

type Props = {
  value: MarketplaceFilterValue
  onChange: (value: MarketplaceFilterValue) => void
}

const quickRanges: Array<{
  key: string
  label: string
  value: MarketplaceFilterValue
}> = [
  { key: 'all', label: '不限价格', value: {} },
  { key: 'under-50', label: '50 元内', value: { maxPriceCents: 5000 } },
  { key: '50-200', label: '50–200 元', value: { minPriceCents: 5000, maxPriceCents: 20000 } },
  { key: 'over-200', label: '200 元以上', value: { minPriceCents: 20000 } },
]

const sameRange = (left: MarketplaceFilterValue, right: MarketplaceFilterValue) => (
  left.minPriceCents === right.minPriceCents
  && left.maxPriceCents === right.maxPriceCents
)

const yuanValue = (cents?: number) => (
  cents === undefined ? '' : String(cents / 100)
)

const rangeSummary = (value: MarketplaceFilterValue) => {
  if (value.minPriceCents !== undefined && value.maxPriceCents !== undefined) {
    return `¥${value.minPriceCents / 100}–¥${value.maxPriceCents / 100}`
  }
  if (value.minPriceCents !== undefined) return `¥${value.minPriceCents / 100} 起`
  if (value.maxPriceCents !== undefined) return `¥${value.maxPriceCents / 100} 内`
  return ''
}

export default function MarketplaceFilters({ value, onChange }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false)
  const [minYuan, setMinYuan] = useState('')
  const [maxYuan, setMaxYuan] = useState('')
  const [validation, setValidation] = useState('')
  const selectedQuickKey = useMemo(
    () => quickRanges.find((item) => sameRange(item.value, value))?.key || 'custom',
    [value.maxPriceCents, value.minPriceCents],
  )

  useEffect(() => {
    if (!sheetVisible) return
    setMinYuan(yuanValue(value.minPriceCents))
    setMaxYuan(yuanValue(value.maxPriceCents))
    setValidation('')
  }, [sheetVisible, value.maxPriceCents, value.minPriceCents])

  const applyCustom = () => {
    const min = minYuan.trim() ? Number(minYuan) : undefined
    const max = maxYuan.trim() ? Number(maxYuan) : undefined
    if (
      (min !== undefined && (!Number.isFinite(min) || min < 0))
      || (max !== undefined && (!Number.isFinite(max) || max < 0))
    ) {
      setValidation('请输入有效的非负价格')
      return
    }
    if (min !== undefined && max !== undefined && min > max) {
      setValidation('最低价不能高于最高价')
      return
    }
    onChange({
      minPriceCents: min === undefined ? undefined : Math.round(min * 100),
      maxPriceCents: max === undefined ? undefined : Math.round(max * 100),
    })
    setSheetVisible(false)
  }

  return (
    <>
      <ScrollView className='filter-quick-scroll' scrollX enhanced showScrollbar={false}>
        <View className='filter-quick-row'>
          {quickRanges.map((range) => (
            <View
              key={range.key}
              className={`filter-chip ${
                selectedQuickKey === range.key ? 'filter-chip--market-active' : ''
              }`}
              hoverClass='filter-chip--pressed'
              onClick={() => onChange(range.value)}
            >
              {range.label}
            </View>
          ))}
          <View
            className={`filter-chip filter-chip--more ${
              selectedQuickKey === 'custom' ? 'filter-chip--market-active' : ''
            }`}
            hoverClass='filter-chip--pressed'
            onClick={() => setSheetVisible(true)}
          >
            {selectedQuickKey === 'custom' ? rangeSummary(value) : '自定义'}
          </View>
        </View>
      </ScrollView>

      {rangeSummary(value) && (
        <View className='filter-applied'>
          <Text>已筛选</Text>
          <View>
            <Text>{rangeSummary(value)}</Text>
            <Text onClick={() => onChange({})}>移除</Text>
          </View>
        </View>
      )}

      <FilterSheet
        visible={sheetVisible}
        title='价格范围'
        onClose={() => setSheetVisible(false)}
        onReset={() => {
          onChange({})
          setSheetVisible(false)
        }}
        onApply={applyCustom}
      >
        <View className='filter-section'>
          <Text className='filter-section__title'>自定义价格</Text>
          <Text className='filter-section__description'>输入商品价格区间，单位为元</Text>
          <View className='price-range'>
            <View>
              <Text>最低价</Text>
              <View className='filter-input'>
                <Text>¥</Text>
                <Input
                  value={minYuan}
                  type='digit'
                  maxlength={8}
                  placeholder='不限'
                  onInput={(event) => {
                    setMinYuan(event.detail.value)
                    setValidation('')
                  }}
                />
              </View>
            </View>
            <Text className='price-range__divider'>至</Text>
            <View>
              <Text>最高价</Text>
              <View className='filter-input'>
                <Text>¥</Text>
                <Input
                  value={maxYuan}
                  type='digit'
                  maxlength={8}
                  placeholder='不限'
                  onInput={(event) => {
                    setMaxYuan(event.detail.value)
                    setValidation('')
                  }}
                />
              </View>
            </View>
          </View>
          {validation && <Text className='filter-validation'>{validation}</Text>}
        </View>
      </FilterSheet>
    </>
  )
}
