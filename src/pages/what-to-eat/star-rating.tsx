import { Image, Text, View } from '@tarojs/components'
import './star-rating.scss'

const primaryStarIcon = require('../../assets/icons/star.svg')
const mutedStarIcon = require('../../assets/icons/star-muted.svg')

const SCORES = [1, 2, 3, 4, 5]

export type StarRatingProps = {
  value: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  disabled?: boolean
  showValue?: boolean
  label?: string
  onChange?: (score: number) => void
}

const normalizeScore = (value: number) => Math.min(5, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
const normalizeDisplayScore = (value: number) => Math.min(5, Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 2) / 2))
const formatScore = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0'

export default function StarRating({
  value,
  size = 'md',
  interactive = false,
  disabled = false,
  showValue = false,
  label = '评分',
  onChange,
}: StarRatingProps) {
  const canChange = interactive && !disabled && Boolean(onChange)
  const displayScore = canChange ? normalizeScore(value) : normalizeDisplayScore(value)
  const fullScore = Math.floor(displayScore)
  const hasHalf = !canChange && displayScore % 1 >= .5
  const className = [
    'star-rating',
    `star-rating--${size}`,
    interactive ? 'star-rating--interactive' : '',
    disabled ? 'star-rating--disabled' : '',
  ].filter(Boolean).join(' ')

  return (
    <View
      className={className}
      ariaRole={interactive ? 'radiogroup' : 'img'}
      ariaLabel={showValue ? `${label} ${formatScore(value)} 分（满分 5 分）` : label}
    >
      <View className='star-rating__stars'>
        {SCORES.map((score) => {
          const full = score <= fullScore
          const half = hasHalf && score === fullScore + 1
          const active = full || half
          const itemClassName = [
            'star-rating__item',
            active ? 'star-rating__item--active' : '',
            canChange ? 'star-rating__item--enabled' : '',
          ].filter(Boolean).join(' ')
          return (
            <View
              key={score}
              className={itemClassName}
              ariaRole={interactive ? 'radio' : undefined}
              ariaLabel={interactive ? `${score} 分${score === displayScore ? '，当前选择' : ''}` : undefined}
              onClick={canChange && onChange ? () => onChange(score) : undefined}
            >
              <Image className='star-rating__icon' src={mutedStarIcon} mode='aspectFit' />
              {active && (
                <View className={`star-rating__fill ${half ? 'star-rating__fill--half' : ''}`}>
                  <Image className='star-rating__icon star-rating__icon--filled' src={primaryStarIcon} mode='aspectFit' />
                </View>
              )}
            </View>
          )
        })}
      </View>
      {showValue ? <Text className='star-rating__value'>{formatScore(value)} 分</Text> : null}
    </View>
  )
}
