import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type {
  CarpoolTripView,
  CampusCirclePostView,
  ErrandView,
  MarketplaceListingView,
  PublicUserProfile,
} from '../../api/types'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatar from '../../components/user-avatar'
import CommunityCommentSheet from '../../features/community/comment-sheet'
import CommunityPostCard, { type CommunityPostCommentPreview } from '../../features/community/post-card'
import { mergePublicCommentPreview } from '../../features/community/comments'
import { saveCommunityDetailSnapshot } from '../../features/community/detail-snapshot'
import { useDismissCommunityOverlaysOnScroll } from '../../features/community/use-overlay-dismissal'
import '../../features/community/feed-panel.scss'
import CarpoolCard from '../../features/life-services/components/carpool-card'
import ErrandCard from '../../features/life-services/components/errand-card'
import MarketplaceCard from '../../features/life-services/components/marketplace-card'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import {
  directMessageChatUrl,
  directMessagesListUrl,
} from '../../features/direct-messages/navigation'
import { privateMessagesRepository } from '../../features/direct-messages/repository'
import { isQualificationEdition } from '../../features/app-edition'
import { requestWechatSubscriptionForModule } from '../../features/wechat-subscription'
import {
  getMiniappRuntimeConfig,
  loadMiniappRuntimeConfig,
  openMiniappModule,
  resolveMiniappModule,
} from '../../features/runtime-config'
import { useCampusShare } from '../../features/share'
import '../../features/life-services/list-panel.scss'
import './index.scss'

type ProfileTab = 'community' | 'errands' | 'marketplace' | 'carpool'
type ProfileItem = CampusCirclePostView | ErrandView | MarketplaceListingView | CarpoolTripView

type TabState = {
  items: ProfileItem[]
  page: number
  total: number
  loaded: boolean
  loading: boolean
  loadingMore: boolean
  error: string
}

const emptyTabState = (): TabState => ({
  items: [],
  page: 0,
  total: 0,
  loaded: false,
  loading: false,
  loadingMore: false,
  error: '',
})

const initialTabs = (): Record<ProfileTab, TabState> => ({
  community: emptyTabState(),
  errands: emptyTabState(),
  marketplace: emptyTabState(),
  carpool: emptyTabState(),
})

const tabOptions: Array<{ key: ProfileTab; label: string }> = [
  { key: 'community', label: '社区' },
  { key: 'errands', label: '跑腿' },
  { key: 'marketplace', label: '二手' },
  { key: 'carpool', label: '找同行' },
]

const mergeUnique = (current: ProfileItem[], incoming: ProfileItem[]) => {
  const items = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => items.set(item.id, item))
  return [...items.values()]
}

const parseUserId = (value?: string) => {
  const id = Number(value || 0)
  return Number.isInteger(id) && id > 0 ? id : 0
}

const requestTab = async (tab: ProfileTab, id: number, page: number) => {
  if (tab === 'community') {
    return lifeServicesRepository.listUserCampusCirclePosts(id, { page })
  }
  if (tab === 'errands') {
    return lifeServicesRepository.listUserErrands(id, { page })
  }
  if (tab === 'marketplace') {
    return lifeServicesRepository.listUserMarketplaceListings(id, { page })
  }
  return lifeServicesRepository.listUserCarpoolTrips(id, { page })
}

