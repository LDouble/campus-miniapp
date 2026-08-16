import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { getActiveAcademicUserId } from '../../../api/academic-credential'
import type { AcademicCacheMetadata } from '../../../api/types'
import { requestWechatSubscriptionAndStopPropagation } from '../../../features/wechat-subscription'
import { isQualificationEdition } from '../../../features/app-edition'
import { openMigratedFeaturePage } from '../../../features/app-edition/navigation'
import {
  getMiniappRuntimeConfig,
  getSectionStartTime,
  getSelectedCampus,
  loadMiniappRuntimeConfig,
} from '../../../features/runtime-config'
import {
  openCourseMarketplacePublisher,
  openCourseMarketplaceSearch,
  type MarketplaceIntent,
} from '../../../features/life-services/marketplace-prefill'
import {
  openCourseMaterials,
  shareCourseMaterials,
} from '../../../features/course-materials/navigation'
import CoursePassRatePreview from '../../../features/academic-statistics/course-pass-rate-preview'
import AcademicHeader from '../components/academic-header'
import { AcademicCacheNotice, AcademicLoadState } from '../components/academic-load-state'
import { findCourseConflicts } from '../calculations'
import { academicRepository } from '../repository'
import {
  CoursesByPeriod,
  getCourseScheduleKey,
  getCoursesForPeriod,
  getCoursesForWeek,
  requireCoursesForPeriod,
  sanitizeCoursesByPeriod,
  setCoursesForPeriod,
} from '../schedule-courses'
import { academicStorage } from '../storage'
import {
  AcademicPeriod,
  AcademicPreferences,
  Course,
  CustomCourseDraft,
} from '../types'
import {
  courseColors,
  formatCourseWeeks,
  formatPeriodStartDate,
  formatMonthDay,
  getCurrentTeachingWeek,
  getWeekDates,
  isSameDay,
  resolvePeriodId,
  resolveScheduleAnchor,
  weekdays,
} from '../utils'
import '../index.scss'

const DEFAULT_PERIOD_ID = '2025-2026-2'
const icons = {
  semester: require('../../../assets/icons/calendar.svg'),
}
const defaultPreferences: AcademicPreferences = {
  section: 'schedule',
  schedulePeriodId: DEFAULT_PERIOD_ID,
  gradePeriodId: DEFAULT_PERIOD_ID,
  examPeriodId: DEFAULT_PERIOD_ID,
  week: 1,
  selectedWeekday: 1,
  scheduleView: 'week',
}

type ScheduleSheet = 'period' | 'week' | 'course-detail' | 'course-form' | null

const emptyDraft = (periodId: string): CustomCourseDraft => ({
  periodId,
  name: '',
  teacher: '',
  location: '',
  weekday: 1,
  startSection: 1,
  endSection: 2,
  weeks: [1, 2, 3, 4, 5, 6, 7, 8],
  color: 'aqua',
})

interface CourseDetailCardProps {
  course: Course
  currentWeek: number
  onEdit?: () => void
  onDelete?: () => void
  onWanted: () => void
  onSell: () => void
  onFindMaterials: () => void
  onShareMaterials: () => void
}

const isCourseInWeek = (course: Course, week: number) => course.weeks.includes(week)

function CourseDetailCard({
  course,
  currentWeek,
  onEdit,
  onDelete,
  onWanted,
  onSell,
  onFindMaterials,
  onShareMaterials,
}: CourseDetailCardProps) {
  const isCurrentWeek = isCourseInWeek(course, currentWeek)
  return (
    <View className={[
      'course-conflict-card',
      `course-conflict-card--${course.color}`,
      isCurrentWeek ? '' : 'course-conflict-card--inactive',
    ].filter(Boolean).join(' ')}
    >
      <View className='course-conflict-card__content'>
        <View className='course-conflict-card__top'>
          <Text className='course-conflict-card__name'>{course.name}</Text>
          <Text className={[
            'course-conflict-card__tag',
            isCurrentWeek ? '' : 'course-conflict-card__tag--inactive',
          ].filter(Boolean).join(' ')}
          >
            {isCurrentWeek ? '' : '非本周 · '}第 {course.startSection}-{course.endSection} 节
          </Text>
        </View>
        <View className='course-conflict-card__details'>
          <View><Text>地点</Text><Text>{course.location || '未填写'}</Text></View>
          <View><Text>教师</Text><Text>{course.teacher || '未填写'}</Text></View>
          <View><Text>周次</Text><Text>{formatCourseWeeks(course.weeks)}</Text></View>
          <View><Text>来源</Text><Text>{course.source === 'custom' ? '自定义课程' : '教务课程'}</Text></View>
        </View>
        {course.source === 'official' && course.courseCode && (
          <CoursePassRatePreview
            courseCode={course.courseCode}
            courseName={course.name}
            teacherName={course.teacher}
          />
        )}
        {course.source === 'custom' && onEdit && onDelete && (
          <View className='course-conflict-card__actions'>
            <View onClick={onDelete}>删除</View>
            <View onClick={onEdit}>编辑</View>
          </View>
        )}
        <View className='course-resource-actions course-resource-actions--course-card'>
          <View className='course-resource-actions__primary' onClick={onFindMaterials}>
            <View>
              <Text>{isQualificationEdition ? '新版课程服务' : '查看课程资料'}</Text>
              <Text>{isQualificationEdition ? '课程相关生活服务已迁移' : '已带入课程与当前学期'}</Text>
            </View>
            <Text>查看 ›</Text>
          </View>
          {!isQualificationEdition && <View className='course-resource-actions__secondary'>
            <View onClick={onShareMaterials}>分享资料</View>
            <View onClick={onWanted}>求购教材</View>
            <View onClick={onSell}>转卖教材</View>
          </View>}
        </View>
      </View>
    </View>
  )
}

