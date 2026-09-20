import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, Switch, Text, View } from '@tarojs/components'
import { useViewPageVisible } from '../../../features/community/use-view-page-visible'
import type {
  CampusCircleClassParticipation,
  CampusCirclePostView,
  CampusCircleTopicView,
} from '../../../api/types'
import { isApiError } from '../../../api/client'
import CustomNavbar from '../../../components/custom-navbar'
import {
  communityTopicPublisherUrl,
  parsePositiveId,
} from '../../../features/community/topic'
import {
  getClassDiscussionMaterialNavigation,
  isClassDiscussionTopic,
  visibleClassDiscussionAnnouncement,
} from '../../../features/class-discussion/context'
import {
  classDiscussionTopicPublisherUrl,
  classQuickQuestions,
  type ClassQuickQuestionId,
} from '../../../features/class-discussion/topic'
import { lifeServicesRepository } from '../../../features/life-services/repository'
import {
  getLifeHubRefreshRevision,
  markLifeHubSectionDirty,
} from '../../../features/life-services/refresh-policy'
import CommunityCommentSheet from '../../../features/community/comment-sheet'
import CommunityPostCard, { type CommunityPostCommentPreview } from '../../../features/community/post-card'
import { mergePublicCommentPreview } from '../../../features/community/comments'
import { saveCommunityDetailSnapshot } from '../../../features/community/detail-snapshot'
import { useDismissCommunityOverlaysOnScroll } from '../../../features/community/use-overlay-dismissal'
import { useCampusShare } from '../../../features/share'
import './index.scss'
import { openPublicProfile } from '../../../features/profile/public-profile'
import { apiDateTimeCampusParts } from '../../../utils/date-time'
import { requestWechatSubscriptionForModule, requestWechatSubscriptionForModuleWithResult } from '../../../features/wechat-subscription'
import { openCourseMaterials } from '../../../features/course-materials/navigation'

const classDiscussionIcons = {
  bell: require('../../../assets/community/class-discussion-bell.svg'),
  comment: require('../../../assets/community/class-discussion-book.svg'),
  material: require('../../../assets/community/class-discussion-material.svg'),
  plus: require('../../../assets/community/class-discussion-plus-white.svg'),
}

const TOPIC_POSTS_PAGE_SIZE = 20

type ClassDiscussionParticipationState = CampusCircleClassParticipation & { topicId: number }

const isUnavailableTopicError = (error: unknown) => (
  isApiError(error) && (error.statusCode === 403 || error.statusCode === 404)
)

