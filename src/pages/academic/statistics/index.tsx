import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { requestWechatSubscriptionAndStopPropagation } from '../../../features/wechat-subscription'
import {
  CourseStatistics,
  getCourseStatistics,
  getInstructorStatisticsTrend,
  InstructorPassRate,
} from '../../../features/academic-statistics/repository'
import {
  academicStatisticsTermKey,
  formatAcademicStatisticsTerm,
} from '../../../features/academic-statistics/term-label'
import type { AcademicPassRateTrend } from '../../../api/types'
import { getSystemState } from '../../../state/system'
import {
  academicBindingGuidance,
  isAcademicBindingRequiredError,
  openAcademicCredentialBinding,
} from '../../../features/academic-verification/binding-guidance'
import AcademicLoadStateCard from '../../../features/academic-verification/academic-load-state'
import { consumeAcademicRefreshAfterVerification } from '../../../features/academic-verification/refresh-signal'
import { apiDateTimeCampusParts } from '../../../utils/date-time'
import './index.scss'

type TrendMetric = 'pass_rate' | 'average_score'

const formatPublishedDate = (value: string) => {
  const parts = apiDateTimeCampusParts(value)
  return parts ? `${parts.year}/${parts.month}/${parts.day}` : '时间待确认'
}

const confidenceText = {
  sample_limited: '样本较少',
  reference: '可供参考',
  sufficient: '样本较充足',
} as const

const decodeParam = (value?: string) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const normalizeTeacher = (value: string) => value.replace(/\s+/g, '')

const distributionRows = (statistics: CourseStatistics) => {
  const distribution = statistics.overview.distribution
  const rows = [
    {
      label: '优秀',
      count: distribution.score_90_100_count + distribution.level_excellent_count,
      tone: 'excellent',
    },
    {
      label: '良好',
      count: distribution.score_80_89_count + distribution.level_good_count,
      tone: 'good',
    },
    {
      label: '中等',
      count: distribution.score_70_79_count + distribution.level_medium_count,
      tone: 'medium',
    },
    {
      label: '及格',
      count: distribution.score_60_69_count + distribution.level_pass_count,
      tone: 'pass',
    },
    {
      label: '不及格',
      count: distribution.numeric_fail_count + distribution.level_fail_count,
      tone: 'fail',
    },
  ]
  return rows.map((row) => ({
    ...row,
    ratio: statistics.overview.valid_count > 0
      ? row.count / statistics.overview.valid_count
      : 0,
  }))
}

