import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import BottomSheet from '../../../components/bottom-sheet'
import { CAMPUS_OPTIONS, type CampusName } from '../campus'
import './campus-selector.scss'

const icons = {
  chevron: require('../../../assets/community/topbar-chevron.svg'),
  filter: require('../../../assets/community/topbar-filter.svg'),
}

type Props = {
  value?: CampusName | ''
  allowAll?: boolean
  label?: string
  topbar?: boolean
  iconOnly?: boolean
  onChange: (value: CampusName | '') => void
}

export default function CampusSelector({
  value = '',
  allowAll = false,
  label = '切换校区',
  topbar = false,
  iconOnly = false,
  onChange,
}: Props) {
  const [visible, setVisible] = useState(false)
  const options: Array<{ label: string; value: CampusName | '' }> = [
    ...(allowAll ? [{ label: '全部校区', value: '' as const }] : []),
    ...CAMPUS_OPTIONS.map((campus) => ({ label: campus, value: campus })),
  ]
  const selectedLabel = value || (allowAll ? '全部校区' : '请选择校区')

  return (
    <>
      <View
        className={[
          'campus-selector__trigger',
          topbar ? 'campus-selector__trigger--topbar' : '',
          iconOnly ? 'campus-selector__trigger--icon-only' : '',
        ].filter(Boolean).join(' ')}
        ariaRole='button'
        ariaLabel={`${label}，当前${selectedLabel}`}
        onClick={() => setVisible(true)}
      >
        {iconOnly ? (
          <Image className='campus-selector__filter-icon' src={icons.filter} mode='aspectFit' />
        ) : topbar ? (
          <>
            <Text className='campus-selector__topbar-value'>{selectedLabel}</Text>
            <Image className='campus-selector__topbar-chevron' src={icons.chevron} mode='aspectFit' />
          </>
        ) : (
          <>
            <Text className='campus-selector__trigger-label'>{label}</Text>
            <View className='campus-selector__trigger-value'>
              <Text>{selectedLabel}</Text>
              <View className='campus-selector__chevron' />
            </View>
          </>
        )}
      </View>

      <BottomSheet
        visible={visible}
        title='选择校区'
        onClose={() => setVisible(false)}
      >
        <View className='campus-selector__options'>
          {options.map((option, index) => {
            const selected = option.value === value
            return (
              <View
                id={`campus-selector-option-${index}`}
                key={option.value || 'all'}
                className={selected
                  ? 'campus-selector__option campus-selector__option--active'
                  : 'campus-selector__option'}
                ariaRole='button'
                ariaLabel={`${selected ? '已选择，' : ''}${option.label}`}
                onClick={() => {
                  onChange(option.value)
                  setVisible(false)
                }}
              >
                <Text>{option.label}</Text>
                <Text className='campus-selector__option-state'>
                  {selected ? '已选择' : ''}
                </Text>
              </View>
            )
          })}
        </View>
      </BottomSheet>
    </>
  )
}
