import { useCallback, useRef, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { isApiError } from '../../../api/client'
import { listAcademicPeriods } from '../../../api/academic'
import type { AcademicPeriod } from '../../../api/types'
import {
  createAcademicRankingGroup, getAcademicRankingProfile, joinAcademicRankingGroup,
  listAcademicRankingGroups, listAcademicRankingReports, listAcademicRankingRules,
  ACADEMIC_RANKING_PAGE_SIZE, type AcademicRankingBatch, type AcademicRankingGroup,
  type AcademicRankingProfile, type AcademicRankingRule,
} from '../../../api/academic-ranking'
import {
  canLoadMoreRankingItems, createRankingPageRequestGate, createRankingPagination,
  requestRankingPage,
} from '../../../features/academic-ranking/pagination'
import './index.scss'

const errorMessage = (error: unknown, fallback: string) => isApiError(error) ? error.message : fallback

export default function AcademicRankingsPage() {
  const [profile, setProfile] = useState<AcademicRankingProfile | null>(null)
  const [rules, setRules] = useState<AcademicRankingRule[]>([])
  const [groupsPage, setGroupsPage] = useState(() => createRankingPagination<AcademicRankingGroup>(ACADEMIC_RANKING_PAGE_SIZE))
  const groupsPageRef = useRef(groupsPage)
  const [reportsPage, setReportsPage] = useState(() => createRankingPagination<AcademicRankingBatch>(ACADEMIC_RANKING_PAGE_SIZE))
  const reportsPageRef = useRef(reportsPage)
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [groupsLoadingMore, setGroupsLoadingMore] = useState(false)
  const [reportsLoadingMore, setReportsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none')
  const [name, setName] = useState('')
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([])
  const [ruleKey, setRuleKey] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const hasLoadedRef = useRef(false)
  const homeRequestActiveRef = useRef(false)
  const groupRequestGateRef = useRef(createRankingPageRequestGate())
  const reportRequestGateRef = useRef(createRankingPageRequestGate())

  const commitGroupsPage = useCallback((page: typeof groupsPage) => {
    groupsPageRef.current = page
    setGroupsPage(page)
  }, [])
  const commitReportsPage = useCallback((page: typeof reportsPage) => {
    reportsPageRef.current = page
    setReportsPage(page)
  }, [])
  const cancelMoreRequests = useCallback(() => {
    groupRequestGateRef.current.cancel()
    reportRequestGateRef.current.cancel()
    setGroupsLoadingMore(false)
    setReportsLoadingMore(false)
  }, [])

  const loadInitial = useCallback(async (pullDown = false) => {
    if (homeRequestActiveRef.current) {
      if (pullDown) Taro.stopPullDownRefresh()
      return
    }
    homeRequestActiveRef.current = true
    setLoading(true); setError('')
    cancelMoreRequests()
    try {
      const [nextProfile, nextRules, groupResult, reportResult, nextPeriods] = await Promise.all([
        getAcademicRankingProfile(),
        listAcademicRankingRules(),
        requestRankingPage(groupsPageRef.current, () => listAcademicRankingGroups(1, ACADEMIC_RANKING_PAGE_SIZE), true),
        requestRankingPage(reportsPageRef.current, () => listAcademicRankingReports(1, ACADEMIC_RANKING_PAGE_SIZE), true),
        listAcademicPeriods(),
      ])
      if (!groupResult.ok) throw groupResult.error
      if (!reportResult.ok) throw reportResult.error
      setProfile(nextProfile); setRules(nextRules); setPeriods(nextPeriods)
      commitGroupsPage(groupResult.state); commitReportsPage(reportResult.state)
      setRuleKey((current) => current || nextRules[0]?.key || '')
      hasLoadedRef.current = true
    } catch (requestError) { setError(errorMessage(requestError, '成绩排名加载失败，请稍后重试')) }
    finally {
      setLoading(false)
      homeRequestActiveRef.current = false
      if (pullDown) Taro.stopPullDownRefresh()
    }
  }, [cancelMoreRequests, commitGroupsPage, commitReportsPage])

  const refreshLists = useCallback(async () => {
    if (homeRequestActiveRef.current) return
    homeRequestActiveRef.current = true
    cancelMoreRequests()
    try {
      const [groupResult, reportResult] = await Promise.all([
        requestRankingPage(groupsPageRef.current, () => listAcademicRankingGroups(1, ACADEMIC_RANKING_PAGE_SIZE), true),
        requestRankingPage(reportsPageRef.current, () => listAcademicRankingReports(1, ACADEMIC_RANKING_PAGE_SIZE), true),
      ])
      if (groupResult.ok) commitGroupsPage(groupResult.state)
      if (reportResult.ok) commitReportsPage(reportResult.state)
      if (!groupResult.ok || !reportResult.ok) {
        const requestError = !groupResult.ok ? groupResult.error : reportResult.ok ? undefined : reportResult.error
        Taro.showToast({ title: errorMessage(requestError, '排名列表刷新失败，请重试'), icon: 'none' })
      }
    } finally { homeRequestActiveRef.current = false }
  }, [cancelMoreRequests, commitGroupsPage, commitReportsPage])

  const refreshAll = useCallback(async () => {
    if (homeRequestActiveRef.current) { Taro.stopPullDownRefresh(); return }
    homeRequestActiveRef.current = true
    cancelMoreRequests()
    try {
      const [nextProfile, nextRules, groupResult, reportResult, nextPeriods] = await Promise.all([
        getAcademicRankingProfile(),
        listAcademicRankingRules(),
        requestRankingPage(groupsPageRef.current, () => listAcademicRankingGroups(1, ACADEMIC_RANKING_PAGE_SIZE), true),
        requestRankingPage(reportsPageRef.current, () => listAcademicRankingReports(1, ACADEMIC_RANKING_PAGE_SIZE), true),
        listAcademicPeriods(),
      ])
      if (!groupResult.ok) throw groupResult.error
      if (!reportResult.ok) throw reportResult.error
      setProfile(nextProfile); setRules(nextRules); setPeriods(nextPeriods)
      commitGroupsPage(groupResult.state); commitReportsPage(reportResult.state)
      setRuleKey((current) => current || nextRules[0]?.key || '')
      hasLoadedRef.current = true
    } catch (requestError) {
      Taro.showToast({ title: errorMessage(requestError, '成绩排名刷新失败，已保留现有列表'), icon: 'none' })
    } finally {
      homeRequestActiveRef.current = false
      Taro.stopPullDownRefresh()
    }
  }, [cancelMoreRequests, commitGroupsPage, commitReportsPage])

  useDidShow(() => {
    if (hasLoadedRef.current) void refreshLists()
    else void loadInitial()
  })
  usePullDownRefresh(() => {
    if (hasLoadedRef.current) void refreshAll()
    else void loadInitial(true)
  })

  const loadMoreGroups = async () => {
    const current = groupsPageRef.current
    if (homeRequestActiveRef.current || !canLoadMoreRankingItems(current)) return
    const requestId = groupRequestGateRef.current.begin()
    if (requestId === null) return
    setGroupsLoadingMore(true)
    try {
      const result = await requestRankingPage(current, () => listAcademicRankingGroups(current.page + 1, ACADEMIC_RANKING_PAGE_SIZE))
      if (!groupRequestGateRef.current.isActive(requestId)) return
      if (result.ok) commitGroupsPage(result.state)
      else Taro.showToast({ title: errorMessage(result.error, '排名组加载失败，请重试'), icon: 'none' })
    } finally {
      if (groupRequestGateRef.current.finish(requestId)) {
        setGroupsLoadingMore(false)
      }
    }
  }

  const loadMoreReports = async () => {
    const current = reportsPageRef.current
    if (homeRequestActiveRef.current || !canLoadMoreRankingItems(current)) return
    const requestId = reportRequestGateRef.current.begin()
    if (requestId === null) return
    setReportsLoadingMore(true)
    try {
      const result = await requestRankingPage(current, () => listAcademicRankingReports(current.page + 1, ACADEMIC_RANKING_PAGE_SIZE))
      if (!reportRequestGateRef.current.isActive(requestId)) return
      if (result.ok) commitReportsPage(result.state)
      else Taro.showToast({ title: errorMessage(result.error, '排名报告加载失败，请重试'), icon: 'none' })
    } finally {
      if (reportRequestGateRef.current.finish(requestId)) {
        setReportsLoadingMore(false)
      }
    }
  }
  const create = async () => {
    if (submitting) return
    if (!name.trim() || !ruleKey || !selectedPeriodIds.length || !profile) { Taro.showToast({ title: '请填写名称、学期和规则', icon: 'none' }); return }
    setSubmitting(true)
    try {
      const group = await createAcademicRankingGroup({ name: name.trim(), education_level: profile.education_level, period_ids: selectedPeriodIds, rule_key: ruleKey })
      setMode('none'); void Taro.navigateTo({ url: `/pages/academic/rankings/group?id=${group.id}` })
    } catch (requestError) { Taro.showToast({ title: errorMessage(requestError, '创建失败'), icon: 'none' }) }
    finally { setSubmitting(false) }
  }
  const join = async () => {
    if (submitting) return
    if (!inviteCode.trim()) { Taro.showToast({ title: '请输入邀请码', icon: 'none' }); return }
    setSubmitting(true)
    try {
      const group = await joinAcademicRankingGroup(inviteCode.trim())
      setMode('none'); void Taro.navigateTo({ url: `/pages/academic/rankings/group?id=${group.id}` })
    } catch (requestError) { Taro.showToast({ title: errorMessage(requestError, '申请加入失败'), icon: 'none' }) }
    finally { setSubmitting(false) }
  }
  return <View className='ranking-page'>
    <CustomNavbar title='成绩排名' showBack />
    <View className='ranking-page__content'>
      {loading && <Text className='ranking-state'>正在读取排名信息…</Text>}
      {!loading && error && <View className='ranking-state ranking-state--error'><Text>{error}</Text><Text onClick={() => void loadInitial()}>重新加载</Text></View>}
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
        <View className='ranking-section'>
          <Text className='ranking-section__title'>我的排名组（{groupsPage.total}）</Text>
          {groupsPage.items.length ? groupsPage.items.map((group) => <View className='ranking-row' key={group.id} onClick={() => void Taro.navigateTo({ url: `/pages/academic/rankings/group?id=${group.id}` })}><View><Text>{group.name}</Text><Text>{group.period_ids.join('、')} · {group.membership_status === 'approved' ? '已确认' : group.membership_status}</Text></View><Text>›</Text></View>) : <Text className='ranking-empty'>还没有加入排名组</Text>}
          {canLoadMoreRankingItems(groupsPage) && <View className='ranking-load-more' ariaRole='button' ariaLabel='加载更多排名组' onClick={groupsLoadingMore ? undefined : () => void loadMoreGroups()}><Text>{groupsLoadingMore ? '排名组加载中…' : '加载更多排名组'}</Text></View>}
          {!canLoadMoreRankingItems(groupsPage) && groupsPage.total > 0 && <Text className='ranking-list-end'>已加载全部 {groupsPage.items.length} / {groupsPage.total} 个排名组</Text>}
        </View>
        <View className='ranking-section'>
          <Text className='ranking-section__title'>我的排名报告（{reportsPage.total}）</Text>
          {reportsPage.items.length ? reportsPage.items.map((report) => <View className='ranking-row' key={report.id} onClick={() => void Taro.navigateTo({ url: `/pages/academic/rankings/report?id=${report.id}&view=personal` })}><View><Text>{report.group_name}</Text><Text>{report.sample_size}/{report.member_count} 人参与 · {report.status}</Text></View><Text>查看</Text></View>) : <Text className='ranking-empty'>组主发布后，报告会显示在这里</Text>}
          {canLoadMoreRankingItems(reportsPage) && <View className='ranking-load-more' ariaRole='button' ariaLabel='加载更多排名报告' onClick={reportsLoadingMore ? undefined : () => void loadMoreReports()}><Text>{reportsLoadingMore ? '报告加载中…' : '加载更多报告'}</Text></View>}
          {!canLoadMoreRankingItems(reportsPage) && reportsPage.total > 0 && <Text className='ranking-list-end'>已加载全部 {reportsPage.items.length} / {reportsPage.total} 份报告</Text>}
        </View>
      </>}
    </View>
  </View>
}
