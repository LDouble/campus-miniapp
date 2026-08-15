import { ScrollView, Text, View } from '@tarojs/components'
import { CAMPUS_OPTIONS, type CampusName } from '../campus'

type Props = {
  value?: CampusName | ''
  allowAll?: boolean
  onChange: (value: CampusName | '') => void
}

export default function CampusSelector({ value = '', allowAll = false, onChange }: Props) {
  const options: Array<{ label: string; value: CampusName | '' }> = [
    ...(allowAll ? [{ label: '全部校区', value: '' as const }] : []),
    ...CAMPUS_OPTIONS.map((campus) => ({ label: campus, value: campus })),
  ]

  return (
    <ScrollView className='campus-selector' scrollX enhanced showScrollbar={false}>
      <View className='campus-selector__row'>
        {options.map((option) => (
          <View
            key={option.value || 'all'}
            className={option.value === value
              ? 'campus-selector__item campus-selector__item--active'
              : 'campus-selector__item'}
            hoverClass='campus-selector__item--pressed'
            ariaRole='button'
            ariaLabel={`筛选${option.label}`}
            onClick={() => onChange(option.value)}
          >
            <Text>{option.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
