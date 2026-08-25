import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { MentionCandidate } from '../../api/types'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { lifeServicesRepository } from '../life-services/repository'
import './mention-picker.scss'

const MAX_MENTIONS = 10

type MentionPickerProps = {
  selected: MentionCandidate[]
  onChange: (selected: MentionCandidate[]) => void
}

export default function MentionPicker({ selected, onChange }: MentionPickerProps) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [candidates, setCandidates] = useState<MentionCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = keyword.trim()
    if (query.length < 2) {
      setCandidates([])
      setError('')
      return
    }
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      void lifeServicesRepository.searchMentionCandidates(query)
        .then((result) => {
          if (active) setCandidates(result.items)
        })
        .catch(() => {
          if (active) {
            setCandidates([])
            setError('暂时无法查询同学，请稍后重试')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 220)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [keyword])

  const remove = (id: number) => onChange(selected.filter((item) => item.id !== id))
  const toggle = (candidate: MentionCandidate) => {
    if (selected.some((item) => item.id === candidate.id)) {
      remove(candidate.id)
      return
    }
    if (selected.length >= MAX_MENTIONS) return
    onChange([...selected, candidate])
  }

  return (
    <View className='mention-picker'>
      <View className='mention-picker__selected'>
        {selected.map((item) => (
          <View key={item.id} className='mention-picker__chip'>
            <Text>@{item.nickname}</Text>
            <View ariaRole='button' ariaLabel={`移除 ${item.nickname}`} onClick={() => remove(item.id)}>×</View>
          </View>
        ))}
        <View
          className='mention-picker__trigger'
          ariaRole='button'
          ariaLabel='提及同学'
          onClick={() => setOpen((current) => !current)}
        >
          <Text>@ 提及同学</Text>
        </View>
      </View>
      {open && (
        <View className='mention-picker__panel'>
          <KeyboardSafeInput
            value={keyword}
            maxlength={32}
            placeholder='输入至少 2 个字符搜索同学'
            placeholderClass='mention-picker__placeholder'
            onInput={(event) => setKeyword(event.detail.value)}
          />
          <Text className='mention-picker__hint'>最多提及 {MAX_MENTIONS} 位同学（{selected.length}/{MAX_MENTIONS}）</Text>
          {keyword.trim().length < 2 ? (
            <Text className='mention-picker__state'>输入至少 2 个字符开始搜索</Text>
          ) : loading ? (
            <Text className='mention-picker__state'>正在搜索</Text>
          ) : error ? (
            <Text className='mention-picker__state'>{error}</Text>
          ) : candidates.length === 0 ? (
            <Text className='mention-picker__state'>没有匹配的同学</Text>
          ) : candidates.map((candidate) => {
            const isSelected = selected.some((item) => item.id === candidate.id)
            const disabled = !isSelected && selected.length >= MAX_MENTIONS
            return (
              <View
                key={candidate.id}
                className={['mention-picker__candidate', isSelected ? 'mention-picker__candidate--selected' : '', disabled ? 'mention-picker__candidate--disabled' : ''].filter(Boolean).join(' ')}
                ariaRole='button'
                ariaLabel={`${isSelected ? '取消提及' : '提及'} ${candidate.nickname}`}
                onClick={!disabled ? () => toggle(candidate) : undefined}
              >
                {candidate.avatar_url ? <Image src={candidate.avatar_url} mode='aspectFill' /> : <View className='mention-picker__avatar'>{Array.from(candidate.nickname)[0] || '同'}</View>}
                <Text>{candidate.nickname}</Text>
                <Text>{isSelected ? '已选择' : '提及'}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
