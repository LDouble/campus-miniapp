import { Text } from '@tarojs/components'

type Props = { name: string; className?: string }

const glyphs: Record<string, string> = {
  home: '⌂', community: '◎', message: '◌', user: '●', plus: '+', bell: '♧',
  calendar: '▦', market: '◇', errand: '↗', lost: '⌕', card: '▣', grade: '★',
  chart: '▥', exam: '✎', canteen: '♨', more: '•••', search: '⌕', location: '⌖',
  heart: '♡', comment: '◌', share: '↗', arrow: '›', close: '×', check: '✓'
}

export function DesignIcon ({ name, className = '' }: Props) {
  return <Text className={`design-icon ${className}`}>{glyphs[name] || '•'}</Text>
}
