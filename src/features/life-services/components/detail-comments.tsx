import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Taro from '@tarojs/taro'
import { CoverView, Image, Text, View } from '@tarojs/components'
import { uploadMediaImage } from '../../../api/media'
import type { CommentView, MentionCandidate } from '../../../api/types'
import { getCurrentUser } from '../../../api/account'
import { isApiError } from '../../../api/client'
import UserAvatar from '../../../components/user-avatar'
import { KeyboardSafeTextarea } from '../../../components/keyboard-safe-input'
import MentionContent from '../../../components/mention-content'
import StickerPicker from '../../../components/sticker-picker'
import CommentImage from '../../community/components/comment-image'
import { openContentReport } from '../../content-report'
import { openPublicProfile } from '../../profile/public-profile'
import { insertStickerToken, serializeStickerTokens } from '../../stickers/content'
import {
  buildCommentTree,
  commentRootId,
  mergeLocalThreadReply,
} from '../../community/comments'
import type { CommentTreeNode } from '../../community/comments'
import {
  applyCommentReaction,
  commentLikeFailure,
} from '../../community/comment-likes'
import { suppressCommunityOverlayDismiss } from '../../community/use-overlay-dismissal'
import { formatDateTime, formatStatus } from '../format'
import { lifeServicesRepository } from '../repository'
import {
  MentionPickerOverlay,
  useMentionPicker,
} from '../../mentions/mention-picker'
import {
  buildMentionContentSegments,
  expandMentionDeletion,
  insertMentionToken,
  removeMentionTokens,
} from '../../mentions/content'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import { showActionSheetSelection } from '../../../utils/action-sheet'
import { getSystemState } from '../../../state/system'
import {
  COMMENT_IMAGE_MAX_DIMENSION,
  DEFAULT_MEDIA_IMAGE_QUALITY,
  MAX_COMMENT_IMAGES,
} from '../../media/images'
import type { MediaImageDraft } from '../../media/images'
import { chooseMediaImages } from '../../media/selection'
import './detail-comments.scss'

const icons = {
  heart: require('../../../assets/community/detail-comment-heart.svg'),
  heartSmall: require('../../../assets/community/detail-comment-heart-small.svg'),
  heartActive: require('../../../assets/community/heart-active.svg'),
  reply: require('../../../assets/community/detail-comment-reply.svg'),
  send: require('../../../assets/community/send.svg'),
  expand: require('../../../assets/icons/expand.svg'),
  collapse: require('../../../assets/icons/collapse.svg'),
  mention: require('../../../assets/icons/mention.svg'),
}

export type DetailCommentTarget = 'campus_circle_post' | 'marketplace' | 'errand' | 'carpool'
export type DetailReplyTarget = Pick<
  CommentView,
  'id' | 'author_id' | 'author_deleted' | 'author_nickname' | 'root_id'
>

const openCommentAuthor = (comment: CommentView) => {
  if (!comment.author_deleted) void openPublicProfile(comment.author_id)
}

export type DetailFooterAction = {
  key: string
  label: string
  emphasis?: 'primary' | 'secondary' | 'danger'
  busy?: boolean
  onClick: () => void
}

type QuickAction = {
  active?: boolean
  activeIcon?: string
  icon: string
  label: string
  onClick: () => void
}

type PersistentContact = {
  label: string
  value: string
  onCopy: () => void
}

type CommentThreadState = {
  descendants: CommentView[]
  error: string
  expanded: boolean
  loaded: boolean
  loading: boolean
}

type PendingTimer = {
  cancel: () => void
}

const COMPOSER_CLOSE_DURATION = 180
const COMMENT_FOCUS_DURATION = 2200
const REPLY_TARGET_SCROLL_DURATION = 180
const REPLY_TARGET_SCROLL_GAP = 12
const REPLY_TARGET_SCROLL_DELAY = 80
const REPLY_TARGET_DISMISS_SUPPRESSION = 800
const REPLY_OPEN_DISMISS_SUPPRESSION = 1600
const COMPOSER_TOP_GAP = 8

const expandedComposerTopInset = () => {
  const { windowInfo, menuButtonRect } = getSystemState()
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight || 20)
  const hasValidMenuButton = menuButtonRect.top >= statusBarHeight
    && menuButtonRect.height > 0
  const navigationBottom = hasValidMenuButton
    ? menuButtonRect.top + menuButtonRect.height
    : statusBarHeight + 44
  return navigationBottom + COMPOSER_TOP_GAP
}

const commentImageErrorMessage = (error: unknown) => (
  isApiError(error)
    ? error.message
    : error instanceof Error ? error.message : '图片上传失败，请重试'
)

type SelectorRect = {
  bottom?: number
  top?: number
}

type ViewportScroll = {
  scrollTop?: number
}

const scrollReplyTargetAboveComposer = (
  targetSelector: string,
  isCurrentRequest: () => boolean,
) => {
  const query = Taro.createSelectorQuery()
  query.select(targetSelector).boundingClientRect()
  query.select('.business-detail-composer').boundingClientRect()
  query.selectViewport().scrollOffset()
  query.exec((results) => {
    if (!isCurrentRequest()) return

    const target = results[0] as SelectorRect | null
    const composer = results[1] as SelectorRect | null
    const viewport = results[2] as ViewportScroll | null
    const targetBottom = Number(target?.bottom)
    const composerTop = Number(composer?.top)
    if (!Number.isFinite(targetBottom) || !Number.isFinite(composerTop)) return

    const overlap = targetBottom - (composerTop - REPLY_TARGET_SCROLL_GAP)
    if (overlap <= 0) return

    suppressCommunityOverlayDismiss(REPLY_TARGET_DISMISS_SUPPRESSION)
    void Taro.pageScrollTo({
      scrollTop: Math.max(0, (Number(viewport?.scrollTop) || 0) + overlap),
      duration: REPLY_TARGET_SCROLL_DURATION,
    })
  })
}

type DetailCommentsProps = {
  targetType: DetailCommentTarget
  targetId: number
  enabled?: boolean
  refreshKey?: number
  targetAuthorId?: number
  initialCommentId?: number
  initialComposerOpen?: boolean
  initialReplyTarget?: DetailReplyTarget | null
  closeComposerSignal?: number
  composerOnly?: boolean
  onComposerClosed?: () => void
  onSubmittingChange?: (submitting: boolean) => void
  onReplyKeyboardHeightChange?: (height: number) => void
  displayTotal?: number
  headingLabel?: string
  showHeading?: boolean
  headingActions?: ReactNode
  placeholder?: string
  tone?: Exclude<DetailCommentTarget, 'campus_circle_post'> | 'community'
  actions?: DetailFooterAction[]
  quickAction?: QuickAction
  persistentContact?: PersistentContact
  onApprovedDelta?: (delta: number) => void
  onMutation?: (mutation: {
    comment: CommentView
    type: 'create' | 'withdraw'
  }) => void
}

const visibleComments = (items: CommentView[]) => (
  items.filter((item) => item.status !== 'withdrawn')
)

const visibleRootComments = (items: CommentView[]) => (
  visibleComments(items).filter((item) => !item.parent_id || item.root_id === item.id)
)

const previewThreadStates = (items: CommentView[]) => items.reduce<Record<number, CommentThreadState>>(
  (result, item) => {
    const preview = visibleComments(item.reply_preview || [])
    if (item.reply_count > 0 || preview.length > 0) {
      result[item.id] = {
        descendants: preview,
        error: '',
        expanded: false,
        loaded: item.reply_count <= preview.length,
        loading: false,
      }
    }
    return result
  },
  {},
)

const commentAuthorName = (comment: Pick<CommentView, 'author_id' | 'author_deleted' | 'author_nickname'>) => (
  comment.author_deleted
    ? '已注销用户'
    : comment.author_nickname?.trim() || `用户 #${comment.author_id}`
)

const commentAuthorInitial = (comment: CommentView) => (
  Array.from(commentAuthorName(comment))[0] || '同'
)

const formatCommentDateTime = (value?: string | null) => (
  formatDateTime(value).replace(/^(\d{2})月(\d{2})日/u, '$1-$2')
)

