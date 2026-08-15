import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import FilterSheet from './filter-sheet'
import './filters.scss'

export type MarketplaceFilterValue = {
  intent?: 'sell' | 'wanted'
  category?: 'general' | 'course_material'
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

const intentOptions: Array<{
  key: 'all' | 'sell' | 'wanted'
  label: string
}> = [
  { key: 'all', label: '全部' },
  { key: 'sell', label: '出售' },
  { key: 'wanted', label: '求购' },
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
    [value],
  )
  const selectedPriceLabel = selectedQuickKey === 'all'
    ? '不限'
    : selectedQuickKey === 'custom'
      ? rangeSummary(value)
      : quickRanges.find((item) => item.key === selectedQuickKey)?.label || '不限'
  const draftQuickKey = quickRanges.find((item) => (
    yuanValue(item.value.minPriceCents) === minYuan.trim()
    && yuanValue(item.value.maxPriceCents) === maxYuan.trim()
  ))?.key || 'custom'

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
      intent: value.intent,
      category: value.category,
      minPriceCents: min === undefined ? undefined : Math.round(min * 100),
      maxPriceCents: max === undefined ? undefined : Math.round(max * 100),
    })
    setSheetVisible(false)
  }

  return (
    <>
      <View className='market-filter-toolbar'>
        <View className='market-intent-switch' ariaRole='tablist'>
          {intentOptions.map((option) => (
            <View
              key={option.key}
              className={(value.intent || 'all') === option.key
                ? 'market-intent-switch__item market-intent-switch__item--active'
                : 'market-intent-switch__item'}
              hoverClass='market-filter-control--pressed'
              ariaRole='button'
              ariaLabel={`${(value.intent || 'all') === option.key ? '已选择，' : ''}${option.label}`}
              onClick={() => onChange({
                ...value,
                intent: option.key === 'all' ? undefined : option.key,
              })}
            >
              {option.label}
            </View>
          ))}
        </View>
        <View
          className={`market-price-trigger ${selectedQuickKey !== 'all' ? 'market-price-trigger--active' : ''}`}
          hoverClass='market-filter-control--pressed'
          ariaRole='button'
          ariaLabel={`价格筛选，当前${selectedPriceLabel}`}
          onClick={() => setSheetVisible(true)}
        >
          <View className='market-price-trigger__label'>
            <Text>价格</Text>
            <Text className='market-price-trigger__separator'>·</Text>
            <Text>{selectedPriceLabel}</Text>
          </View>
          <View className='market-price-trigger__chevron' />
        </View>
      </View>

      <FilterSheet
        visible={sheetVisible}
        title='价格范围'
        onClose={() => setSheetVisible(false)}
        onReset={() => {
          onChange({ intent: value.intent, category: value.category })
          setSheetVisible(false)
        }}
        onApply={applyCustom}
      >
        <View className='filter-section'>
          <Text className='filter-section__title'>快捷价格</Text>
          <View className='market-price-options'>
            {quickRanges.map((range) => (
              <View
                key={range.key}
                className={draftQuickKey === range.key
                  ? 'market-price-option market-price-option--active'
                  : 'market-price-option'}
                hoverClass='market-filter-control--pressed'
                ariaRole='button'
                ariaLabel={`${draftQuickKey === range.key ? '已选择，' : ''}${range.label}`}
                onClick={() => {
                  setMinYuan(yuanValue(range.value.minPriceCents))
                  setMaxYuan(yuanValue(range.value.maxPriceCents))
                  setValidation('')
                }}
              >
                {range.label}
              </View>
            ))}
          </View>
        </View>
        <View className='filter-section'>
          <Text className='filter-section__title'>自定义价格</Text>
          <Text className='filter-section__description'>输入商品价格区间，单位为元</Text>
          <View className='price-range'>
            <View>
              <Text>最低价</Text>
              <View className='filter-input'>
                <Text>¥</Text>
                <KeyboardSafeInput
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
                <KeyboardSafeInput
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
