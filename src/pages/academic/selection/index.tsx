import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  AcademicCredentialMissingError,
  getActiveAcademicUserId,
} from '../../../api/academic-credential'
import type { AcademicCacheMetadata } from '../../../api/types'
import { requestWechatSubscriptionAndStopPropagation } from '../../../features/wechat-subscription'
import { isQualificationEdition } from '../../../features/app-edition'
import { openMigratedFeaturePage } from '../../../features/app-edition/navigation'
import {
  openCourseMarketplaceSearch,
} from '../../../features/life-services/marketplace-prefill'
import { openCourseMaterials } from '../../../features/course-materials/navigation'
import CoursePassRatePreview from '../../../features/academic-statistics/course-pass-rate-preview'
import { consumeAcademicRefreshAfterVerification } from '../../../features/academic-verification/refresh-signal'
import AcademicHeader from '../components/academic-header'
import { AcademicCacheNotice, AcademicLoadState } from '../components/academic-load-state'
import { academicRepository } from '../repository'
import { academicStorage } from '../storage'
import { AcademicPeriod, AcademicPreferences, CourseSelectionRecord, CourseSelectionStatus } from '../types'
import { getPeriodLabel, resolvePeriodId } from '../utils'
import '../index.scss'

const DEFAULT_PERIOD_ID = '2025-2026-2'
const defaultPreferences: AcademicPreferences = {
  section: 'schedule',
  schedulePeriodId: DEFAULT_PERIOD_ID,
  gradePeriodId: DEFAULT_PERIOD_ID,
  examPeriodId: DEFAULT_PERIOD_ID,
  week: 6,
  selectedWeekday: 1,
  scheduleView: 'week',
}
const statusMeta: Record<CourseSelectionStatus, { label: string; description: string }> = {
  selected: { label: '已选', description: '课程记录已由教务系统返回' },
  pending: { label: '待确认', description: '当前课程状态仍待确认' },
  failed: { label: '未选', description: '教务系统标记为未选课程' },
}
type SelectionSheet = 'period' | 'detail' | null
type SelectionTab = 'all' | 'failed'

