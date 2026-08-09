import { useMemo, useRef, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import type {
  DailyCheckinHistory,
  DailyCheckinStatus,
} from '../../api/types'
import {
  createDailyCheckin,
  getMyDailyCheckinStatus,
  listMyDailyCheckinHistory,
} from '../../api/daily-checkins'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import {
  buildDailyCheckinCalendar,
  checkinMonthLabel,
  checkinMonthRange,
  isCheckinMonthAvailable,
  monthFromServerDate,
  shiftCheckinMonth,
} from '../../features/daily-checkin/calendar'
import './index.scss'

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const checkinErrorMessage = (error: unknown) => {
  if (!isApiError(error)) return '网络暂不可用，请稍后重试'
  if (error.code === 'checkin_disabled') return '每日签到暂未开放'
  if (error.code === 'academic_verification_required') return '完成校园身份认证后即可签到'
  return error.message
}

export default function DailyCheckinPage() {
  const [status, setStatus] = useState<DailyCheckinStatus | null>(null)
  const [history, setHistory] = useState<DailyCheckinHistory | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const loadRequest = useRef(0)
  const historyRequest = useRef(0)

  const loadHistory = async (month: string) => {
    if (!month) return
    const request = historyRequest.current + 1
    historyRequest.current = request
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const nextHistory = await listMyDailyCheckinHistory(month)
      if (historyRequest.current !== request) return
      setHistory(nextHistory)
    } catch (loadError) {
      if (historyRequest.current !== request) return
      setHistoryError(checkinErrorMessage(loadError))
    } finally {
      if (historyRequest.current === request) setHistoryLoading(false)
    }
  }

  const load = async (preferredMonth = selectedMonth) => {
    const request = loadRequest.current + 1
    loadRequest.current = request
    setLoading(true)
    setError('')
    try {
      const nextStatus = await getMyDailyCheckinStatus()
      if (loadRequest.current !== request) return
      setStatus(nextStatus)
      const serverMonth = monthFromServerDate(nextStatus.server_date)
      const targetMonth = isCheckinMonthAvailable(preferredMonth, nextStatus.server_date)
        ? preferredMonth
        : serverMonth
      setSelectedMonth(targetMonth)
      await loadHistory(targetMonth)
    } catch (loadError) {
      if (loadRequest.current !== request) return
      setError(checkinErrorMessage(loadError))
    } finally {
      if (loadRequest.current === request) {
        setLoading(false)
        Taro.stopPullDownRefresh()
      }
    }
  }

  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })

  const cells = useMemo(() => buildDailyCheckinCalendar(
    selectedMonth,
    history?.month === selectedMonth ? history.items : [],
    status?.server_date || '',
  ), [history, selectedMonth, status?.server_date])
  const range = checkinMonthRange(status?.server_date || '')
  const canGoPrevious = !!selectedMonth && selectedMonth > range.earliest
  const canGoNext = !!selectedMonth && selectedMonth < range.latest

  const changeMonth = (offset: number) => {
    const nextMonth = shiftCheckinMonth(selectedMonth, offset)
    if (!status || !isCheckinMonthAvailable(nextMonth, status.server_date)) return
    loadRequest.current += 1
    setLoading(false)
    Taro.stopPullDownRefresh()
    setSelectedMonth(nextMonth)
    void loadHistory(nextMonth)
  }

  const submit = async () => {
    if (!status || submitting || status.checked_in || !status.enabled) return
    setSubmitting(true)
    try {
      const result = await createDailyCheckin()
      const resultMonth = result.checked_in_date.slice(0, 7)
      setStatus((current) => current ? {
        ...current,
        server_date: result.checked_in_date,
        checked_in: true,
        checked_in_at: result.checked_in_at,
        consecutive_days: result.consecutive_days,
        today_reward: result.reward,
        user_level: result.user_level,
      } : current)
      if (selectedMonth === resultMonth) {
        setHistory((current) => {
          if (!current || current.items.some((item) => item.date === result.checked_in_date)) {
            return current
          }
          const items = [...current.items, {
            date: result.checked_in_date,
            checked_in_at: result.checked_in_at,
            reward: result.reward,
          }].sort((left, right) => left.date.localeCompare(right.date))
          return { ...current, items, total: items.length }
        })
      }
      Taro.showToast({
        title: result.already_checked_in ? '今日已签到' : `签到成功 +${result.reward}经验`,
        icon: 'none',
      })
      await load(resultMonth)
    } catch (submitError) {
      Taro.showToast({ title: checkinErrorMessage(submitError), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const buttonText = !status?.enabled
    ? '签到暂未开放'
    : status.checked_in
      ? `今日已签到 · +${status.today_reward}`
      : submitting
        ? '签到中…'
        : `签到领取 ${status.today_reward} 经验`

  return (
    <View className='daily-checkin-page'>
      <CustomNavbar title='每日签到' subtitle='积累每一天的校园成长' showBack />
      <View className='daily-checkin-page__content'>
        {loading && !status && <View className='daily-checkin-state'>正在同步签到状态…</View>}
        {!loading && error && !status && (
          <View className='daily-checkin-state daily-checkin-state--error' onClick={() => void load()}>
            <Text>{error}</Text>
            <Text>点击重试</Text>
          </View>
        )}
        {status && (
          <>
            <View className='daily-checkin-hero'>
              <Text className='daily-checkin-hero__date'>{status.server_date}</Text>
              <Text className='daily-checkin-hero__timezone'>北京时间（Asia/Shanghai）为准</Text>
              <View className='daily-checkin-hero__summary'>
                <View>
                  <Text>{status.consecutive_days}</Text>
                  <Text>连续签到 / 天</Text>
                </View>
                <View>
                  <Text>{status.today_reward}</Text>
                  <Text>今日奖励 / 经验</Text>
                </View>
                <View>
                  <Text>{status.user_level.experience}</Text>
                  <Text>当前经验</Text>
                </View>
              </View>
              <Button
                className={`daily-checkin-button${status.checked_in ? ' daily-checkin-button--done' : ''}`}
                disabled={submitting || status.checked_in || !status.enabled}
                loading={submitting}
                onClick={() => void submit()}
              >
                {buttonText}
              </Button>
              {status.enabled && (
                <Text className='daily-checkin-hero__hint'>
                  {status.checked_in
                    ? `保持连续签到，下一次预计可得 ${status.next_reward} 经验`
                    : '连续签到奖励按当前策略递增，漏签后重新从第 1 天计算'}
                </Text>
              )}
            </View>

            <View className='daily-checkin-calendar'>
              <View className='daily-checkin-calendar__header'>
                <View
                  className={canGoPrevious ? '' : 'is-disabled'}
                  ariaRole='button'
                  ariaLabel='查看上个月签到记录'
                  onClick={() => changeMonth(-1)}
                >‹</View>
                <View>
                  <Text>{checkinMonthLabel(selectedMonth)}</Text>
                  <Text>{history?.month === selectedMonth ? `${history.total} 天已签到` : '月度签到记录'}</Text>
                </View>
                <View
                  className={canGoNext ? '' : 'is-disabled'}
                  ariaRole='button'
                  ariaLabel='查看下个月签到记录'
                  onClick={() => changeMonth(1)}
                >›</View>
              </View>
              <View className='daily-checkin-calendar__weekdays'>
                {weekdays.map((weekday) => <Text key={weekday}>{weekday}</Text>)}
              </View>
              {historyLoading && <View className='daily-checkin-calendar__state'>正在加载月度记录…</View>}
              {!historyLoading && historyError && (
                <View className='daily-checkin-calendar__state' onClick={() => void loadHistory(selectedMonth)}>
                  <Text>{historyError}</Text>
                  <Text>点击重试</Text>
                </View>
              )}
              {!historyLoading && !historyError && (
                <View className='daily-checkin-calendar__grid'>
                  {cells.map((cell) => (
                    <View
                      key={cell.key}
                      className={[
                        'daily-checkin-calendar__day',
                        cell.checkedIn ? 'is-checked' : '',
                        cell.isServerDate ? 'is-today' : '',
                        cell.isFuture ? 'is-future' : '',
                        !cell.date ? 'is-placeholder' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {cell.day && <Text>{cell.day}</Text>}
                      {cell.checkedIn && <Text>+{cell.reward}</Text>}
                    </View>
                  ))}
                </View>
              )}
              <Text className='daily-checkin-calendar__footnote'>可查看本月及过去 12 个月；不支持补签</Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
