import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import type { CarpoolTripView } from '../../../api/types'
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
  formatStatus,
  remainingSeats,
} from '../../../features/life-services/format'
import DetailAuthorHeader from '../../../features/life-services/components/detail-author-header'
import DetailBusinessIntro from '../../../features/life-services/components/detail-business-intro'
import DetailComments, {
  createBusinessContactComment,
} from '../../../features/life-services/components/detail-comments'
import DetailOverflowActions from '../../../features/life-services/components/detail-overflow-actions'
import BusinessRoute from '../../../features/life-services/components/business-route'
import {
  buildDetailFooterActions,
  splitDetailActions,
} from '../../../features/life-services/detail-actions'
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
  const [commentRefreshKey, setCommentRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [persistedContact, setPersistedContact] = useState<ParticipationContact | null>(null)

  const applyItem = async (nextItem: CarpoolTripView) => {
    setItem(nextItem)
    const contact = await restoreParticipationContact(Taro, getCurrentIdentity, {
      resourceType: 'carpool',
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
      await applyItem(await lifeServicesRepository.getCarpoolTrip(targetId))
    } catch (loadError) {
      if (!silent) {
        setError(isApiError(loadError) ? loadError.message : '同行计划加载失败')
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
      setError('同行计划参数无效')
      return
    }
    const snapshot = options.snapshot === '1'
      ? consumeBusinessDetailSnapshot('carpool', nextId)
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
      ? `${item.origin} → ${item.destination}｜校园同行`
      : '校园找同行｜OUSea',
    path: id ? '/packages/social/carpool/detail' : '/pages/community/index',
    query: id ? { id } : { section: 'carpool' },
  }))

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
      Taro.navigateTo({ url: `/packages/social/publish/index?section=carpool&mode=edit&id=${item.id}` })
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
    let contactCommentStatus: 'none' | 'created' | 'failed' = 'none'
    let participationItem: CarpoolTripView | null = null
    let participationContact: ParticipationContact | null = null
    try {
      if (action === 'join') {
        participationItem = await lifeServicesRepository.joinCarpoolTrip(item.id, item.version)
        participationContact = await applyItem(participationItem)
        try {
          await createBusinessContactComment(
            'carpool',
            item.id,
            '我想一起同行，方便联系确认一下集合和费用细节吗？',
          )
          contactCommentStatus = 'created'
          setCommentRefreshKey((current) => current + 1)
        } catch (commentError) {
          contactCommentStatus = 'failed'
        }
        try {
          participationItem = await lifeServicesRepository.getCarpoolTrip(item.id)
          participationContact = await applyItem(participationItem)
        } catch {
          // 保留参与接口返回的已更新详情。
        }
      }
      else if (action === 'leave') await applyItem(await lifeServicesRepository.leaveCarpoolTrip(item.id, item.version))
      else if (action === 'cancel') await applyItem(await lifeServicesRepository.cancelCarpoolTrip(item.id, item.version))
      else if (action === 'submit_review') await applyItem(await lifeServicesRepository.submitCarpoolReview(item.id, item.version))
      markLifeHubSectionDirty('carpool')
      if (participationItem) {
        await showParticipationContact(Taro, {
          successTitle: '加入同行成功',
          contactType: participationContact?.contactType || participationItem.contact_type,
          contact: participationContact?.contact || participationItem.contact,
          commentStatus: contactCommentStatus,
          confirmColor: '#708fc9',
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
      Taro.showToast({ title: '确认同行后可查看完整联系方式', icon: 'none' })
      return
    }
    Taro.setClipboardData({ data: displayedContact.contact })
  }

  const persistentContact = item
    && displayedContact
    && hasParticipationContactAccess('carpool', item.viewer_relation, item.status)
      ? {
          label: `发起人 · ${contactTypeLabel(displayedContact.contactType)}`,
          value: displayedContact.contact,
          onCopy: copyContact,
        }
      : undefined

  const footerActions = item ? buildDetailFooterActions({
    availableActions: item.available_actions,
    labels: actionLabels,
    priority: ['join', 'leave', 'submit_review', 'cancel', 'edit', 'verify_academic'],
    dangerActions: ['leave', 'cancel'],
    busy: working,
    onAction: (action) => void runAction(action),
  }) : []
  const { inlineActions, overflowActions } = splitDetailActions(
    footerActions,
    ['edit', 'cancel'],
  )

  return (
    <View className='life-detail life-detail--carpool'>
      <CustomNavbar title='找同行详情' showBack />
      <View className='life-detail__content'>
        {loading && <View className='detail-state'>正在加载找同行信息</View>}
        {!loading && error && <View className='detail-state'><Text>{error}</Text><View onClick={() => void load()}>重新加载</View></View>}
        {!loading && item && (
          <>
            <DetailAuthorHeader
              avatarUrl={item.author_avatar_url}
              nickname={item.author_nickname}
              userId={item.organizer_id}
              meta={<Text>{formatDateTime(item.created_at)}</Text>}
              action={(
                <View className='detail-overview__toolbar-actions'>
                  {item.viewer_relation !== 'organizer' && (
                    <View
                      className='detail-overview__report'
                      onClick={() => void openContentReport({
                        resourceType: 'carpool',
                        resourceId: item.id,
                        resourceVersion: item.version,
                      })}
                    >
                      举报
                    </View>
                  )}
                  <DetailOverflowActions actions={overflowActions} />
                </View>
              )}
            />
            <DetailBusinessIntro
              badges={[
                campusLabel(item.campus),
                formatStatus(item.status, item.review_status),
              ]}
              title={item.description}
            >
              <View className='carpool-detail-route-card'>
                <BusinessRoute
                  startLabel='出发地'
                  start={item.origin}
                  endLabel='目的地'
                  end={item.destination}
                  variant='detail'
                />
                <View className='detail-important-card__grid'>
                  <View>
                    <Text>出发时间</Text>
                    <Text>{formatDateTime(item.departure_at)}</Text>
                  </View>
                  <View>
                    <Text>同行人数</Text>
                    <Text>{item.occupied_seats} / {item.total_seats} 人</Text>
                  </View>
                  <View>
                    <Text>剩余名额</Text>
                    <Text>{remainingSeats(item.total_seats, item.occupied_seats)} 人</Text>
                  </View>
                </View>
              </View>
            </DetailBusinessIntro>

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
                <Text>{displayedContact ? contactTypeLabel(displayedContact.contactType) : '校内联系'}</Text>
                <Text>{displayedContact?.contact || '确认同行后可见'}</Text>
              </View>
              <Text className='detail-contact__tip'>
                {displayedContact
                  ? '已为当前账号在本机保留，之后回来仍可查看。'
                  : '确认同行后可查看完整联系方式，公开页面会自动隐藏敏感信息。'}
              </Text>
            </View>

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>出行提醒</Text><Text>信息撮合</Text></View>
              <Text className='detail-safety'>请在出发前与同行人确认集合点、出行方式、费用分担和安全事项。平台仅提供校内同行信息交流服务，不提供运输、营运或保险担保。</Text>
            </View>

            <DetailComments
              targetType='carpool'
              targetId={item.id}
              enabled={item.review_status === 'approved'}
              refreshKey={commentRefreshKey}
              targetAuthorId={item.organizer_id}
              tone='carpool'
              actions={inlineActions}
              persistentContact={persistentContact}
            />
          </>
        )}
      </View>
    </View>
  )
}
