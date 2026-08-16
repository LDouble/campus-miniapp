import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import type { CommentView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import UserAvatarImage from '../../../components/user-avatar-image'
import { KeyboardSafeTextarea } from '../../../components/keyboard-safe-input'
import { openContentReport } from '../../content-report'
import { openPublicProfile } from '../../profile/public-profile'
import {
  buildCommentTree,
  commentReplyTargetName,
  commentRootId,
  mergeLocalThreadReply,
} from '../../community/comments'
import type { CommentTreeNode } from '../../community/comments'
import CommunityLevelBadge from '../../community/level-badge'
import { formatDateTime, formatStatus } from '../format'
import { lifeServicesRepository } from '../repository'
import { showActionSheetSelection } from '../../../utils/action-sheet'
import './detail-comments.scss'

const icons = {
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

type CommentThreadState = {
  descendants: CommentView[]
  error: string
  expanded: boolean
  loaded: boolean
  loading: boolean
}

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
  const [composerOpen, setComposerOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [focusedCommentId, setFocusedCommentId] = useState(initialCommentId)
  const [enteringCommentId, setEnteringCommentId] = useState(0)
  const [removingCommentId, setRemovingCommentId] = useState(0)

  const load = useCallback(async (nextPage = 1, focusId = 0) => {
    if (!targetId || !enabled) {
      setComments([])
      setThreads({})
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
      let items = visibleRootComments(result.items)
      let nextThreads = previewThreadStates(items)
      if (nextPage === 1 && focusId > 0) {
        try {
          const focused = await lifeServicesRepository.getCommentThread(focusId)
          items = [focused.root, ...items.filter((item) => item.id !== focused.root.id)]
          nextThreads[focused.root.id] = {
            descendants: visibleComments(focused.descendants),
            error: '',
            expanded: true,
            loaded: true,
            loading: false,
          }
          setFocusedCommentId(focusId)
          setTimeout(() => {
            void Taro.pageScrollTo({ selector: `#detail-comment-${focusId}`, duration: 260 })
          }, 120)
        } catch (focusError) {
          Taro.showToast({
            title: isApiError(focusError) ? focusError.message : '对应评论暂时无法查看',
            icon: 'none',
          })
        }
      }
      setComments((current) => nextPage === 1
        ? items
        : [...current, ...items.filter((item) => !current.some((entry) => entry.id === item.id))])
      setThreads((current) => nextPage === 1 ? nextThreads : { ...current, ...nextThreads })
      setPage(result.page)
      setTotal(Number(result.total))
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '评论加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [enabled, targetId, targetType])

  useEffect(() => {
    void load(1, initialCommentId)
  }, [initialCommentId, load, refreshKey])

  const loadThread = async (rootId: number) => {
    setThreads((current) => ({
      ...current,
      [rootId]: {
        descendants: current[rootId]?.descendants || [],
        error: '',
        expanded: true,
        loaded: current[rootId]?.loaded || false,
        loading: true,
      },
    }))
    try {
      const result = await lifeServicesRepository.getCommentThread(rootId)
      setThreads((current) => ({
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
      setThreads((current) => ({
        ...current,
        [rootId]: {
          ...(current[rootId] || { descendants: [], loaded: false }),
          error: isApiError(error) ? error.message : '回复加载失败，请稍后重试',
          expanded: true,
          loading: false,
        },
      }))
    }
  }

  const expandThread = (comment: CommentView) => {
    const thread = threads[comment.id]
    if (!thread?.loaded) {
      if (!thread?.loading) void loadThread(comment.id)
      return
    }
    setThreads((current) => ({
      ...current,
      [comment.id]: { ...current[comment.id], expanded: true },
    }))
  }

  const startReply = (comment: CommentView) => {
    const rootId = commentRootId(comment)
    setReplyTarget(comment)
    setComposerOpen(true)
    setInputFocused(true)
    setThreads((current) => current[rootId]
      ? { ...current, [rootId]: { ...current[rootId], expanded: true } }
      : current)
    if (!threads[rootId]?.loaded && !threads[rootId]?.loading) void loadThread(rootId)
  }

  const openComposer = () => {
    if (!enabled) return
    setComposerOpen(true)
    setInputFocused(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setInputFocused(false)
    setReplyTarget(null)
    setKeyboardHeight(0)
    void Taro.hideKeyboard()
  }

  const submit = async () => {
    const value = content.trim()
    if (!value || submitting || !enabled) {
      if (!value) Taro.showToast({ title: '请输入评论内容', icon: 'none' })
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
      if (activeReplyTarget) {
        const rootId = commentRootId(activeReplyTarget)
        const rootComment = comments.find((comment) => comment.id === rootId)
        setComments((current) => current.map((comment) => (
          comment.id === rootId
            ? { ...comment, reply_count: comment.reply_count + 1 }
            : comment
        )))
        setThreads((current) => {
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
      setFocusedCommentId(created.id)
      setEnteringCommentId(created.id)
      setTimeout(() => {
        setEnteringCommentId((current) => current === created.id ? 0 : current)
      }, 320)
      setContent('')
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
      setSubmitting(false)
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
      if (replyTarget?.id === comment.id) setReplyTarget(null)
      setRemovingCommentId(comment.id)
      await new Promise((resolve) => setTimeout(resolve, 180))
      if (isReply) {
        const rootId = commentRootId(comment)
        setComments((current) => current.map((item) => item.id === rootId
          ? { ...item, reply_count: Math.max(0, item.reply_count - 1) }
          : item))
        setThreads((current) => {
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
        setThreads((current) => {
          const { [comment.id]: _removed, ...remaining } = current
          return remaining
        })
        setTotal((current) => Math.max(0, current - 1))
      }
      if (focusedCommentId === comment.id) setFocusedCommentId(0)
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
      setRemovingCommentId(0)
      setWithdrawingId(0)
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

  const renderMeta = (comment: CommentView) => (
    <View className='business-detail-comment__meta'>
      <Text>{formatDateTime(comment.created_at)}</Text>
      {comment.status !== 'approved' && <Text>{formatStatus(comment.status)}</Text>}
    </View>
  )

  const renderReplyTree = (
    nodes: CommentTreeNode<CommentView>[],
    members: CommentView[],
  ) => nodes.map(({ comment, children }) => (
    <View key={comment.id} className='business-detail-comment__reply-node'>
      <View
        id={`detail-comment-${comment.id}`}
        className={[
          'business-detail-comment__reply',
          focusedCommentId === comment.id ? 'business-detail-comment__reply--focused' : '',
          enteringCommentId === comment.id ? 'business-detail-comment-node--entering' : '',
          removingCommentId === comment.id ? 'business-detail-comment-node--removing' : '',
        ].filter(Boolean).join(' ')}
        onLongPress={() => void openCommentActions(comment)}
      >
        <View
          className='business-detail-comment__reply-identity'
          ariaRole='button'
          ariaLabel={`查看${commentAuthorName(comment)}的个人主页`}
          onClick={() => openCommentAuthor(comment)}
        >
          <Text className='business-detail-comment__reply-relation'>
            {compactCommentName(commentAuthorName(comment))}
            {commentReplyTargetName(comment, members)
              ? `@${compactCommentName(commentReplyTargetName(comment, members))}`
              : ''}
          </Text>
          {comment.author_id === targetAuthorId && <Text className='business-detail-comment__author-badge'>作者</Text>}
          <CommunityLevelBadge level={comment.author_level} compact />
        </View>
        <Text className='business-detail-comment__reply-content' onClick={() => startReply(comment)}>
          {comment.content}
        </Text>
        {renderMeta(comment)}
      </View>
      {children.length > 0 && (
        <View className='business-detail-comment__reply-children'>
          {renderReplyTree(children, members)}
        </View>
      )}
    </View>
  ))

  return (
    <>
      <View className='business-detail-comments'>
        <View className='business-detail-comments__heading'>
          <View />
          <Text>全部评论</Text>
          <Text>{displayTotal ?? total}</Text>
        </View>

        {loading && <View className='business-detail-comments__state'>正在加载评论</View>}
        {!loading && comments.length === 0 && (
          <View className='business-detail-comments__state'>
            {enabled ? '还没有评论，来聊聊细节吧' : '当前暂不开放评论'}
          </View>
        )}
        {!loading && comments.map((comment) => {
          const thread = threads[comment.id]
          const preview = thread?.descendants || visibleComments(comment.reply_preview || [])
          const descendants = thread?.expanded ? preview : preview.slice(0, 2)
          const members = [comment, ...preview]
          const replyTree = buildCommentTree(comment.id, descendants)
          const hasHiddenReplies = comment.reply_count > Math.min(preview.length, 2)
          const showThreadAction = Boolean(thread?.loading)
            || (!thread?.expanded && hasHiddenReplies)
          return (
            <View
              key={comment.id}
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
                    onClick={() => startReply(comment)}
                    onLongPress={() => void openCommentActions(comment)}
                  >
                    <Text>{comment.content}</Text>
                  </View>
                  {renderMeta(comment)}
                  {showThreadAction && (
                    <View className='business-detail-comment__thread-action' onClick={() => expandThread(comment)}>
                      {thread?.loading ? '加载回复中…' : `查看全部 ${comment.reply_count} 条回复`}
                    </View>
                  )}
                </View>
              </View>
              {thread?.error && (
                <View className='business-detail-comment__thread-error' onClick={() => void loadThread(comment.id)}>
                  {thread.error}，点击重试
                </View>
              )}
              {descendants.length > 0 && (
                <View className='business-detail-comment__replies'>
                  {renderReplyTree(replyTree, members)}
                </View>
              )}
            </View>
          )
        })}
        {!loading && comments.length < total && (
          <View className='business-detail-comments__more' onClick={() => !loadingMore && void load(page + 1)}>
            {loadingMore ? '正在加载' : '查看更多评论'}
          </View>
        )}
      </View>

      {(enabled || actions.length > 0) && (
        <>
          {composerOpen && (
            <View
              className='business-detail-composer__backdrop'
              catchMove
              ariaRole='button'
              ariaLabel='关闭评论输入'
              onClick={closeComposer}
            />
          )}
          <View className='business-detail-composer' style={{ bottom: `${keyboardHeight}px` }}>
          {replyTarget && (
            <View className='business-detail-composer__replying'>
              <Text>@{compactCommentName(commentAuthorName(replyTarget), 10)}</Text>
              <Text onClick={closeComposer}>取消</Text>
            </View>
          )}
          <View className='business-detail-composer__main'>
            {enabled && composerOpen ? (
              <KeyboardSafeTextarea
                id={`business-comment-${targetType}-${targetId}`}
                value={content}
                focus={inputFocused}
                disabled={submitting}
                maxlength={300}
                autoHeight
                fixed
                disableDefaultPadding
                confirmType='send'
                confirmHold
                showConfirmBar={false}
                keepVisibleOnKeyboard={false}
                placeholder={replyTarget ? `@${compactCommentName(commentAuthorName(replyTarget), 10)}` : placeholder}
                onFocus={() => {
                  setComposerOpen(true)
                  setInputFocused(true)
                }}
                onBlur={() => setInputFocused(false)}
                onInput={(event) => setContent(event.detail.value)}
                onConfirm={() => void submit()}
                onKeyboardVisibilityChange={(height) => {
                  setKeyboardHeight(height)
                  if (height > 0) setComposerOpen(true)
                }}
              />
            ) : enabled ? (
              <View className='business-detail-composer__collapsed-input' onClick={openComposer}>
                <Text>{content || placeholder}</Text>
              </View>
            ) : (
              <View className='business-detail-composer__disabled'>评论暂未开放</View>
            )}
            {enabled && composerOpen ? (
              <View
                className={[
                  'business-detail-composer__publish',
                  `business-detail-composer__publish--${tone}`,
                  !content.trim() || submitting ? 'business-detail-composer__publish--disabled' : '',
                ].filter(Boolean).join(' ')}
                ariaRole='button'
                ariaLabel={submitting ? '评论发布中' : '发布评论'}
                onClick={!content.trim() || submitting ? undefined : () => void submit()}
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
