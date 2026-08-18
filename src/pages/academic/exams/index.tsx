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
import { openCourseMaterials } from '../../../features/course-materials/navigation'
import { openCourseMarketplacePublisher } from '../../../features/life-services/marketplace-prefill'
import { consumeAcademicRefreshAfterVerification } from '../../../features/academic-verification/refresh-signal'
import AcademicHeader from '../components/academic-header'
import { AcademicCacheNotice, AcademicLoadState } from '../components/academic-load-state'
import { academicRepository } from '../repository'
import { academicStorage } from '../storage'
import {
  AcademicPeriod,
  AcademicPreferences,
  ExamRecord,
} from '../types'
import {
  formatExamDate,
  formatExamTime,
  getExamStatus,
  getExamStatusLabel,
  getPeriodLabel,
  parseDate,
  resolvePeriodId,
} from '../utils'
import '../index.scss'

const DEFAULT_PERIOD_ID = '2025-2026-2'
const defaultPreferences: AcademicPreferences = {
  section: 'exams',
  schedulePeriodId: DEFAULT_PERIOD_ID,
  gradePeriodId: DEFAULT_PERIOD_ID,
  examPeriodId: DEFAULT_PERIOD_ID,
  week: 6,
  selectedWeekday: 1,
  scheduleView: 'week',
}
type ExamSheet = 'period' | 'exam-detail' | null

