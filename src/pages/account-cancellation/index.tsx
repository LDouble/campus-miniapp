import { useRef, useState } from 'react'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  cancelCurrentAccount,
  getAccountCancellationPreflight,
  getCurrentIdentity,
} from '../../api/account'
import {
  isAccountCancelled,
  resumeAfterAccountCancellation,
  WECHAT_APP_ID,
} from '../../api/auth'
import { ApiError, createIdempotencyKey, isApiError } from '../../api/client'
import type { AccountCancellationPreflight } from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import { clearCancelledAccountLocalData } from '../../features/account-cancellation/local'
import { isQualificationEdition } from '../../features/app-edition'
import { featureMigratedUrl } from '../../features/app-edition/navigation'
import { openMiniProgramPrivacyContract } from '../../features/privacy/contract'
import './index.scss'

const icons = {
  arrow: require('../../assets/icons/arrow.svg'),
  identity: require('../../assets/icons/academic.svg'),
  market: require('../../assets/icons/market.svg'),
  errands: require('../../assets/icons/errands.svg'),
  carpool: require('../../assets/icons/shuttle.svg'),
}

type Attempt = {
  code: string
  idempotencyKey: string
}

type BlockerModule = AccountCancellationPreflight['blockers'][number]['module']

const blockerMeta: Record<BlockerModule, {
  label: string
  route: string
  icon: string
}> = {
  marketplace: {
    label: '未结束的二手发布',
    route: '/pages/my-services/index?section=published',
    icon: icons.market,
  },
  trade_order: {
    label: '进行中的交易订单',
    route: '/pages/my-services/index?section=orders&relation=all',
    icon: icons.market,
  },
  errand: {
    label: '进行中的跑腿任务',
    route: '/pages/my-services/index?section=errands&relation=all',
    icon: icons.errands,
  },
  carpool: {
    label: '进行中的拼车行程',
    route: '/pages/my-services/index?section=carpool&relation=all',
    icon: icons.carpool,
  },
}

const qualificationBlockerRoute = (module: BlockerModule) => featureMigratedUrl({
  module: module === 'trade_order' ? 'marketplace' : module,
})

const preflightFromError = (error: ApiError) => {
  const details = error.details
  if (!details || typeof details !== 'object') return null
  if (!('can_cancel' in details) || !('blockers' in details)) return null
  const value = details as AccountCancellationPreflight
  return Array.isArray(value.blockers) ? value : null
}