const renderCommentMeta = (
  comment: CommentView,
  liking: boolean,
  currentUserId: number,
  onToggleLike: (comment: CommentView) => void,
  compact = false,
) => {
  const expectedAction = comment.liked ? 'unlike' : 'like'
  const canToggleLike = comment.available_actions.includes(expectedAction)
  const isOwnComment = comment.author_id === currentUserId
  const likeLabel = isOwnComment
    ? `${comment.like_count}赞`
    : String(comment.like_count)

  return (
    <View className='business-detail-comment__meta'>
      {comment.status !== 'approved' && <Text>{formatStatus(comment.status)}</Text>}
      {canToggleLike ? (
        <View
          className={[
            'business-detail-comment__like',
            isOwnComment ? 'business-detail-comment__like--own' : '',
            comment.liked ? 'business-detail-comment__like--active' : '',
            liking ? 'business-detail-comment__like--busy' : '',
          ].filter(Boolean).join(' ')}
          ariaRole='button'
          ariaLabel={`${liking ? '点赞处理中' : comment.liked ? '取消点赞' : '点赞'}，当前 ${comment.like_count} 个赞`}
          onClick={!liking ? (event) => {
            event.stopPropagation()
            onToggleLike(comment)
          } : undefined}
        >
          <Image
            src={comment.liked ? icons.heartActive : compact ? icons.heartSmall : icons.heart}
            mode='aspectFit'
          />
          <Text>{likeLabel}</Text>
        </View>
      ) : (
        <View
          className={[
            'business-detail-comment__like',
            'business-detail-comment__like--readonly',
            isOwnComment ? 'business-detail-comment__like--own' : '',
          ].filter(Boolean).join(' ')}
          ariaLabel={`当前 ${comment.like_count} 个赞`}
        >
          <Image
            src={comment.liked ? icons.heartActive : compact ? icons.heartSmall : icons.heart}
            mode='aspectFit'
          />
          <Text>{likeLabel}</Text>
        </View>
      )}
    </View>
  )
}

