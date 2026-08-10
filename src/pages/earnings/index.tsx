import { useMemo, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import { listMySettlementPayables, transferSettlementPayable } from '../../api/payments'
import type { MerchantTransferView, SettlementPayableView } from '../../api/types'
import { formatDateTime, formatMoney } from '../../features/life-services/format'
import './index.scss'

const statusLabels: Record<SettlementPayableView['status'], string> = {
  available: '可打款',
  transferring: '打款中',
  paid: '已到账',
  blocked: '暂缓结算',
}

type MerchantTransferAPI = {
  requestMerchantTransfer(options: {
    mchId: string
    appId: string
    package: string
    success: () => void
    fail: (error: unknown) => void
  }): void
}

const confirmMerchantTransfer = async (transfer: MerchantTransferView) => {
  if (transfer.status !== 'awaiting_user_confirmation') return
  if (!transfer.merchant_id || !transfer.app_id || !transfer.confirmation_package) {
    throw new Error('微信收款确认参数不完整')
  }
  if (!Taro.canIUse('requestMerchantTransfer')) {
    throw new Error('当前微信版本过低，请升级后确认收款')
  }
  const nativeWechat = (globalThis as unknown as { wx: MerchantTransferAPI }).wx
  await new Promise<void>((resolve, reject) => {
    nativeWechat.requestMerchantTransfer({
      mchId: transfer.merchant_id || '',
      appId: transfer.app_id || '',
      package: transfer.confirmation_package || '',
      success: resolve,
      fail: reject,
    })
  })
}

export default function EarningsPage() {
  const [items, setItems] = useState<SettlementPayableView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState(0)

  const load = async () => {
    setError('')
    try {
      const page = await listMySettlementPayables(undefined, 1, 100)
      setItems(page.items)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '收益记录加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useDidShow(() => void load())
  usePullDownRefresh(() => void load())

  const availableTotal = useMemo(() => items
    .filter((item) => item.status === 'available')
    .reduce((total, item) => total + item.amount_cents, 0), [items])

  const transfer = async (item: SettlementPayableView) => {
    if (workingId) return
    const confirmation = await Taro.showModal({
      title: item.status === 'transferring' ? '继续确认收款' : '确认微信收款',
      content: item.status === 'transferring'
        ? '这笔打款仍待微信确认，是否继续？'
        : `平台将打款 ${formatMoney(item.amount_cents)} 到当前微信账户。`,
      confirmText: '确认收款',
      confirmColor: '#3f8f83',
    })
    if (!confirmation.confirm) return
    setWorkingId(item.id)
    try {
      const result = await transferSettlementPayable(item.id, item.version)
      await confirmMerchantTransfer(result)
      Taro.showToast({ title: '打款已发起', icon: 'success' })
      await load()
    } catch (transferError) {
      Taro.showToast({
        title: isApiError(transferError)
          ? transferError.message
          : transferError instanceof Error ? transferError.message : '打款发起失败',
        icon: 'none',
      })
    } finally {
      setWorkingId(0)
    }
  }

  return (
    <View className='earnings-page'>
      <View className='earnings-page__orb' />
      <CustomNavbar title='我的收益' subtitle='跑腿与二手交易结算' showBack />
      <View className='earnings-page__content'>
        <View className='earnings-summary'>
          <Text>可打款收益</Text>
          <Text>{formatMoney(availableTotal)}</Text>
          <Text>交易完成后形成平台应付款，不是储值余额</Text>
        </View>
        <View className='earnings-note'>
          <Text>结算说明</Text>
          <Text>买方确认履约后开放打款。微信可能要求再次确认收款，最终状态以微信到账结果为准。</Text>
        </View>
        {loading && <View className='earnings-state'>正在加载收益记录</View>}
        {!loading && error && (
          <View className='earnings-state earnings-state--error'>
            <Text>{error}</Text>
            <View onClick={() => void load()}>重新加载</View>
          </View>
        )}
        {!loading && !error && items.length === 0 && (
          <View className='earnings-state'>
            <Text>暂无可结算记录</Text>
            <Text>完成跑腿或二手交易后会显示在这里</Text>
          </View>
        )}
        {!loading && !error && items.map((item) => (
          <View className='earnings-card' key={item.id}>
            <View className='earnings-card__head'>
              <Text>{item.source_type === 'errand' ? '跑腿服务报酬' : '二手交易货款'}</Text>
              <Text>{statusLabels[item.status]}</Text>
            </View>
            <Text className='earnings-card__amount'>{formatMoney(item.amount_cents)}</Text>
            <View className='earnings-card__meta'>
              <Text>{item.payable_no}</Text>
              <Text>{formatDateTime(item.available_at)}</Text>
            </View>
            {(item.status === 'available' || item.status === 'transferring') && (
              <View className='earnings-card__action' onClick={() => void transfer(item)}>
                {workingId === item.id
                  ? '正在发起'
                  : item.status === 'transferring' ? '继续确认' : '微信收款'}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
