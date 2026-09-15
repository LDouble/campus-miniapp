import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import type { CampusCirclePostView, CommentView } from '../../api/types'
import type { LifeHubSection } from '../life-services/business-theme'
import DetailComments, {
  type DetailCommentTarget,
  type DetailReplyTarget,
} from '../life-services/components/detail-comments'
import { markLifeHubSectionDirty } from '../life-services/refresh-policy'
import { setCustomTabBarHidden } from '../../utils/tabbar'
import './comment-sheet.scss'

type CommentSheetTarget = {
  type: DetailCommentTarget
  id: number
  enabled: boolean
  tone: Exclude<DetailCommentTarget, 'campus_circle_post'> | 'community'
  dirtySection: LifeHubSection
  placeholder?: string
}

type CommonProps = {
  onClose: () => void
  onApprovedDelta?: (delta: number) => void
  onCommentCreated?: (comment: CommentView) => void
  onSubmittingChange?: (submitting: boolean) => void
  dismissSignal?: number
  initialReplyTarget?: DetailReplyTarget | null
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
  onSubmittingChange,
  dismissSignal = 0,
  initialReplyTarget = null,
}: Props) {
  const [closeSignal, setCloseSignal] = useState(0)
  const [replyKeyboardHeight, setReplyKeyboardHeight] = useState(0)
  const closingRef = useRef(false)
  const submittingRef = useRef(false)
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
    if (closingRef.current || submittingRef.current) return
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
    <>
      {replyKeyboardHeight > 0 && (
        <View
          className='community-comment-sheet__reply-viewport-reserve'
          style={{
            height: `calc(${replyKeyboardHeight}px + 320rpx + env(safe-area-inset-bottom))`,
          }}
        />
      )}
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
          initialReplyTarget={initialReplyTarget}
          composerOnly
          closeComposerSignal={closeSignal}
          onComposerClosed={handleComposerClosed}
          onSubmittingChange={(submitting) => {
            submittingRef.current = submitting
            onSubmittingChange?.(submitting)
          }}
          onReplyKeyboardHeightChange={setReplyKeyboardHeight}
          placeholder={placeholder}
          tone={targetTone}
          onApprovedDelta={onApprovedDelta}
          onMutation={(mutation) => {
            markLifeHubSectionDirty(dirtySection)
            if (mutation.type === 'create') {
              onCommentCreated?.(mutation.comment)
            }
          }}
        />
      </View>
      </View>
    </>
  )
}
