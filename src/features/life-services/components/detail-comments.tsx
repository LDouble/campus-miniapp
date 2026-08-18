import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import type { CommentView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import UserAvatarImage from '../../../components/user-avatar-image'
import { KeyboardSafeTextarea } from '../../../components/keyboard-safe-input'
import StickerContent from '../../../components/sticker-content'
import StickerPicker from '../../../components/sticker-picker'
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
import CommunityLevelBadge from '../../community/level-badge'
import { formatDateTime, formatStatus } from '../format'
import { lifeServicesRepository } from '../repository'
import { showActionSheetSelection } from '../../../utils/action-sheet'
import './detail-comments.scss'

const icons = {
  heart: require('../../../assets/community/heart.svg'),
  heartActive: require('../../../assets/community/heart-active.svg'),
  send: require('../../../assets/community/send.svg'),
  share: require('../../../assets/community/share.svg'),
}

export type DetailCommentTarget = 'campus_circle_post' | 'marketplace' | 'errand' | 'carpool'

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

type DetailCommentsProps = {
  targetType: DetailCommentTarget
  targetId: number
  enabled?: boolean
  refreshKey?: number
  targetAuthorId?: number
  initialCommentId?: number
  displayTotal?: number
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

const commentAuthorName = (comment: CommentView) => (
  comment.author_deleted
    ? '已注销用户'
    : comment.author_nickname?.trim() || `用户 #${comment.author_id}`
)

const commentAuthorInitial = (comment: CommentView) => (
  Array.from(commentAuthorName(comment))[0] || '同'
)

const compactCommentName = (name: string, maxLength = 6) => {
  const characters = Array.from(name.trim())
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : characters.join('')
}

const renderCommentMeta = (
  comment: CommentView,
  liking: boolean,
  onToggleLike: (comment: CommentView) => void,
) => {
  const expectedAction = comment.liked ? 'unlike' : 'like'
  const canToggleLike = comment.available_actions.includes(expectedAction)

  return (
    <View className='business-detail-comment__meta'>
      <Text>{formatDateTime(comment.created_at)}</Text>
      {comment.status !== 'approved' && <Text>{formatStatus(comment.status)}</Text>}
      {canToggleLike ? (
        <View
          className={[
            'business-detail-comment__like',
            comment.liked ? 'business-detail-comment__like--active' : '',
            liking ? 'business-detail-comment__like--busy' : '',
          ].filter(Boolean).join(' ')}
          hoverClass={!liking ? 'business-detail-comment__like--pressed' : undefined}
          hoverStartTime={20}
          hoverStayTime={100}
          ariaRole='button'
          ariaLabel={`${liking ? '点赞处理中' : comment.liked ? '取消点赞' : '点赞'}，当前 ${comment.like_count} 个赞`}
          onClick={!liking ? () => onToggleLike(comment) : undefined}
        >
          <Image src={comment.liked ? icons.heartActive : icons.heart} mode='aspectFit' />
          <Text>{comment.like_count}</Text>
        </View>
      ) : (
        <Text className='business-detail-comment__like-count'>
          {comment.like_count} 赞
        </Text>
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
          focusedCommentId === comment.id ? 'business-detail-comment__reply--focused' : '',
          enteringCommentId === comment.id ? 'business-detail-comment-node--entering' : '',
          removingCommentId === comment.id ? 'business-detail-comment-node--removing' : '',
        ].filter(Boolean).join(' ')}
        onLongPress={() => onOpenActions(comment)}
      >
        <View
          className='business-detail-comment__reply-identity'
          ariaRole='button'
          ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
          onClick={() => openCommentAuthor(comment)}
        >
          <Text className='business-detail-comment__reply-relation'>
            {compactCommentName(commentAuthorName(comment))}
            {replyTargetName ? `@${compactCommentName(replyTargetName)}` : ''}
          </Text>
          {comment.author_id === targetAuthorId && <Text className='business-detail-comment__author-badge'>作者</Text>}
          <CommunityLevelBadge level={comment.author_level} compact />
        </View>
        <View className='business-detail-comment__reply-content' onClick={() => onStartReply(comment)}>
          <StickerContent
            content={comment.content}
            stickerClassName='business-detail-comment__sticker'
          />
        </View>
        {renderCommentMeta(comment, likingIds.has(comment.id), onToggleLike)}
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
        className={`business-detail-comment ${focusedCommentId === comment.id ? 'business-detail-comment--focused' : ''}`}
      >
        <View
          className='business-detail-comment__avatar'
          ariaRole='button'
          ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
          onClick={() => openCommentAuthor(comment)}
        >
          <UserAvatarImage
            src={comment.author_avatar_url || ''}
            className='business-detail-comment__avatar-image'
            fallback={commentAuthorInitial(comment)}
            lazyLoad
          />
        </View>
        <View className='business-detail-comment__body'>
          <View
            className='business-detail-comment__identity'
            ariaRole='button'
            ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
            onClick={() => openCommentAuthor(comment)}
          >
            <Text className='business-detail-comment__author'>{commentAuthorName(comment)}</Text>
            {comment.author_id === targetAuthorId && <Text className='business-detail-comment__author-badge'>作者</Text>}
            <CommunityLevelBadge level={comment.author_level} compact />
          </View>
          <View
            className='business-detail-comment__bubble'
            ariaRole='button'
            ariaLabel='点击回复，长按查看更多操作'
            onClick={() => onStartReply(comment)}
            onLongPress={() => onOpenActions(comment)}
          >
            <StickerContent
              content={comment.content}
              stickerClassName='business-detail-comment__sticker'
            />
          </View>
          {renderCommentMeta(comment, likingIds.has(comment.id), onToggleLike)}
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
  displayTotal,
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
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState(0)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [keyboardTransitionDuration, setKeyboardTransitionDuration] = useState(
    COMPOSER_CLOSE_DURATION,
  )
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerClosing, setComposerClosing] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [focusedCommentId, setFocusedCommentId] = useState(0)
  const [enteringCommentId, setEnteringCommentId] = useState(0)
  const [removingCommentId, setRemovingCommentId] = useState(0)
  const [likingIds, setLikingIds] = useState<ReadonlySet<number>>(() => new Set())
  const mountedRef = useRef(true)
  const requestScopeRef = useRef(0)
  const listRequestSequenceRef = useRef(0)
  const listInFlightRef = useRef<Promise<void> | null>(null)
  const threadRequestSequenceRef = useRef(new Map<number, number>())
  const threadInFlightRef = useRef(new Map<number, Promise<void>>())
  const threadsRef = useRef(threads)
  const pendingTimersRef = useRef(new Set<PendingTimer>())
  const composerCloseSequenceRef = useRef(0)
  const composerClosingRef = useRef(false)
  const stickerPickerOpenRef = useRef(false)
  const contentSelectionStartRef = useRef(0)
  const contentSelectionEndRef = useRef(0)
  const focusedCommentClearRef = useRef<null | (() => void)>(null)
  const likeInFlightRef = useRef(new Set<number>())
  const openCommentActionsRef = useRef<(comment: CommentView) => void>(() => {})
  const handleOpenCommentActions = useCallback((comment: CommentView) => {
    openCommentActionsRef.current(comment)
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
    void load(1, initialCommentId)
  }, [initialCommentId, load, refreshKey])

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
  }, [])

  const startReply = useCallback((comment: CommentView) => {
    setReplyTarget(comment)
    openComposer()
  }, [openComposer])

  const finishComposerClose = useCallback(() => {
    composerCloseSequenceRef.current += 1
    composerClosingRef.current = false
    stickerPickerOpenRef.current = false
    setComposerOpen(false)
    setComposerClosing(false)
    setInputFocused(false)
    setStickerPickerOpen(false)
    setReplyTarget(null)
    setKeyboardHeight(0)
  }, [])

  const closeComposer = useCallback(() => {
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

  const handleComposerBlur = useCallback(() => {
    setInputFocused(false)
    if (!composerClosingRef.current && !stickerPickerOpenRef.current) closeComposer()
  }, [closeComposer])

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

  const hasComposerContent = Boolean(content.trim())

  const submit = async () => {
    const value = serializeStickerTokens(content.trim())
    if (!value || submitting || !enabled) {
      if (!value) Taro.showToast({ title: '请输入评论内容或选择表情', icon: 'none' })
      return
    }
    if (value.length > 300) {
      Taro.showToast({ title: '评论内容不能超过 300 字', icon: 'none' })
      return
    }
    const activeReplyTarget = replyTarget
    setSubmitting(true)
    try {
      const created = await lifeServicesRepository.createComment({
        target_type: targetType,
        target_id: targetId,
        content: value,
        ...(activeReplyTarget ? { parent_id: activeReplyTarget.id } : {}),
      })
      if (!mountedRef.current) return
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
              descendants: mergeLocalThreadReply(descendants, created),
              error: '',
              expanded: true,
              loaded: existing?.loaded || false,
              loading: false,
            },
          }
        })
      } else {
        setComments((current) => current.some((comment) => comment.id === created.id)
          ? current
          : [...current, created])
        setTotal((current) => current + 1)
      }
      focusCommentTemporarily(created.id)
      setEnteringCommentId(created.id)
      scheduleTimeout(() => {
        if (mountedRef.current) {
          setEnteringCommentId((current) => current === created.id ? 0 : current)
        }
      }, 320)
      setContent('')
      contentSelectionStartRef.current = 0
      contentSelectionEndRef.current = 0
      closeComposer()
      if (created.status === 'approved') onApprovedDelta?.(1)
      onMutation?.({ comment: created, type: 'create' })
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
      <View className='business-detail-comments'>
        <View className='business-detail-comments__heading'>
          <View />
          <Text>全部评论</Text>
          <Text>{displayTotal ?? total}</Text>
        </View>

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

      {(enabled || actions.length > 0 || persistentContact) && (
        <>
          {persistentContact && <View className='business-detail-comments__persistent-offset' />}
          <View
            className={composerOpen
              && !composerClosing
              ? 'business-detail-composer__backdrop business-detail-composer__backdrop--active'
              : 'business-detail-composer__backdrop'}
            catchMove={composerOpen && !composerClosing}
            ariaRole={composerOpen && !composerClosing ? 'button' : undefined}
            ariaLabel={composerOpen && !composerClosing ? '关闭评论输入' : undefined}
            onTouchStart={composerOpen && !composerClosing ? closeComposer : undefined}
          />
          <View
            className='business-detail-composer'
            style={{
              transform: `translate3d(0, -${keyboardHeight}px, 0)`,
              transitionDuration: `${keyboardTransitionDuration}ms`,
            }}
          >
          {persistentContact && !composerOpen && (
            <View
              className='business-detail-composer__persistent-contact'
              hoverClass='business-detail-composer__persistent-contact--pressed'
              hoverStartTime={20}
              hoverStayTime={100}
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
            <View className='business-detail-composer__replying'>
              <Text>@{compactCommentName(commentAuthorName(replyTarget), 10)}</Text>
              <Text onTouchStart={closeComposer}>取消</Text>
            </View>
          )}
          <View className='business-detail-composer__main'>
            {enabled ? (
              <KeyboardSafeTextarea
                id={`business-comment-${targetType}-${targetId}`}
                value={content}
                focus={composerOpen && inputFocused}
                disabled={submitting}
                maxlength={300}
                autoHeight
                fixed
                disableDefaultPadding
                confirmType='send'
                confirmHold
                showConfirmBar={false}
                keepVisibleOnKeyboard={false}
                placeholder={replyTarget ? '写下回复...' : placeholder}
                onFocus={() => {
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

                  contentSelectionStartRef.current = Math.max(0, selectionStart)
                  contentSelectionEndRef.current = Math.max(
                    contentSelectionStartRef.current,
                    selectionEnd,
                  )
                  setContent(detail.value)
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
            ) : (
              <View className='business-detail-composer__disabled'>评论暂未开放</View>
            )}
            {enabled && composerOpen ? (
              <>
                <View
                  className={stickerPickerOpen
                    ? 'business-detail-composer__sticker-trigger business-detail-composer__sticker-trigger--active'
                    : 'business-detail-composer__sticker-trigger'}
                  hoverClass='business-detail-composer__sticker-trigger--pressed'
                  hoverStartTime={20}
                  hoverStayTime={100}
                  ariaRole='button'
                  ariaLabel={stickerPickerOpen ? '收起表情面板' : '选择表情'}
                  onClick={() => setStickerPickerVisible(!stickerPickerOpen)}
                >
                  <Text>☺</Text>
                </View>
                <View
                  className={[
                    'business-detail-composer__publish',
                    `business-detail-composer__publish--${tone}`,
                    !hasComposerContent || submitting ? 'business-detail-composer__publish--disabled' : '',
                  ].filter(Boolean).join(' ')}
                  ariaRole='button'
                  ariaLabel={submitting ? '评论发布中' : '发布评论'}
                  onClick={!hasComposerContent || submitting ? undefined : () => void submit()}
                >
                  <Image src={icons.send} mode='aspectFit' />
                </View>
              </>
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
                <Button className='business-detail-composer__share' openType='share'>
                  <Image src={icons.share} mode='aspectFit' />
                </Button>
              </>
            )}
            {!composerOpen && actions.length > 0 && (
              <View className='business-detail-composer__actions'>
                {actions.map((action) => (
                  <View
                    key={action.key}
                    className={[
                      'business-detail-composer__action',
                      `business-detail-composer__action--${action.emphasis || 'secondary'}`,
                      `business-detail-composer__action--${tone}`,
                    ].join(' ')}
                    onClick={action.busy ? undefined : action.onClick}
                  >
                    {action.busy ? '处理中' : action.label}
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