export default function SelectionPage() {
  const [academicUserId] = useState(getActiveAcademicUserId)
  const [initialScheduleCache] = useState(() => (
    academicStorage.getScheduleCache(academicUserId)
  ))
  const [initialRecordsCache] = useState(() => (
    academicStorage.getRecordsCache(academicUserId)
  ))
  const [preferences, setPreferences] = useState<AcademicPreferences>({
    ...defaultPreferences,
    ...academicStorage.getPreferences(defaultPreferences),
  })
  const initialRecords = initialRecordsCache
    ?.selectionsByPeriod[preferences.schedulePeriodId]
  const initialUpdatedAt = initialRecordsCache
    ?.selectionsUpdatedAtByPeriod[preferences.schedulePeriodId] || 0
  const [periods, setPeriods] = useState<AcademicPeriod[]>(
    initialScheduleCache?.periods || [],
  )
  const [records, setRecords] = useState<CourseSelectionRecord[]>(initialRecords || [])
  const [loading, setLoading] = useState(!initialUpdatedAt)
  const [retrying, setRetrying] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [usingCache, setUsingCache] = useState(Boolean(initialUpdatedAt))
  const [serverCache, setServerCache] = useState<AcademicCacheMetadata | null>(null)
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(initialUpdatedAt)
  const [activeTab, setActiveTab] = useState<SelectionTab>('all')
  const [sheet, setSheet] = useState<SelectionSheet>(null)
  const [activeRecord, setActiveRecord] = useState<CourseSelectionRecord | null>(null)
  const selectionsRequestRef = useRef(0)
  const firstPageShowRef = useRef(true)

  const summary = useMemo(() => ({
    pending: records.filter((item) => item.status === 'pending'),
  }), [records])
  const displayedRecords = useMemo(() => (
    activeTab === 'failed'
      ? records.filter((record) => record.status === 'failed')
      : records
  ), [activeTab, records])
  const hasSelectedPeriod = periods.some((period) => (
    period.id === preferences.schedulePeriodId
  ))

  const refreshSelections = useCallback(async (
    manual = false,
    periodId = preferences.schedulePeriodId,
  ) => {
    const requestId = ++selectionsRequestRef.current
    const cache = academicStorage.getRecordsCache(academicUserId)
    const cached = cache?.selectionsByPeriod[periodId]
    const updatedAt = cache
      ?.selectionsUpdatedAtByPeriod[periodId] || 0
    setRecords(cached || [])
    setCacheUpdatedAt(updatedAt)
    setUsingCache(Boolean(cached))
    setServerCache(null)
    if (!updatedAt) setLoading(true)
    if (manual) setRetrying(true)
    setLoadError(null)
    try {
      const result = await academicRepository.getCourseSelections(periodId)
      if (selectionsRequestRef.current !== requestId) return
      academicStorage.setSelectionRecords(
        academicUserId,
        periodId,
        result.records,
      )
      setRecords(result.records)
      setCacheUpdatedAt(Date.now())
      setUsingCache(false)
      setServerCache(result.cache || null)
    } catch (error) {
      if (selectionsRequestRef.current !== requestId) return
      if (updatedAt) {
        setUsingCache(true)
        setLoadError(error)
        Taro.showToast({ title: '已展示上次选课结果', icon: 'none' })
      } else {
        setLoadError(error)
      }
    } finally {
      if (selectionsRequestRef.current === requestId) {
        setLoading(false)
        setRetrying(false)
      }
    }
  }, [academicUserId, preferences.schedulePeriodId])

  Taro.useDidShow(() => {
    if (!firstPageShowRef.current && !hasSelectedPeriod) return
    const shouldRefresh = consumeAcademicRefreshAfterVerification(
      Taro,
      '/pages/academic/selection/index',
    )
    if (firstPageShowRef.current) {
      firstPageShowRef.current = false
      return
    }
    if (shouldRefresh) void refreshSelections(false)
  })

  const retryPage = useCallback(async () => {
    setRetrying(true)
    setLoadError(null)
    try {
      const result = await academicRepository.getPeriods({ force: true })
      const periodId = resolvePeriodId(result, preferences.schedulePeriodId)
      if (!periodId) throw new Error('academic period unavailable')
      setPeriods(result)
      setPreferences((current) => ({ ...current, schedulePeriodId: periodId }))
      if (hasSelectedPeriod && periodId === preferences.schedulePeriodId) {
        await refreshSelections(false, periodId)
      } else {
        setLoading(true)
      }
    } catch (error) {
      setLoadError(error)
    } finally {
      setRetrying(false)
      setLoading(false)
    }
  }, [hasSelectedPeriod, preferences.schedulePeriodId, refreshSelections])

  useEffect(() => {
    academicRepository.getPeriods()
      .then((result) => {
        setPeriods(result)
        if (!result.length) setLoading(false)
        setPreferences((current) => {
          const schedulePeriodId = resolvePeriodId(result, current.schedulePeriodId)
          return schedulePeriodId === current.schedulePeriodId
            ? current
            : { ...current, schedulePeriodId }
        })
      })
      .catch((error) => {
        if (initialScheduleCache?.periods.length) {
          setLoadError(error)
          Taro.showToast({ title: '已使用上次学期信息', icon: 'none' })
          return
        }
        setLoading(false)
        setLoadError(error)
      })
  }, [initialScheduleCache])
  useEffect(() => {
    if (!hasSelectedPeriod) return
    void refreshSelections()
  }, [hasSelectedPeriod, refreshSelections])
  useEffect(() => academicStorage.setPreferences(preferences), [preferences])
  Taro.usePullDownRefresh(() => refreshSelections(true).finally(() => Taro.stopPullDownRefresh()))

  const updatePeriod = (schedulePeriodId: string) => {
    setPreferences((current) => ({ ...current, schedulePeriodId }))
  }
  const openCourseTrade = () => {
    if (!activeRecord) return
    if (isQualificationEdition) {
      setSheet(null)
      void openMigratedFeaturePage({ module: 'marketplace' })
      return
    }
    const courseName = activeRecord.courseName.trim()
    setSheet(null)
    const prefill = {
      intent: 'wanted',
      description: `求购《${courseName}》课程使用的课本，版本和成色可沟通。`,
      courseName,
      courseCode: activeRecord.courseCode,
      academicPeriodId: activeRecord.periodId,
      academicPeriodLabel: getPeriodLabel(periods, activeRecord.periodId),
      source: 'course_selection',
    } as const
    void openCourseMarketplaceSearch(prefill)
  }
  const openCourseMaterialPage = () => {
    if (!activeRecord) return
    setSheet(null)
    if (isQualificationEdition) {
      void openMigratedFeaturePage({ module: 'course_materials' })
      return
    }
    const context = {
      courseName: activeRecord.courseName,
      courseCode: activeRecord.courseCode,
      periodId: activeRecord.periodId,
      periodLabel: getPeriodLabel(periods, activeRecord.periodId),
      source: 'selection' as const,
    }
    void openCourseMaterials(context)
  }
  const toolbar = (
    <View className='academic-toolbar academic-toolbar--simple'>
      <View className='academic-toolbar__period' onClick={() => setSheet('period')}>
        <Text className='academic-toolbar__label'>选课学期</Text>
        <View><Text>{getPeriodLabel(periods, preferences.schedulePeriodId)}</Text><Text className='academic-toolbar__chevron'>⌄</Text></View>
      </View>
      <View className='academic-toolbar__hint'><View /><Text>结果同步中</Text></View>
    </View>
  )

  return (
    <View className={`academic-page academic-page--selection ${sheet ? 'academic-page--locked' : ''}`}>
      <View className='academic-page__glow academic-page__glow--two' />
      <AcademicHeader title='选课结果' toolbar={toolbar} />
      <View className='academic-content'>
        {loading ? <View className='academic-state'><View className='academic-state__loader' /><Text>正在同步选课结果…</Text></View> : (
          loadError instanceof AcademicCredentialMissingError
          || (loadError && !usingCache)
        ) ? (
          <AcademicLoadState error={loadError} retrying={retrying} onRetry={retryPage} />
        ) : <>
          <AcademicCacheNotice
            cache={serverCache}
            updatedAt={!usingCache && !loadError ? cacheUpdatedAt : 0}
            localUpdatedAt={usingCache ? cacheUpdatedAt : 0}
            localFallback={Boolean(loadError)}
          />
          <View className='selection-hero'>
            <View><Text className='selection-hero__eyebrow'>本学期课程记录</Text><Text className='selection-hero__number'>{records.length}<Text> 门课程</Text></Text><Text className='selection-hero__copy'>完整展示教务系统返回的课程状态</Text></View>
            <View className='selection-hero__seal'><Text>课程</Text><Text>记录</Text></View>
          </View>
          <View className='selection-tabs'>
            <View className={`selection-tabs__item ${activeTab === 'all' ? 'selection-tabs__item--active' : ''}`} onClick={() => setActiveTab('all')}>全部记录</View>
            <View className={`selection-tabs__item ${activeTab === 'failed' ? 'selection-tabs__item--active' : ''}`} onClick={() => setActiveTab('failed')}>未选记录<Text>{records.filter((record) => record.status === 'failed').length}</Text></View>
          </View>
          {activeTab === 'all' && !!summary.pending.length && <View className='selection-tip'><View /><Text>{summary.pending.length} 门课程仍待确认，最终结果以教务系统为准</Text></View>}
          <View className='selection-heading'><Text>{activeTab === 'failed' ? '未选课程' : '全部课程'}</Text><Text>{displayedRecords.length} 门</Text></View>
          {displayedRecords.map((record) => {
            const meta = statusMeta[record.status]
            return <View key={record.id} className='selection-card' hoverClass='selection-card--pressed' onClick={() => { setActiveRecord(record); setSheet('detail') }}>
              <View className={`selection-card__status selection-card__status--${record.status}`}><View /><Text>{meta.label}</Text></View>
              <Text className='selection-card__name'>{record.courseName}</Text>
              <Text className='selection-card__type'>{record.courseType} · {record.credit} 学分</Text>
              {record.resultText && <Text className='selection-card__result'>{record.resultText}</Text>}
              <View className='selection-card__line'><Text>{record.teacher || '教师待定'}</Text><Text>{record.schedule || '时间待定'}</Text></View>
              <View className='selection-card__footer'><Text>{record.location || '地点待定'}</Text><Text>查看详情 ›</Text></View>
            </View>
          })}
          {!displayedRecords.length && <View className='academic-empty'><View className='academic-empty__art'><View /><View /></View><Text className='academic-empty__title'>{activeTab === 'failed' ? '本学期没有未选记录' : '本学期暂无课程记录'}</Text><Text className='academic-empty__copy'>切换学期或下拉刷新再看看</Text></View>}
        </>}
      </View>
      {sheet && <View className='academic-overlay' onClick={() => setSheet(null)}><View className={`academic-sheet academic-sheet--${sheet}`} onClick={requestWechatSubscriptionAndStopPropagation}><View className='academic-sheet__handle' /><View className='academic-sheet__close' onClick={() => setSheet(null)}>×</View>
        {sheet === 'period' && <View className='academic-sheet__body'><Text className='academic-sheet__title'>选择选课学期</Text><Text className='academic-sheet__subtitle'>查看不同学期的选课结果</Text><View className='period-options'>{periods.map((period) => <View key={period.id} className={`period-options__item ${preferences.schedulePeriodId === period.id ? 'period-options__item--active' : ''}`} onClick={() => { updatePeriod(period.id); setSheet(null) }}><View><Text>{period.label}</Text><Text>查看该学期选课记录</Text></View><View className='period-options__check'>{preferences.schedulePeriodId === period.id ? '✓' : ''}</View></View>)}</View></View>}
        {sheet === 'detail' && activeRecord && (
          <View className='academic-sheet__body'>
            <View className={`selection-detail__badge selection-detail__badge--${activeRecord.status}`}>
              {statusMeta[activeRecord.status].label}
            </View>
            <Text className='academic-sheet__title'>{activeRecord.courseName}</Text>
            <Text className='academic-sheet__subtitle'>
              {[activeRecord.courseCode, activeRecord.courseType].filter(Boolean).join(' · ')}
            </Text>
            <View className='detail-list'>
              {activeRecord.teacher && <View><Text>授课教师</Text><Text>{activeRecord.teacher}</Text></View>}
              {activeRecord.schedule && <View><Text>上课时间</Text><Text>{activeRecord.schedule}</Text></View>}
              {activeRecord.location && <View><Text>上课地点</Text><Text>{activeRecord.location}</Text></View>}
              {activeRecord.campus && <View><Text>开课校区</Text><Text>{activeRecord.campus}</Text></View>}
              {activeRecord.capacity > 0 && <View><Text>课程容量</Text><Text>{activeRecord.enrolled} / {activeRecord.capacity} 人</Text></View>}
              {activeRecord.selectedAt && <View><Text>选课时间</Text><Text>{activeRecord.selectedAt}</Text></View>}
            </View>
            <View className='academic-notice'>
              <Text>{activeRecord.resultText ? '修读情况/成绩' : '选课状态'}</Text>
              <Text>
                {activeRecord.resultText
                  || activeRecord.note
                  || statusMeta[activeRecord.status].description}
              </Text>
            </View>
            <CoursePassRatePreview
              courseCode={activeRecord.courseCode}
              courseName={activeRecord.courseName}
              teacherName={activeRecord.teacher}
            />
            {activeRecord.status === 'selected' && (
              <View className='course-market-actions'>
                <View>
                  <Text>{isQualificationEdition ? '新版课程服务' : '学习准备'}</Text>
                  <Text>{isQualificationEdition ? '课程相关生活服务已迁移' : '发现课程资料，或求购对应课本'}</Text>
                </View>
                <View className='course-market-actions__buttons'>
                  {isQualificationEdition ? (
                    <View onClick={() => openCourseMaterialPage()}>前往新版</View>
                  ) : (<>
                    <View onClick={() => openCourseMaterialPage()}>发现资料</View>
                    <View onClick={openCourseTrade}>求购课本</View>
                  </>)}
                </View>
              </View>
            )}
            <View className='academic-button academic-button--full' onClick={() => setSheet(null)}>
              知道了
            </View>
          </View>
        )}
      </View></View>}
    </View>
  )
}
