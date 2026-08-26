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
  onSelect?: (candidate: MentionCandidate) => void
  onRemove?: (candidate: MentionCandidate) => void
  onClear?: (selected: MentionCandidate[]) => void
  onOpenChange: (open: boolean) => void
}

type MentionPickerStateOptions = Pick<
  MentionPickerProps,
  'open' | 'selected' | 'onChange' | 'onSelect' | 'onRemove' | 'onClear'
>

export function useMentionPicker({
  open,
  selected,
  onChange,
  onSelect,
  onRemove,
  onClear,
}: MentionPickerStateOptions) {
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
      removeCandidate(candidate.id)
      return
    }
    if (selected.length >= MAX_MENTIONS) return
    onChange([...selected, candidate])
    onSelect?.(candidate)
  }

  const removeCandidate = (candidateId: number) => {
    const candidate = selected.find((item) => item.id === candidateId)
    if (!candidate) return
    onChange(selected.filter((item) => item.id !== candidateId))
    onRemove?.(candidate)
  }

  const clearSelected = () => {
    if (selected.length === 0) return
    onChange([])
    onClear?.(selected)
  }

  return {
    candidates,
    clearSelected,
    keyword,
    loading,
    removeCandidate,
    setKeyword,
    toggleCandidate,
  }
}

type MentionPickerSelectionProps = {
  selected: MentionCandidate[]
  onRemove: (candidateId: number) => void
  className?: string
}

export function MentionPickerSelection({
  selected,
  onRemove,
  className = 'mention-picker__selected',
}: MentionPickerSelectionProps) {
  if (selected.length === 0) return null

  return (
    <ScrollView className={className} scrollX enhanced showScrollbar={false}>
      <View className='mention-picker__selected-row'>
        {selected.map((candidate) => (
          <View
            className='mention-picker__chip'
            key={candidate.id}
            ariaRole='button'
            ariaLabel={`取消提及 ${candidate.nickname}`}
            onClick={() => onRemove(candidate.id)}
          >
            <Text>@{candidate.nickname}</Text>
            <Text className='mention-picker__chip-remove'>×</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

type MentionPickerOverlayProps = {
  open: boolean
  selected: MentionCandidate[]
  keyword: string
  candidates: MentionCandidate[]
  loading: boolean
  onKeywordChange: (keyword: string) => void
  onToggleCandidate: (candidate: MentionCandidate) => void
  onRemoveCandidate: (candidateId: number) => void
  onClear: () => void
  onOpenChange: (open: boolean) => void
}

export function MentionPickerOverlay({
  open,
  selected,
  keyword,
  candidates,
  loading,
  onKeywordChange,
  onToggleCandidate,
  onRemoveCandidate,
  onClear,
  onOpenChange,
}: MentionPickerOverlayProps) {
  const safeAreaStyle = mentionPickerSafeAreaStyle()

  if (!open) return null

  return (
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
          focus={open}
          placeholder='搜索昵称'
          maxlength={30}
          onInput={(event) => onKeywordChange(event.detail.value)}
        />
      </View>

      <View className='mention-picker__selection-summary'>
        <Text>已选 {selected.length}/{MAX_MENTIONS}</Text>
        {selected.length > 0 && (
          <Text className='mention-picker__clear' onClick={onClear}>
            清空
          </Text>
        )}
      </View>

      <MentionPickerSelection
        selected={selected}
        onRemove={onRemoveCandidate}
        className='mention-picker__selection-list'
      />

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
                onClick={() => onToggleCandidate(candidate)}
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
  )
}

export default function MentionPicker(props: MentionPickerProps) {
  const picker = useMentionPicker(props)

  return (
    <MentionPickerOverlay
      open={props.open}
      selected={props.selected}
      keyword={picker.keyword}
      candidates={picker.candidates}
      loading={picker.loading}
      onKeywordChange={picker.setKeyword}
      onToggleCandidate={picker.toggleCandidate}
      onRemoveCandidate={picker.removeCandidate}
      onClear={picker.clearSelected}
      onOpenChange={props.onOpenChange}
    />
  )
}
