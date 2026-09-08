import Taro from '@tarojs/taro'
import type { CampusCirclePostView } from '../../api/types'

export type CommunityPinAction = 'pin' | 'unpin'

// 操作能力以服务端下发为准，不在客户端根据角色或权限名自行推断。
const availableActionsFor = (post: CampusCirclePostView): readonly string[] => (
  post.available_actions
)

export const getCommunityPinAction = (
  post: CampusCirclePostView,
): CommunityPinAction | null => {
  const actions = availableActionsFor(post)
  if (actions.includes('unpin')) return 'unpin'
  return actions.includes('pin') ? 'pin' : null
}

export const communityPinActionLabel = (action: CommunityPinAction) => (
  action === 'pin' ? '置顶到本版块' : '取消本版块置顶'
)

export const confirmCommunityPinAction = async (
  action: CommunityPinAction,
  sectionName: string,
) => {
  const label = communityPinActionLabel(action)
  const result = await Taro.showModal({
    title: label,
    content: action === 'pin'
      ? `确认将该动态置顶到「${sectionName || '当前'}」版块吗？置顶只影响该版块。`
      : `确认取消该动态在「${sectionName || '当前'}」版块的置顶吗？`,
    confirmText: action === 'pin' ? '确认置顶' : '确认取消',
    confirmColor: action === 'pin' ? '#2b7fff' : '#d87567',
  })
  return result.confirm
}
