import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import type { MarketplaceListingView } from '../../api/types'
import { isApiError } from '../../api/client'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { openAcademicVerification } from '../../features/academic-verification/guard'
import { openContentReport } from '../../features/content-report'
import { formatMoney, formatStatus } from '../../features/life-services/format'
import '../../features/life-services/detail.scss'
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
  const [error, setError] = useState('')

  const load = async (targetId = id) => {
    if (!targetId) return
    setLoading(true)
    setError('')
    try {
      setItem(await lifeServicesRepository.getMarketplaceListing(targetId))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '商品信息加载失败')
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
      setError('商品参数无效')
    }
  })
  usePullDownRefresh(() => void load())

  const runAction = async (action: string) => {
    if (!item || working) return
    if (action === 'verify_academic') {
      await openAcademicVerification({ prompt: false })
      return
    }
    if (action === 'edit') {
      Taro.navigateTo({ url: `/pages/publish/index?section=market&mode=edit&id=${item.id}` })
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
    try {
      if (action === 'purchase' || action === 'respond') {
        await lifeServicesRepository.respondMarketplaceListing(item.id)
      } else if (action === 'submit_review') {
        await lifeServicesRepository.submitMarketplaceListing(item.id, item.version)
      } else if (action === 'withdraw') {
        await lifeServicesRepository.withdrawMarketplaceListing(item.id, item.version)
      }
      await load()
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
      Taro.showToast({
        title: item?.intent === 'wanted' ? '响应后可查看完整联系方式' : '预订后可查看完整联系方式',
        icon: 'none',
      })
      return
    }
    Taro.setClipboardData({ data: item.contact })
  }

  const relationLabel = item?.viewer_relation === 'owner'
    ? '我发布的'
    : item?.viewer_relation === 'buyer'
      ? '我已预订'
      : item?.viewer_relation === 'seller'
        ? '我已响应'
        : item?.intent === 'wanted' ? '校内求购' : '校内在售'
  const coverTone = item ? Math.abs(item.id) % 4 : 0

  return (
    <View className='life-detail life-detail--market'>
      <CustomNavbar title={item?.intent === 'wanted' ? '求购详情' : '闲置详情'} subtitle='校内见面交易' showBack />
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
                    <Text className='market-detail-gallery__text'>{item.description}</Text>
                  </View>
                )}
              </View>
              <View className='market-detail-main'>
                <View className='market-detail-badges'>
                  <Text>{item.intent === 'wanted' ? '求购' : '出售'}</Text>
                  <Text>{formatStatus(item.status)}</Text>
                  <Text>{relationLabel}</Text>
                </View>
                <View className='market-detail-price'>
                  <Text>{item.intent === 'wanted' ? '预算 ' : ''}{formatMoney(item.price_cents)}</Text>
                  <View>
                    <Text>校内面交</Text>
                    <Text>见面验货后付款</Text>
                  </View>
                </View>
                {item.image_urls.length > 0 && (
                  <View className='market-detail-description'>
                    <Text>{item.description}</Text>
                  </View>
                )}
              </View>
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
                  <Text>{item.contact_type || '校内联系'}</Text>
                  <Text>{item.contact || (item.intent === 'wanted' ? '响应后可见' : '预订后可见')}</Text>
                </View>
                <Text className='market-detail-contact__copy'>复制</Text>
              </View>
              <Text className='detail-contact__tip'>{item.intent === 'wanted' ? '响应后' : '预订后'}可查看完整联系方式，公开页面会自动隐藏敏感信息。</Text>
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

            {item.viewer_relation !== 'owner' && (
              <View
                className='detail-report-link'
                hoverClass='detail-report-link--pressed'
                onClick={() => void openContentReport({
                  resourceType: 'marketplace_listing',
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
                    className={`detail-action ${index === item.available_actions.length - 1 && action !== 'withdraw' ? 'detail-action--primary' : ''} ${action === 'withdraw' ? 'detail-action--danger' : ''}`}
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
