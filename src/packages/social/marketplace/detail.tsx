import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import StickerContent from '../../../components/sticker-content'
import type { MarketplaceListingView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import { getCurrentIdentity } from '../../../api/account'
import { lifeServicesRepository } from '../../../features/life-services/repository'
import { consumeBusinessDetailSnapshot } from '../../../features/life-services/business-detail-snapshot'
import { markLifeHubSectionDirty } from '../../../features/life-services/refresh-policy'
import { openAcademicVerification } from '../../../features/academic-verification/guard'
import { openContentReport } from '../../../features/content-report'
import { requestWechatSubscriptionForModule } from '../../../features/wechat-subscription'
import { useCampusShare } from '../../../features/share'
import { formatDateTime, formatMoney, formatStatus } from '../../../features/life-services/format'
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
import DetailAuthorNavbar from '../../../features/life-services/components/detail-author-navbar'
import DetailComments, {
  createBusinessContactComment,
} from '../../../features/life-services/components/detail-comments'
import DetailOverflowActions from '../../../features/life-services/components/detail-overflow-actions'
import {
  buildDetailFooterActions,
  splitDetailActions,
} from '../../../features/life-services/detail-actions'
import { campusLabel } from '../../../features/life-services/campus'
import { plainStickerContent } from '../../../features/stickers/content'
import '../../../features/life-services/detail.scss'
import './detail.scss'

const actionLabels: Record<string, string> = {
  edit: '编辑商品',
  submit_review: '提交审核',
  withdraw: '撤回商品',
  purchase: '我想要',
  respond: '我可以提供',
  verify_academic: '完成校园认证',
}

export default function MarketplaceDetailPage() {
  const [id, setId] = useState(0)
  const [item, setItem] = useState<MarketplaceListingView | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [commentRefreshKey, setCommentRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [persistedContact, setPersistedContact] = useState<ParticipationContact | null>(null)

  const applyItem = async (nextItem: MarketplaceListingView) => {
    setItem(nextItem)
    const contact = await restoreParticipationContact(Taro, getCurrentIdentity, {
      resourceType: 'marketplace',
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
      await applyItem(await lifeServicesRepository.getMarketplaceListing(targetId))
    } catch (loadError) {
      if (!silent) {
        setError(isApiError(loadError) ? loadError.message : '商品信息加载失败')
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
      setError('商品参数无效')
      return
    }
    const snapshot = options.snapshot === '1'
      ? consumeBusinessDetailSnapshot('marketplace', nextId)
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
      ? `${item.intent === 'wanted' ? '求购' : '闲置'}｜${plainStickerContent(item.description)}`
      : '校园二手｜海大校园',
    path: id ? '/packages/social/marketplace/detail' : '/pages/community/index',
    query: id ? { id } : { section: 'market' },
    imageUrl: item?.status === 'published' ? item.image_urls[0] : undefined,
  }))

  const runAction = async (action: string) => {
    if (!item || working) return
    if (action === 'submit_review') {
      requestWechatSubscriptionForModule('marketplace')
    }
    if (action === 'verify_academic') {
      await openAcademicVerification({ prompt: false })
      return
    }
    if (action === 'edit') {
      requestWechatSubscriptionForModule('marketplace')
      Taro.navigateTo({ url: `/packages/social/publish/index?section=market&mode=edit&id=${item.id}` })
      return
    }
    const confirm = await Taro.showModal({
      title: actionLabels[action] || '确认操作',
      content: action === 'purchase' || action === 'respond'
        ? item.intent === 'wanted'
          ? `确认响应这条求购吗？预算 ${formatMoney(item.price_cents)}，双方在线下沟通交易。`
          : `确认预订这件商品吗？售价 ${formatMoney(item.price_cents)}，交易在线下完成。`
        : action === 'withdraw'
          ? '撤回后其他同学将无法继续浏览或预订。'
          : '提交后商品会进入校园内容审核。',
      confirmColor: action === 'withdraw' ? '#bd6657' : '#df7773',
    })
    if (!confirm.confirm) return

    setWorking(true)
    let contactCommentStatus: 'none' | 'created' | 'failed' = 'none'
    let participationItem: MarketplaceListingView | null = null
    let participationContact: ParticipationContact | null = null
    try {
      if (action === 'purchase' || action === 'respond') {
        await lifeServicesRepository.respondMarketplaceListing(item.id)
        try {
          await createBusinessContactComment(
            'marketplace',
            item.id,
            item.intent === 'wanted'
              ? '我可以提供，方便联系确认一下具体需求吗？'
              : '我想要，方便联系确认一下交易细节吗？',
          )
          contactCommentStatus = 'created'
          setCommentRefreshKey((current) => current + 1)
        } catch (commentError) {
          contactCommentStatus = 'failed'
        }
        try {
          participationItem = await lifeServicesRepository.getMarketplaceListing(item.id)
          participationContact = await applyItem(participationItem)
        } catch {
          participationItem = item
          participationContact = visibleParticipationContact(
            item.contact_type,
            item.contact,
            persistedContact,
          )
        }
      } else if (action === 'submit_review') {
        await lifeServicesRepository.submitMarketplaceListing(item.id, item.version)
      } else if (action === 'withdraw') {
        await lifeServicesRepository.withdrawMarketplaceListing(item.id, item.version)
      }
      markLifeHubSectionDirty('market')
      if (participationItem) {
        await showParticipationContact(Taro, {
          successTitle: item.intent === 'wanted' ? '响应成功' : '预订成功',
          contactType: participationContact?.contactType || participationItem.contact_type,
          contact: participationContact?.contact || participationItem.contact,
          commentStatus: contactCommentStatus,
          confirmColor: '#df7773',
        })
      } else {
        await load()
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
      Taro.showToast({
        title: item?.intent === 'wanted' ? '响应后可查看完整联系方式' : '预订后可查看完整联系方式',
        icon: 'none',
      })
      return
    }
    Taro.setClipboardData({ data: displayedContact.contact })
  }

  const persistentContact = item
    && displayedContact
    && hasParticipationContactAccess('marketplace', item.viewer_relation, item.status)
      ? {
          label: `${item.intent === 'wanted' ? '求购者' : '卖家'} · ${contactTypeLabel(displayedContact.contactType)}`,
          value: displayedContact.contact,
          onCopy: copyContact,
        }
      : undefined

  const relationLabel = item?.viewer_relation === 'owner'
    ? '我发布的'
    : item?.viewer_relation === 'buyer'
      ? '我已预订'
      : item?.viewer_relation === 'seller'
        ? '我已响应'
        : item?.intent === 'wanted' ? '校内求购' : '校内在售'
  const coverTone = item ? Math.abs(item.id) % 4 : 0
  const footerActions = item ? buildDetailFooterActions({
    availableActions: item.available_actions,
    labels: actionLabels,
    priority: ['purchase', 'respond', 'submit_review', 'withdraw', 'edit', 'verify_academic'],
    dangerActions: ['withdraw'],
    busy: working,
    onAction: (action) => void runAction(action),
  }) : []
  const { inlineActions, overflowActions } = splitDetailActions(
    footerActions,
    ['edit', 'withdraw'],
  )

  return (
    <View className='life-detail life-detail--market'>
      <CustomNavbar
        title={item?.intent === 'wanted' ? '求购详情' : '闲置详情'}
        showBack
        barContent={item ? (
          <DetailAuthorNavbar
            avatarUrl={item.author_avatar_url}
            nickname={item.author_nickname}
            userId={item.owner_id}
          />
        ) : undefined}
      />
      <View className='life-detail__content'>
        {loading && <View className='detail-state'>正在加载商品信息</View>}
        {!loading && error && <View className='detail-state'><Text>{error}</Text><View onClick={() => void load()}>重新加载</View></View>}
        {!loading && item && (
          <>
            <View className='market-detail-hero'>
              <View className='market-detail-gallery'>
                {item.image_urls.length > 0 ? (
                  <Swiper
                    className='market-detail-gallery__swiper'
                    indicatorDots={item.image_urls.length > 1}
                    indicatorColor='rgba(255, 255, 255, 0.48)'
                    indicatorActiveColor='#ffffff'
                    circular={item.image_urls.length > 1}
                  >
                    {item.image_urls.map((url) => (
                      <SwiperItem key={url}>
                        <Image className='market-detail-gallery__image' src={url} mode='aspectFill' lazyLoad />
                      </SwiperItem>
                    ))}
                  </Swiper>
                ) : (
                  <View className={`market-detail-gallery__empty market-detail-gallery__empty--tone-${coverTone}`}>
                    <Text className='market-detail-gallery__quote'>“</Text>
                    <StickerContent
                      content={item.description}
                      className='market-detail-gallery__text'
                      stickerClassName='market-detail__sticker'
                    />
                  </View>
                )}
                {item.viewer_relation === 'owner' && item.status === 'pending_review' && (
                  <Text className='market-detail-gallery__reviewing'>图片审核中</Text>
                )}
              </View>
              <View className='market-detail-main'>
                <View className='market-detail-toolbar'>
                  <View className='market-detail-badges'>
                    <Text>{item.intent === 'wanted' ? '求购' : '二手'}</Text>
                    <Text>{campusLabel(item.campus)}</Text>
                    <Text>{formatStatus(item.status)}</Text>
                    <Text>{relationLabel}</Text>
                  </View>
                  <View className='detail-overview__toolbar-actions'>
                    {item.viewer_relation !== 'owner' && (
                      <View
                        className='detail-overview__report'
                        onClick={() => void openContentReport({
                          resourceType: 'marketplace_listing',
                          resourceId: item.id,
                          resourceVersion: item.version,
                        })}
                      >
                        举报
                      </View>
                    )}
                    <DetailOverflowActions actions={overflowActions} />
                  </View>
                </View>
                <StickerContent
                  content={item.description}
                  className='market-detail-title'
                  stickerClassName='market-detail__sticker'
                />
                <View className='market-detail-price'>
                  <Text>{item.intent === 'wanted' ? '预算 ' : ''}{formatMoney(item.price_cents)}</Text>
                  <View>
                    <Text>校内面交</Text>
                    <Text>见面验货后付款</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className='business-detail-meta'>
              <Text>{formatDateTime(item.created_at)}</Text>
              <Text>校内面交</Text>
            </View>

            {item.status === 'rejected' && (
              <View className='detail-review-alert'>
                <Text>审核未通过</Text>
                <Text>{item.rejection_reason || '请修改商品信息后重新提交审核。'}</Text>
              </View>
            )}

            {/*
            <View className='detail-section market-detail-section'>
              <View className='detail-section__heading'><Text>商品信息</Text><Text>{item.created_at}</Text></View>
              <View className='market-detail-facts'>
                <View><Text>发布状态</Text><Text>{formatStatus(item.status)}</Text></View>
                <View><Text>交易方式</Text><Text>校内面交</Text></View>
                <View><Text>商品图片</Text><Text>{item.image_urls.length > 0 ? `${item.image_urls.length} 张` : '文字商品卡'}</Text></View>
              </View>
            </View>
            */}

            <View className='detail-section detail-contact market-detail-contact' onClick={copyContact}>
              <View className='detail-section__heading'><Text>{item.intent === 'wanted' ? '联系求购者' : '联系卖家'}</Text><Text>校内身份</Text></View>
              <View className='market-detail-contact__main'>
                <View className='market-detail-contact__avatar'>{item.intent === 'wanted' ? '求' : '卖'}</View>
                <View className='market-detail-contact__value'>
                  <Text>{displayedContact ? contactTypeLabel(displayedContact.contactType) : '校内联系'}</Text>
                  <Text>{displayedContact?.contact || (item.intent === 'wanted' ? '响应后可见' : '预订后可见')}</Text>
                </View>
                <Text className='market-detail-contact__copy'>复制</Text>
              </View>
              <Text className='detail-contact__tip'>
                {displayedContact
                  ? '已为当前账号在本机保留，之后回来仍可查看。'
                  : `${item.intent === 'wanted' ? '响应后' : '预订后'}可查看完整联系方式，公开页面会自动隐藏敏感信息。`}
              </Text>
            </View>

            <View className='detail-section market-detail-section'>
              <View className='detail-section__heading'><Text>交易步骤</Text><Text>线下付款</Text></View>
              <View className='market-detail-steps'>
                <View><Text>1</Text><View><Text>{item.intent === 'wanted' ? '核对资料' : '核对实物'}</Text><Text>{item.intent === 'wanted' ? '确认课程、版本和资料范围' : '当面检查外观、配件和功能'}</Text></View></View>
                <View><Text>2</Text><View><Text>确认价格</Text><Text>交易前再次确认内容和金额</Text></View></View>
                <View><Text>3</Text><View><Text>完成交易</Text><Text>确认无误后再线下支付</Text></View></View>
              </View>
              <Text className='detail-safety'>平台仅提供信息撮合，不代收款，也不会索要验证码。</Text>
            </View>

            <DetailComments
              targetType='marketplace'
              targetId={item.id}
              enabled={item.status === 'published' || item.viewer_relation !== 'other'}
              refreshKey={commentRefreshKey}
              targetAuthorId={item.owner_id}
              tone='marketplace'
              actions={inlineActions}
              persistentContact={persistentContact}
            />
          </>
        )}
      </View>
    </View>
  )
}
