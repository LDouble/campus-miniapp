import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import type { CarpoolTripView } from '../../api/types'
import { isApiError } from '../../api/client'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import { openAcademicVerification } from '../../features/academic-verification/guard'
import { openContentReport } from '../../features/content-report'
import { requestWechatSubscriptionForModule } from '../../features/wechat-subscription'
import {
  formatDateTime,
  formatStatus,
  remainingSeats,
} from '../../features/life-services/format'
import '../../features/life-services/detail.scss'

const actionLabels: Record<string, string> = {
  edit: '编辑计划',
  submit_review: '重新提交',
  cancel: '取消计划',
  join: '一起同行',
  leave: '取消同行',
  verify_academic: '完成校园认证',
}

export default function CarpoolDetailPage() {
  const [id, setId] = useState(0)
  const [item, setItem] = useState<CarpoolTripView | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = async (targetId = id) => {
    if (!targetId) return
    setLoading(true)
    setError('')
    try {
      setItem(await lifeServicesRepository.getCarpoolTrip(targetId))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '同行计划加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useLoad((options) => {
    const nextId = Number(options.id)
    setId(nextId)
    if (nextId > 0) void load(nextId)
    else {
      setLoading(false)
      setError('同行计划参数无效')
    }
  })
  usePullDownRefresh(() => void load())

  const runAction = async (action: string) => {
    if (!item || working) return
    if (action === 'submit_review') {
      requestWechatSubscriptionForModule('carpool')
    }
    if (action === 'verify_academic') {
      await openAcademicVerification({ prompt: false })
      return
    }
    if (action === 'edit') {
      requestWechatSubscriptionForModule('carpool')
      Taro.navigateTo({ url: `/pages/publish/index?section=carpool&mode=edit&id=${item.id}` })
      return
    }
    const confirm = await Taro.showModal({
      title: actionLabels[action] || '确认操作',
      content: action === 'join'
        ? `确认与大家一起从“${item.origin}”前往“${item.destination}”吗？`
        : action === 'leave'
          ? '取消同行后，该同行名额将重新开放。'
        : action === 'cancel'
            ? '取消后所有同行同学都会受到影响，请确认已经沟通。'
            : '提交后计划会重新进入校园内容审核。',
      confirmColor: action === 'cancel' ? '#bd6657' : '#708fc9',
    })
    if (!confirm.confirm) return

    setWorking(true)
    try {
      if (action === 'join') setItem(await lifeServicesRepository.joinCarpoolTrip(item.id, item.version))
      else if (action === 'leave') setItem(await lifeServicesRepository.leaveCarpoolTrip(item.id, item.version))
      else if (action === 'cancel') setItem(await lifeServicesRepository.cancelCarpoolTrip(item.id, item.version))
      else if (action === 'submit_review') setItem(await lifeServicesRepository.submitCarpoolReview(item.id, item.version))
      markLifeHubSectionDirty('carpool')
      Taro.showToast({ title: '状态已更新', icon: 'success' })
    } catch (actionError) {
      if (isApiError(actionError) && actionError.code === 'academic_verification_required') return
      if (isApiError(actionError) && actionError.statusCode === 409) await load()
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '操作失败，请重试',
        icon: 'none',
      })
    } finally {
      setWorking(false)
    }
  }

  const copyContact = () => {
    if (!item?.contact || item.contact.includes('*')) {
      Taro.showToast({ title: '确认同行后可查看完整联系方式', icon: 'none' })
      return
    }
    Taro.setClipboardData({ data: item.contact })
  }

  return (
    <View className='life-detail life-detail--carpool'>
      <CustomNavbar title='同行计划' subtitle='同时间、同方向，一起出发' showBack />
      <View className='life-detail__content'>
        {loading && <View className='detail-state'>正在加载同行计划</View>}
        {!loading && error && <View className='detail-state'><Text>{error}</Text><View onClick={() => void load()}>重新加载</View></View>}
        {!loading && item && (
          <>
            <View className='detail-overview detail-overview--carpool'>
              <View className='detail-overview__meta'>
                <Text>{formatStatus(item.status, item.review_status)}</Text>
                <Text>{formatDateTime(item.departure_at)}</Text>
              </View>
              <View className='detail-route' style={{ marginTop: '28rpx' }}>
                <View className='detail-route__rail'><View /><View /><View /></View>
                <View className='detail-route__place'><Text>出发地</Text><Text>{item.origin}</Text></View>
                <View className='detail-route__place'><Text>目的地</Text><Text>{item.destination}</Text></View>
              </View>
              {item.description && (
                <Text className='detail-overview__description'>{item.description}</Text>
              )}
              <View className='detail-overview__summary'>
                <View><Text>出发时间</Text><Text>{formatDateTime(item.departure_at)}</Text></View>
                <View className='carpool-count'><Text>{remainingSeats(item.total_seats, item.occupied_seats)}</Text><Text>人可同行</Text></View>
              </View>
            </View>

            {item.review_status === 'rejected' && (
              <View className='detail-review-alert'>
                <Text>审核未通过</Text>
                <Text>{item.review_reason || '请修改同行计划后重新提交审核。'}</Text>
              </View>
            )}

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>同行信息</Text><Text>出发前请再次确认</Text></View>
              <View className='detail-facts'>
                <View className='detail-fact'><Text>同行名额</Text><Text>{item.total_seats} 人</Text></View>
                <View className='detail-fact'><Text>已响应</Text><Text>{item.occupied_seats} 人</Text></View>
                <View className='detail-fact'><Text>当前关系</Text><Text>{item.viewer_relation === 'organizer' ? '我发起的' : item.viewer_relation === 'participant' ? '我要同行' : '可一起同行'}</Text></View>
                <View className='detail-fact'><Text>计划状态</Text><Text>{formatStatus(item.status)}</Text></View>
              </View>
            </View>

            <View className='detail-section detail-contact' onClick={copyContact}>
              <View className='detail-section__heading'><Text>联系发起人</Text><Text>点击复制</Text></View>
              <View className='detail-contact__row'>
                <Text>{item.contact_type || '校内联系'}</Text>
                <Text>{item.contact || '确认同行后可见'}</Text>
              </View>
              <Text className='detail-contact__tip'>联系方式由服务端按同行关系授权，取消同行或计划结束后会重新隐藏。</Text>
            </View>

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>出行提醒</Text><Text>信息撮合</Text></View>
              <Text className='detail-safety'>请在出发前与同行人确认集合点、出行方式、费用分担和安全事项。平台仅提供校内同行信息交流服务，不提供运输、营运或保险担保。</Text>
            </View>

            {item.viewer_relation !== 'organizer' && (
              <View
                className='detail-report-link'
                hoverClass='detail-report-link--pressed'
                onClick={() => void openContentReport({
                  resourceType: 'carpool',
                  resourceId: item.id,
                  resourceVersion: item.version,
                })}
              >
                举报这条信息
              </View>
            )}

            {item.available_actions.length > 0 && (
              <View className='detail-action-bar'>
                {item.available_actions.slice(0, 3).map((action, index) => (
                  <View
                    id={`detail-action-${action}`}
                    key={action}
                    className={`detail-action ${index === item.available_actions.length - 1 && action !== 'cancel' ? 'detail-action--primary' : ''} ${action === 'cancel' ? 'detail-action--danger' : ''}`}
                    hoverClass='detail-action--pressed'
                    onClick={() => void runAction(action)}
                  >
                    {working ? '处理中' : actionLabels[action] || action}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )
}