const renderReplyTree = (
  nodes: CommentTreeNode<CommentView>[],
  memberNames: ReadonlyMap<number, string>,
  targetAuthorId: number | undefined,
  focusedCommentId: number,
  enteringCommentId: number,
  removingCommentId: number,
  likingIds: ReadonlySet<number>,
  currentUserId: number,
  onStartReply: (comment: CommentView) => void,
  onOpenActions: (comment: CommentView) => void,
  onToggleLike: (comment: CommentView) => void,
) => nodes.map(({ comment, children }) => {
  const replyTargetName = comment.reply_to_user_id
    ? memberNames.get(comment.reply_to_user_id) || '上一位同学'
    : ''

  return (
    <View key={comment.id} className='business-detail-comment__reply-node'>
      <View
        id={`detail-comment-${comment.id}`}
        className={[
          'business-detail-comment__reply',
          `business-detail-comment__reply--${comment.status}`,
          focusedCommentId === comment.id ? 'business-detail-comment__reply--focused' : '',
          enteringCommentId === comment.id ? 'business-detail-comment-node--entering' : '',
          removingCommentId === comment.id ? 'business-detail-comment-node--removing' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => onStartReply(comment)}
        onLongPress={() => onOpenActions(comment)}
      >
        <UserAvatar
          src={comment.author_deleted ? '' : comment.author_avatar_url}
          className='business-detail-comment__reply-avatar'
          imageClassName='business-detail-comment__reply-avatar-image'
          fallback={commentAuthorInitial(comment)}
          userId={comment.author_deleted ? 0 : comment.author_id}
          lazyLoad
          ariaRole='button'
          ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
          onClick={(event) => {
            event.stopPropagation()
            openCommentAuthor(comment)
          }}
        />
        <View className='business-detail-comment__reply-body'>
          <View className='business-detail-comment__reply-header'>
            <View
              className='business-detail-comment__reply-identity'
              ariaRole='button'
              ariaLabel={replyTargetName
                ? `查看${commentAuthorName(comment)}的个人主页，回复${replyTargetName}`
                : `查看${commentAuthorName(comment)}的个人主页`}
              onClick={(event) => {
                event.stopPropagation()
                openCommentAuthor(comment)
              }}
            >
              <Text className='business-detail-comment__reply-relation'>
                {commentAuthorName(comment)}
              </Text>
              {comment.author_id === targetAuthorId && <Text className='business-detail-comment__author-badge'>作者</Text>}
              {replyTargetName && (
                <>
                  <Image
                    className='business-detail-comment__reply-to'
                    src={icons.reply}
                    mode='aspectFit'
                  />
                  <Text className='business-detail-comment__reply-target'>
                    {replyTargetName}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View
            id={`detail-comment-reply-${comment.id}`}
            className='business-detail-comment__reply-content'
          >
            <MentionContent
              content={comment.content}
              segments={comment.content_segments}
              stickerClassName='business-detail-comment__sticker'
            />
            {comment.image && (
              <CommentImage
                image={comment.image}
                label={`${commentAuthorName(comment)}的回复图片`}
              />
            )}
          </View>
          <View className='business-detail-comment__footer'>
            <Text className='business-detail-comment__time'>
              {formatCommentDateTime(comment.created_at)}
            </Text>
            {renderCommentMeta(comment, likingIds.has(comment.id), currentUserId, onToggleLike, true)}
          </View>
        </View>
      </View>
      {children.length > 0 && (
        <View className='business-detail-comment__reply-children'>
          {renderReplyTree(
            children,
            memberNames,
            targetAuthorId,
            focusedCommentId,
            enteringCommentId,
            removingCommentId,
            likingIds,
            currentUserId,
            onStartReply,
            onOpenActions,
            onToggleLike,
          )}
        </View>
      )}
    </View>
  )
})

type DetailCommentThreadProps = {
  comment: CommentView
  thread?: CommentThreadState
  targetAuthorId?: number
  focusedCommentId: number
  enteringCommentId: number
  removingCommentId: number
  likingIds: ReadonlySet<number>
  currentUserId: number
  onExpand: (rootId: number) => void
  onStartReply: (comment: CommentView) => void
  onOpenActions: (comment: CommentView) => void
  onToggleLike: (comment: CommentView) => void
}

const DetailCommentThread = memo(function DetailCommentThread({
  comment,
  thread,
  targetAuthorId,
  focusedCommentId,
  enteringCommentId,
  removingCommentId,
  likingIds,
  currentUserId,
  onExpand,
  onStartReply,
  onOpenActions,
  onToggleLike,
}: DetailCommentThreadProps) {
  const { descendants, memberNames, replyTree, showThreadAction } = useMemo(() => {
    const preview = thread?.descendants || visibleComments(comment.reply_preview || [])
    const visibleDescendants = thread?.expanded ? preview : preview.slice(0, 2)
    const hasHiddenReplies = comment.reply_count > Math.min(preview.length, 2)
    const names = new Map<number, string>()

    ;[comment, ...preview].forEach((member) => {
      if (!names.has(member.author_id)) names.set(member.author_id, commentAuthorName(member))
    })

    return {
      descendants: visibleDescendants,
      memberNames: names,
      replyTree: buildCommentTree(comment.id, visibleDescendants),
      showThreadAction: Boolean(thread?.loading)
        || (!thread?.expanded && hasHiddenReplies),
    }
  }, [comment, thread])

  return (
    <View
      className={[
        'business-detail-comment-thread',
        enteringCommentId === comment.id ? 'business-detail-comment-node--entering' : '',
        removingCommentId === comment.id ? 'business-detail-comment-node--removing' : '',
      ].filter(Boolean).join(' ')}
    >
      <View
        id={`detail-comment-${comment.id}`}
        className={[
          'business-detail-comment',
          `business-detail-comment--${comment.status}`,
          focusedCommentId === comment.id ? 'business-detail-comment--focused' : '',
        ].filter(Boolean).join(' ')}
      >
        <UserAvatar
          src={comment.author_deleted ? '' : comment.author_avatar_url}
          className='business-detail-comment__avatar'
          imageClassName='business-detail-comment__avatar-image'
          fallback={commentAuthorInitial(comment)}
          userId={comment.author_deleted ? 0 : comment.author_id}
          lazyLoad
          ariaRole='button'
          ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
          onClick={() => openCommentAuthor(comment)}
        />
        <View className='business-detail-comment__body'>
          <View className='business-detail-comment__header'>
            <View
              className='business-detail-comment__identity'
              ariaRole='button'
              ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
              onClick={() => openCommentAuthor(comment)}
            >
              <Text className='business-detail-comment__author'>{commentAuthorName(comment)}</Text>
              {comment.author_id === targetAuthorId && <Text className='business-detail-comment__author-badge'>作者</Text>}
            </View>
          </View>
          <View
            id={`detail-comment-reply-${comment.id}`}
            className='business-detail-comment__bubble'
            ariaRole='button'
            ariaLabel='点击回复，长按查看更多操作'
            onClick={() => onStartReply(comment)}
            onLongPress={() => onOpenActions(comment)}
          >
            <MentionContent
              content={comment.content}
              segments={comment.content_segments}
              stickerClassName='business-detail-comment__sticker'
            />
            {comment.image && (
              <CommentImage
                image={comment.image}
                label={`${commentAuthorName(comment)}的评论图片`}
              />
            )}
          </View>
          <View className='business-detail-comment__footer'>
            <Text className='business-detail-comment__time'>
              {formatCommentDateTime(comment.created_at)}
            </Text>
            {renderCommentMeta(comment, likingIds.has(comment.id), currentUserId, onToggleLike)}
          </View>
          {showThreadAction && (
            <View className='business-detail-comment__thread-action' onClick={() => onExpand(comment.id)}>
              {thread?.loading ? '加载回复中…' : `查看全部 ${comment.reply_count} 条回复`}
            </View>
          )}
        </View>
      </View>
      {thread?.error && (
        <View className='business-detail-comment__thread-error' onClick={() => onExpand(comment.id)}>
          {thread.error}，点击重试
        </View>
      )}
      {descendants.length > 0 && (
        <View className='business-detail-comment__replies'>
          {renderReplyTree(
            replyTree,
            memberNames,
            targetAuthorId,
            focusedCommentId,
            enteringCommentId,
            removingCommentId,
            likingIds,
            currentUserId,
            onStartReply,
            onOpenActions,
            onToggleLike,
          )}
        </View>
      )}
    </View>
  )
})

export default function DetailComments({
  targetType,
  targetId,
  enabled = true,
  refreshKey = 0,
  targetAuthorId,
  initialCommentId = 0,
  initialComposerOpen = false,
  initialReplyTarget = null,
  closeComposerSignal = 0,
  composerOnly = false,
  onComposerClosed,
  onSubmittingChange,
  onReplyKeyboardHeightChange,
  displayTotal,
  headingLabel,
  showHeading = true,
  headingActions,
  placeholder = '留言问问细节...',
  tone = targetType === 'campus_circle_post' ? 'community' : targetType,
  actions = [],
  quickAction,
  persistentContact,
  onApprovedDelta,
  onMutation,
}: DetailCommentsProps) {
  const [comments, setComments] = useState<CommentView[]>([])
  const [threads, setThreads] = useState<Record<number, CommentThreadState>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [content, setContent] = useState('')
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([])
  const [commentImage, setCommentImage] = useState<MediaImageDraft | null>(null)
  const [replyTarget, setReplyTarget] = useState<DetailReplyTarget | null>(null)
  const [replyAnchorSelector, setReplyAnchorSelector] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState(0)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [keyboardTransitionDuration, setKeyboardTransitionDuration] = useState(
    COMPOSER_CLOSE_DURATION,
  )
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [composerLineCount, setComposerLineCount] = useState(1)
  const [composerClosing, setComposerClosing] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false)
  const [focusedCommentId, setFocusedCommentId] = useState(0)
  const [enteringCommentId, setEnteringCommentId] = useState(0)
  const [removingCommentId, setRemovingCommentId] = useState(0)
  const [likingIds, setLikingIds] = useState<ReadonlySet<number>>(() => new Set())
  const [composerAvatar, setComposerAvatar] = useState({ src: '', fallback: '同', userId: 0 })
  const composerTopInset = useRef(expandedComposerTopInset()).current
  const mountedRef = useRef(true)
  const requestScopeRef = useRef(0)
  const listRequestSequenceRef = useRef(0)
  const listInFlightRef = useRef<Promise<void> | null>(null)
  const threadRequestSequenceRef = useRef(new Map<number, number>())
  const threadInFlightRef = useRef(new Map<number, Promise<void>>())
  const threadsRef = useRef(threads)
  const pendingTimersRef = useRef(new Set<PendingTimer>())
  const composerCloseSequenceRef = useRef(0)
  const replyTargetScrollSequenceRef = useRef(0)
  const initialComposerOpenedRef = useRef(false)
  const lastCloseComposerSignalRef = useRef(closeComposerSignal)
  const composerClosingRef = useRef(false)
  const stickerPickerOpenRef = useRef(false)
  const composerActionPendingRef = useRef(false)
  const mentionSubscriptionRequestedRef = useRef(false)
  const contentSelectionStartRef = useRef(0)
  const contentSelectionEndRef = useRef(0)
  const focusedCommentClearRef = useRef<null | (() => void)>(null)
  const likeInFlightRef = useRef(new Set<number>())
  const openCommentActionsRef = useRef<(comment: CommentView) => void>(() => {})
  const handleOpenCommentActions = useCallback((comment: CommentView) => {
    openCommentActionsRef.current(comment)
  }, [])
  const handleMentionSelect = useCallback((candidate: MentionCandidate) => {
    const inserted = insertMentionToken(
      content,
      candidate.nickname,
      contentSelectionStartRef.current,
      contentSelectionEndRef.current,
    )
    contentSelectionStartRef.current = inserted.cursor
    contentSelectionEndRef.current = inserted.cursor
    setContent(inserted.text)
  }, [content])
  const removeMentionFromContent = useCallback((candidate: MentionCandidate) => {
    const removed = removeMentionTokens(
      content,
      candidate.nickname,
      contentSelectionStartRef.current,
    )
    contentSelectionStartRef.current = removed.cursor
    contentSelectionEndRef.current = removed.cursor
    setContent(removed.text)
  }, [content])
  const clearMentionContent = useCallback((selected: MentionCandidate[]) => {
    let nextContent = content
    let cursor = contentSelectionStartRef.current
    selected.forEach((candidate) => {
      const removed = removeMentionTokens(nextContent, candidate.nickname, cursor)
      nextContent = removed.text
      cursor = removed.cursor
    })
    contentSelectionStartRef.current = cursor
    contentSelectionEndRef.current = cursor
    setContent(nextContent)
  }, [content])
  const mentionPicker = useMentionPicker({
    open: mentionPickerOpen,
    selected: mentionCandidates,
    onChange: setMentionCandidates,
    onSelect: handleMentionSelect,
    onRemove: removeMentionFromContent,
    onClear: clearMentionContent,
  })

  useEffect(() => {
    let active = true
    void getCurrentUser().then(({ user }) => {
      if (!active) return
      const username = user.username?.trim() || '同学'
      setComposerAvatar({
        src: user.avatar_url?.trim() || '',
        fallback: Array.from(username)[0] || '同',
        userId: user.id,
      })
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const clearPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach((timer) => timer.cancel())
    pendingTimersRef.current.clear()
  }, [])

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    let handle: ReturnType<typeof setTimeout> | null = null
    const timer: PendingTimer = {
      cancel: () => {
        if (handle) clearTimeout(handle)
        pendingTimersRef.current.delete(timer)
      },
    }
    handle = setTimeout(() => {
      pendingTimersRef.current.delete(timer)
      callback()
    }, delay)
    pendingTimersRef.current.add(timer)
    return timer.cancel
  }, [])

  const waitForTimeout = useCallback((delay: number) => new Promise<boolean>((resolve) => {
    let handle: ReturnType<typeof setTimeout> | null = null
    const timer: PendingTimer = {
      cancel: () => {
        if (handle) clearTimeout(handle)
        pendingTimersRef.current.delete(timer)
        resolve(false)
      },
    }
    handle = setTimeout(() => {
      pendingTimersRef.current.delete(timer)
      resolve(true)
    }, delay)
    pendingTimersRef.current.add(timer)
  }), [])

  const focusCommentTemporarily = useCallback((commentId: number) => {
    focusedCommentClearRef.current?.()
    focusedCommentClearRef.current = null
    setFocusedCommentId(commentId)
    if (commentId <= 0) return

    focusedCommentClearRef.current = scheduleTimeout(() => {
      setFocusedCommentId((current) => current === commentId ? 0 : current)
      focusedCommentClearRef.current = null
    }, COMMENT_FOCUS_DURATION)
  }, [scheduleTimeout])

  const updateThreads = useCallback((updater: (
    current: Record<number, CommentThreadState>,
  ) => Record<number, CommentThreadState>) => {
    setThreads((current) => {
      const next = updater(current)
      threadsRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const likeInFlight = likeInFlightRef.current
    return () => {
      mountedRef.current = false
      likeInFlight.clear()
      clearPendingTimers()
      focusedCommentClearRef.current = null
    }
  }, [clearPendingTimers])

  const load = useCallback((nextPage = 1, focusId = 0) => {
    if (nextPage !== 1 && listInFlightRef.current) return listInFlightRef.current

    const scope = requestScopeRef.current
    const requestSequence = listRequestSequenceRef.current + 1
    listRequestSequenceRef.current = requestSequence
    const isCurrentRequest = () => (
      mountedRef.current
      && requestScopeRef.current === scope
      && listRequestSequenceRef.current === requestSequence
    )

    const request = (async () => {
      if (!targetId || !enabled) {
        if (!isCurrentRequest()) return
        setComments([])
        updateThreads(() => ({}))
        setTotal(0)
        setLoading(false)
        return
      }

      nextPage === 1 ? setLoading(true) : setLoadingMore(true)
      try {
        const result = await lifeServicesRepository.listComments(targetType, targetId, {
          page: nextPage,
          pageSize: 20,
        })
        if (!isCurrentRequest()) return

        let items = visibleRootComments(result.items)
        let nextThreads = previewThreadStates(items)
        if (nextPage === 1 && focusId > 0) {
          try {
            const focused = await lifeServicesRepository.getCommentThread(focusId)
            if (!isCurrentRequest()) return
            items = [focused.root, ...items.filter((item) => item.id !== focused.root.id)]
            nextThreads[focused.root.id] = {
              descendants: visibleComments(focused.descendants),
              error: '',
              expanded: true,
              loaded: true,
              loading: false,
            }
            focusCommentTemporarily(focusId)
            scheduleTimeout(() => {
              if (isCurrentRequest()) {
                void Taro.pageScrollTo({ selector: `#detail-comment-${focusId}`, duration: 260 })
              }
            }, 120)
          } catch (focusError) {
            if (isCurrentRequest()) {
              Taro.showToast({
                title: isApiError(focusError) ? focusError.message : '对应评论暂时无法查看',
                icon: 'none',
              })
            }
          }
        }
        if (!isCurrentRequest()) return

        setComments((current) => {
          if (nextPage === 1) return items
          const existingIds = new Set(current.map((entry) => entry.id))
          return [...current, ...items.filter((item) => !existingIds.has(item.id))]
        })
        updateThreads((current) => nextPage === 1 ? nextThreads : { ...current, ...nextThreads })
        setPage(result.page)
        setTotal(Number(result.total))
      } catch (error) {
        if (isCurrentRequest()) {
          Taro.showToast({
            title: isApiError(error) ? error.message : '评论加载失败',
            icon: 'none',
          })
        }
      } finally {
        if (isCurrentRequest()) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    })()

    listInFlightRef.current = request
    void request.finally(() => {
      if (listInFlightRef.current === request) listInFlightRef.current = null
    })
    return request
  }, [enabled, focusCommentTemporarily, scheduleTimeout, targetId, targetType, updateThreads])

  useEffect(() => {
    requestScopeRef.current += 1
    listInFlightRef.current = null
    threadInFlightRef.current.clear()
    threadRequestSequenceRef.current.clear()
    return () => {
      clearPendingTimers()
      focusedCommentClearRef.current = null
    }
  }, [clearPendingTimers, enabled, initialCommentId, refreshKey, targetId, targetType])

  useEffect(() => {
    if (composerOnly) {
      setComments([])
      updateThreads(() => ({}))
      setTotal(0)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    void load(1, initialCommentId)
  }, [composerOnly, initialCommentId, load, refreshKey, updateThreads])

  const loadThread = useCallback((rootId: number) => {
    const existingRequest = threadInFlightRef.current.get(rootId)
    if (existingRequest) return existingRequest

    const scope = requestScopeRef.current
    const requestSequence = (threadRequestSequenceRef.current.get(rootId) || 0) + 1
    threadRequestSequenceRef.current.set(rootId, requestSequence)
    const isCurrentRequest = () => (
      mountedRef.current
      && requestScopeRef.current === scope
      && threadRequestSequenceRef.current.get(rootId) === requestSequence
    )

    updateThreads((current) => ({
      ...current,
      [rootId]: {
        descendants: current[rootId]?.descendants || [],
        error: '',
        expanded: true,
        loaded: current[rootId]?.loaded || false,
        loading: true,
      },
    }))
    const request = (async () => {
      try {
        const result = await lifeServicesRepository.getCommentThread(rootId)
        if (!isCurrentRequest()) return
        updateThreads((current) => ({
          ...current,
          [result.root.id]: {
            descendants: visibleComments(result.descendants),
            error: '',
            expanded: true,
            loaded: true,
            loading: false,
          },
        }))
      } catch (error) {
        if (!isCurrentRequest()) return
        updateThreads((current) => ({
          ...current,
          [rootId]: {
            ...(current[rootId] || { descendants: [], loaded: false }),
            error: isApiError(error) ? error.message : '回复加载失败，请稍后重试',
            expanded: true,
            loading: false,
          },
        }))
      }
    })()

    threadInFlightRef.current.set(rootId, request)
    void request.finally(() => {
      if (threadInFlightRef.current.get(rootId) === request) {
        threadInFlightRef.current.delete(rootId)
      }
    })
    return request
  }, [updateThreads])

  const expandThread = useCallback((rootId: number) => {
    const thread = threadsRef.current[rootId]
    if (!thread?.loaded) {
      if (!thread?.loading) void loadThread(rootId)
      return
    }
    updateThreads((current) => ({
      ...current,
      [rootId]: { ...current[rootId], expanded: true },
    }))
  }, [loadThread, updateThreads])

  const toggleCommentLike = useCallback(async (comment: CommentView) => {
    const action = comment.liked ? 'unlike' : 'like'
    if (
      likeInFlightRef.current.has(comment.id)
      || !comment.available_actions.includes(action)
    ) return

    likeInFlightRef.current.add(comment.id)
    setLikingIds(new Set(likeInFlightRef.current))
    try {
      const reaction = comment.liked
        ? await lifeServicesRepository.unlikeResource(comment.id, 'comment')
        : await lifeServicesRepository.likeResource(comment.id, 'comment')
      if (reaction.resource_type !== 'comment' || reaction.resource_id !== comment.id) {
        throw new Error('评论点赞响应与请求不匹配')
      }
      if (!mountedRef.current) return

      setComments((current) => applyCommentReaction(current, reaction))
      const rootId = commentRootId(comment)
      updateThreads((current) => {
        const thread = current[rootId]
        if (!thread) return current
        const descendants = applyCommentReaction(thread.descendants, reaction)
        return descendants === thread.descendants
          ? current
          : { ...current, [rootId]: { ...thread, descendants } }
      })
    } catch (error) {
      if (isApiError(error) && error.code === 'academic_verification_required') return

      const feedback = commentLikeFailure(isApiError(error) ? error : null)
      if (feedback.refresh) await load(1)
      Taro.showToast({ title: feedback.message, icon: 'none' })
    } finally {
      likeInFlightRef.current.delete(comment.id)
      if (mountedRef.current) setLikingIds(new Set(likeInFlightRef.current))
    }
  }, [load, updateThreads])

  const openComposer = useCallback(() => {
    composerCloseSequenceRef.current += 1
    composerClosingRef.current = false
    stickerPickerOpenRef.current = false
    setComposerClosing(false)
    setComposerOpen(true)
    setInputFocused(true)
    setStickerPickerOpen(false)
    setMentionPickerOpen(false)
  }, [])

  useEffect(() => {
    if (!initialComposerOpen || !enabled || initialComposerOpenedRef.current) return
    initialComposerOpenedRef.current = true
    if (initialReplyTarget) {
      suppressCommunityOverlayDismiss(REPLY_OPEN_DISMISS_SUPPRESSION)
      setReplyTarget(initialReplyTarget)
      setReplyAnchorSelector(composerOnly
        ? `#community-comment-preview-${initialReplyTarget.id}`
        : `#detail-comment-reply-${initialReplyTarget.id}`)
    }
    openComposer()
  }, [composerOnly, enabled, initialComposerOpen, initialReplyTarget, openComposer])

  const startReply = useCallback((comment: CommentView) => {
    suppressCommunityOverlayDismiss(REPLY_OPEN_DISMISS_SUPPRESSION)
    replyTargetScrollSequenceRef.current += 1
    setReplyTarget(comment)
    setReplyAnchorSelector(`#detail-comment-reply-${comment.id}`)
    openComposer()
  }, [openComposer])

  const replyKeyboardHeight = replyAnchorSelector && composerOpen ? keyboardHeight : 0

  useEffect(() => {
    onReplyKeyboardHeightChange?.(replyKeyboardHeight)
  }, [onReplyKeyboardHeightChange, replyKeyboardHeight])

  useEffect(() => () => onReplyKeyboardHeightChange?.(0), [onReplyKeyboardHeightChange])

  useEffect(() => {
    replyTargetScrollSequenceRef.current += 1
    const scrollSequence = replyTargetScrollSequenceRef.current
    if (!composerOpen || keyboardHeight <= 0 || !replyAnchorSelector) return

    const cancel = scheduleTimeout(() => {
      scrollReplyTargetAboveComposer(replyAnchorSelector, () => (
        mountedRef.current
        && replyTargetScrollSequenceRef.current === scrollSequence
      ))
    }, Math.min(keyboardTransitionDuration, 360) + REPLY_TARGET_SCROLL_DELAY)

    return () => {
      cancel()
      replyTargetScrollSequenceRef.current += 1
    }
  }, [
    composerOpen,
    keyboardHeight,
    keyboardTransitionDuration,
    replyAnchorSelector,
    scheduleTimeout,
  ])

  const finishComposerClose = useCallback(() => {
    composerCloseSequenceRef.current += 1
    composerClosingRef.current = false
    composerActionPendingRef.current = false
    stickerPickerOpenRef.current = false
    mentionSubscriptionRequestedRef.current = false
    setComposerOpen(false)
    setComposerExpanded(false)
    setComposerClosing(false)
    setInputFocused(false)
    setStickerPickerOpen(false)
    setMentionPickerOpen(false)
    setReplyTarget(null)
    setReplyAnchorSelector('')
    setKeyboardHeight(0)
    onComposerClosed?.()
  }, [onComposerClosed])

  const closeComposer = useCallback(() => {
    replyTargetScrollSequenceRef.current += 1
    const closeSequence = composerCloseSequenceRef.current + 1
    composerCloseSequenceRef.current = closeSequence
    const shouldFollowKeyboard = inputFocused || keyboardHeight > 0

    composerClosingRef.current = true
    setComposerClosing(true)
    setInputFocused(false)
    void Taro.hideKeyboard()

    if (!shouldFollowKeyboard) {
      finishComposerClose()
      return
    }

    scheduleTimeout(() => {
      if (composerCloseSequenceRef.current === closeSequence) {
        setKeyboardHeight(0)
        finishComposerClose()
      }
    }, keyboardTransitionDuration + 120)
  }, [
    finishComposerClose,
    inputFocused,
    keyboardHeight,
    keyboardTransitionDuration,
    scheduleTimeout,
  ])

  const handleComposerBackdropTouchStart = useCallback(() => {
    if (!composerOpen || composerClosing || submitting || composerActionPendingRef.current) return
    closeComposer()
  }, [closeComposer, composerClosing, composerOpen, submitting])

  useEffect(() => {
    if (lastCloseComposerSignalRef.current === closeComposerSignal) return
    lastCloseComposerSignalRef.current = closeComposerSignal
    closeComposer()
  }, [closeComposer, closeComposerSignal])

  const handleComposerBlur = useCallback(() => {
    setInputFocused(false)
    if (composerOnly) return
    if (
      !composerClosingRef.current
      && !stickerPickerOpenRef.current
      && !composerActionPendingRef.current
    ) closeComposer()
  }, [closeComposer, composerOnly])

  const handleKeyboardHeightChange = useCallback((event: {
    detail: { duration?: number; height?: number }
  }) => {
    const height = Math.max(0, Number(event.detail.height) || 0)
    const reportedDuration = Number(event.detail.duration)
    const duration = Number.isFinite(reportedDuration) && reportedDuration >= 0
      ? Math.min(reportedDuration, 1000)
      : COMPOSER_CLOSE_DURATION

    setKeyboardTransitionDuration(duration)
    setKeyboardHeight(height)
    if (height > 0) {
      stickerPickerOpenRef.current = false
      setStickerPickerOpen(false)
      setComposerOpen(true)
      return
    }
    if (!composerClosingRef.current) return

    const closeSequence = composerCloseSequenceRef.current
    scheduleTimeout(() => {
      if (composerCloseSequenceRef.current === closeSequence) {
        finishComposerClose()
      }
    }, duration)
  }, [finishComposerClose, scheduleTimeout])

  const setStickerPickerVisible = useCallback((open: boolean) => {
    stickerPickerOpenRef.current = open
    setStickerPickerOpen(open)
    if (!open) return

    composerCloseSequenceRef.current += 1
    composerClosingRef.current = false
    setComposerClosing(false)
    setComposerOpen(true)
    setInputFocused(false)
    setKeyboardHeight(0)
    void Taro.hideKeyboard()
  }, [])

  const setMentionPickerVisible = useCallback((open: boolean) => {
    composerActionPendingRef.current = open
    setMentionPickerOpen(open)
    if (!open) {
      if (!composerOpen || !enabled) return

      const focusSequence = composerCloseSequenceRef.current + 1
      composerCloseSequenceRef.current = focusSequence
      setKeyboardHeight(0)
      setInputFocused(false)
      scheduleTimeout(() => {
        if (!mountedRef.current || composerCloseSequenceRef.current !== focusSequence) return
        setComposerOpen(true)
        setInputFocused(true)
      }, 80)
      return
    }

    setStickerPickerVisible(false)
    composerCloseSequenceRef.current += 1
    composerClosingRef.current = false
    setComposerClosing(false)
    setComposerOpen(true)
    setInputFocused(false)
    setKeyboardHeight(0)
  }, [composerOpen, enabled, scheduleTimeout, setStickerPickerVisible])

  const handleMentionTriggerClick = useCallback((event: {
    stopPropagation: () => void
  }) => {
    event.stopPropagation()
    composerActionPendingRef.current = true
    if (!mentionSubscriptionRequestedRef.current) {
      const requested = requestWechatSubscriptionForModule('private_message')
      if (requested) mentionSubscriptionRequestedRef.current = true
    }
    setMentionPickerVisible(true)
  }, [setMentionPickerVisible])

  const restoreComposerFocus = useCallback(() => {
    if (!mountedRef.current) return

    composerActionPendingRef.current = true
    composerCloseSequenceRef.current += 1
    composerClosingRef.current = false
    setComposerClosing(false)
    setComposerOpen(true)
    setKeyboardHeight(0)
    // Native image selection dismisses the textarea. Toggle focus so the
    // controlled textarea requests the keyboard again after the picker closes.
    setInputFocused(false)
    scheduleTimeout(() => {
      if (!mountedRef.current) return
      setComposerOpen(true)
      setInputFocused(true)
    }, 80)
    scheduleTimeout(() => {
      if (mountedRef.current) composerActionPendingRef.current = false
    }, 420)
  }, [scheduleTimeout])

  const updateCommentImage = useCallback((
    key: string,
    updater: (current: MediaImageDraft) => MediaImageDraft,
  ) => {
    setCommentImage((current) => current?.key === key ? updater(current) : current)
  }, [])

  const uploadCommentImage = useCallback(async (image: MediaImageDraft) => {
    if (!image.localPath) return
    updateCommentImage(image.key, (current) => ({
      ...current,
      status: 'uploading',
      progress: 0,
      error: '',
    }))
    try {
      const uploaded = await uploadMediaImage({
        purpose: 'comment',
        filePath: image.localPath,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        onProgress: (progress) => updateCommentImage(image.key, (current) => ({
          ...current,
          status: 'uploading',
          progress,
        })),
      })
      updateCommentImage(image.key, (current) => ({
        ...current,
        mediaId: uploaded.id,
        width: uploaded.width || current.width,
        height: uploaded.height || current.height,
        status: 'uploaded',
        progress: 100,
        error: '',
      }))
    } catch (error) {
      const message = commentImageErrorMessage(error)
      updateCommentImage(image.key, (current) => ({
        ...current,
        status: 'failed',
        error: message,
      }))
      Taro.showToast({ title: message, icon: 'none' })
    }
  }, [updateCommentImage])

  const chooseCommentImage = async () => {
    composerActionPendingRef.current = true
    const actionCloseSequence = composerCloseSequenceRef.current
    try {
      if (submitting) return
      if (commentImage) {
        Taro.showToast({ title: '请先删除当前图片，再添加新图片', icon: 'none' })
        return
      }
      const selected = await chooseMediaImages({
        count: MAX_COMMENT_IMAGES,
        maxDimension: COMMENT_IMAGE_MAX_DIMENSION,
        quality: DEFAULT_MEDIA_IMAGE_QUALITY,
      })
      const image = selected[0]
      if (!image) return
      if (!mountedRef.current) return
      setCommentImage(image)
      void uploadCommentImage(image)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '图片选择失败，请重试',
        icon: 'none',
      })
    } finally {
      if (
        mountedRef.current
        && composerCloseSequenceRef.current === actionCloseSequence
      ) {
        restoreComposerFocus()
      } else {
        composerActionPendingRef.current = false
      }
    }
  }

  const hasUploadedCommentImage = commentImage?.status === 'uploaded'
    && Boolean(commentImage.mediaId)
  const hasComposerContent = Boolean(content.trim()) || hasUploadedCommentImage

  const submit = async () => {
    const value = serializeStickerTokens(content.trim())
    if (submitting || !enabled) return
    if (commentImage?.status === 'uploading') {
      Taro.showToast({ title: '图片仍在上传，请稍候', icon: 'none' })
      return
    }
    if (commentImage?.status === 'failed') {
      Taro.showToast({ title: '图片上传失败，请重试或删除', icon: 'none' })
      return
    }
    if (commentImage && !hasUploadedCommentImage) {
      Taro.showToast({ title: '请等待图片上传完成', icon: 'none' })
      return
    }
    if (!value && !hasUploadedCommentImage) {
      Taro.showToast({ title: '请输入评论内容或添加图片', icon: 'none' })
      return
    }
    if (value.length > 300) {
      Taro.showToast({ title: '评论内容不能超过 300 字', icon: 'none' })
      return
    }
    const activeReplyTarget = replyTarget
    setSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const created = await lifeServicesRepository.createComment({
        target_type: targetType,
        target_id: targetId,
        content: value,
        mention_user_ids: mentionCandidates.map((candidate) => candidate.id),
        ...(activeReplyTarget ? { parent_id: activeReplyTarget.id } : {}),
        ...(commentImage?.mediaId ? { media_id: commentImage.mediaId } : {}),
      })
      if (!mountedRef.current) return
      const displayComment = created.content_segments?.length
        ? created
        : {
            ...created,
            content_segments: buildMentionContentSegments(created.content, mentionCandidates),
          }
      if (activeReplyTarget) {
        const rootId = commentRootId(activeReplyTarget)
        const rootComment = comments.find((comment) => comment.id === rootId)
        setComments((current) => current.map((comment) => (
          comment.id === rootId
            ? { ...comment, reply_count: comment.reply_count + 1 }
            : comment
        )))
        updateThreads((current) => {
          const existing = current[rootId]
          const descendants = existing?.descendants
            || visibleComments(rootComment?.reply_preview || [])
          return {
            ...current,
            [rootId]: {
              descendants: mergeLocalThreadReply(descendants, displayComment),
              error: '',
              expanded: true,
              loaded: existing?.loaded || false,
              loading: false,
            },
          }
        })
      } else {
        setComments((current) => current.some((comment) => comment.id === displayComment.id)
          ? current
          : [...current, displayComment])
        setTotal((current) => current + 1)
      }
      focusCommentTemporarily(displayComment.id)
      setEnteringCommentId(displayComment.id)
      scheduleTimeout(() => {
        if (mountedRef.current) {
          setEnteringCommentId((current) => current === displayComment.id ? 0 : current)
        }
      }, 320)
      setContent('')
      setMentionCandidates([])
      setComposerLineCount(1)
      setComposerExpanded(false)
      setCommentImage(null)
      contentSelectionStartRef.current = 0
      contentSelectionEndRef.current = 0
      closeComposer()
      if (created.status === 'approved') onApprovedDelta?.(1)
      onMutation?.({ comment: displayComment, type: 'create' })
      Taro.showToast({
        title: created.status === 'approved'
          ? activeReplyTarget ? '回复已发布' : '评论已发布'
          : activeReplyTarget ? '回复已提交审核' : '评论已提交审核',
        icon: 'success',
      })
    } catch (error) {
      if (isApiError(error) && error.code === 'academic_verification_required') return
      Taro.showToast({
        title: isApiError(error) ? error.message : '评论发布失败',
        icon: 'none',
      })
    } finally {
      onSubmittingChange?.(false)
      if (mountedRef.current) setSubmitting(false)
    }
  }

  const withdraw = async (comment: CommentView) => {
    if (withdrawingId) return
    const isReply = Boolean(comment.parent_id)
    const confirmation = await Taro.showModal({
      title: isReply ? '删除回复' : '删除评论',
      content: `删除后这条${isReply ? '回复' : '评论'}将不再展示，且无法恢复。确认删除吗？`,
      confirmText: '删除',
      confirmColor: '#ff637e',
    })
    if (!confirmation.confirm) return
    setWithdrawingId(comment.id)
    try {
      await lifeServicesRepository.withdrawComment(comment.id, comment.version)
      if (!mountedRef.current) return
      if (replyTarget?.id === comment.id) setReplyTarget(null)
      setRemovingCommentId(comment.id)
      if (!await waitForTimeout(180) || !mountedRef.current) return
      if (isReply) {
        const rootId = commentRootId(comment)
        setComments((current) => current.map((item) => item.id === rootId
          ? { ...item, reply_count: Math.max(0, item.reply_count - 1) }
          : item))
        updateThreads((current) => {
          const existing = current[rootId]
          if (!existing) return current
          return {
            ...current,
            [rootId]: {
              ...existing,
              descendants: existing.descendants
                .filter((item) => item.id !== comment.id)
                .map((item) => item.id === comment.parent_id
                  ? { ...item, reply_count: Math.max(0, item.reply_count - 1) }
                  : item),
            },
          }
        })
      } else {
        setComments((current) => current.filter((item) => item.id !== comment.id))
        updateThreads((current) => {
          const { [comment.id]: _removed, ...remaining } = current
          return remaining
        })
        setTotal((current) => Math.max(0, current - 1))
      }
      if (focusedCommentId === comment.id) focusCommentTemporarily(0)
      if (comment.status === 'approved') {
        onApprovedDelta?.(isReply ? -1 : -(1 + Math.max(0, comment.reply_count)))
      }
      onMutation?.({ comment, type: 'withdraw' })
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) && error.statusCode === 409
          ? '评论状态已变化，请刷新后重试'
          : isApiError(error) ? error.message : '删除失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      if (mountedRef.current) {
        setRemovingCommentId(0)
        setWithdrawingId(0)
      }
    }
  }

  const openCommentActions = async (comment: CommentView) => {
    const menuItems: Array<{
      label: string
      run: () => void | Promise<void>
    }> = []

    if (comment.available_actions.includes('withdraw')) {
      menuItems.push({
        label: withdrawingId === comment.id ? '删除中' : '删除',
        run: () => withdraw(comment),
      })
    } else if (comment.viewer_relation !== 'author' && comment.viewer_relation !== 'admin') {
      menuItems.push({
        label: '举报',
        run: () => {
          void openContentReport({
            resourceType: 'comment',
            resourceId: comment.id,
            resourceVersion: comment.version,
          })
        },
      })
    }

    if (menuItems.length === 0) return
    const tapIndex = await showActionSheetSelection(menuItems.map((item) => item.label))
    const selected = tapIndex === null ? null : menuItems[tapIndex]
    if (selected) await selected.run()
  }
  openCommentActionsRef.current = (comment) => {
    void openCommentActions(comment)
  }

  return (
    <>
      {enabled && composerOpen && targetType === 'campus_circle_post' && (
        <MentionPickerOverlay
          open={mentionPickerOpen}
          selected={mentionCandidates}
          keyword={mentionPicker.keyword}
          candidates={mentionPicker.candidates}
          loading={mentionPicker.loading}
          onKeywordChange={mentionPicker.setKeyword}
          onToggleCandidate={mentionPicker.toggleCandidate}
          onRemoveCandidate={mentionPicker.removeCandidate}
          onClear={mentionPicker.clearSelected}
          onOpenChange={setMentionPickerVisible}
        />
      )}
      {!composerOnly && (
        <View className='business-detail-comments'>
        {showHeading && (
          <View className='business-detail-comments__heading'>
            <View />
            <Text>{headingLabel || `评论 ${displayTotal ?? total}`}</Text>
            {headingActions && (
              <View className='business-detail-comments__heading-actions'>
                {headingActions}
              </View>
            )}
          </View>
        )}

        {loading && (
          <View
            className='business-detail-comments__skeleton'
            ariaRole='status'
            ariaLabel='评论加载中'
          >
            {[0, 1, 2].map((index) => (
              <View key={index} className='business-detail-comments__skeleton-item'>
                <View className='business-detail-comments__skeleton-avatar' />
                <View className='business-detail-comments__skeleton-body'>
                  <View className='business-detail-comments__skeleton-author' />
                  <View className='business-detail-comments__skeleton-line business-detail-comments__skeleton-line--long' />
                  <View className='business-detail-comments__skeleton-line business-detail-comments__skeleton-line--short' />
                  <View className='business-detail-comments__skeleton-meta' />
                </View>
              </View>
            ))}
          </View>
        )}
        {!loading && comments.length === 0 && (
          <View className='business-detail-comments__state'>
            {enabled ? '还没有评论，来聊聊细节吧' : '当前暂不开放评论'}
          </View>
        )}
        {!loading && comments.map((comment) => (
          <DetailCommentThread
            key={comment.id}
            comment={comment}
            thread={threads[comment.id]}
            targetAuthorId={targetAuthorId}
            focusedCommentId={focusedCommentId}
            enteringCommentId={enteringCommentId}
            removingCommentId={removingCommentId}
            likingIds={likingIds}
            currentUserId={composerAvatar.userId}
            onExpand={expandThread}
            onStartReply={startReply}
            onOpenActions={handleOpenCommentActions}
            onToggleLike={toggleCommentLike}
          />
        ))}
        {!loading && comments.length < total && (
          <View className='business-detail-comments__more' onClick={() => !loadingMore && void load(page + 1)}>
            {loadingMore ? '正在加载' : '查看更多评论'}
          </View>
        )}
        </View>
      )}

      {!composerOnly && replyKeyboardHeight > 0 && (
        <View
          className='business-detail-comments__reply-viewport-reserve'
          style={{
            height: `calc(${replyKeyboardHeight}px + 320rpx + env(safe-area-inset-bottom))`,
          }}
        />
      )}

      {(enabled || actions.length > 0 || persistentContact) && (
        <>
          {persistentContact && <View className='business-detail-comments__persistent-offset' />}
          <View
            className={composerOpen
              && !composerClosing
              ? 'business-detail-composer__backdrop business-detail-composer__backdrop--active'
              : 'business-detail-composer__backdrop'}
            catchMove
            ariaRole={composerOpen && !composerClosing ? 'button' : undefined}
            ariaLabel={composerOpen && !composerClosing ? '关闭评论输入' : undefined}
            onTouchStart={handleComposerBackdropTouchStart}
          />
          <View
            className={composerExpanded
              ? 'business-detail-composer business-detail-composer--expanded'
              : 'business-detail-composer'}
            style={{
              height: composerExpanded
                ? `calc(100vh - ${keyboardHeight + composerTopInset}px)`
                : undefined,
              transform: `translate3d(0, -${keyboardHeight}px, 0)`,
              transitionDuration: `${keyboardTransitionDuration}ms`,
            }}
          >
          {persistentContact && !composerOpen && (
            <View
              className='business-detail-composer__persistent-contact'
              ariaRole='button'
              ariaLabel={`${persistentContact.label}，${persistentContact.value}，点击复制`}
              onClick={persistentContact.onCopy}
            >
              <View className='business-detail-composer__persistent-contact-icon'>联</View>
              <View className='business-detail-composer__persistent-contact-copy'>
                <Text>{persistentContact.label}</Text>
                <Text>{persistentContact.value}</Text>
              </View>
              <Text className='business-detail-composer__persistent-contact-action'>复制</Text>
            </View>
          )}
          {replyTarget && (
            <View
              id={`business-comment-replying-${replyTarget.id}`}
              className='business-detail-composer__replying'
            >
              <Text>@{commentAuthorName(replyTarget)}</Text>
              <Text
                id={`business-comment-cancel-reply-${replyTarget.id}`}
                onTouchStart={() => {
                  if (!submitting) closeComposer()
                }}
              >取消</Text>
            </View>
          )}
          {commentImage && (
            <View className='business-detail-composer__image-attachment'>
              <View
                className='business-detail-composer__image-preview'
                ariaRole='button'
                ariaLabel={commentImage.status === 'failed'
                  ? '图片上传失败，点击重试'
                  : '预览待发布图片'}
                onClick={() => {
                  if (commentImage.status === 'failed') {
                    void uploadCommentImage(commentImage)
                    return
                  }
                  void Taro.previewImage({
                    current: commentImage.previewUrl,
                    urls: [commentImage.previewUrl],
                  })
                }}
              >
                <Image src={commentImage.previewUrl} mode='aspectFill' ariaLabel='待发布评论图片' />
                {commentImage.status === 'uploading' && (
                  <View className='business-detail-composer__image-status'>
                    <Text>上传中 {commentImage.progress}%</Text>
                    <View className='business-detail-composer__image-progress'>
                      <View style={{ width: `${commentImage.progress}%` }} />
                    </View>
                  </View>
                )}
                {commentImage.status === 'failed' && (
                  <View className='business-detail-composer__image-status business-detail-composer__image-status--failed'>
                    <Text>上传失败 · 重试</Text>
                  </View>
                )}
                <CoverView
                  className='business-detail-composer__image-remove'
                  ariaRole='button'
                  ariaLabel='删除待发布图片'
                  catchMove
                  onTouchStart={(event) => {
                    event.stopPropagation()
                    composerActionPendingRef.current = true
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    composerActionPendingRef.current = false
                    if (!submitting) setCommentImage(null)
                  }}
                >
                  ×
                </CoverView>
              </View>
              {commentImage.status === 'failed' && (
                <Text className='business-detail-composer__image-error'>
                  {commentImage.error || '图片上传失败，请点击图片重试或删除'}
                </Text>
              )}
            </View>
          )}
          {enabled && composerOpen && (
            <View className='business-detail-composer__tool-row'>
              {targetType === 'campus_circle_post' && (
                <View
                  className={mentionPickerOpen
                    ? 'business-detail-composer__mention-trigger business-detail-composer__mention-trigger--active'
                    : 'business-detail-composer__mention-trigger'}
                  ariaRole='button'
                  ariaLabel='选择要提及的同学'
                  onTouchStart={(event) => {
                    event.stopPropagation()
                    composerActionPendingRef.current = true
                  }}
                  onClick={handleMentionTriggerClick}
                >
                  <Image src={icons.mention} mode='aspectFit' />
                </View>
              )}
              <View
                className={stickerPickerOpen
                  ? 'business-detail-composer__sticker-trigger business-detail-composer__sticker-trigger--active'
                  : 'business-detail-composer__sticker-trigger'}
                ariaRole='button'
                ariaLabel={stickerPickerOpen ? '收起表情面板' : '选择表情'}
                onTouchStart={(event) => {
                  event.stopPropagation()
                  composerActionPendingRef.current = true
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  composerActionPendingRef.current = false
                  setStickerPickerVisible(!stickerPickerOpen)
                }}
              >
                <Image src={require('../../../assets/icons/smile.svg')} mode='aspectFit' />
              </View>
              <View
                className={commentImage
                  ? 'business-detail-composer__image-trigger business-detail-composer__image-trigger--disabled'
                  : 'business-detail-composer__image-trigger'}
                ariaRole='button'
                ariaLabel={commentImage ? '已添加 1 张图片，请先删除后更换' : '添加图片'}
                onTouchStart={(event) => {
                  event.stopPropagation()
                  composerActionPendingRef.current = true
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  void chooseCommentImage()
                }}
              >
                <Image src={require('../../../assets/icons/image.svg')} mode='aspectFit' />
              </View>
            </View>
          )}
          <View className='business-detail-composer__main'>
            <UserAvatar
              src={composerAvatar.src}
              className='business-detail-composer__avatar'
              imageClassName='business-detail-composer__avatar-image'
              fallback={composerAvatar.fallback}
              userId={composerAvatar.userId}
              lazyLoad
            />
            {enabled ? (
              <View className={(composerLineCount > 2 || composerExpanded)
                ? 'business-detail-composer__input-shell business-detail-composer__input-shell--expandable'
                : 'business-detail-composer__input-shell'}
              >
                <KeyboardSafeTextarea
                  id={`business-comment-${targetType}-${targetId}`}
                  value={content}
                  focus={composerOpen && inputFocused && !mentionPickerOpen}
                  disabled={submitting}
                  maxlength={300}
                  autoHeight={!composerExpanded}
                  fixed
                  disableDefaultPadding
                  confirmType='send'
                  confirmHold
                  showConfirmBar={false}
                  keepVisibleOnKeyboard={false}
                  placeholder={replyTarget ? '写下回复...' : placeholder}
                  placeholderClass='business-detail-composer__placeholder'
                  onFocus={() => {
                    composerActionPendingRef.current = false
                    openComposer()
                  }}
                  onBlur={handleComposerBlur}
                  onInput={(event) => {
                    const detail = event.detail as typeof event.detail & {
                      cursor?: number
                      selectionEnd?: number
                      selectionStart?: number
                    }
                    const cursor = Number.isFinite(detail.cursor) ? Number(detail.cursor) : detail.value.length
                    const selectionStart = Number.isFinite(detail.selectionStart)
                      ? Number(detail.selectionStart)
                      : cursor
                    const selectionEnd = Number.isFinite(detail.selectionEnd)
                      ? Number(detail.selectionEnd)
                      : cursor
                    const mentionDeletion = expandMentionDeletion(
                      content,
                      detail.value,
                      mentionCandidates,
                    )
                    if (mentionDeletion.cursor !== null) {
                      contentSelectionStartRef.current = mentionDeletion.cursor
                      contentSelectionEndRef.current = mentionDeletion.cursor
                    } else {
                      contentSelectionStartRef.current = Math.max(0, selectionStart)
                      contentSelectionEndRef.current = Math.max(
                        contentSelectionStartRef.current,
                        selectionEnd,
                      )
                    }
                    if (mentionDeletion.removedCandidateIds.length > 0) {
                      const removedIds = new Set(mentionDeletion.removedCandidateIds)
                      setMentionCandidates((current) => current.filter(
                        (candidate) => !removedIds.has(candidate.id),
                      ))
                    }
                    setContent(mentionDeletion.text)
                  }}
                  onLineChange={(event) => {
                    setComposerLineCount(Math.max(1, Number(event.detail.lineCount) || 1))
                  }}
                  onSelectionChange={(event) => {
                    const detail = event.detail as {
                      selectionEnd?: number
                      selectionStart?: number
                    }
                    const selectionStart = Number(detail.selectionStart)
                    const selectionEnd = Number(detail.selectionEnd)
                    if (!Number.isFinite(selectionStart) || !Number.isFinite(selectionEnd)) return
                    contentSelectionStartRef.current = Math.max(0, selectionStart)
                    contentSelectionEndRef.current = Math.max(
                      contentSelectionStartRef.current,
                      selectionEnd,
                    )
                  }}
                  onConfirm={() => void submit()}
                  onKeyboardHeightChange={handleKeyboardHeightChange}
                />
                {(composerLineCount > 2 || composerExpanded) && (
                  <View
                    className='business-detail-composer__expand'
                    ariaRole='button'
                    ariaLabel={composerExpanded ? '收起评论输入框' : '展开评论输入框到半屏'}
                    onTouchStart={() => {
                      composerActionPendingRef.current = true
                    }}
                    onClick={() => {
                      composerActionPendingRef.current = false
                      setStickerPickerVisible(false)
                      setComposerExpanded((current) => !current)
                      setInputFocused(true)
                    }}
                  >
                    <Image
                      src={composerExpanded ? icons.collapse : icons.expand}
                      mode='aspectFit'
                    />
                  </View>
                )}
              </View>
            ) : (
              <View className='business-detail-composer__disabled'>评论暂未开放</View>
            )}
            {enabled && composerOpen ? (
              <View
                id={`business-comment-submit-${targetType}-${targetId}`}
                className={[
                  'business-detail-composer__publish',
                  `business-detail-composer__publish--${tone}`,
                  !hasComposerContent || submitting ? 'business-detail-composer__publish--disabled' : '',
                ].filter(Boolean).join(' ')}
                ariaRole='button'
                ariaLabel={submitting ? '评论发布中' : '发布评论'}
                onClick={() => {
                  if (hasComposerContent && !submitting) void submit()
                }}
              >
                <Image src={icons.send} mode='aspectFit' />
              </View>
            ) : (
              <>
                {quickAction && (
                  <View
                    className='business-detail-composer__quick'
                    ariaRole='button'
                    ariaLabel={quickAction.label}
                    onClick={quickAction.onClick}
                  >
                    <Image src={quickAction.active && quickAction.activeIcon ? quickAction.activeIcon : quickAction.icon} mode='aspectFit' />
                  </View>
                )}
              </>
            )}
            {!composerOpen && actions.length > 0 && (
              <View className='business-detail-composer__actions'>
                {actions.map((action) => (
                  <View
                    key={action.key}
                    id={`detail-action-${action.key}`}
                    className={[
                      'business-detail-composer__action',
                      `business-detail-composer__action--${action.emphasis || 'secondary'}`,
                      `business-detail-composer__action--${tone}`,
                      action.busy ? 'business-detail-composer__action--busy' : '',
                    ].join(' ')}
                    ariaRole='button'
                    ariaLabel={action.busy ? `${action.label}处理中` : action.label}
                    onClick={() => {
                      if (!action.busy) action.onClick()
                    }}
                  >
                    <Text>{action.busy ? '处理中' : action.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {enabled && composerOpen && (
            <StickerPicker
              open={stickerPickerOpen}
              className={stickerPickerOpen
                ? 'business-detail-composer__sticker-picker business-detail-composer__sticker-picker--open'
                : 'business-detail-composer__sticker-picker'}
              onOpenChange={setStickerPickerVisible}
              onSelect={(sticker) => {
                const inserted = insertStickerToken(
                  content,
                  sticker.id,
                  contentSelectionStartRef.current,
                  contentSelectionEndRef.current,
                )
                contentSelectionStartRef.current = inserted.cursor
                contentSelectionEndRef.current = inserted.cursor
                setContent(inserted.text)
              }}
            />
          )}
          </View>
        </>
      )}
    </>
  )
}

export const createBusinessContactComment = async (
  targetType: Exclude<DetailCommentTarget, 'campus_circle_post'>,
  targetId: number,
  content: string,
) => lifeServicesRepository.createComment({
  target_type: targetType,
  target_id: targetId,
  content,
})