const formatAnnouncementTime = (value?: string | null) => {
  const parts = value ? apiDateTimeCampusParts(value) : null
  return parts
    ? `${parts.year}年${parts.month}月${parts.day}日 ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
    : '刚刚发布'
}

const mergeUniquePosts = (
  current: CampusCirclePostView[],
  incoming: CampusCirclePostView[],
) => {
  const seen = new Set(current.map((post) => post.id))
  return [...current, ...incoming.filter((post) => {
    if (seen.has(post.id)) return false
    seen.add(post.id)
    return true
  })]
}

export default function CommunityTopicPage() {
  const viewPageVisible = useViewPageVisible()
  const [topic, setTopic] = useState<CampusCircleTopicView | null>(null)
  const [posts, setPosts] = useState<CampusCirclePostView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [topicId, setTopicId] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [commentPost, setCommentPost] = useState<CampusCirclePostView | null>(null)
  const [commentReplyTarget, setCommentReplyTarget] = useState<CommunityPostCommentPreview | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentDismissSignal, setCommentDismissSignal] = useState(0)
  const [openActionPostId, setOpenActionPostId] = useState<number | null>(null)
  const [announcementExpanded, setAnnouncementExpanded] = useState(false)
  const [classSettingsExpanded, setClassSettingsExpanded] = useState(false)
  const [classParticipation, setClassParticipation] = useState<ClassDiscussionParticipationState | null>(null)
  const [classParticipationError, setClassParticipationError] = useState('')
  const [classNotificationUpdating, setClassNotificationUpdating] = useState(false)
  const [classParticipationRetryVersion, setClassParticipationRetryVersion] = useState(0)
  const [classWechatRegistrationRetry, setClassWechatRegistrationRetry] = useState<(() => Promise<boolean>) | null>(null)
  const [classWechatRegistrationRetrying, setClassWechatRegistrationRetrying] = useState(false)
  const requestSequence = useRef(0)
  const topicRequestSequence = useRef(0)
  const topicIdRef = useRef(0)
  const hasShown = useRef(false)
  const loadedRefreshRevision = useRef(-1)
  const classParticipationRef = useRef<ClassDiscussionParticipationState | null>(null)
  const classParticipationInFlightTopicIdRef = useRef(0)
  const classParticipationPendingTopicIdRef = useRef(0)
  const classParticipationRequestSequence = useRef(0)
  const classNotificationRequestSequence = useRef(0)
  const classNotificationUpdatingRef = useRef(false)
  const classWechatRegistrationRetryingRef = useRef(false)
  const activeClassDiscussionTopicIdRef = useRef(0)

  const applyClassParticipation = useCallback((next: ClassDiscussionParticipationState | null) => {
    classParticipationRef.current = next
    setClassParticipation(next)
  }, [])

  const recordClassParticipation = useCallback(async (nextTopic: CampusCircleTopicView) => {
    if (!isClassDiscussionTopic(nextTopic) || nextTopic.status !== 'active') return
    const id = nextTopic.id
    if (classNotificationUpdatingRef.current) return
    if (classParticipationInFlightTopicIdRef.current === id) {
      classParticipationPendingTopicIdRef.current = id
      return
    }

    const requestId = ++classParticipationRequestSequence.current
    const notificationRequestSequenceAtStart = classNotificationRequestSequence.current
    classParticipationInFlightTopicIdRef.current = id
    try {
      const result = await lifeServicesRepository.recordCampusCircleClassParticipation(id)
      if (
        requestId !== classParticipationRequestSequence.current
        || activeClassDiscussionTopicIdRef.current !== id
      ) return
      const current = classParticipationRef.current
      const notificationChangedWhileRecording = (
        notificationRequestSequenceAtStart !== classNotificationRequestSequence.current
      )
      applyClassParticipation({
        ...result,
        topicId: id,
        // 提醒设置比人数刷新更新，不能由较早的参与登记响应覆盖。
        notifications_enabled: notificationChangedWhileRecording && current?.topicId === id
          ? current.notifications_enabled
          : result.notifications_enabled,
      })
      setClassParticipationError('')
    } catch {
      if (
        requestId === classParticipationRequestSequence.current
        && activeClassDiscussionTopicIdRef.current === id
      ) {
        setClassParticipationError('参与状态暂未同步，下拉刷新后重试')
      }
    } finally {
      if (classParticipationInFlightTopicIdRef.current === id) {
        classParticipationInFlightTopicIdRef.current = 0
      }
      if (
        classParticipationPendingTopicIdRef.current === id
        && activeClassDiscussionTopicIdRef.current === id
        && !classNotificationUpdatingRef.current
      ) {
        classParticipationPendingTopicIdRef.current = 0
        setClassParticipationRetryVersion((version) => version + 1)
      }
    }
  }, [applyClassParticipation])

  useEffect(() => {
    if (!topic || !isClassDiscussionTopic(topic) || topic.status !== 'active') {
      activeClassDiscussionTopicIdRef.current = 0
      classParticipationRequestSequence.current += 1
      classParticipationPendingTopicIdRef.current = 0
      applyClassParticipation(null)
      setClassParticipationError('')
      return
    }
    activeClassDiscussionTopicIdRef.current = topic.id
    void recordClassParticipation(topic)
    return () => {
      if (activeClassDiscussionTopicIdRef.current === topic.id) {
        activeClassDiscussionTopicIdRef.current = 0
        classParticipationRequestSequence.current += 1
      }
    }
  }, [applyClassParticipation, classParticipationRetryVersion, recordClassParticipation, topic])

  const load = useCallback(async (id: number, nextPage = 1, append = false) => {
    if (!Number.isInteger(id) || id < 1) {
      setLoading(false)
      setLoadingMore(false)
      setError('话题参数无效')
      Taro.stopPullDownRefresh()
      return
    }

    const requestId = ++requestSequence.current
    const topicRequestId = append
      ? topicRequestSequence.current
      : ++topicRequestSequence.current
    const refreshRevisionAtStart = getLifeHubRefreshRevision('community')
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError('')
    }

    try {
      if (append) {
        const postsResult = await lifeServicesRepository.listCampusCirclePosts({
          topicId: id,
          page: nextPage,
          pageSize: TOPIC_POSTS_PAGE_SIZE,
        })
        if (requestId !== requestSequence.current) return
        setPosts((current) => mergeUniquePosts(current, postsResult.items))
        setPage(postsResult.page)
        setTotal(Number(postsResult.total))
        return
      }

      const [topicResult, postsResult] = await Promise.all([
        lifeServicesRepository.getCampusCircleTopic(id),
        lifeServicesRepository.listCampusCirclePosts({
          topicId: id,
          page: nextPage,
          pageSize: TOPIC_POSTS_PAGE_SIZE,
        }),
      ])
      if (requestId !== requestSequence.current) return
      if (topicRequestId === topicRequestSequence.current) setTopic(topicResult)
      setPosts(mergeUniquePosts([], postsResult.items))
      setPage(postsResult.page)
      setTotal(Number(postsResult.total))
      if (refreshRevisionAtStart === getLifeHubRefreshRevision('community')) {
        loadedRefreshRevision.current = refreshRevisionAtStart
      }
    } catch (loadError) {
      if (requestId !== requestSequence.current) return
      const message = isApiError(loadError) ? loadError.message : '话题加载失败'
      if (append) {
        Taro.showToast({ title: message, icon: 'none' })
      } else {
        setError(message)
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadingMore(false)
        Taro.stopPullDownRefresh()
      }
    }
  }, [])

  const refreshTopic = useCallback(async (id: number) => {
    if (!Number.isInteger(id) || id < 1) return
    const requestId = ++topicRequestSequence.current
    try {
      const nextTopic = await lifeServicesRepository.getCampusCircleTopic(id)
      if (requestId === topicRequestSequence.current) setTopic(nextTopic)
    } catch (refreshError) {
      if (requestId !== topicRequestSequence.current) return
      if (isUnavailableTopicError(refreshError)) {
        setTopic(null)
        setPosts([])
        setTotal(0)
        setPage(1)
        setError('课堂讨论已不可用')
      }
      // 网络失败时保留已展示的话题信息；下拉刷新仍会完整反馈失败状态。
    }
  }, [])

  useLoad((options) => {
    const id = parsePositiveId(options.id)
    topicIdRef.current = id
    setTopicId(id)
    void load(id)
  })
  useDidHide(() => {
    activeClassDiscussionTopicIdRef.current = 0
    classParticipationRequestSequence.current += 1
  })
  useDidShow(() => {
    // 初次进入已由 useLoad 拉取。后台公告不改变本地版本号，因此每次返回都刷新话题元数据。
    if (!hasShown.current) {
      hasShown.current = true
      return
    }
    const id = topicIdRef.current
    if (id < 1) return
    if (loadedRefreshRevision.current !== getLifeHubRefreshRevision('community')) void load(id)
    else void refreshTopic(id)
  })
  usePullDownRefresh(useCallback(() => {
    void load(topicId)
  }, [load, topicId]))

  useCampusShare((event) => {
    const dataset = event.target?.dataset || {}
    const postId = Number(dataset.postId)
    if (event.from === 'button' && postId > 0) {
      const shareTitle = typeof dataset.shareTitle === 'string'
        ? dataset.shareTitle
        : 'OUSea动态'
      const shareImage = typeof dataset.shareImage === 'string'
        ? dataset.shareImage
        : ''
      const result = {
        title: shareTitle,
        path: '/pages/community/detail',
        query: { id: postId, mode: 'post' },
      }
      return shareImage ? { ...result, imageUrl: shareImage } : result
    }
    return {
      title: isClassDiscussionTopic(topic)
        ? `${topic?.name || '课堂讨论'}｜课堂讨论`
        : topic ? `#${topic.name}｜OUSea话题` : 'OUSea话题',
      path: topicId ? '/pages/community/topic/index' : '/pages/community/index',
      query: topicId ? { id: topicId } : undefined,
      imageUrl: topic?.cover_url || undefined,
    }
  })

  const toggleLike = useCallback(async (post: CampusCirclePostView) => {
    const updated = post.liked
      ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
      : await lifeServicesRepository.likeCampusCirclePost(post.id)
    setPosts((current) => current.map((item) => item.id === updated.id ? updated : item))
    markLifeHubSectionDirty('community')
  }, [])
  const requestClassInteractionSubscription = useCallback(() => {
    const participation = classParticipationRef.current
    if (
      !participation?.notifications_enabled
      || participation.topicId !== activeClassDiscussionTopicIdRef.current
      || classNotificationUpdatingRef.current
    ) return
    // Keep the request inside the click gesture; navigation does not depend on consent.
    requestWechatSubscriptionForModule('community')
  }, [])
  const openPost = useCallback((post: CampusCirclePostView) => {
    requestClassInteractionSubscription()
    setOpenActionPostId(null)
    saveCommunityDetailSnapshot(post)
    return Taro.navigateTo({ url: `/pages/community/detail?id=${post.id}&mode=post&snapshot=1` })
  }, [requestClassInteractionSubscription])
  const openComments = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(null)
    setCommentPost(post)
  }, [])
  const openReply = useCallback((post: CampusCirclePostView, comment: CommunityPostCommentPreview) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(comment)
    setCommentPost(post)
  }, [])
  const toggleActions = useCallback((postId: number) => {
    setOpenActionPostId((current) => current === postId ? null : postId)
  }, [])
  const closeActions = useCallback(() => {
    setOpenActionPostId(null)
  }, [])
  const updateLatestComment = useCallback((comment: Parameters<typeof mergePublicCommentPreview>[1]) => {
    setPosts((current) => current.map((item) => (
      item.id === comment.target_id
        ? {
            ...item,
            comment_previews: mergePublicCommentPreview(
              item.comment_previews,
              comment,
              commentReplyTarget,
            ),
          }
        : item
    )))
  }, [commentReplyTarget])
  const dismissCommunityOverlays = useCallback(() => {
    setOpenActionPostId(null)
    if (commentPost) setCommentDismissSignal((current) => current + 1)
  }, [commentPost])
  useDismissCommunityOverlaysOnScroll({
    active: openActionPostId !== null || (commentPost !== null && !commentSubmitting),
    onDismiss: dismissCommunityOverlays,
  })
  const updateCommentCount = useCallback((postId: number, delta: number) => {
    setPosts((current) => current.map((item) => (
      item.id === postId
        ? { ...item, comment_count: Math.max(0, item.comment_count + delta) }
        : item
    )))
  }, [])
  const openPublisher = useCallback((question?: ClassQuickQuestionId) => {
    if (!topic) return
    requestClassInteractionSubscription()
    const url = isClassDiscussionTopic(topic)
      ? classDiscussionTopicPublisherUrl(topic.id, question)
      : communityTopicPublisherUrl(topic.id)
    return Taro.navigateTo({ url })
  }, [requestClassInteractionSubscription, topic])
  const openClassMaterials = useCallback(() => {
    const context = getClassDiscussionMaterialNavigation(topic)
    if (!context) {
      Taro.showToast({ title: '课程资料关联信息暂不可用', icon: 'none' })
      return
    }
    requestClassInteractionSubscription()
    void openCourseMaterials(context)
  }, [requestClassInteractionSubscription, topic])
  const updateClassNotifications = useCallback(async (notificationsEnabled: boolean) => {
    const current = classParticipationRef.current
    if (!current || classNotificationUpdatingRef.current) return

    const requestId = ++classNotificationRequestSequence.current
    classNotificationUpdatingRef.current = true
    setClassNotificationUpdating(true)
    const previous = current
    const optimistic = { ...current, notifications_enabled: notificationsEnabled }
    applyClassParticipation(optimistic)
    try {
      const result = await lifeServicesRepository.updateCampusCircleClassNotifications(
        current.topicId,
        { notifications_enabled: notificationsEnabled },
      )
      if (
        requestId === classNotificationRequestSequence.current
        && activeClassDiscussionTopicIdRef.current === current.topicId
        && classParticipationRef.current?.topicId === current.topicId
      ) {
        applyClassParticipation({ ...result, topicId: current.topicId })
        if (!result.notifications_enabled) setClassWechatRegistrationRetry(null)
        setClassParticipationError('')
        Taro.showToast({
          title: result.notifications_enabled ? '已开启新帖子和公告提醒' : '已关闭新帖子和公告提醒',
          icon: 'none',
        })
      }
    } catch (updateError) {
      if (
        requestId === classNotificationRequestSequence.current
        && activeClassDiscussionTopicIdRef.current === current.topicId
        && classParticipationRef.current?.topicId === current.topicId
      ) {
        applyClassParticipation(previous)
        Taro.showToast({
          title: isApiError(updateError) ? updateError.message : '提醒设置失败，请稍后重试',
          icon: 'none',
        })
      }
    } finally {
      if (requestId === classNotificationRequestSequence.current) {
        classNotificationUpdatingRef.current = false
        if (activeClassDiscussionTopicIdRef.current === current.topicId) {
          setClassNotificationUpdating(false)
        }
      }
    }
  }, [applyClassParticipation])
  const openPostAuthor = useCallback((post: CampusCirclePostView) => {
    void openPublicProfile(post.author_id)
  }, [])
  const reload = useCallback(() => {
    void load(topicId)
  }, [load, topicId])
  const loadMore = useCallback(() => {
    if (loading || loadingMore || posts.length >= total) return
    void load(topicId, page + 1, true)
  }, [load, loading, loadingMore, page, posts.length, topicId, total])

  const classDiscussion = isClassDiscussionTopic(topic)
  const activeClassParticipation = classParticipation?.topicId === topic?.id
    ? classParticipation
    : null
  const requestClassWechatSubscription = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    if (!activeClassParticipation?.notifications_enabled) return

    // 订阅面板必须在用户点击的同步调用链中打开，不能先 await 配置或网络请求。
    const subscription = requestWechatSubscriptionForModuleWithResult('community')
    void subscription.then((result) => {
      if (result.accepted && result.registered) {
        setClassWechatRegistrationRetry(null)
        Taro.showToast({ title: '已订阅微信提醒', icon: 'success' })
        return
      }
      if (result.accepted && result.retryRegistration) {
        setClassWechatRegistrationRetry(() => result.retryRegistration!)
        Taro.showToast({ title: '微信授权已完成，请重新登记微信提醒', icon: 'none' })
        return
      }
      if (result.needsSettings) {
        Taro.showToast({ title: '请在微信设置中开启订阅消息', icon: 'none' })
        return
      }
      Taro.showToast({
        title: result.requested ? '未订阅微信提醒，站内提醒不受影响' : '当前没有可用的微信提醒模板',
        icon: 'none',
      })
    })
  }, [activeClassParticipation?.notifications_enabled])
  const retryClassWechatRegistration = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    if (
      !activeClassParticipation?.notifications_enabled
      || !classWechatRegistrationRetry
      || classWechatRegistrationRetryingRef.current
    ) return
    classWechatRegistrationRetryingRef.current = true
    setClassWechatRegistrationRetrying(true)
    void classWechatRegistrationRetry().then((registered) => {
      if (registered) {
        setClassWechatRegistrationRetry(null)
        Taro.showToast({ title: '已订阅微信提醒', icon: 'success' })
      } else {
        Taro.showToast({ title: '微信提醒登记失败，请重试', icon: 'none' })
      }
    }).finally(() => {
      classWechatRegistrationRetryingRef.current = false
      setClassWechatRegistrationRetrying(false)
    })
  }, [activeClassParticipation?.notifications_enabled, classWechatRegistrationRetry])
  const announcement = visibleClassDiscussionAnnouncement(topic)
  const announcementKey = announcement
    ? `${announcement.title}:${announcement.published_at || ''}:${announcement.content}`
    : ''
  useEffect(() => {
    setAnnouncementExpanded(false)
  }, [announcementKey])
  const participateLabel = classDiscussion
    ? '发布课堂讨论'
    : topic?.kind === 'campaign' ? '参与活动' : '参与讨论'

  return <View
    className={`community-topic-page ${classDiscussion ? 'community-topic-page--class' : ''}`}
    onClick={(event) => {
      if (classDiscussion) event.stopPropagation()
    }}
  >
    <CustomNavbar
      title={classDiscussion ? '课堂讨论' : topic ? `#${topic.name}` : '话题'}
      subtitle={classDiscussion ? undefined : topic?.description || '校园话题'}
      showBack
    />
    <View className='community-topic-page__content'>
      {!loading && !error && topic && classDiscussion && (
        <View
          className='community-topic-class-context'
          onClick={(event) => event.stopPropagation()}
        >
          <View className='community-topic-class-context__heading'>
            <View className='community-topic-class-context__badges'>
              {topic.class_discussion && <>
                <Text className='community-topic-class-context__badge'>
                  {topic.class_discussion.period_id}
                </Text>
                <Text className='community-topic-class-context__badge community-topic-class-context__badge--plain'>
                  选课号 {topic.class_discussion.class_num}
                </Text>
              </>}
              <Text className='community-topic-class-context__badge community-topic-class-context__badge--public'>公开讨论</Text>
            </View>
            {activeClassParticipation && (
              <View
                className='community-topic-class-context__reminder'
                ariaRole='button'
                ariaLabel={classSettingsExpanded ? '收起课堂提醒设置' : '展开课堂提醒设置'}
                onClick={() => setClassSettingsExpanded((current) => !current)}
              >
                <Image src={classDiscussionIcons.bell} mode='aspectFit' />
                <Text>{activeClassParticipation.notifications_enabled ? '提醒已开' : '提醒已关'}</Text>
              </View>
            )}
          </View>
          <Text className='community-topic-class-context__name'>
            {topic.class_discussion?.course_name || topic.name}
          </Text>
          <Text className='community-topic-class-context__description'>
            公开课堂讨论，不限本班同学参与。交流课后习题、共享课程资料。
          </Text>
          {activeClassParticipation && (
            <View className='community-topic-class-context__participation'>
              <Text className='community-topic-class-context__count'>
                已有 {activeClassParticipation.participant_count} 人来过
              </Text>
              {classSettingsExpanded && (
                <View className='community-topic-class-context__settings-panel'>
                  <View className='community-topic-class-context__notification'>
                    <View>
                      <Text>接收新帖子和公告</Text>
                      <Text>评论和回复仅通知对应同学</Text>
                    </View>
                    <Switch
                      checked={activeClassParticipation.notifications_enabled}
                      disabled={classNotificationUpdating}
                      color='var(--ousea-ocean-500, #2B7AEF)'
                      ariaLabel={activeClassParticipation.notifications_enabled
                        ? '关闭新帖子和公告提醒'
                        : '开启新帖子和公告提醒'}
                      onChange={(event) => {
                        event.stopPropagation()
                        void updateClassNotifications(Boolean(event.detail.value))
                      }}
                    />
                  </View>
                  {activeClassParticipation.notifications_enabled ? (
                    <View
                      className='community-topic-class-context__wechat-subscription'
                      ariaRole='button'
                      ariaLabel={classWechatRegistrationRetry ? '重新登记课堂微信提醒' : '订阅课堂微信提醒'}
                      onClick={classWechatRegistrationRetry
                        ? retryClassWechatRegistration
                        : requestClassWechatSubscription}
                    >{classWechatRegistrationRetrying
                      ? '正在登记微信提醒…'
                      : classWechatRegistrationRetry ? '重新登记微信提醒' : '开通微信提醒'}</View>
                  ) : (
                    <Text className='community-topic-class-context__wechat-subscription-note'>
                      开启群提醒后可开通微信提醒
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
          {!activeClassParticipation && classParticipationError && (
            <Text className='community-topic-class-context__error'>{classParticipationError}</Text>
          )}
        </View>
      )}
      {!loading && !error && topic && classDiscussion && (
        <View className='community-topic-class-filters' ariaLabel='课堂讨论筛选'>
          <View className='community-topic-class-filters__item community-topic-class-filters__item--active'>
            <Text>全部讨论 ({topic.post_count})</Text>
          </View>
          <View
            className='community-topic-class-filters__item'
            ariaRole='button'
            ariaLabel={`查看${topic.name}的课程资料`}
            onClick={openClassMaterials}
          >
            <Text>课程资料</Text>
          </View>
          {announcement && (
            <View
              className='community-topic-class-filters__item'
              ariaRole='button'
              ariaLabel='查看课堂公告'
              onClick={() => {
                setAnnouncementExpanded(true)
                void Taro.pageScrollTo({ selector: '#class-discussion-announcement', duration: 300 })
              }}
            >
              <Text>教学通知</Text>
            </View>
          )}
        </View>
      )}
      {!loading && !error && announcement && (
        <View
          id='class-discussion-announcement'
          className={`community-topic-announcement ${announcementExpanded ? 'community-topic-announcement--expanded' : ''}`}
          ariaRole='button'
          ariaLabel={announcementExpanded ? '收起课堂公告全文' : '展开课堂公告全文'}
          onClick={() => setAnnouncementExpanded((current) => !current)}
        >
          <View className='community-topic-announcement__heading'>
            <Text className='community-topic-announcement__eyebrow'>公告</Text>
            <Text className='community-topic-announcement__title'>{announcement.title}</Text>
            <Text className='community-topic-announcement__toggle'>
              {announcementExpanded ? '收起' : '展开'}
            </Text>
          </View>
          {announcementExpanded && <>
            <Text className='community-topic-announcement__time'>
              {formatAnnouncementTime(announcement.published_at)}
            </Text>
            <Text className='community-topic-announcement__content'>{announcement.content}</Text>
          </>}
        </View>
      )}
      {!loading && !error && topic && (
        <View className='community-topic-feed-heading'>
          <Text className='community-topic-feed-heading__tab'>{classDiscussion ? '课堂动态' : '最新发表'}</Text>
          <Text className='community-topic-feed-heading__count'>{classDiscussion ? `共 ${topic.post_count} 条讨论` : `共 ${topic.post_count} 条动态`}</Text>
        </View>
      )}

      {loading && <View className='community-topic-page__state'>正在加载讨论</View>}
      {!loading && error && (
        <View className='community-topic-page__state community-topic-page__state--error'>
          <Text>{error}</Text>
          <View
            className='community-topic-page__retry'
            ariaRole='button'
            ariaLabel='重新加载话题'
            onClick={reload}
          >重新加载</View>
        </View>
      )}
      {!loading && !error && posts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          variant={classDiscussion ? 'classroom' : 'community'}
          trackViews
          viewExposureSurface='topic'
          viewTrackingEnabled={viewPageVisible && !commentPost}
          sectionName={classDiscussion ? '课堂讨论' : '校园社区'}
          actionsOpen={openActionPostId === post.id}
          onToggleActions={toggleActions}
          onCloseActions={closeActions}
          onToggleLike={toggleLike}
          onOpen={openPost}
          onOpenComments={openComments}
          onReplyComment={openReply}
          onOpenAuthor={openPostAuthor}
        />
      ))}
      {!loading && !error && topic && posts.length === 0 && (
        <View className='community-topic-empty'>
          <Text>还没有人发布动态</Text>
          <Text>{classDiscussion ? '发布第一条课堂讨论，和同学一起交流' : '带上这个话题，成为第一个参与讨论的人'}</Text>
        </View>
      )}
      {!loading && !error && posts.length < total && (
        <View
          className='api-community-load-more'
          ariaRole='button'
          ariaLabel={loadingMore ? '正在加载更多话题动态' : '查看更多话题动态'}
          onClick={loadMore}
        >
          {loadingMore ? '正在加载…' : '查看更多'}
        </View>
      )}
      {commentPost && (
        <CommunityCommentSheet
          key={commentPost.id}
          post={commentPost}
          initialReplyTarget={commentReplyTarget ? {
            id: commentReplyTarget.id,
            author_id: commentReplyTarget.authorId,
            author_deleted: commentReplyTarget.authorDeleted,
            author_nickname: commentReplyTarget.authorNickname,
            root_id: commentReplyTarget.rootId,
          } : null}
          onClose={() => {
            setCommentPost(null)
            setCommentReplyTarget(null)
            setCommentSubmitting(false)
          }}
          onSubmittingChange={setCommentSubmitting}
          dismissSignal={commentDismissSignal}
          onApprovedDelta={(delta) => updateCommentCount(commentPost.id, delta)}
          onCommentCreated={updateLatestComment}
        />
      )}
    </View>
    {!loading && !error && topic && (
      <View className='community-topic-page__action-bar'>
        {classDiscussion && (
          <View className='community-topic-page__quick-questions' ariaLabel='课堂快捷操作'>
            {classQuickQuestions.filter((question) => question.id !== 'attendance').map((question) => (
              <View
                key={question.id}
                className='community-topic-page__quick-question'
                ariaRole='button'
                ariaLabel={question.id === 'materials'
                  ? `查看${topic.name}的课程资料`
                  : `${question.label}，发布到${topic.name}`}
                onClick={() => question.id === 'materials'
                  ? openClassMaterials()
                  : openPublisher(question.id)}
              >
                <View className='community-topic-page__quick-question-icon'>
                  <Image
                    src={question.id === 'homework'
                      ? classDiscussionIcons.comment
                      : classDiscussionIcons.material}
                    mode='aspectFit'
                  />
                </View>
                <Text>{question.id === 'homework' ? '问作业' : '资料'}</Text>
              </View>
            ))}
          </View>
        )}
        <View
          className='community-topic-page__participate'
          ariaRole='button'
          ariaLabel={`${participateLabel}：${topic.name}`}
          onClick={() => openPublisher()}
        >{classDiscussion && <Image src={classDiscussionIcons.plus} mode='aspectFit' />}
          <Text>{participateLabel}</Text>
        </View>
      </View>
    )}
  </View>
}
