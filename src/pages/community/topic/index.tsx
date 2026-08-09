import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CampusCirclePostView, CampusCircleTopicView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import CustomNavbar from '../../../components/custom-navbar'
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
    const id = Number(options.id)
    setTopicId(Number.isInteger(id) && id > 0 ? id : 0); void load(id)
  })
  usePullDownRefresh(() => { void load(topicId) })

  const toggleLike = async (post: CampusCirclePostView) => {
    const updated = post.liked
      ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
      : await lifeServicesRepository.likeCampusCirclePost(post.id)
    setPosts((current) => current.map((item) => item.id === updated.id ? updated : item))
  }
  const openPost = (post: CampusCirclePostView) => Taro.navigateTo({ url: `/pages/community/detail?id=${post.id}&mode=post` })

  return <View className='community-topic-page'>
    <CustomNavbar title={topic?.kind === 'campaign' ? '校园活动' : '话题动态'} showBack />
    <View className='community-topic-page__content'>
      {topic && <View className='community-topic-page__hero'><Text>#{topic.name}</Text><Text>{topic.description || `${topic.post_count} 条讨论`}</Text></View>}
      {loading && <View className='community-topic-page__state'>正在加载讨论</View>}
      {!loading && error && <View className='community-topic-page__state' onClick={() => void load(topicId)}>{error}，点击重试</View>}
      {!loading && !error && posts.map((post) => <CommunityPostCard key={post.id} post={post} sectionName='校园社区' onToggleLike={(item) => void toggleLike(item)} onOpen={openPost} />)}
      {!loading && !error && posts.length === 0 && <View className='community-topic-page__state'>暂时还没有动态，来抢沙发吧</View>}
    </View>
  </View>
}