const drawTrend = (
  trend: AcademicPassRateTrend,
  metric: TrendMetric,
  selectedIndex: number,
) => {
  const points = trend.points
  if (points.length < 2) return
  const { windowWidth } = getSystemState().windowInfo
  const width = Math.max(280, Math.floor(windowWidth * (1 - 112 / 750)))
  const height = 176
  const padding = { top: 18, right: 16, bottom: 16, left: 16 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const context = Taro.createCanvasContext('academic-pass-rate-chart')

  context.setStrokeStyle('rgba(83, 133, 127, 0.12)')
  context.setLineWidth(1)
  ;[0, 0.5, 1].forEach((ratio) => {
    const y = padding.top + plotHeight * ratio
    context.beginPath()
    context.moveTo(padding.left, y)
    context.lineTo(width - padding.right, y)
    context.stroke()
  })

  const coordinates = points.map((point, index) => {
    const raw = metric === 'pass_rate'
      ? point.pass_rate * 100
      : point.average_score || 0
    return {
      x: padding.left + (plotWidth * index) / (points.length - 1),
      y: padding.top + plotHeight * (1 - Math.max(0, Math.min(100, raw)) / 100),
    }
  })

  context.beginPath()
  coordinates.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.setStrokeStyle('#55aeb5')
  context.setLineWidth(3)
  context.setLineCap('round')
  context.setLineJoin('round')
  context.stroke()

  coordinates.forEach((point, index) => {
    context.beginPath()
    context.arc(point.x, point.y, index === selectedIndex ? 5 : 3.5, 0, Math.PI * 2)
    context.setFillStyle(index === selectedIndex ? '#e98c70' : '#ffffff')
    context.fill()
    context.setStrokeStyle(index === selectedIndex ? '#e98c70' : '#55aeb5')
    context.setLineWidth(2)
    context.stroke()
  })
  context.draw()
}

export default function AcademicStatisticsPage() {
  const router = useRouter()
  const courseCode = decodeParam(router.params.course_code).trim()
  const courseName = decodeParam(router.params.course_name).trim()
  const currentTeacherName = decodeParam(router.params.teacher_name).trim()
  const [statistics, setStatistics] = useState<CourseStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [fromCache, setFromCache] = useState(false)
  const [metric, setMetric] = useState<TrendMetric>('pass_rate')
  const [selectedPoint, setSelectedPoint] = useState(0)
  const [selectedTeacher, setSelectedTeacher] = useState<InstructorPassRate | null>(null)
  const [teacherTrend, setTeacherTrend] = useState<AcademicPassRateTrend | null>(null)
  const [teacherTrendLoading, setTeacherTrendLoading] = useState(false)

  const load = useCallback(async () => {
    if (!courseCode) {
      setLoadError(new Error('缺少课程编号，暂时无法查询'))
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const result = await getCourseStatistics(courseCode)
      setStatistics(result.data)
      setFromCache(result.fromCache)
      setSelectedPoint(Math.max(0, result.data.trend.points.length - 1))
    } catch (error) {
      setLoadError(error)
    } finally {
      setLoading(false)
    }
  }, [courseCode])

  useEffect(() => {
    void load()
  }, [load])

  Taro.useDidShow(() => {
    if (consumeAcademicRefreshAfterVerification(
      Taro,
      '/pages/academic/statistics/index',
    )) {
      void load()
    }
  })

  Taro.usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const sortedInstructors = useMemo(() => {
    if (!statistics) return []
    const normalizedCurrent = normalizeTeacher(currentTeacherName)
    return [...statistics.instructors].sort((left, right) => {
      const leftCurrent = normalizeTeacher(left.teacher_name) === normalizedCurrent
      const rightCurrent = normalizeTeacher(right.teacher_name) === normalizedCurrent
      if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1
      return right.valid_count - left.valid_count
    })
  }, [currentTeacherName, statistics])

  const points = statistics ? statistics.trend.points : []
  const activePoint = points[selectedPoint] || null

  useEffect(() => {
    if (selectedTeacher || !statistics || statistics.trend.points.length < 2) return
    const timer = setTimeout(() => {
      drawTrend(statistics.trend, metric, selectedPoint)
    }, 80)
    return () => clearTimeout(timer)
  }, [metric, selectedPoint, selectedTeacher, statistics])

  const openTeacher = (teacher: InstructorPassRate) => {
    setSelectedTeacher(teacher)
    setTeacherTrend(null)
    setTeacherTrendLoading(true)
    getInstructorStatisticsTrend(courseCode, teacher.teacher_key)
      .then(setTeacherTrend)
      .catch(() => setTeacherTrend(null))
      .finally(() => setTeacherTrendLoading(false))
  }

  const title = statistics?.overview.course_name || courseName || '课程参考'
  const distributions = statistics ? distributionRows(statistics) : []
  const bindingRequired = isAcademicBindingRequiredError(loadError)
  const errorMessage = bindingRequired
    ? academicBindingGuidance.message
    : loadError instanceof Error
      ? loadError.message
      : '课程参考加载失败'

  return (
    <View className={`statistics-page ${selectedTeacher ? 'statistics-page--locked' : ''}`}>
      <View className='statistics-page__glow statistics-page__glow--warm' />
      <View className='statistics-page__glow statistics-page__glow--teal' />
      <CustomNavbar title='课程参考' subtitle={courseCode} showBack />
      <View className='statistics-page__content'>
        {loading && (
          <View className='statistics-state'>
            <View className='statistics-state__loader' />
            <Text>正在整理历史数据…</Text>
          </View>
        )}
        {!loading && Boolean(loadError) && (
          bindingRequired ? (
            <AcademicLoadStateCard
              title={academicBindingGuidance.title}
              message={errorMessage}
              actionLabel={academicBindingGuidance.actionLabel}
              onAction={() => { void openAcademicCredentialBinding() }}
            />
          ) : (
            <View className='statistics-empty'>
              <View className='statistics-empty__art'><View /><View /></View>
              <Text className='statistics-empty__title'>暂时没有可展示的数据</Text>
              <Text className='statistics-empty__copy'>{errorMessage}</Text>
              <View
                className='statistics-empty__action'
                ariaRole='button'
                ariaLabel='重新加载课程统计'
                onClick={() => { void load() }}
              >重新加载</View>
            </View>
          )
        )}
        {!loading && statistics && !loadError && (
          <>
            <View className='statistics-hero'>
              <Text className='statistics-hero__course'>{title}</Text>
              <Text className='statistics-hero__meta'>
                {statistics.overview.term_count} 个学期 · {statistics.overview.valid_count} 份有效成绩
              </Text>
              <View className='statistics-hero__metrics'>
                <View className='statistics-hero__primary'>
                  <Text>{formatPercent(statistics.overview.pass_rate)}</Text>
                  <Text>历史通过率</Text>
                </View>
                <View>
                  <Text>
                    {statistics.overview.average_score === undefined
                      ? '—'
                      : statistics.overview.average_score.toFixed(1)}
                  </Text>
                  <Text>百分制平均分</Text>
                </View>
                <View>
                  <Text>{confidenceText[statistics.overview.confidence]}</Text>
                  <Text>样本状态</Text>
                </View>
              </View>
              {fromCache && <Text className='statistics-hero__cache'>网络异常，已展示上次统计结果</Text>}
            </View>

            <View className='statistics-section'>
              <View className='statistics-section__heading'>
                <View>
                  <Text>成绩段分布</Text>
                  <Text>百分制与等级制按对应档位合并</Text>
                </View>
              </View>
              <View className='distribution-card'>
                {distributions.map((row) => (
                  <View key={row.label} className='distribution-row'>
                    <Text>{row.label}</Text>
                    <View className='distribution-row__track'>
                      <View
                        className={`distribution-row__fill distribution-row__fill--${row.tone}`}
                        style={{ width: `${Math.max(row.ratio * 100, row.count ? 2 : 0)}%` }}
                      />
                    </View>
                    <Text>{formatPercent(row.ratio)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='statistics-section'>
              <View className='statistics-section__heading statistics-section__heading--trend'>
                <View>
                  <Text>学期趋势</Text>
                  <Text>仅展示达到隐私样本门槛的学期</Text>
                </View>
                <View className='trend-switch'>
                  <View
                    className={metric === 'pass_rate' ? 'trend-switch__item--active' : ''}
                    ariaRole='button'
                    ariaLabel='查看通过率趋势'
                    onClick={() => setMetric('pass_rate')}
                  >通过率</View>
                  <View
                    className={metric === 'average_score' ? 'trend-switch__item--active' : ''}
                    ariaRole='button'
                    ariaLabel='查看平均分趋势'
                    onClick={() => setMetric('average_score')}
                  >平均分</View>
                </View>
              </View>
              <View className='trend-card'>
                {points.length >= 2 ? (
                  <>
                    {!selectedTeacher && (
                      <View className='trend-chart'>
                        <Canvas
                          className='trend-chart__canvas'
                          canvasId='academic-pass-rate-chart'
                        />
                        <View className='trend-chart__touches'>
                          {points.map((point, index) => (
                            <View
                              key={academicStatisticsTermKey(point)}
                              onClick={() => setSelectedPoint(index)}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    <View className='trend-labels'>
                      {points.map((point, index) => (
                        <Text
                          key={academicStatisticsTermKey(point)}
                          className={index === selectedPoint ? 'trend-labels__active' : ''}
                        >
                          {formatAcademicStatisticsTerm(point)}
                        </Text>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text className='trend-card__single'>当前只有一个学期达到展示条件</Text>
                )}
                {activePoint && (
                  <View className='trend-detail'>
                    <View>
                      <Text>{formatAcademicStatisticsTerm(activePoint)}</Text>
                      <Text>{activePoint.valid_count} 份有效成绩</Text>
                    </View>
                    <View>
                      <Text>{formatPercent(activePoint.pass_rate)}</Text>
                      <Text>通过率</Text>
                    </View>
                    <View>
                      <Text>
                        {activePoint.average_score === undefined
                          ? '—'
                          : activePoint.average_score.toFixed(1)}
                      </Text>
                      <Text>平均分</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View className='statistics-section'>
              <View className='statistics-section__heading'>
                <View>
                  <Text>历史授课教师</Text>
                  <Text>样本较多的教师优先展示，不代表教学排名</Text>
                </View>
              </View>
              <View className='instructor-list'>
                {sortedInstructors.map((teacher) => {
                  const isCurrent = normalizeTeacher(teacher.teacher_name)
                    === normalizeTeacher(currentTeacherName)
                  return (
                    <View
                      key={teacher.teacher_key}
                      className={`instructor-card ${isCurrent ? 'instructor-card--current' : ''}`}
                      ariaRole='button'
                      ariaLabel={`查看${teacher.teacher_name}的历史统计`}
                      onClick={() => openTeacher(teacher)}
                    >
                      <View className='instructor-card__identity'>
                        <View>
                          <Text>{teacher.teacher_name}</Text>
                          {isCurrent && <Text>当前授课教师</Text>}
                        </View>
                        <Text>{teacher.term_count} 学期 · {teacher.valid_count} 份样本</Text>
                      </View>
                      <View className='instructor-card__metric'>
                        <Text>{formatPercent(teacher.pass_rate)}</Text>
                        <Text>通过率</Text>
                      </View>
                      <View className='instructor-card__metric'>
                        <Text>{teacher.average_score === undefined ? '—' : teacher.average_score.toFixed(1)}</Text>
                        <Text>平均分</Text>
                      </View>
                      <Text className='instructor-card__arrow'>›</Text>
                    </View>
                  )
                })}
                {!sortedInstructors.length && (
                  <View className='instructor-empty'>暂时没有教师数据达到展示条件</View>
                )}
              </View>
            </View>

            <View className='statistics-privacy'>
              <Text>数据说明</Text>
              <Text>数据来自历史成绩的匿名聚合，仅供选课和复习参考，不代表教师教学质量。平均分仅统计百分制成绩。</Text>
              <Text>统计更新于 {formatPublishedDate(statistics.publishedAt)}</Text>
            </View>
          </>
        )}
      </View>

      {selectedTeacher && (
        <View className='statistics-overlay' onClick={() => setSelectedTeacher(null)}>
          <View className='statistics-sheet' onClick={requestWechatSubscriptionAndStopPropagation}>
            <View className='statistics-sheet__handle' />
            <View
              className='statistics-sheet__close'
              ariaRole='button'
              ariaLabel='关闭教师统计详情'
              onClick={() => setSelectedTeacher(null)}
            >×</View>
            <Text className='statistics-sheet__title'>{selectedTeacher.teacher_name}</Text>
            <Text className='statistics-sheet__subtitle'>{title} · 历史聚合数据</Text>
            <View className='teacher-summary'>
              <View><Text>{formatPercent(selectedTeacher.pass_rate)}</Text><Text>通过率</Text></View>
              <View><Text>{selectedTeacher.average_score === undefined ? '—' : selectedTeacher.average_score.toFixed(1)}</Text><Text>平均分</Text></View>
              <View><Text>{selectedTeacher.valid_count}</Text><Text>有效样本</Text></View>
            </View>
            <Text className='statistics-sheet__section-title'>学期记录</Text>
            {teacherTrendLoading && <Text className='teacher-trend-empty'>正在加载教师趋势…</Text>}
            {!teacherTrendLoading && teacherTrend && teacherTrend.points.length > 0 && (
              <View className='teacher-trend-list'>
                {teacherTrend.points.map((point) => (
                  <View key={academicStatisticsTermKey(point)}>
                    <Text>{formatAcademicStatisticsTerm(point)}</Text>
                    <Text>{formatPercent(point.pass_rate)}</Text>
                    <Text>{point.average_score === undefined ? '等级制' : `${point.average_score.toFixed(1)} 分`}</Text>
                    <Text>{point.valid_count} 份</Text>
                  </View>
                ))}
              </View>
            )}
            {!teacherTrendLoading && (!teacherTrend || !teacherTrend.points.length) && (
              <Text className='teacher-trend-empty'>暂无可展示的分学期记录</Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
