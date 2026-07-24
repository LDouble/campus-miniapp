import { Input, Picker, Text, Textarea, View } from '@tarojs/components'

type Change = (value: string) => void

export function FieldInput ({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = 'text'
}: {
  label: string
  value: string
  onChange: Change
  placeholder?: string
  error?: string
  type?: 'text' | 'number' | 'digit'
}) {
  return <View className='form-field'>
    <Text className='field-label'>{label}</Text>
    <Input value={value} type={type} onInput={event => onChange(event.detail.value)} placeholder={placeholder || `请输入${label}`} maxlength={200} />
    {error && <Text className='field-error'>{error}</Text>}
  </View>
}

export function FieldTextarea ({
  label,
  value,
  onChange,
  placeholder,
  error
}: {
  label: string
  value: string
  onChange: Change
  placeholder?: string
  error?: string
}) {
  return <View className='form-field'>
    <Text className='field-label'>{label}</Text>
    <Textarea value={value} onInput={event => onChange(event.detail.value)} placeholder={placeholder || `请输入${label}`} maxlength={5000} />
    {error && <Text className='field-error'>{error}</Text>}
  </View>
}

export function AmountField (props: Omit<Parameters<typeof FieldInput>[0], 'type'>) {
  return <FieldInput {...props} type='digit' />
}

export function DateTimeField ({
  label,
  value,
  onChange,
  error
}: {
  label: string
  value: string
  onChange: Change
  error?: string
}) {
  const parts = value.split(' ')
  const date = parts[0] || ''
  const clock = parts[1] || ''
  const today = new Date().toISOString().slice(0, 10)
  const update = (nextDate: string, nextClock: string) => onChange(`${nextDate || today} ${nextClock || '12:00'}`)
  return <View className='form-field'>
    <Text className='field-label'>{label}</Text>
    <View className='datetime-row'>
      <Picker mode='date' value={date || today} onChange={event => update(String(event.detail.value), clock)}>
        <View className={`picker-value ${date ? '' : 'placeholder'}`}>{date || '选择日期'}</View>
      </Picker>
      <Picker mode='time' value={clock || '12:00'} onChange={event => update(date, String(event.detail.value))}>
        <View className={`picker-value ${clock ? '' : 'placeholder'}`}>{clock || '选择时间'}</View>
      </Picker>
    </View>
    {error && <Text className='field-error'>{error}</Text>}
  </View>
}

export function ContactFields ({
  contactType,
  contact,
  onTypeChange,
  onContactChange,
  error
}: {
  contactType: string
  contact: string
  onTypeChange: Change
  onContactChange: Change
  error?: string
}) {
  const types = [
    { label: '微信', value: 'wechat' },
    { label: '手机号', value: 'phone' },
    { label: 'QQ', value: 'qq' }
  ]
  const index = Math.max(0, types.findIndex(item => item.value === contactType))
  return <View className='form-field'>
    <Text className='field-label'>联系方式</Text>
    <View className='contact-row'>
      <Picker mode='selector' range={types.map(item => item.label)} value={index} onChange={event => onTypeChange(types[Number(event.detail.value)].value)}>
        <View className='contact-type'>{types[index].label}⌄</View>
      </Picker>
      <Input value={contact} onInput={event => onContactChange(event.detail.value)} placeholder='请输入联系方式' maxlength={200} />
    </View>
    {error && <Text className='field-error'>{error}</Text>}
  </View>
}
