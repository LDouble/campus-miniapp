import { useCallback, useEffect, useState } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { isApiError } from '../../../api/client'
import { listAcademicPeriods } from '../../../api/academic'
import type { AcademicPeriod } from '../../../api/types'
import {
  createAcademicRankingGroup, getAcademicRankingProfile, joinAcademicRankingGroup,
  listAcademicRankingGroups, listAcademicRankingReports, listAcademicRankingRules,
  type AcademicRankingBatch, type AcademicRankingGroup, type AcademicRankingProfile, type AcademicRankingRule,
} from '../../../api/academic-ranking'
import './index.scss'

const errorMessage = (error: unknown, fallback: string) => isApiError(error) ? error.message : fallback

export default function AcademicRankingsPage() {
  const [profile, setProfile] = useState<AcademicRankingProfile | null>(null)
  const [rules, setRules] = useState<AcademicRankingRule[]>([])
  const [groups, setGroups] = useState<AcademicRankingGroup[]>([])
  const [reports, setReports] = useState<AcademicRankingBatch[]>([])
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none')
  const [name, setName] = useState('')
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([])
  const [ruleKey, setRuleKey] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextProfile, nextRules, nextGroups, nextReports, nextPeriods] = await Promise.all([
        getAcademicRankingProfile(), listAcademicRankingRules(), listAcademicRankingGroups(), listAcademicRankingReports(), listAcademicPeriods(),
      ])
      setProfile(nextProfile); setRules(nextRules); setGroups(nextGroups); setReports(nextReports); setPeriods(nextPeriods)
      setRuleKey((current) => current || nextRules[0]?.key || '')
    } catch (requestError) { setError(errorMessage(requestError, '成绩排名加载失败，请稍后重试')) }
    finally { setLoading(false); Taro.stopPullDownRefresh() }
  }, [])
  useEffect(() => { void load() }, [load])
  usePullDownRefresh(() => void load())
  const create = async () => {
    if (submitting) return
    if (!name.trim() || !ruleKey || !selectedPeriodIds.length || !profile) { Taro.showToast({ title: '请填写名称、学期和规则', icon: 'none' }); return }
    setSubmitting(true)
    try {
      const detail = await createAcademicRankingGroup({ name: name.trim(), education_level: profile.education_level, period_ids: selectedPeriodIds, rule_key: ruleKey })
      setMode('none'); void Taro.navigateTo({ url: `/pages/academic/rankings/group?id=${detail.group.id}` })
    } catch (requestError) { Taro.showToast({ title: errorMessage(requestError, '创建失败'), icon: 'none' }) }
    finally { setSubmitting(false) }
  }
  const join = async () => {
    if (submitting) return
    if (!inviteCode.trim()) { Taro.showToast({ title: '请输入邀请码', icon: 'none' }); return }
    setSubmitting(true)
    try {
      const detail = await joinAcademicRankingGroup(inviteCode.trim())
      setMode('none'); void Taro.navigateTo({ url: `/pages/academic/rankings/group?id=${detail.group.id}` })
    } catch (requestError) { Taro.showToast({ title: errorMessage(requestError, '申请加入失败'), icon: 'none' }) }
    finally { setSubmitting(false) }
  }
  return <View className='ranking-page'>
    <CustomNavbar title='成绩排名' showBack />
    <View className='ranking-page__content'>
      {loading && <Text className='ranking-state'>正在读取排名信息…</Text>}
      {!loading && error && <View className='ranking-state ranking-state--error'><Text>{error}</Text><Text onClick={() => void load()}>重新加载</Text></View>}
      {!loading && !error && <>
        <View className='ranking-card ranking-profile'>
          <Text className='ranking-eyebrow'>教务档案</Text>
          <Text className='ranking-profile__title'>{profile?.college_name || '学院信息待同步'}{profile?.major_name ? ` · ${profile.major_name}` : ''}</Text>
          <Text className='ranking-copy'>{profile?.class_name ? `已从 ${profile.provider} 同步：${profile.class_name}` : '暂未获得行政班信息；自建组只代表参与者范围。'}</Text>
          <Text className='ranking-muted'>已同步学期：{profile?.synced_periods.join('、') || '暂无'}</Text>
        </View>
        <View className='ranking-actions'><View onClick={() => setMode('create')}>创建排名组</View><View onClick={() => setMode('join')}>输入邀请码</View></View>
        {mode === 'create' && <View className='ranking-card ranking-form'>
          <Text className='ranking-section__title'>创建排名组</Text><KeyboardSafeInput value={name} placeholder='例如：2024级计算机1班' onInput={(e) => setName(e.detail.value)} />
          <Text className='ranking-copy'>选择要统计的教务学期。此排名仅代表已确认参与者的参考结果，不是学院正式排名。</Text>
          <View className='ranking-period-list'>{periods.map((period) => <View key={period.id} className={selectedPeriodIds.includes(period.id) ? 'is-selected' : ''} onClick={() => setSelectedPeriodIds((current) => current.includes(period.id) ? current.filter((id) => id !== period.id) : [...current, period.id])}><Text>{period.label}</Text><Text>{selectedPeriodIds.includes(period.id) ? '已选' : '选择'}</Text></View>)}</View>
          {!periods.length && <Text className='ranking-empty'>暂无可选教务学期，请先完成教务认证并同步成绩。</Text>}
          <View className='ranking-rule-list'>{rules.map((rule) => <View key={rule.key} className={ruleKey === rule.key ? 'is-selected' : ''} onClick={() => setRuleKey(rule.key)}><Text>{rule.name}</Text><Text>{rule.description}</Text></View>)}</View>
          <Text className='ranking-copy'>等级成绩默认按优秀/优 90、良好/良 80、中等/中 70、合格/及格 60、不合格/不及格 0、通过 85、不通过 0 换算。重修或多次成绩无法确认顺序时会标记为资料不完整，不应作为正式院系规则使用。</Text>
          <View className='ranking-primary' onClick={() => void create()}>{submitting ? '提交中…' : '创建并生成邀请码'}</View>
        </View>}
        {mode === 'join' && <View className='ranking-card ranking-form'>
          <Text className='ranking-section__title'>申请加入排名组</Text><KeyboardSafeInput value={inviteCode} placeholder='输入 32 位邀请码' maxlength={32} onInput={(e) => setInviteCode(e.detail.value)} />
          <Text className='ranking-copy'>加入仅同意把你的成绩用于本组计算，不会自动授权组主或其他成员查看你的成绩明细。</Text>
          <View className='ranking-primary' onClick={() => void join()}>{submitting ? '提交中…' : '提交申请'}</View>
        </View>}
        <View className='ranking-section'><Text className='ranking-section__title'>我的排名组</Text>{groups.length ? groups.map((group) => <View className='ranking-row' key={group.id} onClick={() => void Taro.navigateTo({ url: `/pages/academic/rankings/group?id=${group.id}` })}><View><Text>{group.name}</Text><Text>{group.period_ids.join('、')} · {group.membership_status === 'approved' ? '已确认' : group.membership_status}</Text></View><Text>›</Text></View>) : <Text className='ranking-empty'>还没有加入排名组</Text>}</View>
        <View className='ranking-section'><Text className='ranking-section__title'>我的排名报告</Text>{reports.length ? reports.map((report) => <View className='ranking-row' key={report.id} onClick={() => void Taro.navigateTo({ url: `/pages/academic/rankings/report?id=${report.id}&view=personal` })}><View><Text>{report.group_name}</Text><Text>{report.sample_size}/{report.member_count} 人参与 · {report.status}</Text></View><Text>查看</Text></View>) : <Text className='ranking-empty'>组主发布后，报告会显示在这里</Text>}</View>
      </>}
    </View>
  </View>
}
