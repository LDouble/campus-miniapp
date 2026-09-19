import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDidShow, useRouter } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { getAcademicRankingReport, type AcademicRankingReport } from '../../../api/academic-ranking'
import { isApiError } from '../../../api/client'

import './index.scss'

const score = (value: number) => (value / 100).toFixed(2)
const courses = (raw?: string) => { try { const value = raw ? JSON.parse(raw) : null; return Array.isArray(value?.courses) ? value.courses : [] } catch { return [] } }
export default function AcademicRankingReportPage() {
  const { params } = useRouter(); const id = Number(params.id) || 0
  const [view, setView] = useState<'personal' | 'shared'>(params.view === 'shared' ? 'shared' : 'personal')
  const [report, setReport] = useState<AcademicRankingReport | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const load = useCallback(async () => { if (!id) return; setLoading(true); setReport(null); try { setReport(await getAcademicRankingReport(id, view)); setError('') } catch (cause) { if (view === 'personal') { try { setReport(await getAcademicRankingReport(id, 'shared')); setView('shared'); setError('已切换到收到的汇总报告') } catch { setError(isApiError(cause) ? cause.message : '报告暂时无法读取') } } else setError(isApiError(cause) ? cause.message : '报告暂时无法读取') } finally { setLoading(false) } }, [id, view])
  useEffect(() => { void load() }, [load]); useDidShow(() => { void load() }); const details = useMemo(() => courses(report?.rows[0]?.details_json), [report])
  const detailRows = details.map((value, index) => {
    const item = value as Record<string, unknown>
    const name = String(item.course_name || item.name || '课程')
    const courseType = String(item.course_type || '课程')
    const creditX100 = Number(item.credit_x100)
    const credit = Number.isFinite(creditX100) ? score(creditX100) : '—'
    const scoreX100 = Number(item.score_x100)
    const valueScore = Number.isFinite(scoreX100) ? `${score(scoreX100)} 分` : String(item.raw_score ?? '成绩待确认')
    const status = item.included === true ? '已计入' : item.reason === 'invalid_credit' ? '学分无效，未计入' : item.reason === 'unknown_grade' ? '成绩无法换算，未计入' : '未计入'
    return <View className='ranking-row' key={`${String(item.course_code || name)}-${index}`}><View><Text>{name}</Text><Text>{courseType} · {credit} 学分</Text></View><View><Text>{valueScore}</Text><Text>{status}</Text></View></View>
  })
  return (
    <View className='ranking-page'>
      <CustomNavbar title={view === 'shared' ? '收到的排名报告' : '我的排名报告'} showBack />
      <View className='ranking-page__content'>
        {loading && <Text className='ranking-state'>正在读取报告…</Text>}
        <View className='ranking-actions'><View className={view === 'personal' ? 'is-active' : ''} onClick={() => setView('personal')}>我的报告</View><View className={view === 'shared' ? 'is-active' : ''} onClick={() => setView('shared')}>收到的汇总</View></View>
        {!loading && error && <View className='ranking-state ranking-state--error'><Text>{error}</Text><Text onClick={() => void load()}>重新加载</Text></View>}
        {report && <>
          <View className='ranking-card ranking-profile'><Text className='ranking-eyebrow'>{report.view === 'shared' ? `当前获授权 ${report.authorized_count} 人` : '个人成绩排名'}</Text><Text className='ranking-profile__title'>{report.batch.group_name}</Text><Text className='ranking-copy'>参与样本 {report.batch.sample_size}/{report.batch.member_count} 人；自建组排名仅代表已参与成员。</Text><Text className='ranking-muted'>统计截至 {report.batch.source_cutoff_at}</Text></View>
          <View className='ranking-section'><Text className='ranking-section__title'>{view === 'shared' ? '已授权汇总' : '排名结果'}</Text>{report.rows.map((row) => <View key={row.user_id}><View className='ranking-row ranking-report-row' onClick={() => row.details_json && setExpandedRows((current) => current.includes(row.user_id) ? current.filter((rowId) => rowId !== row.user_id) : [...current, row.user_id])}><View><Text>{row.display_name || row.student_no_masked}</Text><Text>学分 {score(row.credit_x100)} · {row.tied_count > 1 ? `${row.tied_count} 人并列` : '无并列'}{row.details_json ? ' · 可查看明细' : ''}</Text></View><View><Text>第 {row.rank}/{row.total} 名</Text><Text>{score(row.score_x100)} 分</Text></View></View>{view === 'shared' && row.details_json && expandedRows.includes(row.user_id) && <View className='ranking-card'><Text className='ranking-copy'>该同学已授权逐课明细</Text>{courses(row.details_json).map((value, index) => { const item = value as Record<string, unknown>; return <Text className='ranking-muted' key={`${row.user_id}-${index}`}>{String(item.course_name || '课程')} · {item.included === true ? '已计入' : '未计入'} · {String(item.raw_score ?? '成绩待确认')}</Text> })}</View>}</View>)}</View>
          {view === 'personal' && <View className='ranking-section'><Text className='ranking-section__title'>逐课计算明细</Text>{detailRows.length ? detailRows : <Text className='ranking-empty'>当前授权范围未包含逐课明细，或明细暂不可用。</Text>}</View>}
        </>}
      </View>
    </View>
  )
}
