import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView, CampusCircleTopicView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import CustomNavbar from '../../../components/custom-navbar'
import {
  communityTopicPublisherUrl,
  parsePositiveId,
  topicPeriodLabel,
} from '../../../features/community/topic'
import { lifeServicesRepository } from '../../../features/life-services/repository'
import CommunityPostCard from '../../../features/community/post-card'
import './index.scss'

export default function CommunityTopicPage() {
  const [topic, setTopic] = useState<CampusCircleTopicView | null>(null)
  const [posts, setPosts] = useState<CampusCirclePostView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [topicId, setTopicId] = useState(0)

  const load = async (id: number) => {
    if (!Number.isInteger(id) || id < 1) {
      setLoading(false)
      setError('话题参数无效')
      Taro.stopPullDownRefresh()
      return
    }
    setLoading(true); setError('')
    try {
      const [topicResult, postsResult] = await Promise.all([
        lifeServicesRepository.getCampusCircleTopic(id),
        lifeServicesRepository.listCampusCirclePosts({ topicId: id, pageSize: 50 }),
      ])
      setTopic(topicResult); setPosts(postsResult.items)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '话题加载失败')
    } finally {
      setLoading(false); Taro.stopPullDownRefresh()
    }
  }

  useLoad((options) => {
    const id = parsePositiveId(options.id)
    setTopicId(id); void load(id)
  })
  usePullDownRefresh(() => { void load(topicId) })

  const toggleLike = async (post: CampusCirclePostView) => {
    const updated = post.liked
      ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
      : await lifeServicesRepository.likeCampusCirclePost(post.id)
    setPosts((current) => current.map((item) => item.id === updated.id ? updated : item))
  }
  const openPost = (post: CampusCirclePostView) => Taro.navigateTo({ url: `/pages/community/detail?id=${post.id}&mode=post` })
  const openPublisher = () => {
    if (!topic) return
    Taro.navigateTo({ url: communityTopicPublisherUrl(topic.id) })
  }

  const topicLabel = topic?.kind === 'campaign'
    ? '校园活动'
    : topic?.is_hot
      ? '热门话题'
      : '校园话题'
  const participateLabel = topic?.kind === 'campaign' ? '参与活动' : '参与讨论'
  const periodLabel = topic ? topicPeriodLabel(topic) : ''

  return <View className='community-topic-page'>
    <CustomNavbar title={topic?.name || topicLabel} showBack />
    <View className='community-topic-page__content'>
      {topic && (
        <View className={`community-topic-hero ${topic.cover_url ? 'community-topic-hero--covered' : ''}`}>
          {topic.cover_url && <Image className='community-topic-hero__cover' src={topic.cover_url} mode='aspectFill' />}
          <View className='community-topic-hero__glow' />
          <View className='community-topic-hero__content'>
            <View className='community-topic-hero__eyebrow'>
              <Text>{topicLabel}</Text>
              {topic.is_hot && topic.kind === 'campaign' && <Text>热门</Text>}
            </View>
            <Text className='community-topic-hero__title'>#{topic.name}</Text>
            <Text className='community-topic-hero__description'>
              {topic.description || '和海大同学一起分享观点与校园见闻'}
            </Text>
            <View className='community-topic-hero__footer'>
              <View className='community-topic-hero__meta'>
                <Text>{topic.post_count} 条动态</Text>
                {periodLabel && <Text>{periodLabel}</Text>}
              </View>
              <View
                className='community-topic-hero__action'
                hoverClass='community-topic-hero__action--pressed'
                ariaRole='button'
                ariaLabel={`${participateLabel}：${topic.name}`}
                onClick={openPublisher}
              >
                <Text>{participateLabel}</Text>
                <Text>＋</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {!loading && !error && topic && (
        <View className='community-topic-feed-heading'>
          <View>
            <Text>话题动态</Text>
            <Text>看看同学们正在聊什么</Text>
          </View>
          <Text>{topic.post_count} 条</Text>
        </View>
      )}

      {loading && <View className='community-topic-page__state'>正在加载讨论</View>}
      {!loading && error && (
        <View className='community-topic-page__state community-topic-page__state--error'>
          <Text>{error}</Text>
          <View onClick={() => void load(topicId)}>重新加载</View>
        </View>
      )}
      {!loading && !error && posts.map((post) => <CommunityPostCard key={post.id} post={post} sectionName='校园社区' onToggleLike={(item) => void toggleLike(item)} onOpen={openPost} />)}
      {!loading && !error && topic && posts.length === 0 && (
        <View className='community-topic-empty'>
          <View>OUC</View>
          <Text>还没有人发布动态</Text>
          <Text>带上这个话题，成为第一个参与讨论的人</Text>
          <View
            className='community-topic-empty__action'
            hoverClass='community-topic-empty__action--pressed'
            ariaRole='button'
            ariaLabel={`${participateLabel}：${topic.name}`}
            onClick={openPublisher}
          >
            {participateLabel}
          </View>
        </View>
      )}
    </View>
  </View>
}
