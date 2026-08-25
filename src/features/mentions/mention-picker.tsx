import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { MentionCandidate } from '../../api/types'
import { getNavbarMetrics } from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { lifeServicesRepository } from '../life-services/repository'
import './mention-picker.scss'

const MAX_MENTIONS = 10

const mentionPickerSafeAreaStyle = () => {
  try {
    const windowInfo = Taro.getWindowInfo()
    const navbarMetrics = getNavbarMetrics()
    const safeAreaBottom = Math.max(
      0,
      windowInfo.windowHeight - (windowInfo.safeArea?.bottom || windowInfo.windowHeight),
    )

    return {
      top: `${navbarMetrics.statusBarHeight + navbarMetrics.navigationBarHeight}px`,
      bottom: `${safeAreaBottom}px`,
      paddingTop: '12px',
      paddingBottom: '12px',
    }
  } catch {
    return { top: '64px', bottom: '0', paddingTop: '12px', paddingBottom: '12px' }
  }
}

type MentionPickerProps = {
  open: boolean
  selected: MentionCandidate[]
  onChange: (selected: MentionCandidate[]) => void
  onOpenChange: (open: boolean) => void
}

export default function MentionPicker({ open, selected, onChange, onOpenChange }: MentionPickerProps) {
  const safeAreaStyle = mentionPickerSafeAreaStyle()
  const [keyword, setKeyword] = useState('')
  const [candidates, setCandidates] = useState<MentionCandidate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    const normalizedKeyword = keyword.trim()
    if (normalizedKeyword.length < 2) {
      setCandidates([])
      setLoading(false)
      return
    }

    let disposed = false
    const timer = setTimeout(() => {
      setLoading(true)
      lifeServicesRepository
        .searchMentionCandidates(normalizedKeyword)
        .then((result) => {
          if (!disposed) setCandidates(result.items)
        })
        .catch(() => {
          if (!disposed) setCandidates([])
        })
        .finally(() => {
          if (!disposed) setLoading(false)
        })
    }, 220)

    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [keyword, open])

  const toggleCandidate = (candidate: MentionCandidate) => {
    const isSelected = selected.some((item) => item.id === candidate.id)
    if (isSelected) {
      onChange(selected.filter((item) => item.id !== candidate.id))
      return
    }
    if (selected.length >= MAX_MENTIONS) return
    onChange([...selected, candidate])
  }

  const removeCandidate = (candidateId: number) => {
    onChange(selected.filter((item) => item.id !== candidateId))
  }

  return (
    <>
      {selected.length > 0 && (
        <ScrollView className='mention-picker__selected' scrollX enhanced showScrollbar={false}>
          <View className='mention-picker__selected-row'>
            {selected.map((candidate) => (
              <View
                className='mention-picker__chip'
                key={candidate.id}
                ariaRole='button'
                ariaLabel={`取消提及 ${candidate.nickname}`}
                onClick={() => removeCandidate(candidate.id)}
              >
                <Text>@{candidate.nickname}</Text>
                <Text className='mention-picker__chip-remove'>×</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {open && (
        <View className='mention-picker__overlay' style={safeAreaStyle} catchMove>
          <View className='mention-picker__header'>
            <Text className='mention-picker__header-action' onClick={() => onOpenChange(false)}>
              取消
            </Text>
            <View className='mention-picker__heading'>
              <Text className='mention-picker__title'>提及同学</Text>
              <Text className='mention-picker__subtitle'>最多选择 {MAX_MENTIONS} 位</Text>
            </View>
            <Text className='mention-picker__header-action mention-picker__header-action--primary' onClick={() => onOpenChange(false)}>
              完成
            </Text>
          </View>

          <View className='mention-picker__search'>
            <Text className='mention-picker__search-icon'>⌕</Text>
            <KeyboardSafeInput
              id='mention-candidate-search'
              className='mention-picker__search-input'
              value={keyword}
              placeholder='搜索昵称'
              maxlength={30}
              onInput={(event) => setKeyword(event.detail.value)}
            />
          </View>

          <View className='mention-picker__selection-summary'>
            <Text>已选 {selected.length}/{MAX_MENTIONS}</Text>
            {selected.length > 0 && (
              <Text className='mention-picker__clear' onClick={() => onChange([])}>
                清空
              </Text>
            )}
          </View>

          {selected.length > 0 && (
            <ScrollView className='mention-picker__selection-list' scrollX enhanced showScrollbar={false}>
              <View className='mention-picker__selected-row'>
                {selected.map((candidate) => (
                  <View
                    className='mention-picker__chip'
                    key={candidate.id}
                    ariaRole='button'
                    ariaLabel={`取消提及 ${candidate.nickname}`}
                    onClick={() => removeCandidate(candidate.id)}
                  >
                    <Text>@{candidate.nickname}</Text>
                    <Text className='mention-picker__chip-remove'>×</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          <ScrollView className='mention-picker__candidate-list' scrollY enhanced>
            {keyword.trim().length < 2 ? (
              <View className='mention-picker__empty'>
                <Text>输入至少两个字搜索同学</Text>
              </View>
            ) : loading ? (
              <View className='mention-picker__empty'>
                <Text>正在搜索…</Text>
              </View>
            ) : candidates.length === 0 ? (
              <View className='mention-picker__empty'>
                <Text>没有找到匹配的同学</Text>
              </View>
            ) : (
              candidates.map((candidate) => {
                const selectedCandidate = selected.some((item) => item.id === candidate.id)
                const disabled = !selectedCandidate && selected.length >= MAX_MENTIONS

                return (
                  <View
                    className={disabled ? 'mention-picker__candidate mention-picker__candidate--disabled' : 'mention-picker__candidate'}
                    key={candidate.id}
                    ariaRole='checkbox'
                    onClick={() => toggleCandidate(candidate)}
                  >
                    {candidate.avatar_url ? (
                      <Image className='mention-picker__avatar' src={candidate.avatar_url} mode='aspectFill' />
                    ) : (
                      <View className='mention-picker__avatar mention-picker__avatar--fallback'>
                        {candidate.nickname.slice(0, 1)}
                      </View>
                    )}
                    <View className='mention-picker__candidate-content'>
                      <Text className='mention-picker__candidate-name'>{candidate.nickname}</Text>
                    </View>
                    <View className={selectedCandidate ? 'mention-picker__check mention-picker__check--selected' : 'mention-picker__check'}>
                      {selectedCandidate && <Text>✓</Text>}
                    </View>
                  </View>
                )
              })
            )}
          </ScrollView>
        </View>
      )}
    </>
  )
}
