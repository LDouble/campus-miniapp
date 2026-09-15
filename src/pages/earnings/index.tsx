import { useMemo, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import { createWithdrawal, getMyWithdrawal, getMyWithdrawalSummary, listMySettlementPayables, listMyWithdrawals } from '../../api/payments'
import type { MerchantTransferView, SettlementPayableView, WithdrawalSceneSummary, WithdrawalSummary, WithdrawalView } from '../../api/types'
import { formatDateTime, formatMoney } from '../../features/life-services/format'
import './index.scss'

const sceneLabels: Record<WithdrawalView['scene_key'], string> = {
  commission: '跑腿服务报酬',
  purchase: '采购货款',
  secondhand_recycle: '二手回收货款',
}
const withdrawalStatusLabels: Record<WithdrawalView['status'], string> = {
  pending_review: '待审核', approved: '审核通过，待打款', processing: '打款中', awaiting_user_confirmation: '待确认收款', succeeded: '已到账', rejected: '已驳回', failed: '打款失败',
}
const payableStatusLabels: Record<SettlementPayableView['status'], string> = {
  available: '可提现', reserved: '已锁定，等待审核', transferring: '打款中', paid: '已到账', blocked: '暂缓结算',
}
type MerchantTransferAPI = { requestMerchantTransfer(options: { mchId: string; appId: string; package: string; success: () => void; fail: (error: unknown) => void }): void }

const confirmMerchantTransfer = async (transfer: MerchantTransferView) => {
  if (transfer.status !== 'awaiting_user_confirmation') return
  if (!transfer.merchant_id || !transfer.app_id || !transfer.confirmation_package) throw new Error('微信收款确认参数不完整')
  if (!Taro.canIUse('requestMerchantTransfer')) throw new Error('当前微信版本过低，请升级后确认收款')
  const nativeWechat = (globalThis as unknown as { wx: MerchantTransferAPI }).wx
  await new Promise<void>((resolve, reject) => nativeWechat.requestMerchantTransfer({ mchId: transfer.merchant_id || '', appId: transfer.app_id || '', package: transfer.confirmation_package || '', success: resolve, fail: reject }))
}

const loadAll = async <T,>(loadPage: (page: number) => Promise<{ items: T[]; total: number }>) => {
  const first = await loadPage(1)
  const items = [...first.items]
  for (let page = 2; items.length < first.total; page += 1) {
    const next = await loadPage(page)
    if (!next.items.length) break
    items.push(...next.items)
  }
  return items
}

export default function EarningsPage() {
  const [summary, setSummary] = useState<WithdrawalSummary | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalView[]>([])
  const [payables, setPayables] = useState<SettlementPayableView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingScene, setWorkingScene] = useState<WithdrawalView['scene_key'] | null>(null)
  const [confirmingId, setConfirmingId] = useState(0)

  const load = async () => {
    setError('')
    try {
      const [nextSummary, nextWithdrawals, nextPayables] = await Promise.all([
        getMyWithdrawalSummary(),
        loadAll((page) => listMyWithdrawals(undefined, page, 50)),
        loadAll((page) => listMySettlementPayables(undefined, page, 50)),
      ])
      setSummary(nextSummary)
      setWithdrawals(nextWithdrawals)
      setPayables(nextPayables)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '收益记录加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useDidShow(() => void load())
  usePullDownRefresh(() => void load())
  const scenes = useMemo(() => (summary?.scenes || []).filter((scene) => (
    scene.amount_cents > 0 && scene.payable_count > 0
  )), [summary])

  const applyForScene = async (scene: WithdrawalSceneSummary) => {
    if (workingScene || scene.amount_cents <= 0 || scene.payable_count <= 0) return
    const confirmation = await Taro.showModal({ title: '提交提现申请', content: `将 ${sceneLabels[scene.scene_key]}的 ${formatMoney(scene.amount_cents)}（${scene.payable_count} 笔）合并申请提现。提交后金额会锁定，等待管理员审核。`, confirmText: '提交申请', confirmColor: '#2b7aef' })
    if (!confirmation.confirm) return
    setWorkingScene(scene.scene_key)
    try {
      await createWithdrawal(scene.scene_key, scene.amount_cents, scene.payable_count)
      Taro.showToast({ title: '申请已提交，等待审核', icon: 'success' })
      await load()
    } catch (applyError) {
      if (isApiError(applyError) && applyError.statusCode === 409) {
        Taro.showToast({ title: '可提现金额已变化，请刷新后重新确认', icon: 'none' })
        await load()
      } else Taro.showToast({ title: isApiError(applyError) ? applyError.message : '提现申请提交失败', icon: 'none' })
    } finally { setWorkingScene(null) }
  }

  const confirmReceipt = async (withdrawal: WithdrawalView) => {
    if (confirmingId || withdrawal.status !== 'awaiting_user_confirmation') return
    setConfirmingId(withdrawal.id)
    try {
      const detail = await getMyWithdrawal(withdrawal.id)
      if (detail.status !== 'awaiting_user_confirmation' || !detail.transfer) throw new Error('收款状态已变化，请刷新后重试')
      await confirmMerchantTransfer(detail.transfer)
      Taro.showToast({ title: '已提交微信收款确认', icon: 'success' })
      await load()
    } catch (confirmError) {
      Taro.showToast({ title: isApiError(confirmError) ? confirmError.message : confirmError instanceof Error ? confirmError.message : '确认收款失败', icon: 'none' })
    } finally { setConfirmingId(0) }
  }

  return <View className='earnings-page'>
    <CustomNavbar title='我的收益' subtitle='跑腿与二手交易结算' showBack />
    <View className='earnings-page__content'>
      <View className='earnings-summary'>
        <Text className='earnings-summary__label'>可提现收益</Text>
        <Text className='earnings-summary__amount'>{formatMoney(summary?.available_amount_cents || 0)}</Text>
        <Text className='earnings-summary__hint'>按收益场景合并申请；审核中的金额会锁定，新收益可继续单独申请。</Text>
        <View className='earnings-summary__totals'><Text>审核中 {formatMoney(summary?.reserved_amount_cents || 0)}</Text><Text>已到账 {formatMoney(summary?.paid_amount_cents || 0)}</Text></View>
      </View>
      {loading && <View className='earnings-state'>正在加载收益记录</View>}
      {!loading && error && <View className='earnings-state earnings-state--error'><Text>{error}</Text><View onClick={() => void load()}>重新加载</View></View>}
      {!loading && !error && <>
        <View className='earnings-section-head'><Text>全部提现</Text><Text>按场景分别合并</Text></View>
        {scenes.length === 0 && <View className='earnings-state'><Text>暂无可提现收益</Text><Text>完成跑腿或二手交易后会显示在这里</Text></View>}
        {scenes.map((scene) => <View className='earnings-scene-card' key={scene.scene_key}><View><Text className='earnings-scene-card__title'>{sceneLabels[scene.scene_key]}</Text><Text className='earnings-scene-card__meta'>{scene.payable_count} 笔可合并</Text></View><Text className='earnings-scene-card__amount'>{formatMoney(scene.amount_cents)}</Text><View className='earnings-scene-card__action' onClick={() => void applyForScene(scene)}>{workingScene === scene.scene_key ? '提交中' : '全部提现'}</View></View>)}
        <View className='earnings-section-head'><Text>提现申请记录</Text><Text>{withdrawals.length} 笔</Text></View>
        {withdrawals.length === 0 && <View className='earnings-empty-inline'>提交提现申请后会显示审核和打款进度</View>}
        {withdrawals.map((withdrawal) => <View className='earnings-card' key={withdrawal.id}><View className='earnings-card__head'><Text>{sceneLabels[withdrawal.scene_key]}</Text><Text className={`earnings-status earnings-status--${withdrawal.status}`}>{withdrawalStatusLabels[withdrawal.status]}</Text></View><Text className='earnings-card__amount'>{formatMoney(withdrawal.amount_cents)}</Text><View className='earnings-card__meta'><Text>{withdrawal.payable_count} 笔收益 · {withdrawal.withdrawal_no}</Text><Text>{formatDateTime(withdrawal.created_at)}</Text></View>{withdrawal.status === 'rejected' && withdrawal.review_reason && <Text className='earnings-card__reason'>驳回原因：{withdrawal.review_reason}</Text>}{withdrawal.status === 'awaiting_user_confirmation' && <View className='earnings-card__action' onClick={() => void confirmReceipt(withdrawal)}>{confirmingId === withdrawal.id ? '正在确认' : '确认微信收款'}</View>}</View>)}
        <View className='earnings-section-head'><Text>收入明细</Text><Text>{payables.length} 笔</Text></View>
        {payables.map((payable) => <View className='earnings-income-row' key={payable.id}><View><Text>{sceneLabels[payable.scene_key]}</Text><Text>{payable.payable_no} · {formatDateTime(payable.available_at)}</Text></View><View><Text>{formatMoney(payable.amount_cents)}</Text><Text>{payableStatusLabels[payable.status]}</Text></View></View>)}
      </>}
    </View>
  </View>
}
