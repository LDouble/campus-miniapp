import { useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type {
  DailyCheckinStatus,
  UserExperienceLedgerView,
  UserLevelSummary,
  UserLevelTask,
} from '../../api/types'
import {
  getMyUserLevel,
  listMyUserExperienceLedger,
  listMyUserLevelTasks,
} from '../../api/user-levels'
import { isApiError } from '../../api/client'
import { getMyDailyCheckinStatus } from '../../api/daily-checkins'
import CustomNavbar from '../../components/custom-navbar'
import { formatDateTime } from '../../features/life-services/format'
import './index.scss'

const sourceLabels: Record<string, string> = {
  academic_verified: '完成学籍认证',
  admin_adjustment: '管理员调整',
  comment_approved: '评论审核通过',
  like_received: '帖子收到有效点赞',
  newcomer_comment_approved: '新手任务：初次回应',
  newcomer_post_approved: '新手任务：初次发声',
  post_approved: '帖子审核通过',
  daily_checkin: '每日签到',
}

export default function UserLevelPage() {
  const [level, setLevel] = useState<UserLevelSummary | null>(null)
  const [ledger, setLedger] = useState<UserExperienceLedgerView[]>([])
  const [tasks, setTasks] = useState<UserLevelTask[]>([])
  const [checkinStatus, setCheckinStatus] = useState<DailyCheckinStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [levelResult, ledgerResult, taskResult, checkinResult] = await Promise.all([
        getMyUserLevel(),
        listMyUserExperienceLedger(1, 50),
        listMyUserLevelTasks().catch(() => ({ items: [] })),
        getMyDailyCheckinStatus().catch(() => null),
      ])
      setLevel(levelResult)
      setLedger(ledgerResult.items)
      setTasks(taskResult.items)
      setCheckinStatus(checkinResult)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '等级信息加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })

  return (
    <View className='user-level-page'>
      <CustomNavbar title='社区等级' showBack />
      <View className='user-level-page__content'>
        {loading && <View className='user-level-state'>正在汇总社区贡献</View>}
        {!loading && error && (
          <View className='user-level-state user-level-state--error' onClick={() => void load()}>
            <Text>{error}</Text>
            <Text>点击重试</Text>
          </View>
        )}
        {!loading && !error && level && (
          <>
            <View className={`user-level-hero user-level-hero--${level.theme}`}>
              <View className='user-level-hero__eyebrow'>海大社区贡献等级</View>
              <View className='user-level-hero__title'>
                <Text>Lv.{level.level}</Text>
                <Text>{level.name}</Text>
              </View>
              <Text className='user-level-hero__description'>{level.description}</Text>
              <View className='user-level-hero__numbers'>
                <Text>{level.experience} 经验</Text>
                <Text>
                  {level.is_max_level
                    ? '已达最高等级'
                    : `下一等级 ${level.next_threshold} 经验`}
                </Text>
              </View>
              <View className='user-level-hero__track'>
                <View style={{ width: `${Math.max(0, Math.min(100, level.progress_percent))}%` }} />
              </View>
              <Text className='user-level-hero__message'>{level.upgrade_message}</Text>
            </View>

            <View
              className='user-level-checkin'
              ariaRole='button'
              ariaLabel={checkinStatus?.checked_in ? '今日已签到，查看签到日历' : '前往每日签到'}
              onClick={() => Taro.navigateTo({ url: '/pages/daily-checkin/index' })}
            >
              <View className='user-level-checkin__content'>
                <Text>每日签到</Text>
                <Text>
                  {checkinStatus
                    ? `连续 ${checkinStatus.consecutive_days} 天 · ${checkinStatus.checked_in
                      ? `今日已获得 ${checkinStatus.today_reward} 经验`
                      : checkinStatus.enabled
                        ? `今日可得 ${checkinStatus.today_reward} 经验`
                        : '签到暂未开放'}`
                    : '每天签到一次，连续签到奖励逐步增加'}
                </Text>
              </View>
              <View className={checkinStatus?.checked_in ? 'user-level-checkin__action is-done' : 'user-level-checkin__action'}>
                {checkinStatus?.checked_in ? '已签到' : checkinStatus?.enabled === false ? '查看' : '去签到'}
              </View>
            </View>

            <View className='user-level-tasks'>
              <Text className='user-level-section-title'>新手任务</Text>
              {tasks.map((task) => (
                <View
                  key={task.key}
                  className={task.status === 'completed'
                    ? 'user-level-task user-level-task--completed'
                    : 'user-level-task'}
                >
                  <View className='user-level-task__content'>
                    <Text className='user-level-task__title'>{task.title}</Text>
                    <Text className='user-level-task__description'>{task.description}</Text>
                  </View>
                  <View className='user-level-task__progress'>
                    <Text className='user-level-task__reward'>+{task.reward}</Text>
                    <Text className='user-level-task__status'>
                      {task.status === 'completed' ? '已完成' : '待完成'}
                    </Text>
                  </View>
                </View>
              ))}
              {tasks.length === 0 && <View className='user-level-ledger__empty'>完成首次发帖或评论审核后，这里会展示任务进度</View>}
            </View>

            <View className='user-level-rules'>
              <Text className='user-level-section-title'>如何获得经验</Text>
              <View><Text>每日</Text><Text>每日签到</Text><Text>连续签到递增，有上限</Text></View>
              <View><Text>+20</Text><Text>首次完成学籍认证</Text><Text>仅一次</Text></View>
              <View><Text>+10</Text><Text>帖子审核通过</Text><Text>每日最多 3 次</Text></View>
              <View><Text>+3</Text><Text>评论或回复审核通过</Text><Text>每日最多 10 次</Text></View>
              <View><Text>+1</Text><Text>帖子收到有效点赞</Text><Text>每日最多 20 次</Text></View>
              <Text className='user-level-rules__hint'>签到以北京时间（Asia/Shanghai）自然日为准，不支持补签。撤销审核或取消点赞时会自动扣回对应经验。等级仅展示社区贡献，不代表身份、权限或信用。</Text>
            </View>

            <View className='user-level-ledger'>
              <Text className='user-level-section-title'>最近经验记录</Text>
              {ledger.map((item) => (
                <View key={item.id} className='user-level-ledger__item'>
                  <View>
                    <Text>{sourceLabels[item.source_type] || item.source_type}</Text>
                    <Text>{item.note || formatDateTime(item.created_at)}</Text>
                  </View>
                  <View className={item.amount > 0 ? 'user-level-ledger__amount--plus' : 'user-level-ledger__amount--minus'}>
                    <Text>{item.amount > 0 ? `+${item.amount}` : item.amount}</Text>
                    <Text>余额 {item.balance_after}</Text>
                  </View>
                </View>
              ))}
              {ledger.length === 0 && (
                <View className='user-level-ledger__empty'>参与社区并通过审核后，经验记录会出现在这里</View>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  )
}
