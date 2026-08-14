import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  KeyboardSafeTextarea,
  useKeyboardInset,
} from '../../components/keyboard-safe-input'
import {
  enabledCampuses,
  getMiniappRuntimeConfig,
  getSelectedCampus,
  loadMiniappRuntimeConfig,
  saveSelectedCampus,
} from '../../features/runtime-config'
import {
  createClassroomOccupancyReport,
  loadClassroomDayAvailability,
  type ClassroomReportCategory,
  type ClassroomView,
  type EmptyClassroomDayAvailability,
} from '../../features/empty-classroom/repository'
import { loadAcademicCalendar } from '../../features/calendar/repository'
import {
  academicWeekdayToDate,
  resolveAcademicCalendarState,
  resolveAcademicWeekday,
} from '../../features/calendar/utils'
import type { AcademicCalendar } from '../../api/types'
import {
  filterDayViewBuilding,
  formatAvailableSectionRanges,
  normalizeAvailableSections,
} from '../../features/empty-classroom/day-view'
import { isApiError } from '../../api/client'
import { requestWechatSubscriptionAndStopPropagation } from '../../features/wechat-subscription'
import { takeWechatAiHandoffQuery } from '../../features/wechat-ai/handoff'
import { useCampusShare } from '../../features/share'
import './index.scss'

const sectionNumbers = Array.from({ length: 12 }, (_, index) => index + 1)
const reportCategories: Array<[ClassroomReportCategory, string]> = [
  ['class_in_progress', '正在上课'],
  ['event', '临时活动'],
  ['maintenance', '维修维护'],
  ['other', '其他占用'],
]
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const INITIAL_BUILDING_ROWS = 12
type ClassroomDisplayGroup = {
  building: string
  classrooms: Array<{ classroom: ClassroomView; available_sections?: number[] }>
}

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const validServiceDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) return undefined
  return date.getFullYear() >= 2020 && date.getFullYear() <= 2100 ? value : undefined
}

const validCampus = (value?: string) => {
  const normalized = value?.trim() || ''
  return normalized && normalized.length <= 40 ? normalized : undefined
}

const dateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`
}

const sourceErrorText = (error: unknown) => {
  if (isApiError(error)) {
    if (error.code === 'date_outside_teaching_term') {
      return '当前不在教学周，享受假期吧'
    }
    if (error.code === 'forbidden') {
      return '暂时无法查询空教室，请稍后再试'
    }
    return error.message
  }
  if (error instanceof Error && error.message === '所选日期不在教学周内') return error.message
  return '空教室服务暂时不可用'
}

export default function EmptyClassroomPage() {
  const bootstrap = getMiniappRuntimeConfig()
  const initialCampus = getSelectedCampus(bootstrap)
  const [config, setConfig] = useState(bootstrap)
  const [campus, setCampus] = useState(initialCampus)
  const [serviceDate, setServiceDate] = useState(dateKey(new Date()))
  const [dayResult, setDayResult] = useState<EmptyClassroomDayAvailability | null>(null)
  const [calendar, setCalendar] = useState<AcademicCalendar | null>(null)
  const [building, setBuilding] = useState('all')
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [queryReady, setQueryReady] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [reportingClassroom, setReportingClassroom] = useState<ClassroomView | null>(null)
  const [reportCategory, setReportCategory] = useState<ClassroomReportCategory>('class_in_progress')
  const [reportDescription, setReportDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reportStartWeek, setReportStartWeek] = useState(1)
  const [reportEndWeek, setReportEndWeek] = useState(1)
  const [reportStartSection, setReportStartSection] = useState(1)
  const [reportEndSection, setReportEndSection] = useState(12)
  const { keyboardHeight, onKeyboardVisibilityChange } = useKeyboardInset()
  const handoffCampus = useRef<string>()
  const handoffHasDate = useRef(false)
  const requestVersion = useRef(0)

  useCampusShare(() => ({
    title: `${campus}·${dateLabel(serviceDate)}空教室`,
    path: '/pages/empty-classroom/index',
    query: { campus, date: serviceDate },
  }))

  const campuses = useMemo(() => enabledCampuses(config), [config])
  const calendarSelection = useMemo(
    () => resolveAcademicWeekday(calendar, serviceDate),
    [calendar, serviceDate],
  )
  const weekOptions = useMemo(() => (
    calendarSelection?.term
      ? Array.from({ length: calendarSelection.term.week_count }, (_, index) => index + 1)
      : []
  ), [calendarSelection?.term])
  const sourceGroups = useMemo<ClassroomDisplayGroup[]>(() => {
    const groups = dayResult?.groups
    if (!Array.isArray(groups)) return []
    return groups.map((group) => ({
      ...group,
      classrooms: Array.isArray(group.classrooms) ? group.classrooms : [],
    }))
  }, [dayResult])
  const buildings = useMemo(() => sourceGroups.map((group) => group.building), [sourceGroups])
  const filteredGroups = useMemo(() => filterDayViewBuilding(sourceGroups, building), [building, sourceGroups])
  const total = filteredGroups.reduce((sum, group) => sum + group.classrooms.length, 0)
  const reportStartDate = useMemo(() => {
    if (!calendarSelection) return serviceDate
    return academicWeekdayToDate(
      calendarSelection.term,
      reportStartWeek,
      calendarSelection.weekday,
    ) || serviceDate
  }, [calendarSelection, reportStartWeek, serviceDate])
  const reportEndDate = useMemo(() => {
    if (!calendarSelection) return serviceDate
    return academicWeekdayToDate(
      calendarSelection.term,
      reportEndWeek,
      calendarSelection.weekday,
    ) || serviceDate
  }, [calendarSelection, reportEndWeek, serviceDate])

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setErrorText('')
    try {
      if (!calendarSelection) throw new Error('所选日期不在教学周内')
      const next = await loadClassroomDayAvailability({
        campus,
        periodId: calendarSelection.term.id,
        teachingWeek: calendarSelection.week,
        weekday: calendarSelection.weekday,
      })
      if (version !== requestVersion.current) return
      setDayResult(next)
    } catch (error) {
      if (version !== requestVersion.current) return
      setDayResult(null)
      setErrorText(sourceErrorText(error))
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [calendarSelection, campus])

  useLoad((options) => {
    const handoffQuery = takeWechatAiHandoffQuery(options, 'pages/empty-classroom/index')
    const nextCampus = validCampus(handoffQuery.campus)
    const nextDate = validServiceDate(handoffQuery.date)
    if (nextCampus) {
      handoffCampus.current = nextCampus
      if (enabledCampuses(bootstrap).includes(nextCampus)) {
        setCampus(nextCampus)
        handoffCampus.current = undefined
      }
    }
    if (nextDate) {
      handoffHasDate.current = true
      setServiceDate(nextDate)
    }
  })

  useEffect(() => {
    let active = true
    Promise.all([
      loadMiniappRuntimeConfig().catch(() => getMiniappRuntimeConfig()),
      loadAcademicCalendar('undergraduate').catch(() => null),
    ]).then(([next, calendarResult]) => {
      if (!active) return
      setConfig(next)
      const nextCalendar = calendarResult?.calendar || null
      setCalendar(nextCalendar)
      const available = enabledCampuses(next)
      const requestedCampus = handoffCampus.current
      setCampus((current) => {
        if (requestedCampus && available.includes(requestedCampus)) return requestedCampus
        if (available.includes(current)) return current
        const fallback = getSelectedCampus(next)
        return fallback
      })

      const calendarState = resolveAcademicCalendarState(nextCalendar)
      if (!handoffHasDate.current) {
        if (calendarState.kind === 'upcoming') {
          setServiceDate(calendarState.term.start_date)
        } else if (calendarState.kind === 'finished') {
          setServiceDate(
            academicWeekdayToDate(calendarState.term, calendarState.term.week_count, 1)
              || calendarState.term.start_date,
          )
        }
      }
      handoffCampus.current = undefined
      setQueryReady(true)
    }).catch(() => {
      if (active) setQueryReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!queryReady) return
    void refresh()
  }, [queryReady, refresh])

  usePullDownRefresh(async () => {
    if (queryReady) await refresh()
    Taro.stopPullDownRefresh()
  })

  const chooseCampus = (value: string) => {
    if (value === campus) return
    saveSelectedCampus(value)
    setCampus(value)
    setBuilding('all')
    setExpandedBuildings({})
  }

  const chooseDate = (value: string) => {
    setServiceDate(value)
    setBuilding('all')
    setExpandedBuildings({})
  }

  const chooseWeek = (week: number) => {
    if (!calendarSelection) return
    const value = academicWeekdayToDate(calendarSelection.term, week, calendarSelection.weekday)
    if (value) chooseDate(value)
  }

  const chooseWeekday = (weekday: number) => {
    if (!calendarSelection) return
    const value = academicWeekdayToDate(calendarSelection.term, calendarSelection.week, weekday)
    if (value) chooseDate(value)
  }

  const openReport = (classroom: ClassroomView) => {
    setReportingClassroom(classroom)
    setReportCategory('class_in_progress')
    setReportDescription('')
    setReportStartWeek(calendarSelection?.week || 1)
    setReportEndWeek(calendarSelection?.week || 1)
    setReportStartSection(1)
    setReportEndSection(12)
  }

  const submitReport = async () => {
    if (!reportingClassroom || submitting) return
    if (!calendarSelection) {
      Taro.showToast({ title: '当前教学周不可用', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await createClassroomOccupancyReport({
        classroomId: reportingClassroom.id,
        periodId: calendarSelection.term.id,
        startTeachingWeek: reportStartWeek,
        endTeachingWeek: reportEndWeek,
        weekday: calendarSelection.weekday,
        startSection: reportStartSection,
        endSection: reportEndSection,
        category: reportCategory,
        description: reportDescription.trim() || undefined,
      })
      setReportingClassroom(null)
      setReportDescription('')
      Taro.showToast({
        title: reportStartWeek === reportEndWeek
          ? `已提交第 ${reportStartWeek} 周反馈`
          : `已提交第 ${reportStartWeek}—${reportEndWeek} 周反馈`,
        icon: 'success',
      })
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '提交失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='empty-classroom-page'>
      <CustomNavbar title='空教室' subtitle='课表推算 · 非实时状态' showBack />

      <View className='empty-classroom-page__content'>
        <View className='empty-classroom-overview'>
          <View className='empty-classroom-overview__summary'>
            <Text>{campus}</Text>
            <Text>
              {calendarSelection
                ? `第 ${calendarSelection.week} 周 · ${weekdays[calendarSelection.weekday - 1]} · ${dateLabel(serviceDate)}`
                : `${dateLabel(serviceDate)} · 全天`}
            </Text>
          </View>
          <View className='empty-classroom-overview__metric'>
            <Text>{loading ? '—' : total}</Text>
            <Text>间教室</Text>
          </View>
        </View>

        <View className='empty-classroom-filters'>
          <View className='empty-classroom-filter-section'>
            <View className='empty-classroom-filter-title'>
              <Text>校区</Text>
              <Text>选择上课区域</Text>
            </View>
            <View className='empty-classroom-campus-options'>
              {campuses.map((item) => (
                <View
                  key={item}
                  className={[
                    'empty-classroom-filter-chip',
                    campus === item ? 'empty-classroom-filter-chip--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => chooseCampus(item)}
                >
                  {item.replace('校区', '')}
                </View>
              ))}
            </View>
          </View>

          {calendarSelection && (
            <View className='empty-classroom-filter-section empty-classroom-filter-section--time'>
              <View className='empty-classroom-filter-title empty-classroom-filter-title--time'>
                <View>
                  <Text>教学时间</Text>
                  <Text>{calendarSelection.term.short_label} · {dateLabel(serviceDate)}</Text>
                </View>
                <Picker
                  mode='selector'
                  range={weekOptions.map((week) => `第 ${week} 周`)}
                  value={Math.max(0, calendarSelection.week - 1)}
                  onChange={(event) => chooseWeek(weekOptions[Number(event.detail.value)] || 1)}
                >
                  <View className='empty-classroom-week-control'>
                    <Text>第 {calendarSelection.week} 周</Text>
                    <Text>切换</Text>
                  </View>
                </Picker>
              </View>
              <View className='empty-classroom-weekdays'>
                {weekdays.map((label, index) => (
                  <View
                    key={label}
                    className={[
                      'empty-classroom-weekdays__item',
                      calendarSelection.weekday === index + 1 ? 'empty-classroom-weekdays__active' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => chooseWeekday(index + 1)}
                  >{label}</View>
                ))}
              </View>
            </View>
          )}

          {buildings.length > 0 && (
            <View className='empty-classroom-filter-section empty-classroom-filter-section--building'>
              <View className='empty-classroom-filter-title'>
                <Text>楼栋</Text>
                <Text>{buildings.length} 栋可选</Text>
              </View>
              <ScrollView className='empty-classroom-building-options' scrollX enhanced showScrollbar={false}>
                <View className='empty-classroom-building-options__track'>
                  {['all', ...buildings].map((item) => (
                    <View
                      key={item}
                      className={[
                        'empty-classroom-filter-chip',
                        'empty-classroom-filter-chip--building',
                        building === item ? 'empty-classroom-filter-chip--active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setBuilding(item)}
                    >{item === 'all' ? '全部楼栋' : item}</View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        <View className='empty-classroom-note'>
          <View />
          <Text>基于课表和已审核反馈推算，到场后请确认现场状态</Text>
        </View>

        <View className='empty-classroom-heading'>
          <View>
            <Text>教室全天情况</Text>
            <Text>{dateLabel(serviceDate)} · 1—12 节</Text>
          </View>
          <Text>{loading ? '查询中' : `${filteredGroups.length} 栋`}</Text>
        </View>

        {loading && (
          <View className='empty-classroom-loading'>
            {[0, 1, 2].map((item) => <View key={item} />)}
          </View>
        )}

        {!loading && errorText && (
          <View className='empty-classroom-empty'>
            <View className='empty-classroom-empty__door'><View /></View>
            <Text>{errorText}</Text>
            <Text>{errorText.includes('假期') ? '开学后再来看看教室安排' : '下拉刷新或稍后再试'}</Text>
            {!errorText.includes('假期') && (
              <View className='empty-classroom-empty__retry' onClick={() => void refresh()}>
                重新查询
              </View>
            )}
          </View>
        )}

        {!loading && !errorText && dayResult && !dayResult.schedule_data_ready && (
          <View className='empty-classroom-warning'>课表占用数据尚未同步，暂不判断全天空闲情况。</View>
        )}

        {!loading && !errorText && total === 0 && (
          <View className='empty-classroom-empty'>
            <View className='empty-classroom-empty__door'><View /></View>
            <Text>当前范围暂无教室</Text>
            <Text>切换教学周、星期、校区或楼栋再看看</Text>
          </View>
        )}

        {!loading && filteredGroups.map((group) => {
          const visibleRows = expandedBuildings[group.building]
            ? group.classrooms
            : group.classrooms.slice(0, INITIAL_BUILDING_ROWS)
          return (
          <View key={group.building} className='empty-classroom-building'>
            <View className='empty-classroom-building__head'>
              <Text>{group.building}</Text>
              <Text>{group.classrooms.length} 间</Text>
            </View>
            <View className='empty-classroom-building__list'>
              {visibleRows.map((item) => {
                const classroom = item.classroom
                const dayDataReady = dayResult?.schedule_data_ready !== false
                const availableSections = dayDataReady
                  ? normalizeAvailableSections(item.available_sections)
                  : []
                const availabilityLabel = !dayDataReady
                  ? '课表待同步'
                  : availableSections.length === sectionNumbers.length
                    ? '全天空闲'
                    : availableSections.length > 0
                      ? `空闲 ${availableSections.length} 节`
                      : '暂无空闲'
                const availabilityTone = !dayDataReady
                  ? 'pending'
                  : availableSections.length === sectionNumbers.length
                    ? 'all'
                    : availableSections.length > 0
                      ? 'partial'
                      : 'none'
                return (
                <View key={classroom.id} className='empty-classroom-row'>
                  <View className='empty-classroom-row__header'>
                    <View className='empty-classroom-row__main'>
                      <Text>{classroom.room}</Text>
                      <Text className={`empty-classroom-row__status empty-classroom-row__status--${availabilityTone}`}>
                        {availabilityLabel}
                      </Text>
                    </View>
                    <View
                      className='empty-classroom-row__report'
                      hoverClass='empty-classroom-row__report--pressed'
                      role='button'
                      ariaLabel={`反馈 ${classroom.room} 的占用情况`}
                      onClick={() => openReport(classroom)}
                    >
                      <Text>反馈占用</Text>
                    </View>
                  </View>
                  <View
                    className='empty-classroom-day-grid'
                    ariaLabel={dayDataReady
                      ? `${classroom.room} 空闲节次：${formatAvailableSectionRanges(availableSections)}`
                      : `${classroom.room} 课表待同步`}
                  >
                    {sectionNumbers.map((section) => (
                      <View
                        key={section}
                        className={dayDataReady && availableSections.includes(section) ? 'empty-classroom-day-grid__free' : ''}
                      >
                        {section}
                      </View>
                    ))}
                  </View>
                </View>
                )
              })}
              {group.classrooms.length > INITIAL_BUILDING_ROWS && (
                <View className='empty-classroom-building__more' onClick={() => setExpandedBuildings((current) => ({ ...current, [group.building]: !current[group.building] }))}>
                  {expandedBuildings[group.building] ? '收起' : `展开其余 ${group.classrooms.length - INITIAL_BUILDING_ROWS} 间`}
                </View>
              )}
            </View>
          </View>
          )
        })}

        <View className='empty-classroom-disclaimer'>
          查询结果仅供参考，请以门牌、现场课程和管理人员安排为准
        </View>
      </View>

      {reportingClassroom && (
        <View className='empty-classroom-report-mask' onClick={() => setReportingClassroom(null)}>
          <View
            className='empty-classroom-report'
            style={{ bottom: `${keyboardHeight}px` }}
            onClick={requestWechatSubscriptionAndStopPropagation}
          >
            <View className='empty-classroom-report__handle' />
            <View className='empty-classroom-report__title'>
              <View>
                <Text>反馈教室已被占用</Text>
                <Text>{reportingClassroom.display_name}</Text>
              </View>
              <Text onClick={() => setReportingClassroom(null)}>取消</Text>
            </View>
            <View className='empty-classroom-report__hint'>
              反馈需要后台审核，通过前不会影响其他同学的查询结果
            </View>
            <View className='empty-classroom-report__field'>
              <View className='empty-classroom-report__field-label'>
                <Text>占用周次</Text>
                <Text>
                  {calendarSelection ? `${weekdays[calendarSelection.weekday - 1]} · ${dateLabel(reportStartDate)}${reportStartWeek === reportEndWeek ? '' : `—${dateLabel(reportEndDate)}`}` : dateLabel(reportStartDate)}
                </Text>
              </View>
              <View className='empty-classroom-report__sections'>
                <Picker
                  className='empty-classroom-report__start-week-picker'
                  mode='selector'
                  range={weekOptions.map((week) => `第 ${week} 周`)}
                  value={Math.max(0, weekOptions.indexOf(reportStartWeek))}
                  disabled={weekOptions.length === 0}
                  onChange={(event) => {
                    const next = weekOptions[Number(event.detail.value)] || reportStartWeek
                    setReportStartWeek(next)
                    if (reportEndWeek < next) setReportEndWeek(next)
                  }}
                >
                  <View className='empty-classroom-report__picker'>
                    <Text>第 {reportStartWeek} 周</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
                <Text>至</Text>
                <Picker
                  className='empty-classroom-report__end-week-picker'
                  mode='selector'
                  range={weekOptions.map((week) => `第 ${week} 周`)}
                  value={Math.max(0, weekOptions.indexOf(reportEndWeek))}
                  disabled={weekOptions.length === 0}
                  onChange={(event) => {
                    const next = weekOptions[Number(event.detail.value)] || reportStartWeek
                    setReportEndWeek(Math.max(reportStartWeek, next))
                  }}
                >
                  <View className='empty-classroom-report__picker'>
                    <Text>第 {reportEndWeek} 周</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
              </View>
            </View>
            <View className='empty-classroom-report__field'>
              <View className='empty-classroom-report__field-label'>
                <Text>占用节次</Text>
                <Text>请选择连续的起止节次</Text>
              </View>
              <View className='empty-classroom-report__sections'>
                <Picker
                  className='empty-classroom-report__start-section-picker'
                  mode='selector'
                  range={sectionNumbers.map((section) => `第 ${section} 节`)}
                  value={reportStartSection - 1}
                  onChange={(event) => {
                    const next = sectionNumbers[Number(event.detail.value)] || 1
                    setReportStartSection(next)
                    if (reportEndSection < next) setReportEndSection(next)
                  }}
                >
                  <View className='empty-classroom-report__picker'>
                    <Text>第 {reportStartSection} 节</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
                <Text>至</Text>
                <Picker
                  className='empty-classroom-report__end-section-picker'
                  mode='selector'
                  range={sectionNumbers.map((section) => `第 ${section} 节`)}
                  value={reportEndSection - 1}
                  onChange={(event) => {
                    const next = sectionNumbers[Number(event.detail.value)] || reportStartSection
                    setReportEndSection(Math.max(reportStartSection, next))
                  }}
                >
                  <View className='empty-classroom-report__picker'>
                    <Text>第 {reportEndSection} 节</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
              </View>
            </View>
            <View className='empty-classroom-report__field-label empty-classroom-report__field-label--category'>
              <Text>占用类型</Text>
            </View>
            <View className='empty-classroom-report__categories'>
              {reportCategories.map(([value, label]) => (
                <View
                  key={value}
                  className={reportCategory === value ? 'empty-classroom-report__category--active' : ''}
                  onClick={() => setReportCategory(value)}
                >
                  {label}
                </View>
              ))}
            </View>
            <KeyboardSafeTextarea
              className='empty-classroom-report__textarea'
              value={reportDescription}
              maxlength={500}
              placeholder='补充现场情况（选填）'
              onInput={(event) => setReportDescription(event.detail.value)}
              onKeyboardVisibilityChange={onKeyboardVisibilityChange}
            />
            <View
              className={`empty-classroom-report__submit ${submitting ? 'empty-classroom-report__submit--disabled' : ''}`}
              onClick={submitReport}
            >
              {submitting ? '提交中…' : '提交反馈'}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
