import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
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
  type MiniappRuntimeConfig,
} from '../../features/runtime-config'
import {
  createClassroomOccupancyReport,
  loadAvailableClassrooms,
  type ClassroomReportCategory,
  type ClassroomView,
  type EmptyClassroomAvailability,
} from '../../features/empty-classroom/repository'
import { loadAcademicCalendar } from '../../features/calendar/repository'
import { resolveAcademicCalendarState } from '../../features/calendar/utils'
import { isApiError } from '../../api/client'
import { requestWechatSubscriptionAndStopPropagation } from '../../features/wechat-subscription'
import './index.scss'

const sectionNumbers = Array.from({ length: 12 }, (_, index) => index + 1)
const quickRanges = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
] as Array<[number, number]>
const reportCategories: Array<[ClassroomReportCategory, string]> = [
  ['class_in_progress', '正在上课'],
  ['event', '临时活动'],
  ['maintenance', '维修维护'],
  ['other', '其他占用'],
]

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateFromOffset = (offset: number) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date
}

const dateLabel = (value: string) => {
  const today = dateKey(dateFromOffset(0))
  const tomorrow = dateKey(dateFromOffset(1))
  if (value === today) return '今天'
  if (value === tomorrow) return '明天'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`
}

const defaultSearch = (config: MiniappRuntimeConfig, campus: string) => {
  const sections = config.campuses[campus]?.sections || {}
  const now = new Date()
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const nextSection = sectionNumbers.find((section) => {
    const slot = sections[String(section)]
    return slot && clock < slot.end
  })
  if (nextSection) {
    const [startSection, endSection] = quickRanges.find(([start, end]) => (
      nextSection >= start && nextSection <= end
    )) || [nextSection, nextSection]
    return { date: dateKey(now), startSection, endSection }
  }
  return { date: dateKey(dateFromOffset(1)), startSection: 1, endSection: 2 }
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
  return '空教室服务暂时不可用'
}

export default function EmptyClassroomPage() {
  const bootstrap = getMiniappRuntimeConfig()
  const initialCampus = getSelectedCampus(bootstrap)
  const initialSearch = defaultSearch(bootstrap, initialCampus)
  const [config, setConfig] = useState(bootstrap)
  const [campus, setCampus] = useState(initialCampus)
  const [serviceDate, setServiceDate] = useState(initialSearch.date)
  const [startSection, setStartSection] = useState(initialSearch.startSection)
  const [endSection, setEndSection] = useState(initialSearch.endSection)
  const [result, setResult] = useState<EmptyClassroomAvailability | null>(null)
  const [loading, setLoading] = useState(true)
  const [queryReady, setQueryReady] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [reportingClassroom, setReportingClassroom] = useState<ClassroomView | null>(null)
  const [reportCategory, setReportCategory] = useState<ClassroomReportCategory>('class_in_progress')
  const [reportDescription, setReportDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const { keyboardHeight, onKeyboardVisibilityChange } = useKeyboardInset()

  const campuses = useMemo(() => enabledCampuses(config), [config])
  const campusSections = useMemo(
    () => config.campuses[campus]?.sections || {},
    [campus, config],
  )
  const total = result?.groups.reduce((sum, group) => sum + group.classrooms.length, 0) || 0
  const customRangeSelected = !quickRanges.some(
    ([start, end]) => start === startSection && end === endSection,
  )
  const timeText = useMemo(() => {
    const start = campusSections[String(startSection)]?.start
    const end = campusSections[String(endSection)]?.end
    return start && end ? `${start}—${end}` : `第 ${startSection}—${endSection} 节`
  }, [campusSections, endSection, startSection])

  const refresh = useCallback(async () => {
    setLoading(true)
    setErrorText('')
    try {
      const next = await loadAvailableClassrooms({
        campus,
        date: serviceDate,
        startSection,
        endSection,
      })
      setResult(next)
    } catch (error) {
      setResult(null)
      setErrorText(sourceErrorText(error))
    } finally {
      setLoading(false)
    }
  }, [campus, endSection, serviceDate, startSection])

  useEffect(() => {
    let active = true
    Promise.all([
      loadMiniappRuntimeConfig(),
      loadAcademicCalendar('undergraduate'),
    ]).then(([next, calendarResult]) => {
      if (!active) return
      setConfig(next)
      const available = enabledCampuses(next)
      setCampus((current) => {
        if (available.includes(current)) return current
        const fallback = getSelectedCampus(next)
        const search = defaultSearch(next, fallback)
        setServiceDate(search.date)
        setStartSection(search.startSection)
        setEndSection(search.endSection)
        return fallback
      })

      const calendarState = resolveAcademicCalendarState(calendarResult.calendar)
      if (calendarState.kind === 'upcoming') {
        setServiceDate(calendarState.term.start_date)
        setStartSection(1)
        setEndSection(2)
      }
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
  }

  const chooseRange = (start: number, end: number) => {
    setStartSection(start)
    setEndSection(end)
    setCustomRangeOpen(false)
  }

  const openReport = (classroom: ClassroomView) => {
    setReportingClassroom(classroom)
    setReportCategory('class_in_progress')
    setReportDescription('')
  }

  const submitReport = async () => {
    if (!reportingClassroom || submitting) return
    setSubmitting(true)
    try {
      await createClassroomOccupancyReport({
        classroomId: reportingClassroom.id,
        serviceDate,
        startSection,
        endSection,
        category: reportCategory,
        description: reportDescription.trim() || undefined,
      })
      setReportingClassroom(null)
      setReportDescription('')
      Taro.showToast({ title: '已提交，等待审核', icon: 'success' })
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
              {dateLabel(serviceDate)} · 第 {startSection}{startSection === endSection ? '' : `—${endSection}`} 节 · {timeText}
            </Text>
          </View>
          <View className='empty-classroom-overview__metric'>
            <Text>{loading ? '—' : total}</Text>
            <Text>间可用</Text>
          </View>
        </View>

        <View className='empty-classroom-filters'>
          <ScrollView className='empty-classroom-scope' scrollX enhanced showScrollbar={false}>
            <View className='empty-classroom-scope__track'>
              <Text className='empty-classroom-scope__label'>校区</Text>
              {campuses.map((item) => (
                <View
                  key={item}
                  className={[
                    'empty-classroom-scope__chip',
                    campus === item ? 'empty-classroom-scope__chip--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => chooseCampus(item)}
                >
                  {item.replace('校区', '')}
                </View>
              ))}
              <View className='empty-classroom-scope__divider' />
              <Text className='empty-classroom-scope__label'>日期</Text>
              {[0, 1].map((offset) => {
                const date = dateFromOffset(offset)
                const value = dateKey(date)
                return (
                  <View
                    key={value}
                    className={[
                      'empty-classroom-scope__chip',
                      serviceDate === value ? 'empty-classroom-scope__chip--active' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setServiceDate(value)}
                  >
                    {offset === 0 ? '今天' : '明天'}
                  </View>
                )
              })}
              <Picker
                mode='date'
                value={serviceDate}
                onChange={(event) => setServiceDate(String(event.detail.value))}
              >
                <View
                  className={[
                    'empty-classroom-scope__chip',
                    ![dateKey(dateFromOffset(0)), dateKey(dateFromOffset(1))].includes(serviceDate)
                      ? 'empty-classroom-scope__chip--active'
                      : '',
                  ].filter(Boolean).join(' ')}
                >
                  {![dateKey(dateFromOffset(0)), dateKey(dateFromOffset(1))].includes(serviceDate)
                    ? dateLabel(serviceDate)
                    : '其他'}
                </View>
              </Picker>
            </View>
          </ScrollView>

          <View className='empty-classroom-period__head'>
            <Text>节次</Text>
            <Text>{timeText}</Text>
          </View>
          <ScrollView className='empty-classroom-period' scrollX enhanced showScrollbar={false}>
            <View className='empty-classroom-period__track'>
              {quickRanges.map(([start, end]) => (
                <View
                  key={`${start}-${end}`}
                  className={[
                    'empty-classroom-period__chip',
                    startSection === start && endSection === end
                      ? 'empty-classroom-period__chip--active'
                      : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => chooseRange(start, end)}
                >
                  {start}—{end}节
                </View>
              ))}
              <View
                className={[
                  'empty-classroom-period__chip',
                  customRangeSelected ? 'empty-classroom-period__chip--active' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setCustomRangeOpen((current) => !current)}
              >
                {customRangeSelected
                  ? `${startSection}${startSection === endSection ? '' : `—${endSection}`}节`
                  : '自定义'}
              </View>
            </View>
          </ScrollView>

          {customRangeOpen && (
            <View className='empty-classroom-custom-panel'>
              <Text>自定义节次</Text>
              <View className='empty-classroom-custom-panel__pickers'>
                <Picker
                  mode='selector'
                  range={sectionNumbers}
                  value={Math.max(0, startSection - 1)}
                  onChange={(event) => {
                    const next = sectionNumbers[Number(event.detail.value)] || 1
                    setStartSection(next)
                    if (endSection < next) setEndSection(next)
                  }}
                >
                  <View>第 {startSection} 节</View>
                </Picker>
                <Text>至</Text>
                <Picker
                  mode='selector'
                  range={sectionNumbers}
                  value={Math.max(0, endSection - 1)}
                  onChange={(event) => {
                    const next = sectionNumbers[Number(event.detail.value)] || startSection
                    setEndSection(Math.max(startSection, next))
                  }}
                >
                  <View>第 {endSection} 节</View>
                </Picker>
              </View>
            </View>
          )}
        </View>

        <View className='empty-classroom-note'>
          <View />
          <Text>基于课表和已审核反馈推算，到场后请确认现场状态</Text>
        </View>

        <View className='empty-classroom-heading'>
          <View>
            <Text>可用教室</Text>
            <Text>{dateLabel(serviceDate)} · 第 {startSection}{startSection === endSection ? '' : `—${endSection}`} 节</Text>
          </View>
          <Text>{loading ? '查询中' : `${result?.groups.length || 0} 栋`}</Text>
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

        {!loading && !errorText && total === 0 && (
          <View className='empty-classroom-empty'>
            <View className='empty-classroom-empty__door'><View /></View>
            <Text>这个时段暂时没有空教室</Text>
            <Text>切换节次、日期或校区再看看</Text>
          </View>
        )}

        {!loading && result?.groups.map((group) => (
          <View key={group.building} className='empty-classroom-building'>
            <View className='empty-classroom-building__head'>
              <Text>{group.building}</Text>
              <Text>{group.classrooms.length} 间</Text>
            </View>
            <View className='empty-classroom-building__list'>
              {group.classrooms.map(({ classroom }) => (
                <View key={classroom.id} className='empty-classroom-row'>
                  <View className='empty-classroom-row__main'>
                    <Text>{classroom.room}</Text>
                    <Text>
                      {classroom.room_type || '普通教室'}
                      {classroom.capacity ? ` · ${classroom.capacity} 人` : ''}
                    </Text>
                  </View>
                  <View className='empty-classroom-row__aside'>
                    {(classroom.facilities || []).length > 0 && (
                      <Text>{(classroom.facilities || []).slice(0, 2).join('、')}</Text>
                    )}
                    <Text onClick={() => openReport(classroom)}>反馈占用</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

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
                <Text>{reportingClassroom.display_name} · 第 {startSection}—{endSection} 节</Text>
              </View>
              <Text onClick={() => setReportingClassroom(null)}>取消</Text>
            </View>
            <View className='empty-classroom-report__hint'>
              反馈需要后台审核，通过前不会影响其他同学的查询结果
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
