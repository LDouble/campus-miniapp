import { useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import type { MarketplaceListingView } from '../../api/types'
import { isApiError } from '../../api/client'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { openAcademicVerification } from '../../features/academic-verification/guard'
import { formatDateTime, formatMoney, formatStatus } from '../../features/life-services/format'
import '../../features/life-services/detail.scss'

const actionLabels: Record<string, string> = {
  edit: '编辑商品',
  submit_review: '提交审核',
  withdraw: '撤回商品',
  purchase: '我想要',
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
      content: action === 'purchase'
        ? `确认预订这件商品吗？售价 ${formatMoney(item.price_cents)}，交易在线下完成。`
        : action === 'withdraw'
          ? '撤回后其他同学将无法继续浏览或预订。'
          : '提交后商品会进入校园内容审核。',
      confirmColor: action === 'withdraw' ? '#bd6657' : '#df7773',
    })
    if (!confirm.confirm) return

    setWorking(true)
    try {
      if (action === 'purchase') {
        await lifeServicesRepository.reserveMarketplaceListing(item.id)
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
      Taro.showToast({ title: '预订后可查看完整联系方式', icon: 'none' })
      return
    }
    Taro.setClipboardData({ data: item.contact })
  }

  return (
    <View className='life-detail life-detail--market'>
      <CustomNavbar title='闲置详情' subtitle='校内见面交易' showBack />
      <View className='life-detail__content'>
        {loading && <View className='detail-state'>正在加载商品信息</View>}
        {!loading && error && <View className='detail-state'><Text>{error}</Text><View onClick={() => void load()}>重新加载</View></View>}
        {!loading && item && (
          <>
            <View className='detail-overview detail-overview--market'>
              <View className='market-gallery'>
                {item.image_urls.length
                  ? item.image_urls.map((url) => <Image key={url} src={url} mode='aspectFill' lazyLoad />)
                  : <View className='market-gallery__empty'><Text>OUC</Text><Text>校内闲置</Text></View>}
              </View>
              <View className='detail-overview__meta'>
                <Text>{formatStatus(item.status)}</Text>
                <Text>{item.viewer_relation === 'owner' ? '我发布的' : item.viewer_relation === 'buyer' ? '我已预订' : '校内在售'}</Text>
              </View>
              <View className='detail-overview__summary detail-overview__summary--primary'>
                <View><Text>商品售价</Text><Text>线下面交</Text></View>
                <Text>{formatMoney(item.price_cents)}</Text>
              </View>
              <Text className='detail-overview__description'>{item.description}</Text>
            </View>

            {item.status === 'rejected' && (
              <View className='detail-review-alert'>
                <Text>审核未通过</Text>
                <Text>{item.rejection_reason || '请修改商品信息后重新提交审核。'}</Text>
              </View>
            )}

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>商品信息</Text><Text>真实描述</Text></View>
              <View className='detail-facts'>
                <View className='detail-fact'><Text>发布状态</Text><Text>{formatStatus(item.status)}</Text></View>
                <View className='detail-fact'><Text>交易方式</Text><Text>校内面交</Text></View>
                <View className='detail-fact'><Text>发布时间</Text><Text>{formatDateTime(item.created_at)}</Text></View>
                <View className='detail-fact'><Text>图片数量</Text><Text>{item.image_urls.length} 张</Text></View>
              </View>
            </View>

            <View className='detail-section detail-contact' onClick={copyContact}>
              <View className='detail-section__heading'><Text>联系卖家</Text><Text>点击复制</Text></View>
              <View className='detail-contact__row'>
                <Text>{item.contact_type || '校内联系'}</Text>
                <Text>{item.contact || '预订后可见'}</Text>
              </View>
              <Text className='detail-contact__tip'>联系方式由服务端按买卖关系授权，不会出现在公开列表和分享卡中。</Text>
            </View>

            <View className='detail-section'>
              <View className='detail-section__heading'><Text>交易提醒</Text><Text>线下付款</Text></View>
              <Text className='detail-safety'>见面后先核对实物与功能，再决定是否付款。平台只提供信息撮合，不代收款，也不会要求提供验证码。</Text>
            </View>

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
