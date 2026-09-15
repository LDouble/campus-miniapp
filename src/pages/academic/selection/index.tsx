import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { getActiveAcademicUserId } from '../../../api/academic-credential'
import type { AcademicCacheMetadata } from '../../../api/types'
import { requestWechatSubscriptionAndStopPropagation } from '../../../features/wechat-subscription'
import { isQualificationEdition } from '../../../features/app-edition'
import { openMigratedFeaturePage } from '../../../features/app-edition/navigation'
import {
  openCourseMarketplacePublisher,
  openCourseMarketplaceSearch,
} from '../../../features/life-services/marketplace-prefill'
import { openCourseMaterials } from '../../../features/course-materials/navigation'
import CoursePassRatePreview from '../../../features/academic-statistics/course-pass-rate-preview'
import { consumeAcademicRefreshAfterVerification } from '../../../features/academic-verification/refresh-signal'
import { isAcademicBindingRequiredError } from '../../../features/academic-verification/binding-guidance'
import AcademicHeader from '../components/academic-header'
import { AcademicCacheNotice, AcademicLoadState } from '../components/academic-load-state'
import { academicRepository } from '../repository'
import { academicStorage } from '../storage'
import { AcademicPeriod, AcademicPreferences, CourseSelectionRecord, CourseSelectionStatus } from '../types'
import { getPeriodLabel, resolveNextPeriodId, resolvePeriodId } from '../utils'
import '../index.scss'
import './selection-sheet.scss'

