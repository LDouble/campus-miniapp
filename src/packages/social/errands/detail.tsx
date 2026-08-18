import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import type { ErrandView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import { getCurrentIdentity } from '../../../api/account'
import { lifeServicesRepository } from '../../../features/life-services/repository'
import { consumeBusinessDetailSnapshot } from '../../../features/life-services/business-detail-snapshot'
import { markLifeHubSectionDirty } from '../../../features/life-services/refresh-policy'
import { openAcademicVerification } from '../../../features/academic-verification/guard'
import { openContentReport } from '../../../features/content-report'
import { requestWechatSubscriptionForModule } from '../../../features/wechat-subscription'
import { useCampusShare } from '../../../features/share'
import {
  formatDateTime,
  formatMoney,
  formatStatus,
} from '../../../features/life-services/format'
import DetailAuthorNavbar from '../../../features/life-services/components/detail-author-navbar'
import DetailBusinessIntro from '../../../features/life-services/components/detail-business-intro'
import DetailComments, {
  createBusinessContactComment,
} from '../../../features/life-services/components/detail-comments'
import BusinessRoute from '../../../features/life-services/components/business-route'
import { buildDetailFooterActions } from '../../../features/life-services/detail-actions'
import { campusLabel } from '../../../features/life-services/campus'
import {
  contactTypeLabel,
  showParticipationContact,
} from '../../../features/life-services/contact-reveal'
import {
  hasParticipationContactAccess,
  type ParticipationContact,
  restoreParticipationContact,
  visibleParticipationContact,
} from '../../../features/life-services/participation-contact-storage'
import '../../../features/life-services/detail.scss'

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
  const [commentRefreshKey, setCommentRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [persistedContact, setPersistedContact] = useState<ParticipationContact | null>(null)

  const applyItem = async (nextItem: ErrandView) => {
    setItem(nextItem)
    const contact = await restoreParticipationContact(Taro, getCurrentIdentity, {
      resourceType: 'errand',
      resourceId: nextItem.id,
      viewerRelation: nextItem.viewer_relation,
      resourceStatus: nextItem.status,
      contactType: nextItem.contact_type,
      contact: nextItem.contact,
    })
    setPersistedContact(contact)
    return contact
  }

  const load = async (targetId = id, silent = false) => {
    if (!targetId) return
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      await applyItem(await lifeServicesRepository.getErrand(targetId))
    } catch (loadError) {
      if (!silent) {
        setError(isApiError(loadError) ? loadError.message : '跑腿任务加载失败')
      }
    } finally {
      if (!silent) {
        setLoading(false)
        Taro.stopPullDownRefresh()
      }
    }
  }

  useLoad((options) => {
    const nextId = Number(options.id)
    setId(nextId)
    if (nextId <= 0) {
      setLoading(false)
      setError('任务参数无效')
      return
    }
    const snapshot = options.snapshot === '1'
      ? consumeBusinessDetailSnapshot('errand', nextId)
      : null
    if (snapshot) {
      setItem(snapshot)
      setPersistedContact(null)
      setError('')
      setLoading(false)
      void load(nextId, true)
      return
    }
    void load(nextId)
  })
  usePullDownRefresh(() => void load())

  useCampusShare(() => ({
    title: item
      ? `${item.pickup_location} → ${item.dropoff_location}｜校园跑腿`
      : '校园跑腿｜海大校园',
    path: id ? '/packages/social/errands/detail' : '/pages/community/index',
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
      Taro.navigateTo({ url: `/packages/social/publish/index?section=errands&mode=edit&id=${item.id}` })
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
    let contactCommentStatus: 'none' | 'created' | 'failed' = 'none'
    let participationItem: ErrandView | null = null
    let participationContact: ParticipationContact | null = null
    try {
      if (action === 'accept') {
        const response = await lifeServicesRepository.acceptErrand(item.id, item.version)
        participationItem = response.errand
        participationContact = await applyItem(participationItem)
        try {
          await createBusinessContactComment(
            'errand',
            item.id,
            '我已接单，方便联系确认一下取送细节吗？',
          )
          contactCommentStatus = 'created'
          setCommentRefreshKey((current) => current + 1)
        } catch (commentError) {
          contactCommentStatus = 'failed'
        }
        try {
          participationItem = await lifeServicesRepository.getErrand(item.id)
          participationContact = await applyItem(participationItem)
        } catch {
          // 保留接单接口返回的已更新详情。
        }
      } else if (action === 'pickup') {
        await applyItem(await lifeServicesRepository.pickupErrand(item.id, item.version))
      } else if (action === 'deliver') {
        await applyItem(await lifeServicesRepository.deliverErrand(item.id, item.version))
      } else if (action === 'complete') {
        const response = await lifeServicesRepository.completeErrand(item.id, item.version)
        await applyItem(response.errand)
      } else if (action === 'cancel') {
        const response = await lifeServicesRepository.cancelErrand(item.id, item.version)
        await applyItem(response.errand)
      } else if (action === 'submit_review') {
        await applyItem(await lifeServicesRepository.submitErrandReview(item.id, item.version))
      }
      markLifeHubSectionDirty('errands')
      if (participationItem) {
        await showParticipationContact(Taro, {
          successTitle: '接单成功',
          contactType: participationContact?.contactType || participationItem.contact_type,
          contact: participationContact?.contact || participationItem.contact,
          commentStatus: contactCommentStatus,
          confirmColor: '#3f8f83',
        })
      } else {
        Taro.showToast({ title: '状态已更新', icon: 'success' })
      }
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

  const displayedContact = visibleParticipationContact(
    item?.contact_type,
    item?.contact,
    persistedContact,
  )

  const copyContact = () => {
    if (!displayedContact) {
      Taro.showToast({ title: '参与任务后可查看完整联系方式', icon: 'none' })
      return
    }
    Taro.setClipboardData({ data: displayedContact.contact })
  }

  const persistentContact = item
    && displayedContact
    && hasParticipationContactAccess('errand', item.viewer_relation, item.status)
      ? {
          label: `发布者 · ${contactTypeLabel(displayedContact.contactType)}`,
          value: displayedContact.contact,
          onCopy: copyContact,
        }
      : undefined

  const footerActions = item ? buildDetailFooterActions({
    availableActions: item.available_actions,
    labels: actionLabels,
    priority: ['accept', 'pickup', 'deliver', 'complete', 'submit_review', 'cancel', 'edit', 'verify_academic'],
    dangerActions: ['cancel'],
    busy: working,
    onAction: (action) => void updateFromAction(action),
  }) : []

  return (
    <View className='life-detail life-detail--errands'>
      <CustomNavbar
        title='跑腿详情'
        showBack
        barContent={item ? (
          <DetailAuthorNavbar
            avatarUrl={item.author_avatar_url}
            nickname={item.author_nickname}
            userId={item.requester_id}
          />
        ) : undefined}
      />
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
            <DetailBusinessIntro
              badges={[
                '跑腿',
                campusLabel(item.campus),
                formatStatus(item.status, item.review_status),
              ]}
              title={item.description}
              action={item.viewer_relation !== 'publisher' ? (
                <View
                  className='detail-overview__report'
                  hoverClass='detail-report-link--pressed'
                  onClick={() => void openContentReport({
                    resourceType: 'errand',
                    resourceId: item.id,
                    resourceVersion: item.version,
                  })}
                >
                  举报
                </View>
              ) : undefined}
            >
              <View className='detail-important-card detail-important-card--errand'>
                <View className='detail-important-card__topline'>
                  <View>
                    <Text>任务报酬</Text>
                    <Text>{item.currency === 'CNY' ? '线下结算' : item.currency}</Text>
                  </View>
                  <Text>{formatMoney(item.reward_cents)}</Text>
                </View>
                <BusinessRoute
                  startLabel='取件地'
                  start={item.pickup_location}
                  endLabel='送达地'
                  end={item.dropoff_location}
                  variant='detail'
                />
                <View className='detail-important-card__row'>
                  <Text>期望送达</Text>
                  <Text>{formatDateTime(item.deadline)}</Text>
                </View>
              </View>
            </DetailBusinessIntro>

            {item.review_status === 'rejected' && (
              <View className='detail-review-alert'>
                <Text>审核未通过</Text>
                <Text>{item.review_reason || '请修改任务信息后重新提交审核。'}</Text>
              </View>
            )}

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
                <Text>{displayedContact ? contactTypeLabel(displayedContact.contactType) : '校内联系'}</Text>
                <Text>{displayedContact?.contact || '参与后可见'}</Text>
              </View>
              <Text className='detail-contact__tip'>
                {displayedContact
                  ? '已为当前账号在本机保留，之后回来仍可查看。'
                  : '接单后可查看完整联系方式，公开页面会自动隐藏敏感信息。'}
              </Text>
            </View>

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>安全提示</Text><Text>线下互助</Text></View>
              <Text className='detail-safety'>取送前请核对物品和地点，不代收验证码、不垫付高额费用。报酬为线下结算，平台不代收款。</Text>
            </View>

            <DetailComments
              targetType='errand'
              targetId={item.id}
              enabled={item.review_status === 'approved'}
              refreshKey={commentRefreshKey}
              targetAuthorId={item.requester_id}
              tone='errand'
              actions={footerActions}
              persistentContact={persistentContact}
            />
          </>
        )}
      </View>
    </View>
  )
}
