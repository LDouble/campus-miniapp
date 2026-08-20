import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import type { CampusCirclePostView, CommentView } from '../../api/types'
import type { LifeHubSection } from '../life-services/business-theme'
import DetailComments, {
  type DetailCommentTarget,
} from '../life-services/components/detail-comments'
import { markLifeHubSectionDirty } from '../life-services/refresh-policy'
import { setCustomTabBarHidden } from '../../utils/tabbar'
import './comment-sheet.scss'

type CommentSheetTarget = {
  type: Exclude<DetailCommentTarget, 'campus_circle_post'>
  id: number
  enabled: boolean
  tone: Exclude<DetailCommentTarget, 'campus_circle_post'>
  dirtySection: LifeHubSection
  placeholder?: string
}

type CommonProps = {
  onClose: () => void
  onApprovedDelta?: (delta: number) => void
  onCommentCreated?: (comment: CommentView) => void
  dismissSignal?: number
}

type Props = CommonProps & (
  | { post: CampusCirclePostView; target?: never }
  | { post?: never; target: CommentSheetTarget }
)

export default function CommunityCommentSheet({
  post,
  target,
  onClose,
  onApprovedDelta,
  onCommentCreated,
  dismissSignal = 0,
}: Props) {
  const [closeSignal, setCloseSignal] = useState(0)
  const closingRef = useRef(false)
  const lastDismissSignalRef = useRef(dismissSignal)
  const targetType = target?.type || 'campus_circle_post'
  const targetId = target?.id || post?.id || 0
  const targetEnabled = target?.enabled ?? post?.status === 'approved'
  const targetTone = target?.tone || 'community'
  const dirtySection = target?.dirtySection || 'community'
  const placeholder = target?.placeholder || '友善交流，分享你的想法'

  useEffect(() => {
    setCustomTabBarHidden(true)
    return () => setCustomTabBarHidden(false)
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setCloseSignal((current) => current + 1)
  }, [])

  const handleComposerClosed = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (dismissSignal === lastDismissSignalRef.current) return
    lastDismissSignalRef.current = dismissSignal
    requestClose()
  }, [dismissSignal, requestClose])

  return (
    <View className='community-comment-sheet'>
      <View
        className='community-comment-sheet__backdrop'
        ariaRole='button'
        ariaLabel='关闭评论输入'
        onClick={requestClose}
      />
      <View className='community-comment-sheet__panel'>
        <DetailComments
          targetType={targetType}
          targetId={targetId}
          enabled={targetEnabled}
          initialComposerOpen
          composerOnly
          closeComposerSignal={closeSignal}
          onComposerClosed={handleComposerClosed}
          placeholder={placeholder}
          tone={targetTone}
          onApprovedDelta={onApprovedDelta}
          onMutation={(mutation) => {
            markLifeHubSectionDirty(dirtySection)
            if (mutation.type === 'create' && mutation.comment.status === 'approved') {
              onCommentCreated?.(mutation.comment)
            }
          }}
        />
      </View>
    </View>
  )
}