const DEFAULT_PERIOD_ID = '2025-2026-2'
const COURSE_TRADE_GUIDE_DURATION_MS = 3000
const ACADEMIC_CHEVRON = require('../../../assets/icons/academic-chevron-down.svg')

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
  const [preferences, setPreferences] = useState<AcademicPreferences>(() => {
    const stored = academicStorage.getPreferences(defaultPreferences)
    const defaultPeriodId = resolveNextPeriodId(initialScheduleCache?.periods || [])
      || defaultPreferences.schedulePeriodId
    return {
      ...defaultPreferences,
      ...stored,
      section: 'schedule',
      // 选课结果默认查看当前学期的未来一个学期，没有未来学期时回退到当前学期。
      schedulePeriodId: defaultPeriodId,
    }
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
  const [courseTradeGuideVisible, setCourseTradeGuideVisible] = useState(false)
  const [pageShowCount, setPageShowCount] = useState(0)
  const selectionsRequestRef = useRef(0)
  const firstPageShowRef = useRef(true)
  const courseTradeGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedRecords = useMemo(() => (
    records.filter((record) => record.status === 'selected')
  ), [records])
  const summary = useMemo(() => ({
    pending: records.filter((item) => item.status === 'pending'),
  }), [records])
  const displayedRecords = useMemo(() => (
    activeTab === 'failed'
      ? records.filter((record) => record.status === 'failed')
      : records
  ), [activeTab, records])
  const firstSelectedRecordId = useMemo(() => (
    selectedRecords[0]?.id || ''
  ), [selectedRecords])
  const hasSelectedPeriod = periods.some((period) => (
    period.id === preferences.schedulePeriodId
  ))
  // 每个学期选项按现有最小触控高度估算；短列表保持紧凑，超出视口后交给 ScrollView。
  const periodSheetScrollHeight = `min(calc(76vh - 80rpx - env(safe-area-inset-bottom)), ${112 + periods.length * 128}rpx)`

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
    setPageShowCount((current) => current + 1)
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
      const periodId = resolveNextPeriodId(result) || resolvePeriodId(result, preferences.schedulePeriodId)
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
          const schedulePeriodId = resolveNextPeriodId(result) || resolvePeriodId(result, current.schedulePeriodId)
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
  useEffect(() => {
    if (!pageShowCount || loading || isQualificationEdition || !firstSelectedRecordId) return
    if (courseTradeGuideTimerRef.current) clearTimeout(courseTradeGuideTimerRef.current)
    setCourseTradeGuideVisible(true)
    courseTradeGuideTimerRef.current = setTimeout(() => {
      setCourseTradeGuideVisible(false)
      courseTradeGuideTimerRef.current = null
    }, COURSE_TRADE_GUIDE_DURATION_MS)
    return () => {
      if (courseTradeGuideTimerRef.current) clearTimeout(courseTradeGuideTimerRef.current)
      courseTradeGuideTimerRef.current = null
    }
  }, [firstSelectedRecordId, loading, pageShowCount])
  Taro.usePullDownRefresh(() => refreshSelections(true).finally(() => Taro.stopPullDownRefresh()))

  const updatePeriod = (schedulePeriodId: string) => {
    setPreferences((current) => ({ ...current, schedulePeriodId }))
  }
  const openSelectionDetail = (record: CourseSelectionRecord) => {
    setActiveRecord(record)
    setSheet('detail')
  }
  const openCourseTrade = (record: CourseSelectionRecord) => {
    setCourseTradeGuideVisible(false)
    if (courseTradeGuideTimerRef.current) {
      clearTimeout(courseTradeGuideTimerRef.current)
      courseTradeGuideTimerRef.current = null
    }
    if (isQualificationEdition) {
      setSheet(null)
      void openMigratedFeaturePage({ module: 'marketplace' })
      return
    }
    const courseName = record.courseName.trim()
    setSheet(null)
    const prefill = {
      intent: 'wanted',
      description: `求购《${courseName}》课程使用的课本，版本和成色可沟通。`,
      courseName,
      courseCode: record.courseCode,
      academicPeriodId: record.periodId,
      academicPeriodLabel: getPeriodLabel(periods, record.periodId),
      source: 'course_selection',
    } as const
    void openCourseMarketplaceSearch(prefill)
  }
  const openBulkCourseTrade = () => {
    if (!selectedRecords.length) return
    const periodLabel = getPeriodLabel(periods, preferences.schedulePeriodId)
    const courseList = selectedRecords.map((record, index) => (
      `${index + 1}. ${record.courseName}${record.courseCode ? `（${record.courseCode}）` : ''}`
    ))
    void openCourseMarketplacePublisher({
      intent: 'wanted',
      description: [
        `求购${periodLabel}以下课程使用的教材：`,
        ...courseList,
        '',
        '教材版本、成色和价格都可以沟通，可分开联系。',
      ].join('\n'),
      courseName: `${periodLabel}教材（${selectedRecords.length}门）`,
      courseCode: '',
      academicPeriodId: preferences.schedulePeriodId,
      academicPeriodLabel: periodLabel,
      source: 'course_selection',
    })
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
        <View><Text>{getPeriodLabel(periods, preferences.schedulePeriodId)}</Text><Image className='academic-toolbar__chevron' src={ACADEMIC_CHEVRON} mode='aspectFit' /></View>
      </View>
      <View className='academic-toolbar__hint'><View /><Text>结果同步中</Text></View>
    </View>
  )

  return (
    <View className='academic-page academic-page--selection'>
      <View className='academic-page__glow academic-page__glow--two' />
      <AcademicHeader title='选课结果' toolbar={toolbar} />
      <View className='academic-content'>
        {loading ? <View className='academic-state'><View className='academic-state__loader' /><Text>正在同步选课结果…</Text></View> : (
          isAcademicBindingRequiredError(loadError)
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
          {!!selectedRecords.length && !isQualificationEdition && (
            <View
              className='selection-bulk-purchase'
              ariaRole='button'
              ariaLabel={`一键求购本学期${selectedRecords.length}门课程教材`}
              onClick={openBulkCourseTrade}
            >
              <View>
                <Text>一键求购本学期教材</Text>
                <Text>已带入 {selectedRecords.length} 门已选课程，确认预算后发布</Text>
              </View>
              <Text>{selectedRecords.length} 门 ›</Text>
            </View>
          )}
          <View className='selection-tabs'>
            <View className={`selection-tabs__item ${activeTab === 'all' ? 'selection-tabs__item--active' : ''}`} onClick={() => setActiveTab('all')}>全部记录</View>
            <View className={`selection-tabs__item ${activeTab === 'failed' ? 'selection-tabs__item--active' : ''}`} onClick={() => setActiveTab('failed')}>未选记录<Text>{records.filter((record) => record.status === 'failed').length}</Text></View>
          </View>
          {activeTab === 'all' && !!summary.pending.length && <View className='selection-tip'><View /><Text>{summary.pending.length} 门课程仍待确认，最终结果以教务系统为准</Text></View>}
          <View className='selection-heading'><Text>{activeTab === 'failed' ? '未选课程' : '全部课程'}</Text><Text>{displayedRecords.length} 门</Text></View>
          {displayedRecords.map((record) => {
            const meta = statusMeta[record.status]
            const showCourseTradeAction = record.status === 'selected' && !isQualificationEdition
            const showCourseTradeGuide = showCourseTradeAction
              && record.id === firstSelectedRecordId
              && courseTradeGuideVisible
            return <View key={record.id} className='selection-card' onClick={() => openSelectionDetail(record)}>
              <View className={`selection-card__status selection-card__status--${record.status}`}><View /><Text>{meta.label}</Text></View>
              <Text className='selection-card__name'>{record.courseName}</Text>
              <Text className='selection-card__type'>{record.courseType} · {record.credit} 学分</Text>
              {record.resultText && <Text className='selection-card__result'>{record.resultText}</Text>}
              <View className='selection-card__line'><Text>{record.teacher || '教师待定'}</Text><Text>{record.schedule || '时间待定'}</Text></View>
              <View className={`selection-card__footer ${showCourseTradeAction ? 'selection-card__footer--with-book' : ''}`}>
                <Text>{record.location || '地点待定'}</Text>
                <View className='selection-card__footer-actions'>
                  {showCourseTradeAction && (
                    <View
                      className='selection-card__book-action'
                      ariaRole='button'
                      ariaLabel={`为${record.courseName}求购课本`}
                      onClick={(event) => {
                        event.stopPropagation()
                        openCourseTrade(record)
                      }}
                    >
                      <Text>求购课本</Text>
                      {showCourseTradeGuide && (
                        <Text className='selection-card__book-guide'>去闲置找二手书</Text>
                      )}
                    </View>
                  )}
                  <Text>查看详情 ›</Text>
                </View>
              </View>
            </View>
          })}
          {!displayedRecords.length && <View className='academic-empty'><View className='academic-empty__art'><View /><View /></View><Text className='academic-empty__title'>{activeTab === 'failed' ? '本学期没有未选记录' : '本学期暂无课程记录'}</Text><Text className='academic-empty__copy'>切换学期或下拉刷新再看看</Text></View>}
        </>}
      </View>
      {sheet && <View className='academic-overlay selection-sheet-overlay' catchMove onClick={() => setSheet(null)}><View className={`academic-sheet selection-sheet academic-sheet--${sheet}`} catchMove onClick={requestWechatSubscriptionAndStopPropagation}><View className='academic-sheet__handle' /><View className='academic-sheet__close' onClick={() => setSheet(null)}>×</View>
        {sheet === 'period' && <ScrollView className='selection-sheet__scroll selection-sheet__scroll--period' style={{ height: periodSheetScrollHeight }} scrollY enhanced showScrollbar={false}><View className='selection-sheet__scroll-content'><View className='academic-sheet__body'><Text className='academic-sheet__title'>选择选课学期</Text><Text className='academic-sheet__subtitle'>查看不同学期的选课结果</Text><View className='period-options'>{periods.map((period) => <View key={period.id} className={`period-options__item ${preferences.schedulePeriodId === period.id ? 'period-options__item--active' : ''}`} onClick={() => { updatePeriod(period.id); setSheet(null) }}><View><Text>{period.label}</Text><Text>查看该学期选课记录</Text></View><View className='period-options__check'>{preferences.schedulePeriodId === period.id ? '✓' : ''}</View></View>)}</View></View></View></ScrollView>}
        {sheet === 'detail' && activeRecord && <ScrollView className='selection-sheet__scroll' scrollY enhanced showScrollbar={false}>
          <View className='selection-sheet__scroll-content'>
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
                  <Text>{isQualificationEdition ? '课程相关生活服务已迁移' : '查看课程资料与学习参考'}</Text>
                </View>
                <View className='course-market-actions__buttons'>
                  {isQualificationEdition ? (
                    <View onClick={() => openCourseMaterialPage()}>前往新版</View>
                  ) : <View onClick={() => openCourseMaterialPage()}>发现资料</View>}
                </View>
              </View>
            )}
            <View className='academic-button academic-button--full' onClick={() => setSheet(null)}>
              知道了
            </View>
              </View>
          </View>
        </ScrollView>}
      </View></View>}
    </View>
  )
}