export default function SchedulePage() {
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [campusName, setCampusName] = useState(() => (
    getSelectedCampus(getMiniappRuntimeConfig())
  ))
  const [academicUserId] = useState(getActiveAcademicUserId)
  const [initialScheduleCache] = useState(() => (
    academicStorage.getScheduleCache(academicUserId)
  ))
  const [preferences, setPreferences] = useState<AcademicPreferences>({
    ...defaultPreferences,
    ...academicStorage.getPreferences(defaultPreferences),
    section: 'schedule',
  })
  const [periods, setPeriods] = useState<AcademicPeriod[]>(
    initialScheduleCache ? initialScheduleCache.periods : [],
  )
  const initialCoursesByPeriod = sanitizeCoursesByPeriod(
    initialScheduleCache?.coursesByPeriod || {},
  )
  const hasInitialCourses = Object.prototype.hasOwnProperty.call(
    initialCoursesByPeriod,
    preferences.schedulePeriodId,
  )
  const [officialCoursesByPeriod, setOfficialCoursesByPeriod] = useState<CoursesByPeriod>(
    initialCoursesByPeriod,
  )
  const [customCourses, setCustomCourses] = useState<Course[]>(academicStorage.getCustomCourses())
  const [loading, setLoading] = useState(!hasInitialCourses)
  const [retrying, setRetrying] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [usingCache, setUsingCache] = useState(hasInitialCourses)
  const [serverCache, setServerCache] = useState<AcademicCacheMetadata | null>(null)
  const [showRefreshGuide, setShowRefreshGuide] = useState(() => (
    !academicStorage.hasSeenScheduleRefreshGuideToday()
  ))
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(
    initialScheduleCache
      ?.coursesUpdatedAtByPeriod[preferences.schedulePeriodId] || 0,
  )
  const [initialized, setInitialized] = useState(false)
  const [sheet, setSheet] = useState<ScheduleSheet>(null)
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)
  const [activeSlotCourses, setActiveSlotCourses] = useState<Course[]>([])
  const [courseDraft, setCourseDraft] = useState<CustomCourseDraft>(
    emptyDraft(preferences.schedulePeriodId),
  )

  const schedulePeriod = periods.find((period) => period.id === preferences.schedulePeriodId)
  const sectionTimes = Array.from({ length: 12 }, (_, index) => (
    getSectionStartTime(runtimeConfig, campusName, index + 1)
  ))
  const weekDates = getWeekDates(schedulePeriod, preferences.week)
  const officialCourses = getCoursesForPeriod(
    officialCoursesByPeriod,
    preferences.schedulePeriodId,
  )
  const allCourses = useMemo(() => [
    ...officialCourses,
    ...customCourses.filter((course) => course.periodId === preferences.schedulePeriodId),
  ], [customCourses, officialCourses, preferences.schedulePeriodId])
  const weekCourses = useMemo(
    () => getCoursesForWeek(allCourses, preferences.week),
    [allCourses, preferences.week],
  )
  const dayCourses = useMemo(
    () => weekCourses
      .filter((course) => course.weekday === preferences.selectedWeekday)
      .sort((left, right) => (
        left.startSection - right.startSection
        || left.id.localeCompare(right.id)
      )),
    [preferences.selectedWeekday, weekCourses],
  )

  useEffect(() => {
    let active = true
    loadMiniappRuntimeConfig().then((config) => {
      if (!active) return
      setRuntimeConfig(config)
      setCampusName(getSelectedCampus(config))
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const applyPeriods = (records: AcademicPeriod[]) => {
      setPeriods(records)
      if (!records.length) setLoading(false)
      setPreferences((current) => {
        const { periodId: schedulePeriodId, week } = resolveScheduleAnchor(records)
        if (
          schedulePeriodId === current.schedulePeriodId
          && week === current.week
        ) return current
        return {
          ...current,
          schedulePeriodId,
          week,
          selectedWeekday: 1,
        }
      })
      setInitialized(true)
    }

    let active = true
    academicRepository.getPeriods()
      .then((records) => {
        if (!active) return
        const currentCache = academicStorage.getScheduleCache(academicUserId)
        academicStorage.setScheduleCache(
          academicUserId,
          records,
          currentCache ? currentCache.coursesByPeriod : {},
          currentCache?.coursesUpdatedAtByPeriod || {},
        )
        applyPeriods(records)
      })
      .catch((error) => {
        if (!active) return
        if (initialScheduleCache && initialScheduleCache.periods.length) {
          applyPeriods(initialScheduleCache.periods)
          setUsingCache(true)
          setServerCache(null)
          setLoadError(error)
          Taro.showToast({ title: '网络异常，已使用本地课表', icon: 'none' })
          return
        }
        setLoading(false)
        setLoadError(error)
      })
    return () => {
      active = false
    }
  }, [academicUserId, initialScheduleCache])

  useEffect(() => {
    if (!initialized) return
    const periodId = preferences.schedulePeriodId
    if (!periods.some((period) => period.id === periodId)) return
    const cache = academicStorage.getScheduleCache(academicUserId)
    const hasCachedCourses = Boolean(
      cache
      && Object.prototype.hasOwnProperty.call(
        cache.coursesByPeriod,
        periodId,
      )
    )
    if (hasCachedCourses && cache) {
      const cachedCourses = getCoursesForPeriod(cache.coursesByPeriod, periodId)
      setOfficialCoursesByPeriod((current) => (
        setCoursesForPeriod(current, periodId, cachedCourses)
      ))
      setCacheUpdatedAt(cache.coursesUpdatedAtByPeriod[periodId] || 0)
      setLoading(false)
    }

    let active = true
    setServerCache(null)
    setUsingCache(hasCachedCourses)
    if (!hasCachedCourses) setLoading(true)
    setLoadError(null)
      academicRepository.getCourses(periodId)
      .then((result) => {
        const courses = requireCoursesForPeriod(result.records, periodId)
        const currentCache = academicStorage.getScheduleCache(academicUserId)
        const updatedAt = Date.now()
        academicStorage.setScheduleCache(
          academicUserId,
          periods,
          setCoursesForPeriod(
            currentCache ? currentCache.coursesByPeriod : {},
            periodId,
            courses,
          ),
          {
            ...(currentCache?.coursesUpdatedAtByPeriod || {}),
            [periodId]: updatedAt,
          },
        )
        if (active) {
          setOfficialCoursesByPeriod((current) => (
            setCoursesForPeriod(current, periodId, courses)
          ))
          setCacheUpdatedAt(updatedAt)
          setUsingCache(false)
          setServerCache(result.cache || null)
        }
      })
      .catch((error) => {
        if (!active) return
        if (hasCachedCourses) {
          setUsingCache(true)
          setLoadError(error)
          Taro.showToast({ title: '已展示上次课程表', icon: 'none' })
        } else {
          setLoadError(error)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [academicUserId, initialized, periods, preferences.schedulePeriodId])

  useEffect(() => academicStorage.setPreferences(preferences), [preferences])
  useEffect(() => academicStorage.setCustomCourses(customCourses), [customCourses])

  useEffect(() => {
    if (!showRefreshGuide || loading || sheet) return undefined
    const timer = setTimeout(() => {
      setShowRefreshGuide(false)
      academicStorage.markScheduleRefreshGuideSeenToday()
    }, 3000)
    return () => clearTimeout(timer)
  }, [loading, sheet, showRefreshGuide])

  const updatePreferences = (patch: Partial<AcademicPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch, section: 'schedule' }))
  }

  const refreshSchedule = async () => {
    const cache = academicStorage.getScheduleCache(academicUserId)
    const hasCachedCourses = Boolean(
      cache
      && Object.prototype.hasOwnProperty.call(
        cache.coursesByPeriod,
        preferences.schedulePeriodId,
      )
    )
    if (!hasCachedCourses) setLoading(true)
    setRetrying(true)
    setLoadError(null)
    setServerCache(null)
    setUsingCache(hasCachedCourses)
    try {
      const records = await academicRepository.getPeriods()
      const schedulePeriodId = resolvePeriodId(records, preferences.schedulePeriodId)
      const resolvedPeriod = records.find((period) => period.id === schedulePeriodId)
      const courseResult = schedulePeriodId
        ? await academicRepository.getCourses(schedulePeriodId)
        : undefined
      const courses = courseResult
        ? requireCoursesForPeriod(courseResult.records, schedulePeriodId)
        : []
      const currentCache = academicStorage.getScheduleCache(academicUserId)
      const updatedAt = Date.now()
      academicStorage.setScheduleCache(
        academicUserId,
        records,
        schedulePeriodId
          ? setCoursesForPeriod(
            currentCache ? currentCache.coursesByPeriod : {},
            schedulePeriodId,
            courses,
          )
          : sanitizeCoursesByPeriod(currentCache?.coursesByPeriod || {}),
        schedulePeriodId
          ? {
            ...(currentCache?.coursesUpdatedAtByPeriod || {}),
            [schedulePeriodId]: updatedAt,
          }
          : currentCache?.coursesUpdatedAtByPeriod || {},
      )
      setPeriods(records)
      if (schedulePeriodId) {
        setOfficialCoursesByPeriod((current) => (
          setCoursesForPeriod(current, schedulePeriodId, courses)
        ))
      }
      setCacheUpdatedAt(schedulePeriodId ? updatedAt : 0)
      setUsingCache(false)
      setServerCache(courseResult?.cache || null)
      setPreferences((current) => ({
        ...current,
        schedulePeriodId,
        week: resolvedPeriod && resolvedPeriod.isCurrent
          ? getCurrentTeachingWeek(resolvedPeriod)
          : 1,
        selectedWeekday: 1,
      }))
      Taro.showToast({ title: '课程表已刷新', icon: 'success' })
    } catch (error) {
      if (hasCachedCourses) {
        setUsingCache(true)
        setLoadError(error)
        Taro.showToast({ title: '刷新失败，继续展示上次课程表', icon: 'none' })
      } else {
        setLoadError(error)
      }
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }

  Taro.usePullDownRefresh(() => {
    setShowRefreshGuide(false)
    academicStorage.markScheduleRefreshGuideSeenToday()
    refreshSchedule().finally(() => Taro.stopPullDownRefresh())
  })

  const isCourseOverlap = (left: Course, right: Course) => (
    left.weekday === right.weekday
    && left.startSection <= right.endSection
    && right.startSection <= left.endSection
  )

  const openCourse = (course: Course) => {
    setActiveCourse(course)
    setActiveSlotCourses(allCourses.filter((item) => isCourseOverlap(item, course)))
    setSheet('course-detail')
  }

  const openTimeSlot = (weekday: number, section: number) => {
    const slotCourses = allCourses.filter((course) => (
      course.weekday === weekday
      && course.startSection <= section
      && course.endSection >= section
    )).sort((left, right) => (
      Number(isCourseInWeek(right, preferences.week))
        - Number(isCourseInWeek(left, preferences.week))
      || left.id.localeCompare(right.id)
    ))
    if (!slotCourses.length) return
    setActiveCourse(slotCourses[0])
    setActiveSlotCourses(slotCourses)
    setSheet('course-detail')
  }

  const closeCourseFloat = () => {
    setSheet(null)
    setActiveCourse(null)
    setActiveSlotCourses([])
  }

  const openCourseTrade = (course: Course, intent: MarketplaceIntent) => {
    closeCourseFloat()
    if (isQualificationEdition) {
      void openMigratedFeaturePage({ module: 'marketplace' })
      return
    }
    const courseName = course.name.trim()
    const prefill = {
      intent,
      description: intent === 'wanted'
        ? `求购与《${courseName}》相关的教材、笔记或复习资料，版本和成色可沟通。`
        : `转卖与《${courseName}》相关的教材、笔记或复习资料，具体版本和成色可沟通。`,
      courseName,
      courseCode: course.courseCode || '',
      academicPeriodId: course.periodId,
      academicPeriodLabel: periods.find((period) => period.id === course.periodId)?.label || course.periodId,
      source: 'schedule',
    } as const
    if (intent === 'wanted') {
      void openCourseMarketplaceSearch(prefill)
      return
    }
    void openCourseMarketplacePublisher(prefill)
  }
  const openCourseMaterialPage = (course: Course, action?: 'upload') => {
    setSheet(null)
    if (isQualificationEdition) {
      void openMigratedFeaturePage({ module: 'course_materials' })
      return
    }
    const context = {
      courseName: course.name,
      courseCode: course.courseCode,
      periodId: course.periodId,
      periodLabel: periods.find((period) => period.id === course.periodId)?.label,
      source: 'schedule' as const,
    }
    void (action === 'upload'
      ? shareCourseMaterials(context)
      : openCourseMaterials(context))
  }

  const openCourseForm = (course?: Course) => {
    setCourseDraft(course ? {
      id: course.id,
      periodId: course.periodId,
      name: course.name,
      teacher: course.teacher,
      location: course.location,
      weekday: course.weekday,
      startSection: course.startSection,
      endSection: course.endSection,
      weeks: [...course.weeks],
      color: course.color,
    } : emptyDraft(preferences.schedulePeriodId))
    setSheet('course-form')
  }

  const toggleDraftWeek = (week: number) => {
    setCourseDraft((current) => ({
      ...current,
      weeks: current.weeks.includes(week)
        ? current.weeks.filter((item) => item !== week)
        : [...current.weeks, week].sort((left, right) => left - right),
    }))
  }

  const saveCourse = async () => {
    const name = courseDraft.name.trim()
    if (!name || !courseDraft.weeks.length) {
      Taro.showToast({ title: '请填写课程名并选择上课周次', icon: 'none' })
      return
    }
    if (courseDraft.endSection < courseDraft.startSection) {
      Taro.showToast({ title: '结束节次不能早于开始节次', icon: 'none' })
      return
    }

    const conflicts = findCourseConflicts(courseDraft, allCourses)
    if (conflicts.length) {
      const result = await Taro.showModal({
        title: '发现课程冲突',
        content: `与“${conflicts.map((course) => course.name).join('、')}”时间重叠，仍要保存吗？`,
        confirmText: '仍要保存',
        confirmColor: '#4d9ead',
      })
      if (!result.confirm) return
    }

    const record: Course = {
      ...courseDraft,
      id: courseDraft.id || `custom-${Date.now()}`,
      name,
      teacher: courseDraft.teacher.trim(),
      location: courseDraft.location.trim(),
      source: 'custom',
    }
    setCustomCourses((current) => courseDraft.id
      ? current.map((course) => course.id === courseDraft.id ? record : course)
      : [...current, record])
    setActiveCourse(record)
    setActiveSlotCourses([record])
    setSheet('course-detail')
    Taro.showToast({ title: courseDraft.id ? '课程已更新' : '课程已添加', icon: 'success' })
  }

  const deleteCourse = async (course = activeCourse) => {
    if (!course || course.source !== 'custom') return
    const result = await Taro.showModal({
      title: '删除自定义课程',
      content: `确定删除“${course.name}”吗？`,
      confirmColor: '#c56f73',
    })
    if (!result.confirm) return
    setCustomCourses((current) => current.filter((item) => item.id !== course.id))
    const remainingCourses = activeSlotCourses.filter((item) => item.id !== course.id)
    if (!remainingCourses.length) {
      closeCourseFloat()
    } else {
      setActiveSlotCourses(remainingCourses)
      setActiveCourse(remainingCourses[0])
    }
    Taro.showToast({ title: '课程已删除', icon: 'success' })
  }

  const toolbar = (
    <View className='academic-toolbar academic-toolbar--schedule'>
      <View
        className='academic-toolbar__period'
        ariaRole='button'
        ariaLabel='切换学年学期'
        onClick={() => setSheet('period')}
      >
        <Image src={icons.semester} mode='aspectFit' />
        <Text>学期</Text>
      </View>
      <View className='academic-week-stepper'>
        <View
          className='academic-week-stepper__arrow academic-week-stepper__arrow--prev'
          ariaRole='button'
          ariaLabel='上一周'
          onClick={() => updatePreferences({ week: Math.max(1, preferences.week - 1) })}
        />
        <View
          className='academic-week-stepper__label'
          ariaRole='button'
          ariaLabel='选择周次'
          onClick={() => setSheet('week')}
        >
          第 {preferences.week} 周
        </View>
        <View
          className='academic-week-stepper__arrow academic-week-stepper__arrow--next'
          ariaRole='button'
          ariaLabel='下一周'
          onClick={() => updatePreferences({ week: Math.min(schedulePeriod?.weeks || 20, preferences.week + 1) })}
        />
      </View>
      <View
        className={`academic-view-toggle academic-view-toggle--${preferences.scheduleView}`}
        ariaRole='button'
        ariaLabel={`当前${preferences.scheduleView === 'week' ? '周' : '日'}视图，点击切换`}
        onClick={() => updatePreferences({ scheduleView: preferences.scheduleView === 'week' ? 'day' : 'week' })}
      >
        <View className='academic-view-toggle__icon' />
        <Text>{preferences.scheduleView === 'week' ? '周' : '日'}</Text>
      </View>
    </View>
  )

  const renderWeekSchedule = () => (
    <View className='timetable'>
      <View className='timetable__header'>
        <View className='timetable__corner'>节次</View>
        {weekDates.map((date, index) => (
          <View
            key={date.getTime()}
            className={[
              'timetable__date',
              preferences.selectedWeekday === index + 1 ? 'timetable__date--selected' : '',
              isSameDay(date, new Date()) ? 'timetable__date--today' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => updatePreferences({ selectedWeekday: index + 1 })}
          >
            <Text>{weekdays[index].slice(1)}</Text>
            <Text>{formatMonthDay(date)}</Text>
          </View>
        ))}
      </View>
      <View className='timetable__body'>
        {sectionTimes.map((time, index) => (
          <View
            key={time}
            className='timetable__time'
            style={{ gridColumn: '1', gridRow: String(index + 1) }}
          >
            <Text>{index + 1}</Text>
            <Text>{time}</Text>
          </View>
        ))}
        {Array.from({ length: 84 }, (_, index) => {
          const weekday = (index % 7) + 1
          const section = Math.floor(index / 7) + 1
          const slotCourses = weekCourses.filter((course) => (
            course.weekday === weekday
            && course.startSection <= section
            && course.endSection >= section
          ))
          return (
            <View
              key={`cell-${index}`}
              className={`timetable__cell ${slotCourses.length > 1 ? 'timetable__cell--conflict' : ''}`}
              style={{
                gridColumn: String(weekday + 1),
                gridRow: String(section),
              }}
              onClick={() => openTimeSlot(weekday, section)}
            />
          )
        })}
        {allCourses.map((course) => {
          const overlappingCourses = allCourses
            .filter((item) => isCourseOverlap(item, course))
            .sort((left, right) => {
              const leftCurrent = isCourseInWeek(left, preferences.week)
              const rightCurrent = isCourseInWeek(right, preferences.week)
              if (leftCurrent !== rightCurrent) return Number(rightCurrent) - Number(leftCurrent)
              const leftNextWeek = Math.min(
                ...left.weeks.filter((week) => week >= preferences.week),
                Number.POSITIVE_INFINITY,
              )
              const rightNextWeek = Math.min(
                ...right.weeks.filter((week) => week >= preferences.week),
                Number.POSITIVE_INFINITY,
              )
              return leftNextWeek - rightNextWeek || left.id.localeCompare(right.id)
            })
          const primaryCourse = overlappingCourses[0]
          if (course !== primaryCourse) return null
          const overlapCount = overlappingCourses.length
          const currentCourses = overlappingCourses.filter((item) => (
            isCourseInWeek(item, preferences.week)
          ))
          const currentCourseCount = currentCourses.length
          const isCurrentWeek = isCourseInWeek(course, preferences.week)
          const hasConflict = currentCourseCount > 1
          const relatedCount = overlapCount - 1
          const nextCourseWeek = Math.min(
            ...course.weeks.filter((week) => week > preferences.week),
            Number.POSITIVE_INFINITY,
          )
          return (
            <View
              key={getCourseScheduleKey(course)}
              className={[
                'timetable-course',
                `timetable-course--${course.color}`,
                isCurrentWeek ? '' : 'timetable-course--inactive',
                hasConflict ? 'timetable-course--conflict' : '',
                hasConflict ? 'timetable-course--stacked' : '',
                !hasConflict && relatedCount > 0 ? 'timetable-course--related' : '',
              ].filter(Boolean).join(' ')}
              style={{
                gridColumn: String(course.weekday + 1),
                gridRow: `${course.startSection} / span ${course.endSection - course.startSection + 1}`,
              }}
              ariaRole='button'
              ariaLabel={hasConflict
                ? `时间冲突，共 ${currentCourseCount} 门课程，点击查看详情`
                : relatedCount > 0
                  ? `${course.name}，同一时段另有 ${relatedCount} 门其他周次课程`
                  : `${course.name}，第 ${course.startSection} 到 ${course.endSection} 节`}
              hoverClass='timetable-course--pressed'
              onClick={() => openCourse(course)}
            >
              {hasConflict ? (
                <>
                  <View className='timetable-course__conflict-head'>
                    <Text>冲突</Text>
                    <Text className='timetable-course__conflict-count'>{currentCourseCount} 门</Text>
                  </View>
                  <Text className='timetable-course__name'>{course.name} 等</Text>
                  <Text className='timetable-course__location'>点按查看详情</Text>
                </>
              ) : (
                <>
                  <View className='timetable-course__preview-head'>
                    {!isCurrentWeek && Number.isFinite(nextCourseWeek) ? (
                      <Text className='timetable-course__status'>
                        第{nextCourseWeek}周
                        {relatedCount > 0 ? ` +${relatedCount}` : ''}
                      </Text>
                    ) : isCurrentWeek && relatedCount > 0 ? (
                      <Text className='timetable-course__related-count'>+{relatedCount}</Text>
                    ) : null}
                  </View>
                  <Text className='timetable-course__name'>{course.name}</Text>
                  <Text className='timetable-course__location'>
                    {isCurrentWeek ? course.location : formatCourseWeeks(course.weeks)}
                  </Text>
                </>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )

  const renderDaySchedule = () => (
    <View className='day-schedule'>
      <ScrollView className='day-strip' scrollX showScrollbar={false}>
        <View className='day-strip__inner'>
          {weekDates.map((date, index) => (
            <View
              key={date.getTime()}
              className={`day-strip__item ${preferences.selectedWeekday === index + 1 ? 'day-strip__item--active' : ''}`}
              onClick={() => updatePreferences({ selectedWeekday: index + 1 })}
            >
              <Text>{weekdays[index]}</Text>
              <Text>{date.getDate()}</Text>
              {isSameDay(date, new Date()) && <View className='day-strip__today' />}
            </View>
          ))}
        </View>
      </ScrollView>
      {dayCourses.length ? (
        <View className='day-course-list'>
          {dayCourses.map((course) => {
            return (
              <View
                key={getCourseScheduleKey(course)}
                className='day-course'
                hoverClass='day-course--pressed'
                onClick={() => openCourse(course)}
              >
                <View className={`day-course__tone day-course__tone--${course.color}`} />
                <View className='day-course__time'>
                  <Text>
                    {getSectionStartTime(
                      runtimeConfig,
                      course.campus || campusName,
                      course.startSection,
                    )}
                  </Text>
                  <Text>第 {course.startSection}-{course.endSection} 节</Text>
                </View>
                <View className='day-course__main'>
                  <View className='day-course__title-line'>
                    <Text className='day-course__name'>{course.name}</Text>
                  </View>
                  <Text className='day-course__meta'>
                    {[course.location, course.teacher].filter(Boolean).join(' · ') || '自定义课程'}
                  </Text>
                </View>
                <Text className='academic-chevron'>›</Text>
              </View>
            )
          })}
        </View>
      ) : (
        <View className='academic-empty'>
          <View className='academic-empty__art'><View /><View /></View>
          <Text className='academic-empty__title'>这一天没有课程</Text>
          <Text className='academic-empty__copy'>去海边走走，也别忘了完成学习计划</Text>
        </View>
      )}
    </View>
  )

  const renderSheet = () => {
    if (!sheet) return null
    if (sheet === 'course-detail' && activeCourse) {
      const currentSlotCourses = activeSlotCourses.filter((course) => (
        isCourseInWeek(course, preferences.week)
      ))
      const isConflict = currentSlotCourses.length > 1
      const hasRelatedCourses = activeSlotCourses.length > 1
      return (
        <View className='course-float-layer' onClick={closeCourseFloat}>
          <View
            className='course-float-card course-float-card--detail'
            onClick={requestWechatSubscriptionAndStopPropagation}
          >
            <View className='course-float-card__handle' />
            <View className='course-float-card__toolbar'>
              <View>
                <Text className='course-float-card__title'>
                  {isConflict
                    ? `${currentSlotCourses.length} 门课程时间冲突`
                    : hasRelatedCourses
                      ? `同一时段还有 ${activeSlotCourses.length - 1} 门课程`
                      : '课程详情'}
                </Text>
                <Text className='course-float-card__copy'>
                  {isConflict
                    ? '切换课程查看冲突详情与学习服务'
                    : hasRelatedCourses
                      ? '课程周次不同，可切换查看具体安排'
                      : '查看课程安排与相关服务'}
                </Text>
              </View>
              <View
                className='course-float-card__close'
                ariaRole='button'
                ariaLabel='关闭课程详情'
                onClick={(event) => {
                  event.stopPropagation()
                  closeCourseFloat()
                }}
              >
                ×
              </View>
            </View>
            {hasRelatedCourses && (
              <ScrollView className='course-switcher' scrollX showScrollbar={false}>
                <View className='course-switcher__inner'>
                  {activeSlotCourses.map((course) => {
                    const active = course === activeCourse
                    return (
                      <View
                        key={getCourseScheduleKey(course)}
                        className={`course-switcher__item ${active ? 'course-switcher__item--active' : ''}`}
                        ariaRole='button'
                        ariaLabel={`查看${course.name}课程详情`}
                        onClick={() => setActiveCourse(course)}
                      >
                        <Text>{course.name}</Text>
                        <Text>
                          {isCourseInWeek(course, preferences.week)
                            ? '本周'
                            : formatCourseWeeks(course.weeks)}
                          {' · '}第 {course.startSection}-{course.endSection} 节
                          {course.location ? ` · ${course.location}` : ''}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </ScrollView>
            )}
            <View className='course-float-card__scroll'>
              <View className='course-conflict-list'>
                <CourseDetailCard
                  key={getCourseScheduleKey(activeCourse)}
                  course={activeCourse}
                  currentWeek={preferences.week}
                  onDelete={() => deleteCourse(activeCourse)}
                  onEdit={() => openCourseForm(activeCourse)}
                  onWanted={() => openCourseTrade(activeCourse, 'wanted')}
                  onSell={() => openCourseTrade(activeCourse, 'sell')}
                  onFindMaterials={() => openCourseMaterialPage(activeCourse)}
                  onShareMaterials={() => openCourseMaterialPage(activeCourse, 'upload')}
                />
              </View>
            </View>
          </View>
        </View>
      )
    }
    return (
      <View className='academic-overlay' onClick={() => setSheet(null)}>
        <View className={`academic-sheet academic-sheet--${sheet}`} onClick={requestWechatSubscriptionAndStopPropagation}>
          <View className='academic-sheet__handle' />
          <View className='academic-sheet__close' onClick={() => setSheet(null)}>×</View>
          {sheet === 'period' && (
            <View className='academic-sheet__body'>
              <Text className='academic-sheet__title'>选择学年学期</Text>
              <Text className='academic-sheet__subtitle'>课程和自定义安排按学期保存</Text>
              <View className='period-options'>
                {periods.map((period) => (
                  <View
                    key={period.id}
                    className={`period-options__item ${preferences.schedulePeriodId === period.id ? 'period-options__item--active' : ''}`}
                    onClick={() => {
                      updatePreferences({
                        schedulePeriodId: period.id,
                        week: period.isCurrent ? getCurrentTeachingWeek(period) : 1,
                        selectedWeekday: 1,
                      })
                      setSheet(null)
                    }}
                  >
                    <View>
                      <Text>{period.label}</Text>
                      <Text>开学 {formatPeriodStartDate(period)} · {period.weeks} 周教学周</Text>
                    </View>
                    <View className='period-options__check'>
                      {preferences.schedulePeriodId === period.id ? '✓' : ''}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          {sheet === 'week' && (
            <View className='academic-sheet__body'>
              <Text className='academic-sheet__title'>切换教学周</Text>
              <Text className='academic-sheet__subtitle'>选择后课程表会立即更新</Text>
              <View className='week-options'>
                {Array.from({ length: schedulePeriod?.weeks || 20 }, (_, index) => index + 1).map((week) => (
                  <View
                    key={week}
                    className={`week-options__item ${preferences.week === week ? 'week-options__item--active' : ''}`}
                    onClick={() => {
                      updatePreferences({ week })
                      setSheet(null)
                    }}
                  >
                    <Text>{week}</Text><Text>周</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {sheet === 'course-form' && (
            <View className='academic-sheet__body academic-sheet__body--form'>
              <Text className='academic-sheet__title'>{courseDraft.id ? '编辑自定义课程' : '添加自定义课程'}</Text>
              <Text className='academic-sheet__subtitle'>课程会保存在当前设备</Text>
              <ScrollView className='course-form-scroll' scrollY>
                <View className='academic-field'>
                  <Text className='academic-field__label'>课程名称 *</Text>
                  <KeyboardSafeInput
                    value={courseDraft.name}
                    maxlength={30}
                    placeholder='例如：专业学习小组'
                    onInput={(event) => setCourseDraft((current) => ({ ...current, name: event.detail.value }))}
                  />
                </View>
                <View className='academic-field-row'>
                  <View className='academic-field'>
                    <Text className='academic-field__label'>任课教师</Text>
                    <KeyboardSafeInput
                      value={courseDraft.teacher}
                      maxlength={15}
                      placeholder='选填'
                      onInput={(event) => setCourseDraft((current) => ({ ...current, teacher: event.detail.value }))}
                    />
                  </View>
                  <View className='academic-field'>
                    <Text className='academic-field__label'>上课地点</Text>
                    <KeyboardSafeInput
                      value={courseDraft.location}
                      maxlength={20}
                      placeholder='选填'
                      onInput={(event) => setCourseDraft((current) => ({ ...current, location: event.detail.value }))}
                    />
                  </View>
                </View>
                <Text className='academic-field__label'>星期 *</Text>
                <ScrollView className='form-chip-scroll' scrollX showScrollbar={false}>
                  <View className='form-chip-row'>
                    {weekdays.map((weekday, index) => (
                      <View
                        key={weekday}
                        className={`form-chip ${courseDraft.weekday === index + 1 ? 'form-chip--active' : ''}`}
                        onClick={() => setCourseDraft((current) => ({ ...current, weekday: index + 1 }))}
                      >
                        {weekday}
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View className='academic-field-row academic-field-row--sections'>
                  <View className='academic-field'>
                    <Text className='academic-field__label'>开始节次 *</Text>
                    <View className='stepper'>
                      <View onClick={() => setCourseDraft((current) => ({ ...current, startSection: Math.max(1, current.startSection - 1) }))}>−</View>
                      <Text>{courseDraft.startSection}</Text>
                      <View onClick={() => setCourseDraft((current) => ({ ...current, startSection: Math.min(12, current.startSection + 1) }))}>＋</View>
                    </View>
                  </View>
                  <View className='academic-field'>
                    <Text className='academic-field__label'>结束节次 *</Text>
                    <View className='stepper'>
                      <View onClick={() => setCourseDraft((current) => ({ ...current, endSection: Math.max(1, current.endSection - 1) }))}>−</View>
                      <Text>{courseDraft.endSection}</Text>
                      <View onClick={() => setCourseDraft((current) => ({ ...current, endSection: Math.min(12, current.endSection + 1) }))}>＋</View>
                    </View>
                  </View>
                </View>
                <View className='academic-field__label-line'>
                  <Text className='academic-field__label'>有效周次 *</Text>
                  <Text>{courseDraft.weeks.length} 周</Text>
                </View>
                <View className='form-weeks'>
                  {Array.from({ length: schedulePeriod?.weeks || 20 }, (_, index) => index + 1).map((week) => (
                    <View
                      key={week}
                      className={courseDraft.weeks.includes(week) ? 'form-weeks__active' : ''}
                      onClick={() => toggleDraftWeek(week)}
                    >
                      {week}
                    </View>
                  ))}
                </View>
                <Text className='academic-field__label'>课程颜色</Text>
                <View className='color-options'>
                  {courseColors.map((color) => (
                    <View
                      key={color}
                      className={`color-options__item color-options__item--${color} ${courseDraft.color === color ? 'color-options__item--active' : ''}`}
                      onClick={() => setCourseDraft((current) => ({ ...current, color }))}
                    >
                      {courseDraft.color === color ? '✓' : ''}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View className='academic-button academic-button--full' onClick={saveCourse}>保存课程</View>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className={`academic-page academic-page--schedule academic-page--schedule-${preferences.scheduleView} ${sheet ? 'academic-page--locked' : ''}`}>
      <View className='academic-page__glow academic-page__glow--one' />
      <AcademicHeader title='课程表' toolbar={toolbar} variant='schedule' />
      <View
        key={preferences.schedulePeriodId}
        className={`academic-content academic-content--schedule academic-content--schedule-${preferences.scheduleView}`}
      >
        {showRefreshGuide && !loading && !sheet && (
          <View
            className='schedule-refresh-guide'
            ariaRole='status'
            ariaLabel='下拉可以更新课表'
          >
            <View className='schedule-refresh-guide__gesture'>
              <View className='schedule-refresh-guide__arrow' />
            </View>
            <Text>下拉更新课表</Text>
          </View>
        )}
        {loading ? (
          <View className='academic-state'>
            <View className='academic-state__loader' />
            <Text>正在整理课程表…</Text>
          </View>
        ) : loadError && !usingCache ? (
          <AcademicLoadState error={loadError} retrying={retrying} onRetry={refreshSchedule} />
        ) : (
          <>
            <AcademicCacheNotice
              cache={serverCache}
              updatedAt={!usingCache && !loadError ? cacheUpdatedAt : 0}
              localUpdatedAt={usingCache ? cacheUpdatedAt : 0}
              localFallback={Boolean(loadError)}
            />
            {preferences.scheduleView === 'week' ? renderWeekSchedule() : renderDaySchedule()}
          </>
        )}
      </View>
      <View
        className='academic-fab'
        hoverClass='academic-fab--pressed'
        ariaRole='button'
        ariaLabel='添加自定义课程'
        onClick={() => openCourseForm()}
      >
        <Text className='academic-fab__plus'>＋</Text>
        <Text>自定义课程</Text>
      </View>
      {renderSheet()}
    </View>
  )
}
