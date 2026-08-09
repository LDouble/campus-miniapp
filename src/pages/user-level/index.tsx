import { useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type {
  UserExperienceLedgerView,
  UserLevelSummary,
} from '../../api/types'
import {
  getMyUserLevel,
  listMyUserExperienceLedger,
} from '../../api/user-levels'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import { formatDateTime } from '../../features/life-services/format'
import './index.scss'

const sourceLabels: Record<string, string> = {
  academic_verified: '完成学籍认证',
  admin_adjustment: '管理员调整',
  comment_approved: '评论审核通过',
  like_received: '帖子收到有效点赞',
  post_approved: '帖子审核通过',
}

export default function UserLevelPage() {
  const [level, setLevel] = useState<UserLevelSummary | null>(null)
  const [ledger, setLedger] = useState<UserExperienceLedgerView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [levelResult, ledgerResult] = await Promise.all([
        getMyUserLevel(),
        listMyUserExperienceLedger(1, 50),
      ])
      setLevel(levelResult)
      setLedger(ledgerResult.items)
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

            <View className='user-level-rules'>
              <Text className='user-level-section-title'>如何获得经验</Text>
              <View><Text>+20</Text><Text>首次完成学籍认证</Text><Text>仅一次</Text></View>
              <View><Text>+10</Text><Text>帖子审核通过</Text><Text>每日最多 3 次</Text></View>
              <View><Text>+3</Text><Text>评论或回复审核通过</Text><Text>每日最多 10 次</Text></View>
              <View><Text>+1</Text><Text>帖子收到有效点赞</Text><Text>每日最多 20 次</Text></View>
              <Text className='user-level-rules__hint'>撤销审核或取消点赞时会自动扣回对应经验。等级仅展示社区贡献，不代表身份、权限或信用。</Text>
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