export default function AccountCancellationPage() {
  const [preflight, setPreflight] = useState<AccountCancellationPreflight | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(isAccountCancelled)
  const [userId, setUserId] = useState(0)
  const attemptRef = useRef<Attempt | null>(null)

  useLoad((options) => {
    if (options.success === '1' || isAccountCancelled()) setCompleted(true)
  })

  const loadPreflight = async () => {
    if (completed || loading) return
    setLoading(true)
    try {
      const [account, result] = await Promise.all([
        getCurrentIdentity(),
        getAccountCancellationPreflight(),
      ])
      setUserId(account.user_id)
      setPreflight(result)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '注销检查失败，请重试',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    void loadPreflight()
  })

  const openPrivacy = async () => {
    try {
      await openMiniProgramPrivacyContract()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '隐私保护指引暂不可用',
        icon: 'none',
      })
    }
  }

  const cancelAccount = async () => {
    if (submitting || loading || !preflight?.can_cancel) return
    const confirmation = await Taro.showModal({
      title: '确认注销当前账号？',
      content: '注销后将解绑微信与教务权限，清除姓名和本机账号数据；学号与历史内容会保留，公开身份显示为“已注销用户”。',
      confirmText: '确认注销',
      confirmColor: '#d87567',
      cancelText: '再想想',
    })
    if (!confirmation.confirm) return

    setSubmitting(true)
    try {
      if (!attemptRef.current) {
        const loginResult = await Taro.login()
        if (!loginResult.code) throw new Error('微信身份确认失败，请重试')
        attemptRef.current = {
          code: loginResult.code,
          idempotencyKey: createIdempotencyKey('account-cancellation'),
        }
      }
      const attempt = attemptRef.current
      await cancelCurrentAccount({
        appId: WECHAT_APP_ID,
        code: attempt.code,
        idempotencyKey: attempt.idempotencyKey,
      })
      await clearCancelledAccountLocalData(userId)
      attemptRef.current = null
      setCompleted(true)
      await Taro.reLaunch({ url: '/pages/account-cancellation/index?success=1' })
    } catch (error) {
      if (isApiError(error)) {
        const latest = preflightFromError(error)
        if (latest) setPreflight(latest)
        attemptRef.current = null
      }
      Taro.showToast({
        title: error instanceof Error
          ? error.message
          : '网络中断，再次点击可安全重试',
        icon: 'none',
        duration: 2600,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resume = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await resumeAfterAccountCancellation()
      await Taro.reLaunch({ url: '/pages/index/index' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '重新注册失败，请稍后重试',
        icon: 'none',
      })
      setSubmitting(false)
    }
  }

  if (completed) {
    return <View className='cancellation-page'>
      <CustomNavbar title='账号已注销' subtitle='你的旧账号已停止使用' />
      <View className='cancellation-page__content'>
        <View className='cancellation-success motion-enter'>
          <View className='cancellation-success__mark'><Text>完成</Text></View>
          <Text className='cancellation-success__title'>注销已完成</Text>
          <Text className='cancellation-success__copy'>
            微信身份和教务权限已解绑，旧账号内容会以“已注销用户”继续保留。
          </Text>
          <View
            className={`cancellation-button cancellation-button--primary ${submitting ? 'cancellation-button--disabled' : ''}`}
            hoverClass='cancellation-button--pressed'
            ariaRole='button'
            ariaLabel='重新注册并继续使用'
            onClick={() => void resume()}
          >
            <Text>{submitting ? '正在重新注册' : '重新注册并继续使用'}</Text>
          </View>
          <Text className='cancellation-success__hint'>新账号不会关联旧账号的历史内容</Text>
        </View>
      </View>
    </View>
  }

  const blockers = preflight?.blockers || []
  return <View className='cancellation-page'>
    <View className='cancellation-page__orb' />
    <CustomNavbar title='注销账号' subtitle='注销前请确认影响' />
    <View className='cancellation-page__content'>
      <View className='cancellation-intro motion-enter'>
        <View className='cancellation-intro__icon'>
          <Image src={icons.identity} mode='aspectFit' />
        </View>
        <View className='cancellation-intro__main'>
          <Text>账号对外匿名化并解绑教务</Text>
          <Text>这不是删除全部历史记录</Text>
        </View>
      </View>

      <View className='cancellation-section motion-enter motion-enter--delay-1'>
        <Text className='cancellation-section__title'>注销后会发生什么</Text>
        <View className='cancellation-impact'>
          {[
            ['微信与登录', '解绑当前微信，所有旧登录状态立即失效'],
            ['教务身份', '撤销教务权限并清除姓名，学号仍保留'],
            ['历史内容', '帖子、资料和已完成交易继续保留'],
            ['公开身份', '统一显示“已注销用户”，不再关联旧账号'],
          ].map(([title, copy]) => (
            <View className='cancellation-impact__item' key={title}>
              <View className='cancellation-impact__dot' />
              <View><Text>{title}</Text><Text>{copy}</Text></View>
            </View>
          ))}
        </View>
      </View>

      <View className='cancellation-section motion-enter motion-enter--delay-2'>
        <View className='cancellation-section__head'>
          <View>
            <Text className='cancellation-section__title'>注销前检查</Text>
            <Text className='cancellation-section__hint'>进行中的服务需要先处理完</Text>
          </View>
          <View
            className='cancellation-section__refresh'
            hoverClass='cancellation-section__refresh--pressed'
            onClick={() => void loadPreflight()}
          >
            <Text>{loading ? '检查中' : '重新检查'}</Text>
          </View>
        </View>
        {loading && !preflight ? (
          <View className='cancellation-status'><Text>正在检查账号状态…</Text></View>
        ) : blockers.length ? (
          <View className='cancellation-blockers'>
            {blockers.map((blocker) => {
              const meta = blockerMeta[blocker.module]
              return <View className='cancellation-blocker' key={blocker.module}>
                <View className='cancellation-blocker__icon'>
                  <Image src={meta.icon} mode='aspectFit' />
                </View>
                <View className='cancellation-blocker__main'>
                  <Text>{meta.label}</Text>
                  <Text>{blocker.count} 项需要处理</Text>
                </View>
                <View
                  className='cancellation-blocker__action'
                  hoverClass='cancellation-blocker__action--pressed'
                  onClick={() => Taro.navigateTo({
                    url: isQualificationEdition
                      ? qualificationBlockerRoute(blocker.module)
                      : meta.route,
                  })}
                >
                  <Text>去处理</Text><Image src={icons.arrow} mode='aspectFit' />
                </View>
              </View>
            })}
          </View>
        ) : (
          <View className='cancellation-status cancellation-status--ready'>
            <View /><Text>当前没有未完成业务，可以继续注销</Text>
          </View>
        )}
      </View>

      <View className='cancellation-privacy motion-enter motion-enter--delay-3'>
        <Text>注销前可再次查看</Text>
        <View onClick={() => void openPrivacy()}><Text>小程序用户隐私保护指引</Text></View>
      </View>

      <View
        className={[
          'cancellation-button',
          'cancellation-button--danger',
          (!preflight?.can_cancel || submitting || loading) ? 'cancellation-button--disabled' : '',
        ].filter(Boolean).join(' ')}
        hoverClass='cancellation-button--pressed'
        ariaRole='button'
        ariaLabel='确认注销当前账号'
        onClick={() => void cancelAccount()}
      >
        <Text>{submitting ? '正在注销' : blockers.length ? '请先处理未完成业务' : '确认注销当前账号'}</Text>
      </View>
      <Text className='cancellation-page__footnote'>注销完成后不可恢复旧账号关联</Text>
    </View>
  </View>
}
