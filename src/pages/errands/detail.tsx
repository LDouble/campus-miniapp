import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import type { ErrandView } from '../../api/types'
import { isApiError } from '../../api/client'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import { openAcademicVerification } from '../../features/academic-verification/guard'
import { openContentReport } from '../../features/content-report'
import { requestWechatSubscriptionForModule } from '../../features/wechat-subscription'
import { useCampusShare } from '../../features/share'
import {
  formatDateTime,
  formatMoney,
  formatStatus,
  relativeDeadline,
} from '../../features/life-services/format'
import '../../features/life-services/detail.scss'

const actionLabels: Record<string, string> = {
  edit: '编辑',
  submit_review: '重新提交',
  accept: '我要接单',
  pickup: '确认取件',
  deliver: '确认送达',
  complete: '确认完成',
  cancel: '取消任务',
  verify_academic: '完成校园认证',
}

export default function ErrandDetailPage() {
  const [id, setId] = useState(0)
  const [item, setItem] = useState<ErrandView | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = async (targetId = id) => {
    if (!targetId) return
    setLoading(true)
    setError('')
    try {
      setItem(await lifeServicesRepository.getErrand(targetId))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '跑腿任务加载失败')
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
      setError('任务参数无效')
    }
  })
  usePullDownRefresh(() => void load())

  useCampusShare(() => ({
    title: item
      ? `${item.pickup_location} → ${item.dropoff_location}｜校园跑腿`
      : '校园跑腿｜海大校园',
    path: id ? '/pages/errands/detail' : '/pages/community/index',
    query: id ? { id } : { section: 'errands' },
  }))

  const updateFromAction = async (action: string) => {
    if (!item || working) return
    if (action === 'submit_review') {
      requestWechatSubscriptionForModule('errand')
    }
    if (action === 'verify_academic') {
      await openAcademicVerification({ prompt: false })
      return
    }
    if (action === 'edit') {
      requestWechatSubscriptionForModule('errand')
      Taro.navigateTo({ url: `/pages/publish/index?section=errands&mode=edit&id=${item.id}` })
      return
    }
    const result = await Taro.showModal({
      title: actionLabels[action] || '确认操作',
      content: action === 'accept'
        ? `确认接下这个任务吗？完成后可获得 ${formatMoney(item.reward_cents)}。`
        : action === 'cancel'
          ? '取消后任务将停止流转，请确认是否继续。'
          : '请确认当前进度真实无误。',
      confirmColor: action === 'cancel' ? '#bd6657' : '#3f8f83',
    })
    if (!result.confirm) return

    setWorking(true)
    try {
      if (action === 'accept') {
        const response = await lifeServicesRepository.acceptErrand(item.id, item.version)
        setItem(response.errand)
      } else if (action === 'pickup') {
        setItem(await lifeServicesRepository.pickupErrand(item.id, item.version))
      } else if (action === 'deliver') {
        setItem(await lifeServicesRepository.deliverErrand(item.id, item.version))
      } else if (action === 'complete') {
        const response = await lifeServicesRepository.completeErrand(item.id, item.version)
        setItem(response.errand)
      } else if (action === 'cancel') {
        const response = await lifeServicesRepository.cancelErrand(item.id, item.version)
        setItem(response.errand)
      } else if (action === 'submit_review') {
        setItem(await lifeServicesRepository.submitErrandReview(item.id, item.version))
      }
      markLifeHubSectionDirty('errands')
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
      Taro.showToast({ title: '参与任务后可查看完整联系方式', icon: 'none' })
      return
    }
    Taro.setClipboardData({ data: item.contact })
  }

  return (
    <View className='life-detail life-detail--errands'>
      <CustomNavbar title='跑腿详情' subtitle='校园实名互助' showBack />
      <View className='life-detail__content'>
        {loading && <View className='detail-state'>正在加载任务信息</View>}
        {!loading && error && (
          <View className='detail-state'>
            <Text>{error}</Text>
            <View onClick={() => void load()}>重新加载</View>
          </View>
        )}
        {!loading && item && (
          <>
            <View className='detail-overview'>
              <View className='detail-overview__meta'>
                <Text>{formatStatus(item.status, item.review_status)}</Text>
                <Text>{relativeDeadline(item.deadline)}</Text>
              </View>
              <View className='detail-overview__summary detail-overview__summary--primary'>
                <View>
                  <Text>任务报酬</Text>
                  <Text>{item.currency === 'CNY' ? '线下结算' : item.currency}</Text>
                </View>
                <Text>{formatMoney(item.reward_cents)}</Text>
              </View>
              <Text className='detail-overview__description'>{item.description}</Text>
            </View>

            {item.review_status === 'rejected' && (
              <View className='detail-review-alert'>
                <Text>审核未通过</Text>
                <Text>{item.review_reason || '请修改任务信息后重新提交审核。'}</Text>
              </View>
            )}

            <View className='detail-section'>
              <View className='detail-section__heading'>
                <Text>取送路线</Text>
                <Text>请提前确认交接点</Text>
              </View>
              <View className='detail-route'>
                <View className='detail-route__rail'><View /><View /><View /></View>
                <View className='detail-route__place'><Text>取件地</Text><Text>{item.pickup_location}</Text></View>
                <View className='detail-route__place'><Text>送达地</Text><Text>{item.dropoff_location}</Text></View>
              </View>
            </View>

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>任务信息</Text><Text>实时状态</Text></View>
              <View className='detail-facts'>
                <View className='detail-fact'><Text>截止时间</Text><Text>{formatDateTime(item.deadline)}</Text></View>
                <View className='detail-fact'><Text>当前关系</Text><Text>{item.viewer_relation === 'publisher' ? '我发布的' : item.viewer_relation === 'runner' ? '我接的任务' : '可参与'}</Text></View>
                <View className='detail-fact'><Text>任务状态</Text><Text>{formatStatus(item.status)}</Text></View>
                <View className='detail-fact'><Text>审核状态</Text><Text>{formatStatus(item.review_status)}</Text></View>
              </View>
            </View>

            <View className='detail-section detail-contact' onClick={copyContact}>
              <View className='detail-section__heading'><Text>联系方式</Text><Text>点击复制</Text></View>
              <View className='detail-contact__row'>
                <Text>{item.contact_type || '校内联系'}</Text>
                <Text>{item.contact || '参与后可见'}</Text>
              </View>
              <Text className='detail-contact__tip'>联系方式由服务端按参与关系授权，结束后会重新隐藏。</Text>
            </View>

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>安全提示</Text><Text>线下互助</Text></View>
              <Text className='detail-safety'>取送前请核对物品和地点，不代收验证码、不垫付高额费用。报酬为线下结算，平台不代收款。</Text>
            </View>

            {item.viewer_relation !== 'publisher' && (
              <View
                className='detail-report-link'
                hoverClass='detail-report-link--pressed'
                onClick={() => void openContentReport({
                  resourceType: 'errand',
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
                    onClick={() => void updateFromAction(action)}
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
