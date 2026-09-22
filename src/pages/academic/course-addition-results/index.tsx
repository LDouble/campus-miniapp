import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  getActiveAcademicUserId,
  loadAcademicCredential,
  type AcademicEducationLevel,
} from '../../../api/academic-credential'
import type { AcademicCacheMetadata } from '../../../api/types'
import { requestWechatSubscriptionAndStopPropagation } from '../../../features/wechat-subscription'
import { consumeAcademicRefreshAfterVerification } from '../../../features/academic-verification/refresh-signal'
import { isAcademicBindingRequiredError } from '../../../features/academic-verification/binding-guidance'
import AcademicHeader from '../components/academic-header'
import { AcademicCacheNotice, AcademicLoadState } from '../components/academic-load-state'
import { academicRepository } from '../repository'
import { academicStorage } from '../storage'
import type {
  AcademicPeriod,
  CourseAdditionResultRecord,
} from '../types'
import { getPeriodLabel, resolveDefaultPeriodId } from '../utils'
import '../index.scss'
import './index.scss'

const ACADEMIC_CHEVRON = require('../../../assets/icons/academic-chevron-down.svg')

const getEducationLevel = (platformUserId: number): AcademicEducationLevel => {
  try {
    return loadAcademicCredential(platformUserId).educationLevel
  } catch {
    return 'undergraduate'
  }
}

type AdditionSheet = 'period' | 'detail' | null

