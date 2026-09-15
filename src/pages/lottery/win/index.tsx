import { useEffect, useState } from 'react'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { isApiError } from '../../../api/client'
import { getLotteryWin, type LotteryWin } from '../../../api/lottery'
import './index.scss'

const claimStatus = { pending: '待领取', fulfilled: '已发放', expired: '已过期' }
const time = (value?: string | null) => value ? value.replace('T', ' ').slice(0, 16) : '待公布'
export default function LotteryWinPage() {
  const [id, setId] = useState(''); const [win, setWin] = useState<LotteryWin | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useLoad((options) => setId(String(options.id || '')))
  const load = async () => { if (!id) return; setLoading(true); setError(''); try { setWin(await getLotteryWin(id)) } catch (loadError) { setError(isApiError(loadError) ? loadError.message : '领奖信息加载失败') } finally { setLoading(false); Taro.stopPullDownRefresh() } }
  useEffect(() => { if (id) void load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useDidShow(() => { void load() })
  return <View className='lottery-win-page'><CustomNavbar title='领奖详情' subtitle='请按活动规则完成领取' showBack />
    {loading && <View className='lottery-win-state'>正在加载领奖信息…</View>}
    {!loading && error && <View className='lottery-win-state lottery-win-state--error' onClick={() => void load()}>{error}，点击重试</View>}
    {win && <View className='lottery-win-page__content'><View className='lottery-win-hero'>{win.prize.image_url && <Image src={win.prize.image_url} mode='aspectFill' />}<Text>恭喜中奖</Text><Text>{win.prize.name}</Text><Text>请在截止前按规则领取奖品</Text></View>
      <View className='lottery-win-card'><Text>领奖状态</Text><Text>{claimStatus[win.status]}</Text><Text>中奖时间：{time(win.created_at)}</Text><Text>领奖截止：{time(win.prize.claim_deadline_at)}</Text></View>
      <View className='lottery-win-card'><Text>领取方式</Text><Text>{win.prize.claim_method || '请等待工作人员联系安排领取。'}</Text>{win.fulfillment_note && <Text>{win.fulfillment_note}</Text>}</View>
    </View>}
  </View>
}