export default function PublicProfilePage() {
  const [userId, setUserId] = useState(0)
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [activeTab, setActiveTab] = useState<ProfileTab>('community')
  const [tabs, setTabs] = useState<Record<ProfileTab, TabState>>(initialTabs)
  const [openingConversation, setOpeningConversation] = useState(false)
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [commentPost, setCommentPost] = useState<CampusCirclePostView | null>(null)
  const [commentReplyTarget, setCommentReplyTarget] = useState<CommunityPostCommentPreview | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentDismissSignal, setCommentDismissSignal] = useState(0)
  const [openActionPostId, setOpenActionPostId] = useState<number | null>(null)

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
        path: '/packages/social/community/detail',
        query: { id: postId, mode: 'post' },
      }
      return shareImage ? { ...result, imageUrl: shareImage } : result
    }
    return {
      title: profile ? `${profile.user.nickname}的OUSea主页` : 'OUSea个人主页',
      path: userId ? '/pages/public-profile/index' : '/pages/community/index',
      query: userId ? { id: userId } : undefined,
    }
  })

  const updateTab = useCallback((tab: ProfileTab, update: Partial<TabState>) => {
    setTabs((current) => ({
      ...current,
      [tab]: { ...current[tab], ...update },
    }))
  }, [])

  const loadProfile = async (id: number) => {
    if (!id) {
      setProfileLoading(false)
      setProfileError('用户参数无效')
      return
    }
    setProfileLoading(true)
    setProfileError('')
    try {
      setProfile(await lifeServicesRepository.getUserProfile(id))
    } catch (error) {
      setProfileError(isApiError(error) ? error.message : '个人主页加载失败')
    } finally {
      setProfileLoading(false)
    }
  }

  const loadTab = useCallback(async (tab: ProfileTab, page = 1, append = false) => {
    if (!userId) return
    updateTab(tab, append
      ? { loadingMore: true, error: '' }
      : { loading: true, error: '' })
    try {
      const result = await requestTab(tab, userId, page)
      setTabs((current) => ({
        ...current,
        [tab]: {
          ...current[tab],
          items: append
            ? mergeUnique(current[tab].items, result.items)
            : result.items,
          page: result.page,
          total: Number(result.total),
          loaded: true,
          loading: false,
          loadingMore: false,
          error: '',
        },
      }))
    } catch (error) {
      updateTab(tab, {
        loaded: true,
        loading: false,
        loadingMore: false,
        error: isApiError(error) ? error.message : '内容加载失败，请稍后重试',
      })
    }
  }, [updateTab, userId])

  useLoad((options) => {
    const id = parseUserId(options.id)
    setUserId(id)
    void loadProfile(id)
  })

  useDidShow(() => {
    void loadMiniappRuntimeConfig().then(setRuntimeConfig)
  })

  useEffect(() => {
    if (!userId || tabs[activeTab].loaded || tabs[activeTab].loading) return
    void loadTab(activeTab)
  }, [activeTab, loadTab, tabs, userId])

  usePullDownRefresh(() => {
    if (!userId) {
      Taro.stopPullDownRefresh()
      return
    }
    void Promise.all([
      loadProfile(userId),
      loadTab(activeTab),
    ]).finally(() => Taro.stopPullDownRefresh())
  })

  const tabState = tabs[activeTab]
  const countForTab = (tab: ProfileTab) => {
    if (!profile) return 0
    if (tab === 'community') return profile.counts.community_posts
    if (tab === 'errands') return profile.counts.errands
    if (tab === 'marketplace') return profile.counts.marketplace_listings
    return profile.counts.carpool_trips
  }

  const openCommunityPost = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    saveCommunityDetailSnapshot(post)
    void Taro.navigateTo({ url: `/packages/social/community/detail?id=${post.id}&mode=post&snapshot=1` })
  }, [])

  const openPrivateConversation = async (subscriptionAlreadyRequested = false) => {
    if (isQualificationEdition || !profile || profile.is_self || openingConversation) return
    setOpeningConversation(true)
    try {
      const config = await loadMiniappRuntimeConfig()
      setRuntimeConfig(config)
      if (resolveMiniappModule(config, 'private_message').state !== 'enabled') {
        await openMiniappModule('private_message', directMessagesListUrl, {
          config,
          subscriptionAlreadyRequested,
        })
        return
      }
      const conversation = await privateMessagesRepository.createConversation(profile.user.id)
      await openMiniappModule(
        'private_message',
        directMessageChatUrl(conversation.id),
        { config, subscriptionAlreadyRequested },
      )
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '暂时无法打开私信，请稍后重试',
        icon: 'none',
      })
    } finally {
      setOpeningConversation(false)
    }
  }

  const beginPrivateConversation = () => {
    const subscriptionAlreadyRequested = resolveMiniappModule(
      runtimeConfig,
      'private_message',
    ).state === 'enabled' && requestWechatSubscriptionForModule(
      'private_message',
      runtimeConfig,
    )
    void openPrivateConversation(subscriptionAlreadyRequested)
  }
  const openCommunityComments = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(null)
    setCommentPost(post)
  }, [])

  const openCommunityReply = useCallback((post: CampusCirclePostView, comment: CommunityPostCommentPreview) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(comment)
    setCommentPost(post)
  }, [])

  const toggleCommunityActions = useCallback((postId: number) => {
    setOpenActionPostId((current) => current === postId ? null : postId)
  }, [])

  const closeCommunityActions = useCallback(() => {
    setOpenActionPostId(null)
  }, [])

  const updateLatestCommunityComment = useCallback((comment: Parameters<typeof mergePublicCommentPreview>[1]) => {
    setTabs((current) => ({
      ...current,
      community: {
        ...current.community,
        items: (current.community.items as CampusCirclePostView[]).map((item) => (
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
        )),
      },
    }))
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
    setTabs((current) => ({
      ...current,
      community: {
        ...current.community,
        items: (current.community.items as CampusCirclePostView[]).map((item) => (
          item.id === postId
            ? { ...item, comment_count: Math.max(0, item.comment_count + delta) }
            : item
        )),
      },
    }))
  }, [])

  const toggleLike = useCallback(async (post: CampusCirclePostView) => {
    try {
      const updated = post.liked
        ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
        : await lifeServicesRepository.likeCampusCirclePost(post.id)
      setTabs((current) => ({
        ...current,
        community: {
          ...current.community,
          items: current.community.items.map((item) => (
            item.id === updated.id ? updated : item
          )),
        },
      }))
      markLifeHubSectionDirty('community')
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '操作失败，请稍后重试',
        icon: 'none',
      })
    }
  }, [])

  const renderItems = () => {
    if (activeTab === 'community') {
      return (
        <View className='public-profile-feed'>
          {(tabState.items as CampusCirclePostView[]).map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              sectionName='校园社区'
              actionsOpen={openActionPostId === post.id}
              onToggleActions={toggleCommunityActions}
              onCloseActions={closeCommunityActions}
              onToggleLike={toggleLike}
              onOpen={openCommunityPost}
              onOpenComments={openCommunityComments}
              onReplyComment={openCommunityReply}
            />
          ))}
        </View>
      )
    }
    if (activeTab === 'errands') {
      return (
        <View className='errand-list'>
          {(tabState.items as ErrandView[]).map((item) => (
            <ErrandCard key={item.id} item={item} />
          ))}
        </View>
      )
    }
    if (activeTab === 'marketplace') {
      const items = tabState.items as MarketplaceListingView[]
      return (
        <View className='marketplace-grid'>
          {[0, 1].map((column) => (
            <View key={column} className='marketplace-grid__column'>
              {items.filter((_, index) => index % 2 === column).map((item) => (
                <MarketplaceCard key={item.id} item={item} />
              ))}
            </View>
          ))}
        </View>
      )
    }
    return (
      <View className='carpool-list'>
        {(tabState.items as CarpoolTripView[]).map((item) => (
          <CarpoolCard key={item.id} item={item} />
        ))}
      </View>
    )
  }

  return (
    <View className='public-profile-page'>
      <CustomNavbar title={profile?.is_self ? '我的个人主页' : '个人主页'} showBack />
      <View className='public-profile-page__content'>
        {profileLoading && (
          <View className='public-profile-state'>正在加载个人资料</View>
        )}
        {!profileLoading && profileError && (
          <View className='public-profile-state public-profile-state--error'>
            <Text>{profileError}</Text>
            <View onClick={() => void loadProfile(userId)}>重新加载</View>
          </View>
        )}
        {!profileLoading && profile && (
          <>
            <View className='public-profile-hero motion-enter'>
              <UserAvatar
                src={profile.user.avatar_url}
                className='public-profile-hero__avatar'
                imageClassName='public-profile-hero__avatar-image'
                fallback={profile.user.nickname.slice(0, 1) || '同'}
                userId={profile.user.id}
              />
              <View className='public-profile-hero__identity'>
                <View className='public-profile-hero__name-line'>
                  <Text>{profile.user.nickname}</Text>
                  {profile.is_self && <Text>我自己</Text>}
                </View>
                <Text className='public-profile-hero__level'>
                  Lv.{profile.user.level.level} · {profile.user.level.name}
                </Text>
                <Text className='public-profile-hero__hint'>
                  {profile.is_self
                    ? '这里展示你未删除的校园发布'
                    : '仅展示对你公开可见的校园内容'}
                </Text>
                {!isQualificationEdition
                  && !profile.is_self
                  && resolveMiniappModule(runtimeConfig, 'private_message').state !== 'hidden'
                  && (
                  <View
                    className='public-profile-hero__message-action'
                    ariaRole='button'
                    ariaLabel={`给${profile.user.nickname}发私信`}
                    onClick={beginPrivateConversation}
                  >
                    {openingConversation ? '正在打开' : '发私信'}
                  </View>
                )}
              </View>
            </View>

            <View className='public-profile-tabs' ariaRole='tablist'>
              {tabOptions.map((tab) => (
                <View
                  key={tab.key}
                  className={activeTab === tab.key
                    ? 'public-profile-tab public-profile-tab--active'
                    : 'public-profile-tab'}
                  ariaRole='button'
                  ariaLabel={`${tab.label}，${countForTab(tab.key)} 条`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Text>{tab.label}</Text>
                  <Text>{countForTab(tab.key)}</Text>
                </View>
              ))}
            </View>

            <View className='public-profile-section-heading'>
              <View>
                <Text>{tabOptions.find((tab) => tab.key === activeTab)?.label}</Text>
                <Text>{profile.is_self ? '我的发布与进度' : '公开可见的发布'}</Text>
              </View>
              <Text>{tabState.loaded ? `${tabState.total} 条` : '待加载'}</Text>
            </View>

            {tabState.loading && (
              <View className='public-profile-state'>正在加载{tabOptions.find((tab) => tab.key === activeTab)?.label}内容</View>
            )}
            {!tabState.loading && tabState.error && (
              <View className='public-profile-state public-profile-state--error'>
                <Text>{tabState.error}</Text>
                <View onClick={() => void loadTab(activeTab)}>重新加载</View>
              </View>
            )}
            {!tabState.loading && !tabState.error && renderItems()}
            {!tabState.loading && !tabState.error && tabState.loaded && tabState.items.length === 0 && (
              <View className='public-profile-state public-profile-state--empty'>
                <Text>还没有可展示的{tabOptions.find((tab) => tab.key === activeTab)?.label}内容</Text>
                <Text>{profile.is_self ? '发布后就会出现在这里' : '去其他分类看看吧'}</Text>
              </View>
            )}
            {!tabState.loading && !tabState.error && tabState.items.length < tabState.total && (
              <View
                className='public-profile-load-more'
                onClick={() => !tabState.loadingMore && void loadTab(activeTab, tabState.page + 1, true)}
              >
                {tabState.loadingMore ? '正在加载' : '查看更多'}
              </View>
            )}
          </>
        )}
      </View>
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
          onCommentCreated={updateLatestCommunityComment}
        />
      )}
    </View>
  )
}
