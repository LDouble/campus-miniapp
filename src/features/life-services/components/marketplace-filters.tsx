import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { setCustomTabBarHidden } from '../../../utils/tabbar'
import FilterSheet from './filter-sheet'
import './filters.scss'

const icons = {
  check: require('../../../assets/community/topbar-check.svg'),
  chevron: require('../../../assets/community/topbar-chevron.svg'),
  filter: require('../../../assets/community/topbar-filter.svg'),
  sort: require('../../../assets/community/topbar-sort.svg'),
}

export type MarketplaceFilterValue = {
  intent?: 'sell' | 'wanted'
  category?: 'general' | 'course_material'
  minPriceCents?: number
  maxPriceCents?: number
}

type Props = {
  value: MarketplaceFilterValue
  campusControl: ReactNode
  onChange: (value: MarketplaceFilterValue) => void
}

type MarketplaceTypeKey = 'all' | 'sell' | 'wanted' | 'free'

const typeOptions: Array<{ key: MarketplaceTypeKey; label: string }> = [
  { key: 'all', label: '全部类型' },
  { key: 'sell', label: '闲置出售' },
  { key: 'wanted', label: '求购需求' },
  { key: 'free', label: '免费赠送' },
]

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

const isFreeValue = (value: MarketplaceFilterValue) => (
  value.intent === 'sell'
  && value.minPriceCents === 0
  && value.maxPriceCents === 0
)

const selectedTypeKey = (value: MarketplaceFilterValue): MarketplaceTypeKey => {
  if (isFreeValue(value)) return 'free'
  if (value.intent === 'sell') return 'sell'
  if (value.intent === 'wanted') return 'wanted'
  return 'all'
}

const withoutFreePrice = (value: MarketplaceFilterValue) => {
  if (!isFreeValue(value)) return value
  return {
    intent: value.intent,
    category: value.category,
  }
}

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

export default function MarketplaceFilters({ value, campusControl, onChange }: Props) {
  const [typeMenuVisible, setTypeMenuVisible] = useState(false)
  const [typeMenuTop, setTypeMenuTop] = useState(0)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [minYuan, setMinYuan] = useState('')
  const [maxYuan, setMaxYuan] = useState('')
  const [validation, setValidation] = useState('')
  const currentTypeKey = selectedTypeKey(value)
  const currentTypeLabel = typeOptions.find((item) => item.key === currentTypeKey)?.label
    || '全部类型'
  const selectedQuickKey = useMemo(
    () => quickRanges.find((item) => sameRange(item.value, value))?.key || 'custom',
    [value],
  )
  const selectedPriceLabel = selectedQuickKey === 'all'
    ? '价格范围'
    : selectedQuickKey === 'custom'
      ? rangeSummary(value)
      : quickRanges.find((item) => item.key === selectedQuickKey)?.label || '价格范围'
  const draftQuickKey = quickRanges.find((item) => (
    yuanValue(item.value.minPriceCents) === minYuan.trim()
    && yuanValue(item.value.maxPriceCents) === maxYuan.trim()
  ))?.key || 'custom'

  useEffect(() => {
    if (!typeMenuVisible) return undefined
    setCustomTabBarHidden(true)
    return () => setCustomTabBarHidden(false)
  }, [typeMenuVisible])

  useEffect(() => {
    if (!sheetVisible) return
    setMinYuan(yuanValue(value.minPriceCents))
    setMaxYuan(yuanValue(value.maxPriceCents))
    setValidation('')
  }, [sheetVisible, value.maxPriceCents, value.minPriceCents])

  const openTypeMenu = () => {
    const query = Taro.createSelectorQuery()
    query.select('.life-hub-navigation').boundingClientRect()
    query.exec((results) => {
      const navigation = results[0] as { bottom?: number } | null
      const top = Number(navigation?.bottom)
      setTypeMenuTop(Number.isFinite(top) ? Math.max(0, top) : 0)
      setTypeMenuVisible(true)
    })
  }

  const selectType = (key: MarketplaceTypeKey) => {
    const base = withoutFreePrice(value)
    if (key === 'free') {
      onChange({
        ...value,
        intent: 'sell',
        category: undefined,
        minPriceCents: 0,
        maxPriceCents: 0,
      })
    } else {
      onChange({
        ...base,
        intent: key === 'all' ? undefined : key,
        category: undefined,
      })
    }
    setTypeMenuVisible(false)
  }

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
      <View className='market-filter-toolbar life-service-filter-toolbar'>
        <View
          id='market-type-trigger'
          className='life-service-filter-chip'
          ariaRole='button'
          ariaLabel={`类型筛选，当前${currentTypeLabel}`}
          onClick={openTypeMenu}
        >
          <Text>{currentTypeLabel}</Text>
          <Image
            className={typeMenuVisible
              ? 'life-service-filter-chip__chevron life-service-filter-chip__chevron--open'
              : 'life-service-filter-chip__chevron'}
            src={icons.chevron}
            mode='aspectFit'
          />
        </View>

        <View
          id='market-price-trigger'
          className='life-service-filter-chip'
          ariaRole='button'
          ariaLabel={`价格筛选，当前${selectedPriceLabel}`}
          onClick={() => setSheetVisible(true)}
        >
          <Text>{selectedPriceLabel}</Text>
          <Image className='life-service-filter-chip__icon' src={icons.sort} mode='aspectFit' />
        </View>

        {campusControl}

        <View className='life-service-filter-toolbar__divider' />
        <View
          className='life-service-filter-more'
          ariaRole='button'
          ariaLabel='打开价格筛选'
          onClick={() => setSheetVisible(true)}
        >
          <Image src={icons.filter} mode='aspectFit' />
        </View>
      </View>

      {typeMenuVisible && (
        <View
          className='market-type-dropdown-layer'
          style={{ top: `${typeMenuTop}px` }}
          catchMove
          onClick={() => setTypeMenuVisible(false)}
        >
          <View
            className='market-type-dropdown'
            ariaRole='menu'
            ariaLabel='闲置类型'
            onClick={(event) => event.stopPropagation()}
          >
            {typeOptions.map((option) => {
              const selected = option.key === currentTypeKey
              return (
                <View
                  id={`market-type-option-${option.key}`}
                  key={option.key}
                  className={selected
                    ? 'market-type-dropdown__item market-type-dropdown__item--active'
                    : 'market-type-dropdown__item'}
                  ariaRole='menuitem'
                  ariaLabel={`${selected ? '已选择，' : ''}${option.label}`}
                  onClick={() => selectType(option.key)}
                >
                  <Text>{option.label}</Text>
                  {selected && <Image src={icons.check} mode='aspectFit' />}
                </View>
              )
            })}
          </View>
        </View>
      )}

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
