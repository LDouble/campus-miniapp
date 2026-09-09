import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { createCatProfileSuggestion, type CatProfileSuggestionField } from '../../api/cat-atlas'
import './shared.scss'
import './warm-theme.scss'

const fields: Array<{ key: CatProfileSuggestionField; label: string; hint: string; placeholder: string }> = [
  { key: 'aliases', label: '别名', hint: '多个别名请用顿号或逗号分隔', placeholder: '例如：大橘、橘老板' },
  { key: 'gender', label: '性别', hint: '如不确定可填写“未知”或“推测为公”', placeholder: '例如：母（推测）' },
  { key: 'coat', label: '毛色', hint: '描述最容易辨认的毛色特征', placeholder: '例如：橘白、狸花' },
  { key: 'traits', label: '性格', hint: '多个性格标签请用顿号或逗号分隔', placeholder: '例如：亲人、爱晒太阳' },
  { key: 'resident_area', label: '常驻区域', hint: '请填写常出现的校园区域', placeholder: '例如：图书馆后门附近' },
]

export default function CatProfileSuggestionPage() {
  const { params } = useRouter()
  const id = params.id || ''
  const name = decodeURIComponent(params.name || '这只猫')
  const [field, setField] = useState<CatProfileSuggestionField>('aliases')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selected = fields.find((item) => item.key === field) || fields[0]

  const submit = async () => {
    const proposedValue = value.trim()
    if (!id || !proposedValue) {
      void Taro.showToast({ title: '请先填写补充内容', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await createCatProfileSuggestion(id, { field, proposed_value: proposedValue, note: note.trim() || undefined })
      void Taro.showToast({ title: '已提交，等待审核', icon: 'success' })
      setTimeout(() => { void Taro.navigateBack() }, 900)
    } catch (error) {
      void Taro.showToast({ title: error instanceof Error ? error.message : '提交失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return <View className='cat-page cat-profile-suggestion-page'>
    <CustomNavbar title='补充档案' showBack />
    <View className='cat-profile-suggestion-page__content'>
      <View className='cat-profile-suggestion-page__hero'>
        <Text>一起把 {name} 的档案补充得更完整</Text>
        <Text>你的建议会先交由管理员审核，通过后才会更新公开信息。</Text>
      </View>
      <Text className='cat-profile-suggestion-page__label'>补充哪一项？</Text>
      <View className='cat-profile-suggestion-page__fields'>
        {fields.map((item) => <Text key={item.key} className={field === item.key ? 'is-active' : ''} onClick={() => { setField(item.key); setValue('') }}>{item.label}</Text>)}
      </View>
      <View className='cat-profile-suggestion-page__value-card'>
        <Text>{selected.label}</Text>
        <Text>{selected.hint}</Text>
        <KeyboardSafeInput value={value} maxlength={field === 'resident_area' ? 160 : field === 'gender' ? 16 : 64} placeholder={selected.placeholder} onInput={(event) => setValue(event.detail.value)} />
      </View>
      <Text className='cat-profile-suggestion-page__label'>为什么这样补充？<Text>（可选）</Text></Text>
      <View className='cat-profile-suggestion-page__note'>
        <KeyboardSafeTextarea value={note} maxlength={200} placeholder='例如：经常在这里见到它，大家都这么叫它…' onInput={(event) => setNote(event.detail.value)} />
        <Text>{note.length}/200</Text>
      </View>
    </View>
    <View className='cat-profile-suggestion-page__footer'>
      <Button className='cat-profile-suggestion-page__submit' hoverClass='none' loading={submitting} disabled={submitting} onClick={() => void submit()}>提交补充建议</Button>
      <Text>审核通过后会同步更新猫咪基础档案</Text>
    </View>
  </View>
}