export default function CourseAdditionResultsPage() {
  const [academicUserId] = useState(getActiveAcademicUserId)
  const [initialScheduleCache] = useState(() => (
    academicStorage.getScheduleCache(academicUserId)
  ))
  const [initialRecordsCache] = useState(() => (
    academicStorage.getRecordsCache(academicUserId)
  ))
  const [educationLevel] = useState<AcademicEducationLevel>(() => (
    getEducationLevel(academicUserId)
  ))
  const [periods, setPeriods] = useState<AcademicPeriod[]>(
    initialScheduleCache?.periods || [],
  )
  const [selectedPeriodId, setSelectedPeriodId] = useState(() => (
    resolveDefaultPeriodId(initialScheduleCache?.periods || [])
  ))
  const initialRecords = initialRecordsCache?.additionsByPeriod[selectedPeriodId]
  const initialUpdatedAt = initialRecordsCache
    ?.additionsUpdatedAtByPeriod[selectedPeriodId] || 0
  const [records, setRecords] = useState<CourseAdditionResultRecord[]>(
    initialRecords || [],
  )
  const [loading, setLoading] = useState(!initialUpdatedAt)
  const [retrying, setRetrying] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [usingCache, setUsingCache] = useState(Boolean(initialUpdatedAt))
  const [serverCache, setServerCache] = useState<AcademicCacheMetadata | null>(null)
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(initialUpdatedAt)
  const [sheet, setSheet] = useState<AdditionSheet>(null)
  const [activeRecord, setActiveRecord] = useState<CourseAdditionResultRecord | null>(null)
  const additionsRequestRef = useRef(0)
  const firstPageShowRef = useRef(true)

  const isGraduate = educationLevel === 'graduate'
  const hasSelectedPeriod = periods.some((period) => period.id === selectedPeriodId)

  const refreshAdditions = useCallback(async (
    manual = false,
    periodId = selectedPeriodId,
  ) => {
    if (isGraduate) return
    const requestId = ++additionsRequestRef.current
    const cache = academicStorage.getRecordsCache(academicUserId)
    const cached = cache?.additionsByPeriod[periodId]
    const updatedAt = cache?.additionsUpdatedAtByPeriod[periodId] || 0
    setRecords(cached || [])
    setCacheUpdatedAt(updatedAt)
    setUsingCache(Boolean(cached))
    setServerCache(null)
    if (!updatedAt) setLoading(true)
    if (manual) setRetrying(true)
    setLoadError(null)
    try {
      const result = await academicRepository.getCourseAdditionResults(periodId)
      if (additionsRequestRef.current !== requestId) return
      academicStorage.setAdditionRecords(academicUserId, periodId, result.records)
      setRecords(result.records)
      setCacheUpdatedAt(Date.now())
      setUsingCache(false)
      setServerCache(result.cache || null)
    } catch (error) {
      if (additionsRequestRef.current !== requestId) return
      if (updatedAt) {
        setUsingCache(true)
        setLoadError(error)
        Taro.showToast({ title: '已展示上次加课结果', icon: 'none' })
      } else {
        setLoadError(error)
      }
    } finally {
      if (additionsRequestRef.current === requestId) {
        setLoading(false)
        setRetrying(false)
      }
    }
  }, [academicUserId, isGraduate, selectedPeriodId])

  useEffect(() => {
    academicRepository.getPeriods({ force: true })
      .then((nextPeriods) => {
        setPeriods(nextPeriods)
        if (!nextPeriods.length) setLoading(false)
        setSelectedPeriodId((current) => {
          const next = resolveDefaultPeriodId(nextPeriods)
          if (!next) return current
          return next === current ? current : next
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

  Taro.useDidShow(() => {
    const shouldRefresh = consumeAcademicRefreshAfterVerification(
      Taro,
      '/pages/academic/course-addition-results/index',
    )
    if (firstPageShowRef.current) {
      firstPageShowRef.current = false
      return
    }
    if (shouldRefresh) void refreshAdditions(false)
  })

  const retryPage = useCallback(async () => {
    setRetrying(true)
    setLoadError(null)
    try {
      const nextPeriods = await academicRepository.getPeriods({ force: true })
      const periodId = resolveDefaultPeriodId(nextPeriods)
      if (!periodId) throw new Error('academic period unavailable')
      setPeriods(nextPeriods)
      setSelectedPeriodId(periodId)
      await refreshAdditions(false, periodId)
    } catch (error) {
      setLoadError(error)
    } finally {
      setRetrying(false)
      setLoading(false)
    }
  }, [refreshAdditions])

  useEffect(() => {
    if (!hasSelectedPeriod || isGraduate) return
    void refreshAdditions()
  }, [hasSelectedPeriod, isGraduate, refreshAdditions])

  Taro.usePullDownRefresh(() => {
    refreshAdditions(true).finally(() => Taro.stopPullDownRefresh())
  })

  const selectPeriod = (periodId: string) => {
    setSelectedPeriodId(periodId)
    setSheet(null)
  }

  const openDetail = (record: CourseAdditionResultRecord) => {
    setActiveRecord(record)
    setSheet('detail')
  }

  const toolbar = (
    <View className='academic-toolbar academic-toolbar--simple'>
      <View className='academic-toolbar__period' onClick={() => setSheet('period')}>
        <View>
          <Text>{getPeriodLabel(periods, selectedPeriodId)}</Text>
          <Image className='academic-toolbar__chevron' src={ACADEMIC_CHEVRON} mode='aspectFit' />
        </View>
      </View>
      <View className='academic-toolbar__hint'>
        <View />
        <Text>结果同步中</Text>
      </View>
    </View>
  )

  return (
    <View className={`academic-page academic-page--addition ${sheet ? 'academic-page--locked' : ''}`}>
      <View className='academic-page__glow academic-page__glow--one' />
      <AcademicHeader title='加课结果' toolbar={toolbar} />
      <View className='academic-content'>
        {isGraduate ? (
          <View className='academic-empty'>
            <View className='academic-empty__art'><View /><View /></View>
            <Text className='academic-empty__title'>研究生暂不支持加课结果</Text>
            <Text className='academic-empty__copy'>加课结果查询目前仅面向本科生开放</Text>
          </View>
        ) : loading ? (
          <View className='academic-state'>
            <View className='academic-state__loader' />
            <Text>正在同步加课结果…</Text>
          </View>
        ) : (
          isAcademicBindingRequiredError(loadError)
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
            <View className='addition-hero'>
              <View>
                <Text className='addition-hero__eyebrow'>加课申请</Text>
                <Text className='addition-hero__number'>{records.length}<Text> 条申请</Text></Text>
                <Text className='addition-hero__copy'>审核状态以教务系统返回为准</Text>
              </View>
              <View className='addition-hero__seal'><Text>加课</Text><Text>结果</Text></View>
            </View>
            {records.map((record) => (
              <View key={record.id} className='addition-card' onClick={() => openDetail(record)}>
                <View className='addition-card__status'><View /><Text>{record.auditText || '状态未知'}</Text></View>
                <Text className='addition-card__name'>{record.courseName}</Text>
                <View className='addition-card__line'>
                  <Text className='addition-card__label'>课程号</Text>
                  <Text>{record.courseCode || '—'}</Text>
                </View>
                <View className='addition-card__line'>
                  <Text className='addition-card__label'>选课号</Text>
                  <Text>{record.selectionCode || '—'}</Text>
                </View>
                <View className='addition-card__line'>
                  <Text className='addition-card__label'>教学班</Text>
                  <Text>{record.teachingClass || '—'}</Text>
                </View>
                <View className='addition-card__footer'>
                  <Text>{record.teacher || '教师待定'}</Text>
                  <Text>查看详情 ›</Text>
                </View>
              </View>
            ))}
            {!records.length && (
              <View className='academic-empty'>
                <View className='academic-empty__art'><View /><View /></View>
                <Text className='academic-empty__title'>本学期暂无加课申请</Text>
                <Text className='academic-empty__copy'>切换学期或下拉刷新再看看</Text>
              </View>
            )}
          </>
        )}
      </View>
      {sheet && (
        <View className='academic-overlay' onClick={() => setSheet(null)}>
          <View className={`academic-sheet academic-sheet--${sheet}`} onClick={requestWechatSubscriptionAndStopPropagation}>
            <View className='academic-sheet__handle' />
            <View className='academic-sheet__close' onClick={() => setSheet(null)}>×</View>
            {sheet === 'period' && (
              <View className='academic-sheet__body'>
                <Text className='academic-sheet__title'>选择加课学期</Text>
                <Text className='academic-sheet__subtitle'>查看不同学期的加课申请结果</Text>
                <View className='period-options'>
                  {periods.map((period) => (
                    <View
                      key={period.id}
                      className={`period-options__item ${selectedPeriodId === period.id ? 'period-options__item--active' : ''}`}
                      onClick={() => selectPeriod(period.id)}
                    >
                      <View>
                        <Text>{period.label}</Text>
                        <Text>查看该学期加课申请</Text>
                      </View>
                      <View className='period-options__check'>
                        {selectedPeriodId === period.id ? '✓' : ''}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {sheet === 'detail' && activeRecord && (
              <View className='academic-sheet__body'>
                <View className='addition-detail__badge'>{activeRecord.auditText || '状态未知'}</View>
                <Text className='academic-sheet__title'>{activeRecord.courseName}</Text>
                <Text className='academic-sheet__subtitle'>
                  {[activeRecord.courseCode, activeRecord.selectionCode].filter(Boolean).map((code) => code).join(' · ')}
                </Text>
                <View className='detail-list'>
                  <View><Text>授课教师</Text><Text>{activeRecord.teacher || '—'}</Text></View>
                  <View><Text>教学班</Text><Text>{activeRecord.teachingClass || '—'}</Text></View>
                  <View><Text>课程号</Text><Text>{activeRecord.courseCode || '—'}</Text></View>
                  <View><Text>选课号</Text><Text>{activeRecord.selectionCode || '—'}</Text></View>
                  <View><Text>学期</Text><Text>{activeRecord.periodName || getPeriodLabel(periods, activeRecord.periodId)}</Text></View>
                </View>
                <View className='academic-notice'>
                  <Text>审核状态</Text>
                  <Text>{activeRecord.auditText || '状态未知'}</Text>
                </View>
                <View className='academic-button academic-button--full' onClick={() => setSheet(null)}>知道了</View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
