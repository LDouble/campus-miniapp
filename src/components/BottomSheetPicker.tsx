import { ScrollView, Text, View } from '@tarojs/components'
import { DesignIcon } from './DesignIcon'
import './BottomSheetPicker.scss'

interface BottomSheetPickerProps {
  open: boolean
  title: string
  options: string[]
  value: string
  onClose: () => void
  onSelect: (value: string) => void
}

export function BottomSheetPicker ({
  open,
  title,
  options,
  value,
  onClose,
  onSelect
}: BottomSheetPickerProps) {
  if (!open) return null

  return <View className='picker-layer'>
    <View className='picker-mask' onClick={onClose} />
    <View className='picker-sheet' onClick={event => event.stopPropagation()}>
      <View className='picker-handle' />
      <View className='picker-heading'>
        <Text>{title}</Text>
        <View className='picker-close' onClick={onClose}><DesignIcon name='close' /></View>
      </View>
      <ScrollView scrollY className='picker-options'>
        {options.map(option => <View
          className={`picker-option ${value === option ? 'selected' : ''}`}
          key={option}
          onClick={() => onSelect(option)}
        >
          <Text>{option}</Text>
          {value === option && <DesignIcon name='check' />}
        </View>)}
      </ScrollView>
    </View>
  </View>
}