export default function ExamsPage() {
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
    section: 'exams',
  })
  const initialExams = initialRecordsCache?.examsByPeriod[preferences.examPeriodId]
  const initialUpdatedAt = initialRecordsCache
    ?.examsUpdatedAtByPeriod[preferences.examPeriodId] || 0
  const [periods, setPeriods] = useState<AcademicPeriod[]>(
    initialScheduleCache?.periods || [],
  )
  const [exams, setExams] = useState<ExamRecord[]>(initialExams || [])
  const [loading, setLoading] = useState(!initialUpdatedAt)
  const [retrying, setRetrying] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [usingCache, setUsingCache] = useState(Boolean(initialUpdatedAt))
  const [serverCache, setServerCache] = useState<AcademicCacheMetadata | null>(null)
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(initialUpdatedAt)
  const [sheet, setSheet] = useState<ExamSheet>(null)
  const [activeExam, setActiveExam] = useState<ExamRecord | null>(null)
  const examsRequestRef = useRef(0)
  const firstPageShowRef = useRef(true)

  const visibleExams = useMemo(() => exams
    .sort((left, right) => {
      const leftFinished = getExamStatus(left) === 'finished'
      const rightFinished = getExamStatus(right) === 'finished'
      if (leftFinished !== rightFinished) return leftFinished ? 1 : -1
      return parseDate(left.startAt).getTime() - parseDate(right.startAt).getTime()
    }), [exams])
  const groupedExams = useMemo(() => visibleExams.reduce<Record<string, ExamRecord[]>>((groups, exam) => {
    const date = exam.startAt.slice(0, 10)
    groups[date] = [...(groups[date] || []), exam]
    return groups
  }, {}), [visibleExams])
  const hasSelectedPeriod = periods.some((period) => period.id === preferences.examPeriodId)

  useEffect(() => {
    academicRepository.getPeriods()
      .then((records) => {
        setPeriods(records)
        if (!records.length) setLoading(false)
        setPreferences((current) => {
          const examPeriodId = resolvePeriodId(records, current.examPeriodId)
          return examPeriodId === current.examPeriodId
            ? current
            : { ...current, examPeriodId }
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

  const refreshExams = useCallback(async (
    manual = false,
    periodId = preferences.examPeriodId,
  ) => {
    const requestId = ++examsRequestRef.current
    const cache = academicStorage.getRecordsCache(academicUserId)
    const cached = cache?.examsByPeriod[periodId]
    const updatedAt = cache?.examsUpdatedAtByPeriod[periodId] || 0
    setExams(cached || [])
    setCacheUpdatedAt(updatedAt)
    setUsingCache(Boolean(cached))
    setServerCache(null)
    if (!updatedAt) setLoading(true)
    if (manual) setRetrying(true)
    setLoadError(null)
    try {
      const result = await academicRepository.getExams(periodId)
      if (examsRequestRef.current !== requestId) return
      const records = result.records
      academicStorage.setExamRecords(academicUserId, periodId, records)
      setExams(records)
      setCacheUpdatedAt(Date.now())
      setUsingCache(false)
      setServerCache(result.cache || null)
    } catch (error) {
      if (examsRequestRef.current !== requestId) return
      if (updatedAt) {
        setUsingCache(true)
        setLoadError(error)
        Taro.showToast({ title: '已展示上次考试安排', icon: 'none' })
      } else {
        setLoadError(error)
      }
    } finally {
      if (examsRequestRef.current === requestId) {
        setLoading(false)
        setRetrying(false)
      }
    }
  }, [academicUserId, preferences.examPeriodId])

  Taro.useDidShow(() => {
    if (!firstPageShowRef.current && !hasSelectedPeriod) return
    const shouldRefresh = consumeAcademicRefreshAfterVerification(
      Taro,
      '/pages/academic/exams/index',
    )
    if (firstPageShowRef.current) {
      firstPageShowRef.current = false
      return
    }
    if (shouldRefresh && hasSelectedPeriod) void refreshExams(false)
  })

  const retryPage = useCallback(async () => {
    setRetrying(true)
    setLoadError(null)
    try {
      const records = await academicRepository.getPeriods({ force: true })
      const periodId = resolvePeriodId(records, preferences.examPeriodId)
      if (!periodId) throw new Error('academic period unavailable')
      setPeriods(records)
      setPreferences((current) => ({ ...current, examPeriodId: periodId }))
      if (hasSelectedPeriod && periodId === preferences.examPeriodId) {
        await refreshExams(false, periodId)
      } else {
        setLoading(true)
      }
    } catch (error) {
      setLoadError(error)
    } finally {
      setRetrying(false)
      setLoading(false)
    }
  }, [hasSelectedPeriod, preferences.examPeriodId, refreshExams])

  useEffect(() => {
    if (!hasSelectedPeriod) return
    void refreshExams()
  }, [hasSelectedPeriod, refreshExams])

  useEffect(() => academicStorage.setPreferences(preferences), [preferences])

  Taro.usePullDownRefresh(() => {
    refreshExams(true).finally(() => Taro.stopPullDownRefresh())
  })

  const updatePreferences = (patch: Partial<AcademicPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch, section: 'exams' }))
  }

  const openExamMaterials = () => {
    if (!activeExam) return
    setSheet(null)
    if (isQualificationEdition) {
      void openMigratedFeaturePage({ module: 'course_materials' })
      return
    }
    void openCourseMaterials({
      courseName: activeExam.courseName,
      periodId: activeExam.periodId,
      periodLabel: getPeriodLabel(periods, activeExam.periodId),
      source: 'exams',
    })
  }

  const openExamTextbookPublisher = () => {
    if (!activeExam) return
    const courseName = activeExam.courseName.trim()
    setSheet(null)
    if (isQualificationEdition) {
      void openMigratedFeaturePage({ module: 'marketplace' })
      return
    }
    void openCourseMarketplacePublisher({
      intent: 'sell',
      description: `出售《${courseName}》课程使用过的课本，版本和成色可沟通。`,
      courseName,
      courseCode: '',
      academicPeriodId: activeExam.periodId,
      academicPeriodLabel: getPeriodLabel(periods, activeExam.periodId),
      source: 'schedule',
    })
  }

  const toolbar = (
    <View className='academic-toolbar academic-toolbar--simple'>
      <View className='academic-toolbar__period' onClick={() => setSheet('period')}>
        <Text className='academic-toolbar__label'>考试学期</Text>
        <View>
          <Text>{getPeriodLabel(periods, preferences.examPeriodId)}</Text>
          <Text className='academic-toolbar__chevron'>⌄</Text>
        </View>
      </View>
      <View className='academic-toolbar__hint'>
        <View />
        <Text>动态更新</Text>
      </View>
    </View>
  )

  const renderSheet = () => {
    if (!sheet) return null
    return (
      <View className='academic-overlay' onClick={() => setSheet(null)}>
        <View className={`academic-sheet academic-sheet--${sheet}`} onClick={requestWechatSubscriptionAndStopPropagation}>
          <View className='academic-sheet__handle' />
          <View className='academic-sheet__close' onClick={() => setSheet(null)}>×</View>
          {sheet === 'period' && (
            <View className='academic-sheet__body'>
              <Text className='academic-sheet__title'>选择考试学期</Text>
              <Text className='academic-sheet__subtitle'>查看不同学期的考试记录</Text>
              <View className='period-options'>
                {periods.map((period) => (
                  <View
                    key={period.id}
                    className={`period-options__item ${preferences.examPeriodId === period.id ? 'period-options__item--active' : ''}`}
                    onClick={() => {
                      updatePreferences({ examPeriodId: period.id })
                      setSheet(null)
                    }}
                  >
                    <View>
                      <Text>{period.label}</Text>
                      <Text>查看考试安排与考场信息</Text>
                    </View>
                    <View className='period-options__check'>
                      {preferences.examPeriodId === period.id ? '✓' : ''}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          {sheet === 'exam-detail' && activeExam && (
            <View className='academic-sheet__body'>
              <View className='exam-detail__badge'>{getExamStatusLabel(activeExam)}</View>
              <Text className='academic-sheet__title'>{activeExam.courseName}</Text>
              <Text className='academic-sheet__subtitle'>
                {formatExamDate(activeExam.startAt)} · {formatExamTime(activeExam.startAt, activeExam.endAt)}
              </Text>
              <View className='detail-list'>
                <View><Text>考试校区</Text><Text>{activeExam.campus}</Text></View>
                <View><Text>考试地点</Text><Text>{activeExam.location}</Text></View>
                <View><Text>座位信息</Text><Text>{activeExam.seat}</Text></View>
                <View><Text>考试阶段</Text><Text>{activeExam.phase}</Text></View>
                <View><Text>考试方式</Text><Text>{activeExam.method}</Text></View>
                <View><Text>携带材料</Text><Text>{activeExam.materials}</Text></View>
              </View>
              <View className='academic-notice'>
                <Text>考场提醒</Text>
                <Text>{activeExam.notice}</Text>
              </View>
              <View className='course-resource-actions course-resource-actions--standalone'>
                <View className='course-resource-actions__primary' onClick={openExamMaterials}>
                  <View>
                    <Text>{isQualificationEdition ? '新版课程服务' : '发现资料'}</Text>
                    <Text>{isQualificationEdition ? '课程相关生活服务已迁移' : '发现这门课的笔记、真题和复习资料'}</Text>
                  </View>
                  <Text>去发现 ›</Text>
                </View>
                {!isQualificationEdition && (
                  <View className='course-resource-actions__secondary course-resource-actions__secondary--single'>
                    <View onClick={openExamTextbookPublisher}>出售课本</View>
                  </View>
                )}
              </View>
              <View className='academic-button academic-button--full' onClick={() => setSheet(null)}>知道了</View>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className={`academic-page academic-page--exams ${sheet ? 'academic-page--locked' : ''}`}>
      <View className='academic-page__glow academic-page__glow--one' />
      <AcademicHeader title='考试安排' toolbar={toolbar} />
      <View className='academic-content'>
        {loading ? (
          <View className='academic-state'>
            <View className='academic-state__loader' />
            <Text>正在整理考试安排…</Text>
          </View>
        ) : (
          loadError instanceof AcademicCredentialMissingError
          || (loadError && !usingCache)
        ) ? (
          <AcademicLoadState error={loadError} retrying={retrying} onRetry={retryPage} />
        ) : (
          <>
            <AcademicCacheNotice
              cache={serverCache}
              updatedAt={!usingCache && !loadError ? cacheUpdatedAt : 0}
              localUpdatedAt={usingCache ? cacheUpdatedAt : 0}
              localFallback={Boolean(loadError)}
            />
            <View className='exam-hero'>
              <View>
                <Text className='exam-hero__eyebrow'>考试日程</Text>
                <Text className='exam-hero__title'>
                  {exams.filter((exam) => getExamStatus(exam) !== 'finished').length} 场考试待完成
                </Text>
              </View>
              <View className='exam-hero__mark'><View /><Text>准时</Text></View>
            </View>
            {Object.entries(groupedExams).map(([date, records]) => (
              <View key={date} className='exam-group'>
                <View className='exam-group__heading'>
                  <Text>{formatExamDate(`${date} 00:00`)}</Text>
                  <Text>{records.length} 场</Text>
                </View>
                {records.map((exam) => {
                  const status = getExamStatus(exam)
                  return (
                    <View
                      key={exam.id}
                      className={`exam-card exam-card--${status}`}
                      hoverClass='exam-card--pressed'
                      onClick={() => {
                        setActiveExam(exam)
                        setSheet('exam-detail')
                      }}
                    >
                      <View className='exam-card__status'><View /><Text>{getExamStatusLabel(exam)}</Text></View>
                      <Text className='exam-card__name'>{exam.courseName}</Text>
                      <View className='exam-card__line'>
                        <Text className='exam-card__label'>时间</Text>
                        <Text>{formatExamTime(exam.startAt, exam.endAt)}</Text>
                      </View>
                      <View className='exam-card__line'>
                        <Text className='exam-card__label'>考场</Text>
                        <Text>{exam.location} · {exam.seat}</Text>
                      </View>
                      <View className='exam-card__footer'>
                        <Text>{exam.phase} · {exam.method}</Text>
                        <Text>查看详情 ›</Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            ))}
            {!visibleExams.length && (
              <View className='academic-empty'>
                <View className='academic-empty__art'><View /><View /></View>
                <Text className='academic-empty__title'>本学期暂未安排考试</Text>
                <Text className='academic-empty__copy'>切换学期再看看</Text>
              </View>
            )}
          </>
        )}
      </View>
      {renderSheet()}
    </View>
  )
}
