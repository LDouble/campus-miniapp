import { Image, Text, View } from '@tarojs/components'
import type { CatView } from '../../api/cat-atlas'

export const formatCatDate = (value?: string | null) => {
  if (!value) return '暂未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function CatCover({ cat, large = false }: { cat: CatView; large?: boolean }) {
  if (cat.cover_url) return <Image className={`cat-cover ${large ? 'cat-cover--large' : ''}`} src={cat.cover_url} mode='aspectFill' />
  return <View className={`cat-cover cat-cover--placeholder ${large ? 'cat-cover--large' : ''}`} ariaLabel={`${cat.name}暂无真实图片`}>
    <Image className='cat-cover__fallback-image' src={require('../../assets/cat-atlas/campus-cats-hero.jpg')} mode='aspectFill' />
    <View className='cat-cover__veil' />
    <Text className='cat-cover__name'>{cat.name}</Text>
    <Text className='cat-cover__hint'>暂无真实照片</Text>
  </View>
}

export function RequestState({ loading, error, empty, onRetry }: { loading?: boolean; error?: string; empty?: string; onRetry?: () => void }) {
  if (loading) return <View className='cat-request-state'><View className='cat-request-state__spinner' /><Text>正在加载图鉴…</Text></View>
  if (error) return <View className='cat-request-state'><Text className='cat-request-state__title'>暂时无法加载</Text><Text>{error}</Text>{onRetry && <Text className='cat-text-action' onClick={onRetry}>重新加载</Text>}</View>
  if (empty) return <View className='cat-request-state'><Text className='cat-request-state__title'>{empty}</Text><Text>去校园里走走，也许下一次相遇就在转角。</Text></View>
  return null
}
