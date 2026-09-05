import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { isApiError } from '../../../api/client'
import {
  getActiveAcademicUserId,
  loadAcademicCredential,
  type AcademicEducationLevel,
} from '../../../api/academic-credential'
import {
  listCourseCatalogCategories,
  searchCourseCatalog,
  type CourseCatalogSearchInput,
} from '../../../api/course-catalog'
import {
  addPersonalTimetableItem,
  listPersonalTimetableItems,
  refreshPersonalTimetableItem,
  removePersonalTimetableItem,
} from '../../../api/personal-timetable'
import type {
  MemberCourseCatalogCourse,
  PersonalTimetableItemView,
} from '../../../api/types'
import CustomNavbar from '../../../components/custom-navbar'
import { loadAcademicCalendar } from '../../../features/calendar/repository'
import type { AcademicPeriod, Course } from '../types'
import { academicStorage } from '../storage'
import { formatCourseWeeks, weekdays } from '../utils'
import './index.scss'

const PAGE_SIZE = 20
type CourseCatalogFilters = {
  weekday: number
  section: number
  courseCategory: string
}

type CourseCatalogView = 'search' | 'saved'

const emptyCourseCatalogFilters: CourseCatalogFilters = {
  weekday: 0,
  section: 0,
  courseCategory: '',
}

const weekdayFilterOptions = ['不限', ...weekdays]
const sectionFilterOptions = ['不限', ...Array.from({ length: 12 }, (_, index) => `第 ${index + 1} 节`)]

const hasCourseCatalogFilters = (filters: CourseCatalogFilters) => (
  filters.weekday > 0 || filters.section > 0 || Boolean(filters.courseCategory.trim())
)

const routeCourseCatalogFilters = (params: Record<string, string | undefined>): CourseCatalogFilters => {
  const weekday = Number(params.weekday)
  const section = Number(params.section)
  return {
    weekday: Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? weekday : 0,
    section: Number.isInteger(section) && section >= 1 && section <= 12 ? section : 0,
    courseCategory: '',
  }
}

const getDefaultEducationLevel = (): AcademicEducationLevel => {
  try {
    return loadAcademicCredential(getActiveAcademicUserId()).educationLevel
  } catch {
    return 'undergraduate'
  }
}

const educationLevelOptions: Array<[AcademicEducationLevel, string]> = [
  ['undergraduate', '本科生'],
  ['graduate', '研究生'],
]

const slotLocation = (
  slot: Pick<MemberCourseCatalogCourse['slots'][number], 'building' | 'room' | 'raw_location'>,
  fallback?: string | null,
) => (
  [slot.building, slot.room]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
  || slot.raw_location?.trim()
  || fallback?.trim()
  || ''
)

const courseSummary = (course: MemberCourseCatalogCourse) => (
  [course.class_name, course.course_category]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' · ')
)

const simulationCoursePrefix = (course: MemberCourseCatalogCourse) => (
  `simulation:${course.period_id}:${course.offering_id}:`
)

const personalTimetableItemToCatalogCourse = (
  item: PersonalTimetableItemView,
): MemberCourseCatalogCourse => ({
  campus: item.campus,
  class_name: item.class_name,
  course_category: item.course_category,
  course_code: item.course_code,
  course_name: item.course_name,
  credits: item.credits,
  data_version: item.source_data_version,
  education_level: item.education_level,
  instruction_language: item.instruction_language,
  location_text: item.location_text,
  offering_id: item.offering_id,
  offering_unit: item.offering_unit,
  opening_code: item.opening_code,
  period_id: item.period_id,
  schedule_parse_status: item.slots.length > 0
    ? 'parsed'
    : item.schedule_text
      ? 'unparsed'
      : 'no_schedule',
  schedule_text: item.schedule_text,
  slots: item.slots.map((slot) => ({
    building: slot.building,
    campus: slot.campus,
    classroom_id: slot.classroom_id,
    end_section: slot.end_section,
    id: slot.source_schedule_slot_id,
    location_parsed: slot.location_parsed,
    raw_location: slot.raw_location,
    room: slot.room,
    start_section: slot.start_section,
    weekday: slot.weekday,
    weeks: slot.weeks,
  })),
  teachers: item.teachers,
})

const apiErrorMessage = (error: unknown, fallback: string) => {
  if (isApiError(error)) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

function SlotScheduleList({ course }: { course: MemberCourseCatalogCourse }) {
  if (!course.slots.length) {
    return (
      <View className='course-catalog-card__no-slots'>
        <Text>暂未识别出可加入课表的排课信息</Text>
        {course.schedule_text && <Text>{course.schedule_text}</Text>}
      </View>
    )
  }

  return (
    <View className='course-catalog-slots'>
      <View className='course-catalog-card__section-head'>
        <Text className='course-catalog-card__section-title'>上课安排</Text>
        <Text className='course-catalog-card__section-summary'>共 {course.slots.length} 条</Text>
      </View>
      {course.slots.map((slot) => {
        const location = slotLocation(slot, course.location_text)
        return (
          <View
            key={slot.id}
            className='course-catalog-slot'
          >
            <View className='course-catalog-slot__timing'>
              <Text className='course-catalog-slot__time'>
                {weekdays[slot.weekday - 1] || `星期${slot.weekday}`} · {slot.start_section}-{slot.end_section} 节
              </Text>
              <Text className='course-catalog-slot__weeks'>{formatCourseWeeks(slot.weeks)}</Text>
            </View>
            <Text className='course-catalog-slot__location'>{location || '地点待确认'}</Text>
          </View>
        )
      })}
    </View>
  )
}

interface CourseCatalogCardProps {
  course: MemberCourseCatalogCourse
  personalItem?: PersonalTimetableItemView
  simulationAdded: boolean
  busy: boolean
  onAdd: () => void
  onRemove: () => void
  onRemoveSimulation: () => void
  onRefresh: () => void
  onAddSimulation: () => void
}

function CourseCatalogCard({
  course,
  personalItem,
  simulationAdded,
  busy,
  onAdd,
  onRemove,
  onRemoveSimulation,
  onRefresh,
  onAddSimulation,
}: CourseCatalogCardProps) {
  const summary = courseSummary(course)
  const isAdded = Boolean(personalItem)
  const hasSlots = course.slots.length > 0
  const simulationActionEnabled = simulationAdded || hasSlots
  const auditActionEnabled = isAdded || hasSlots
  return (
    <View className='course-catalog-card'>
      <View className='course-catalog-card__head'>
        <View className='course-catalog-card__identity'>
          <View className='course-catalog-card__title-row'>
            <Text className='course-catalog-card__name'>{course.course_name}</Text>
            {course.course_category && <Text className='course-catalog-card__tag'>{course.course_category}</Text>}
            {course.credits && <Text className='course-catalog-card__tag course-catalog-card__tag--neutral'>{course.credits} 学分</Text>}
          </View>
        </View>
        <View className='course-catalog-card__head-actions'>
          <View
            className={`course-catalog-card__head-action course-catalog-card__head-action--simulation ${!simulationActionEnabled ? 'course-catalog-card__head-action--disabled' : ''}`}
            role='button'
            ariaLabel={`${simulationAdded ? '取消' : '加入'}${course.course_name}的模拟选课`}
            onClick={simulationActionEnabled && !busy
              ? (simulationAdded ? onRemoveSimulation : onAddSimulation)
              : undefined}
          >
            {busy ? '处理中…' : simulationAdded ? '取消模拟' : '模拟选课'}
          </View>
          <View
            className={`course-catalog-card__head-action ${isAdded ? 'course-catalog-card__head-action--audit-danger' : 'course-catalog-card__head-action--audit'} ${!auditActionEnabled ? 'course-catalog-card__head-action--disabled' : ''}`}
            role='button'
            ariaLabel={`${isAdded ? '取消' : '加入'}${course.course_name}的蹭课课表`}
            onClick={auditActionEnabled && !busy ? (isAdded ? onRemove : onAdd) : undefined}
          >
            {busy ? '处理中…' : isAdded ? '取消蹭课' : '加入蹭课'}
          </View>
        </View>
      </View>

      {(course.course_code || course.opening_code) && (
        <View className='course-catalog-card__reference'>
          {course.opening_code && <Text>选课号 {course.opening_code}</Text>}
          {course.course_code && <Text>课程代码 {course.course_code}</Text>}
        </View>
      )}

      <View className='course-catalog-card__meta'>
        <View className='course-catalog-card__facts'>
          <Text className='course-catalog-card__teacher-avatar'>{course.teachers[0]?.slice(0, 1) || '师'}</Text>
          <Text className='course-catalog-card__teacher'>{course.teachers.join('、') || '教师待确认'}</Text>
          {summary && <Text className='course-catalog-card__summary'>{summary}</Text>}
        </View>
        {course.offering_unit && <Text className='course-catalog-card__unit'>{course.offering_unit}</Text>}
        {!course.slots.length && (course.campus || course.location_text) && (
          <Text>地点：{[course.campus, course.location_text].filter(Boolean).join(' · ')}</Text>
        )}
      </View>

      {!isAdded && (
        <SlotScheduleList course={course} />
      )}

      {isAdded && personalItem?.source_status === 'withdrawn' && (
        <Text className='course-catalog-card__note'>课程已从当前目录下架，原安排仍保留在课表中。</Text>
      )}

      {isAdded && personalItem?.source_status === 'updated' && (
        <View className='course-catalog-card__actions'>
          <View
            className='course-catalog-card__action course-catalog-card__action--primary'
            role='button'
            ariaLabel={`同步${course.course_name}的最新排课`}
            onClick={busy ? undefined : onRefresh}
          >
            {busy ? '正在同步…' : '同步最新排课'}
          </View>
        </View>
      )}
    </View>
  )
}

export default function CourseCatalogPage() {
  const router = Taro.useRouter()
  const initialRouteFilters = routeCourseCatalogFilters(router.params)
  const [activeView, setActiveView] = useState<CourseCatalogView>('search')
  const [educationLevel, setEducationLevel] = useState<AcademicEducationLevel>(getDefaultEducationLevel)
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [periodId, setPeriodId] = useState('')
  const [courseName, setCourseName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [submittedCourseName, setSubmittedCourseName] = useState('')
  const [submittedTeacher, setSubmittedTeacher] = useState('')
  const [filters, setFilters] = useState<CourseCatalogFilters>(initialRouteFilters)
  const [submittedFilters, setSubmittedFilters] = useState<CourseCatalogFilters>(initialRouteFilters)
  const [showMoreFilters, setShowMoreFilters] = useState(() => hasCourseCatalogFilters(initialRouteFilters))
  const [items, setItems] = useState<MemberCourseCatalogCourse[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [periodLoading, setPeriodLoading] = useState(true)
  const [courseCategories, setCourseCategories] = useState<string[]>([])
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [categoryLoadError, setCategoryLoadError] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [personalItems, setPersonalItems] = useState<PersonalTimetableItemView[]>([])
  const [personalItemsLoading, setPersonalItemsLoading] = useState(false)
  const [simulationCourses, setSimulationCourses] = useState<Course[]>(() => academicStorage.getSelectionDraftCourses())
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [busyOfferingId, setBusyOfferingId] = useState('')
  const [busyItemId, setBusyItemId] = useState(0)
  const requestSequence = useRef(0)
  const personalItemsRequestSequence = useRef(0)

  Taro.useDidShow(() => {
    setSimulationCourses(academicStorage.getSelectionDraftCourses())
  })

  const personalItemsByOffering = useMemo(
    () => new Map(personalItems.map((item) => [item.offering_id, item])),
    [personalItems],
  )

  const updatePersonalItem = useCallback((nextItem: PersonalTimetableItemView) => {
    setPersonalItems((current) => [
      ...current.filter((item) => item.offering_id !== nextItem.offering_id),
      nextItem,
    ])
  }, [])

  const loadPersonalItems = useCallback(async (
    nextEducationLevel: AcademicEducationLevel,
    nextPeriodId: string,
  ) => {
    if (!nextPeriodId) {
      setPersonalItems([])
      setPersonalItemsLoading(false)
      return
    }
    const requestId = personalItemsRequestSequence.current + 1
    personalItemsRequestSequence.current = requestId
    setPersonalItemsLoading(true)
    try {
      const result = await listPersonalTimetableItems(nextEducationLevel, nextPeriodId)
      if (personalItemsRequestSequence.current !== requestId) return
      setPersonalItems(result.items)
    } catch {
      // 个人课表状态不是检索主链路，失败时仍允许搜索和加入。
      if (personalItemsRequestSequence.current === requestId) setPersonalItems([])
    } finally {
      if (personalItemsRequestSequence.current === requestId) setPersonalItemsLoading(false)
    }
  }, [])

  const loadCourses = useCallback(async (
    nextCourseName: string,
    nextTeacher: string,
    nextPage = 1,
    nextEducationLevel = educationLevel,
    nextPeriodId = periodId,
    nextFilters = submittedFilters,
  ) => {
    if (!nextPeriodId) {
      setItems([])
      setPage(1)
      setTotal(0)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    if (nextPage === 1) {
      setLoading(true)
      setLoadError(null)
    } else {
      setLoadingMore(true)
    }
    const input: CourseCatalogSearchInput = {
      educationLevel: nextEducationLevel,
      periodId: nextPeriodId,
      courseName: nextCourseName,
      teacher: nextTeacher,
      weekday: nextFilters.weekday,
      section: nextFilters.section,
      courseCategory: nextFilters.courseCategory,
      page: nextPage,
      pageSize: PAGE_SIZE,
    }
    try {
      const result = await searchCourseCatalog(input)
      if (requestSequence.current !== requestId) return
      setItems((current) => nextPage === 1
        ? result.items
        : [
          ...current,
          ...result.items.filter((item) => (
            !current.some((candidate) => candidate.offering_id === item.offering_id)
          )),
        ])
      setPage(result.page)
      setTotal(result.total)
    } catch (error) {
      if (requestSequence.current !== requestId) return
      if (nextPage === 1) {
        setItems([])
        setPage(1)
        setTotal(0)
        setLoadError(error)
      } else {
        Taro.showToast({ title: apiErrorMessage(error, '加载更多失败'), icon: 'none' })
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [educationLevel, periodId, submittedFilters])

  useEffect(() => {
    let active = true
    setPeriodLoading(true)
    // 课程目录可以切换学历层级，必须按当前层级读取校历。
    // 私有学期接口只返回已绑定身份的学期，切换到另一学历后会留下错误的 period_id。
    loadAcademicCalendar(educationLevel)
      .then(({ calendar }) => {
        if (!active) return
        const records: AcademicPeriod[] = (calendar?.terms || []).map((term) => ({
          id: term.id,
          label: term.label,
          shortLabel: term.short_label,
          startDate: term.start_date,
          weeks: term.week_count,
          isCurrent: term.is_current,
        }))
        setPeriods(records)
        setPeriodId(records.find((period) => period.isCurrent)?.id || records[0]?.id || '')
        if (!records.length) setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error)
        setLoading(false)
      })
      .finally(() => {
        if (active) setPeriodLoading(false)
      })
    return () => {
      active = false
    }
  }, [educationLevel])

  useEffect(() => {
    if (!periodId) return
    void loadCourses(submittedCourseName, submittedTeacher)
    void loadPersonalItems(educationLevel, periodId)
  }, [educationLevel, loadCourses, loadPersonalItems, periodId, submittedCourseName, submittedTeacher])

  useEffect(() => {
    let active = true
    if (!periodId) {
      setCourseCategories([])
      setCategoryLoading(false)
      setCategoryLoadError(false)
      return () => {
        active = false
      }
    }
    setCategoryLoading(true)
    setCategoryLoadError(false)
    listCourseCatalogCategories({ educationLevel, periodId })
      .then((result) => {
        if (!active) return
        const categories = Array.from(new Set(
          result.items
            .map((category) => category.trim())
            .filter(Boolean),
        ))
        setCourseCategories(categories)
        setFilters((current) => (
          current.courseCategory && !categories.includes(current.courseCategory)
            ? { ...current, courseCategory: '' }
            : current
        ))
        setSubmittedFilters((current) => (
          current.courseCategory && !categories.includes(current.courseCategory)
            ? { ...current, courseCategory: '' }
            : current
        ))
      })
      .catch(() => {
        if (!active) return
        setCourseCategories([])
        setCategoryLoadError(true)
      })
      .finally(() => {
        if (active) setCategoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [educationLevel, periodId])

  Taro.useReachBottom(() => {
    if (loading || loadingMore || items.length >= total || !periodId) return
    void loadCourses(submittedCourseName, submittedTeacher, page + 1)
  })

  const submitSearch = () => {
    const nextCourseName = courseName.trim()
    const nextTeacher = teacher.trim()
    const nextFilters: CourseCatalogFilters = {
      weekday: filters.weekday,
      section: filters.section,
      courseCategory: filters.courseCategory.trim(),
    }
    const sameConditions = nextCourseName === submittedCourseName
      && nextTeacher === submittedTeacher
      && nextFilters.weekday === submittedFilters.weekday
      && nextFilters.section === submittedFilters.section
      && nextFilters.courseCategory === submittedFilters.courseCategory
    setSubmittedCourseName(nextCourseName)
    setSubmittedTeacher(nextTeacher)
    setSubmittedFilters(nextFilters)
    if (sameConditions) {
      void loadCourses(nextCourseName, nextTeacher, 1, educationLevel, periodId, nextFilters)
    }
  }

  const chooseEducationLevel = (next: AcademicEducationLevel) => {
    if (next === educationLevel) return
    // 清空旧层级的学期，避免在新校历返回前以本科 period_id 查询研究生目录（反之亦然）。
    setPeriodId('')
    setPeriods([])
    setPersonalItems([])
    setEducationLevel(next)
    setFilters((current) => ({ ...current, courseCategory: '' }))
    setSubmittedFilters((current) => ({ ...current, courseCategory: '' }))
    setItems([])
    setPage(1)
    setTotal(0)
  }

  const choosePeriod = (next: string) => {
    if (next === periodId) return
    setPeriodId(next)
    setPersonalItems([])
    setFilters((current) => ({ ...current, courseCategory: '' }))
    setSubmittedFilters((current) => ({ ...current, courseCategory: '' }))
    setItems([])
    setPage(1)
    setTotal(0)
  }

  const navigateFromQuickAction = (url: string) => {
    setQuickActionsOpen(false)
    void Taro.navigateTo({ url })
  }

  const addCourse = async (course: MemberCourseCatalogCourse) => {
    const slotIds = course.slots.map((slot) => slot.id)
    if (!slotIds.length) {
      Taro.showToast({ title: '当前课程暂无可加入的排课信息', icon: 'none' })
      return
    }
    setBusyOfferingId(course.offering_id)
    try {
      const result = await addPersonalTimetableItem({
        educationLevel,
        periodId: course.period_id,
        offeringId: course.offering_id,
        scheduleSlotIds: slotIds,
        dataVersion: course.data_version,
      })
      updatePersonalItem(result)
      Taro.showToast({ title: '已加入蹭课课表', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: apiErrorMessage(error, '加入失败，请刷新后重试'), icon: 'none' })
    } finally {
      setBusyOfferingId('')
    }
  }

  const addSimulationCourse = (course: MemberCourseCatalogCourse) => {
    if (!course.slots.length) {
      Taro.showToast({ title: '当前课程暂无可模拟的排课信息', icon: 'none' })
      return
    }
    const existing = academicStorage.getSelectionDraftCourses()
    const prefix = simulationCoursePrefix(course)
    if (existing.some((item) => item.id.startsWith(prefix))) {
      Taro.showToast({ title: '已在模拟选课中', icon: 'none' })
      return
    }
    const next: Course[] = course.slots.map((slot, index) => ({
      id: `${prefix}${slot.id}`,
      periodId: course.period_id,
      courseCode: course.course_code || undefined,
      classNum: course.opening_code || undefined,
      name: course.course_name,
      teacher: course.teachers.join('、') || '教师待确认',
      location: slotLocation(slot, course.location_text) || '地点待确认',
      campus: slot.campus || course.campus || undefined,
      weekday: slot.weekday,
      startSection: slot.start_section,
      endSection: slot.end_section,
      weeks: slot.weeks,
      color: ['aqua', 'lavender', 'peach', 'mint'][index % 4],
      source: 'simulation',
    }))
    const updated = [...existing, ...next]
    academicStorage.setSelectionDraftCourses(updated)
    setSimulationCourses(updated)
    Taro.showToast({ title: '已加入模拟选课', icon: 'success' })
  }

  const removeSimulationCourse = async (course: MemberCourseCatalogCourse) => {
    const result = await Taro.showModal({
      title: '移除模拟选课',
      content: `确定移除“${course.course_name}”及其全部上课安排吗？真实课表不会受影响。`,
      confirmColor: '#c56f73',
    })
    if (!result.confirm) return
    setBusyOfferingId(course.offering_id)
    try {
      const prefix = simulationCoursePrefix(course)
      const updated = academicStorage.getSelectionDraftCourses()
        .filter((item) => !item.id.startsWith(prefix))
      academicStorage.setSelectionDraftCourses(updated)
      setSimulationCourses(updated)
      Taro.showToast({ title: '已移除模拟选课', icon: 'success' })
    } finally {
      setBusyOfferingId('')
    }
  }

  const refreshCourse = async (item: PersonalTimetableItemView) => {
    const confirmation = await Taro.showModal({
      title: '同步最新排课',
      content: '将用课程目录的最新名称、教师、地点和全部排课信息替换当前快照。确定同步吗？',
      confirmText: '同步',
      confirmColor: '#2b7fff',
    })
    if (!confirmation.confirm) return
    setBusyItemId(item.id)
    try {
      const result = await refreshPersonalTimetableItem(item.id, item.version)
      updatePersonalItem(result)
      Taro.showToast({ title: '已同步最新排课', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: apiErrorMessage(error, '同步失败，请刷新后重试'), icon: 'none' })
    } finally {
      setBusyItemId(0)
    }
  }

  const removeCourse = async (item: PersonalTimetableItemView) => {
    const result = await Taro.showModal({
      title: '移除蹭课安排',
      content: `确定移除“${item.course_name}”吗？`,
      confirmColor: '#c56f73',
    })
    if (!result.confirm) return
    setBusyItemId(item.id)
    try {
      await removePersonalTimetableItem(item.id, item.version)
      setPersonalItems((current) => current.filter((candidate) => candidate.id !== item.id))
      Taro.showToast({ title: '已移除蹭课安排', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: apiErrorMessage(error, '移除失败，请刷新后重试'), icon: 'none' })
    } finally {
      setBusyItemId(0)
    }
  }

  const activeCourseFilterCount = [
    filters.weekday > 0,
    filters.section > 0,
    Boolean(filters.courseCategory.trim()),
  ].filter(Boolean).length
  const courseCategoryOptions = ['全部类别', ...courseCategories]
  const courseCategoryIndex = filters.courseCategory
    ? Math.max(courseCategories.indexOf(filters.courseCategory) + 1, 0)
    : 0
  const courseCategoryLabel = filters.courseCategory
    || (categoryLoading
      ? '读取中…'
      : categoryLoadError
        ? '暂不可用'
        : '全部类别')
  const heading = submittedCourseName || submittedTeacher || hasCourseCatalogFilters(submittedFilters)
    ? '检索结果'
    : '本学期开放课程'
  const errorMessage = apiErrorMessage(loadError, '课程目录加载失败，请稍后重试')

  return (
    <View className='course-catalog-page'>
      <CustomNavbar title='蹭课检索' subtitle='按课程与教师寻找可旁听课程' showBack />

      <View className='course-catalog-page__content'>
        <View className='course-catalog-scope'>
          <View className='course-catalog-level-switch'>
            {educationLevelOptions.map(([value, label]) => (
              <View
                key={value}
                className={educationLevel === value ? 'course-catalog-level-switch__active' : ''}
                role='button'
                ariaLabel={`切换至${label}课程目录`}
                onClick={() => chooseEducationLevel(value)}
              >
                {label}
              </View>
            ))}
          </View>

          {periods.length > 0 && (
            <ScrollView className='course-catalog-periods' scrollX enhanced showScrollbar={false}>
              {periods.map((period) => (
                <View
                  key={period.id}
                  className={periodId === period.id ? 'course-catalog-periods__active' : ''}
                  role='button'
                  ariaLabel={`搜索${period.label}课程`}
                  onClick={() => choosePeriod(period.id)}
                >
                  <Text>{period.shortLabel}</Text>
                  {period.isCurrent && <Text>当前</Text>}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View className='course-catalog-view-tabs'>
          <View
            className={`course-catalog-view-tabs__item ${activeView === 'search' ? 'course-catalog-view-tabs__item--active' : ''}`}
            role='button'
            ariaLabel='查看课程检索'
            onClick={() => setActiveView('search')}
          >课程检索</View>
          <View
            className={`course-catalog-view-tabs__item ${activeView === 'saved' ? 'course-catalog-view-tabs__item--active' : ''}`}
            role='button'
            ariaLabel={`查看我的蹭课安排，共 ${personalItems.length} 门`}
            onClick={() => setActiveView('saved')}
          >
            <Text>我的蹭课</Text>
            <Text className='course-catalog-view-tabs__count'>{personalItems.length}</Text>
          </View>
        </View>

        {activeView === 'search' && (
          <>
        <View className='course-catalog-search'>
        <View className='course-catalog-search__card'>
          <View className='course-catalog-search__fields'>
            <View className='course-catalog-search__field course-catalog-search__field--course'>
              <Text className='course-catalog-search__label'>课程</Text>
              <KeyboardSafeInput
                value={courseName}
                maxlength={40}
                confirmType='search'
                placeholder='课程名、选课号、课程号'
                placeholderClass='course-catalog-search__placeholder'
                onInput={(event) => setCourseName(event.detail.value)}
                onConfirm={submitSearch}
              />
              {!!courseName && (
                <View
                  className='course-catalog-search__clear'
                  role='button'
                  ariaLabel='清除课程或选课号搜索'
                  onClick={() => setCourseName('')}
                >清除</View>
              )}
            </View>
          </View>
          <View className='course-catalog-search__row'>
            <View className='course-catalog-search__field course-catalog-search__field--teacher'>
              <Text className='course-catalog-search__label'>教师</Text>
              <KeyboardSafeInput
                value={teacher}
                maxlength={30}
                confirmType='search'
                placeholder='可选，如：李小明'
                placeholderClass='course-catalog-search__placeholder'
                onInput={(event) => setTeacher(event.detail.value)}
                onConfirm={submitSearch}
              />
              {!!teacher && (
                <View
                  className='course-catalog-search__clear'
                  role='button'
                  ariaLabel='清除教师名搜索'
                  onClick={() => setTeacher('')}
                >清除</View>
              )}
            </View>
            <View
              className='course-catalog-search__button'
              role='button'
              ariaLabel='检索课程'
              onClick={submitSearch}
            >
              搜索
            </View>
          </View>
          <View className='course-catalog-search__more-row'>
            <View
              className='course-catalog-search__more-toggle'
              role='button'
              ariaLabel={showMoreFilters ? '收起更多筛选条件' : '展开更多筛选条件'}
              onClick={() => setShowMoreFilters((current) => !current)}
            >
              <Text>更多筛选</Text>
              {activeCourseFilterCount > 0 && (
                <Text className='course-catalog-search__more-count'>{activeCourseFilterCount}</Text>
              )}
              <Text className='course-catalog-search__more-chevron'>{showMoreFilters ? '收起' : '展开'}</Text>
            </View>
            <Text className='course-catalog-search__more-hint'>星期 · 节次 · 类别</Text>
          </View>
          {showMoreFilters && (
            <View className='course-catalog-search__advanced'>
              <View className='course-catalog-search__advanced-row'>
                <Text className='course-catalog-search__advanced-label'>星期</Text>
                <Picker
                  mode='selector'
                  range={weekdayFilterOptions}
                  value={filters.weekday}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    weekday: Number(event.detail.value),
                  }))}
                >
                  <View className='course-catalog-search__picker'>
                    <Text>{weekdayFilterOptions[filters.weekday] || '不限'}</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
              </View>
              <View className='course-catalog-search__advanced-row'>
                <Text className='course-catalog-search__advanced-label'>上课节次</Text>
                <Picker
                  mode='selector'
                  range={sectionFilterOptions}
                  value={filters.section}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    section: Number(event.detail.value),
                  }))}
                >
                  <View className='course-catalog-search__picker'>
                    <Text>{sectionFilterOptions[filters.section] || '不限'}</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
              </View>
              <View className='course-catalog-search__advanced-category'>
                <Text className='course-catalog-search__advanced-label'>课程类别</Text>
                <Picker
                  mode='selector'
                  range={courseCategoryOptions}
                  value={courseCategoryIndex}
                  onChange={(event) => {
                    const index = Number(event.detail.value)
                    setFilters((current) => ({
                      ...current,
                      courseCategory: index > 0 ? courseCategories[index - 1] || '' : '',
                    }))
                  }}
                >
                  <View className='course-catalog-search__picker'>
                    <Text>{courseCategoryLabel}</Text>
                    <Text>›</Text>
                  </View>
                </Picker>
              </View>
              <View className='course-catalog-search__advanced-footer'>
                <Text>点击搜索后生效</Text>
                <View
                  role='button'
                  ariaLabel='清空更多筛选条件'
                  onClick={() => setFilters({ ...emptyCourseCatalogFilters })}
                >清空</View>
              </View>
            </View>
          )}
        </View>
        </View>

        <View className='course-catalog-tip'>
          <Text>可按课程名、课程代码、选课号检索；教师名和更多筛选条件同时填写时，会同时满足全部条件。</Text>
          <View
            className='course-catalog-tip__simulation'
            role='button'
            ariaLabel='查看模拟选课课表'
            onClick={() => void Taro.navigateTo({ url: '/pages/academic/schedule/index?mode=simulation' })}
          >查看模拟选课 ›</View>
        </View>

        {periodLoading || loading ? (
          <View className='course-catalog-state'>
            <View className='course-catalog-state__loader' />
            <Text>{periodLoading ? '正在读取学期…' : '正在检索课程…'}</Text>
          </View>
        ) : loadError ? (
          <View className='course-catalog-empty'>
            <Text className='course-catalog-empty__title'>暂时无法加载课程</Text>
            <Text className='course-catalog-empty__copy'>{errorMessage}</Text>
            <View
              className='course-catalog-empty__action'
              role='button'
              ariaLabel='重新检索课程'
              onClick={() => void loadCourses(submittedCourseName, submittedTeacher, 1)}
            >重新加载</View>
          </View>
        ) : items.length === 0 ? (
          <View className='course-catalog-empty'>
            <Text className='course-catalog-empty__title'>没有找到相关课程</Text>
            <Text className='course-catalog-empty__copy'>换个课程名、课程代码、选课号、教师名或学期试试</Text>
          </View>
        ) : (
          <>
            <View className='course-catalog-heading'>
              <View className='course-catalog-heading__title'>
                <Text>{heading}</Text>
                <Text>{total} 门</Text>
              </View>
              <Text>全部排课将一并加入</Text>
            </View>
            <View className='course-catalog-list'>
              {items.map((course) => {
                const personalItem = personalItemsByOffering.get(course.offering_id)
                const simulationAdded = simulationCourses.some((item) => (
                  item.id.startsWith(simulationCoursePrefix(course))
                ))
                const busy = busyOfferingId === course.offering_id
                  || Boolean(personalItem && busyItemId === personalItem.id)
                return (
                  <CourseCatalogCard
                    key={course.offering_id}
                    course={course}
                    personalItem={personalItem}
                    simulationAdded={simulationAdded}
                    busy={busy}
                    onAdd={() => void addCourse(course)}
                    onRemove={() => {
                      if (personalItem) void removeCourse(personalItem)
                    }}
                    onRefresh={() => {
                      if (personalItem) void refreshCourse(personalItem)
                    }}
                    onAddSimulation={() => addSimulationCourse(course)}
                    onRemoveSimulation={() => void removeSimulationCourse(course)}
                  />
                )
              })}
            </View>
            {loadingMore && <View className='course-catalog-list__footer'>正在加载更多…</View>}
            {!loadingMore && items.length < total && (
              <View className='course-catalog-list__footer'>上拉加载更多课程</View>
            )}
          </>
        )}

          </>
        )}

        {activeView === 'saved' && (
          <View className='course-catalog-saved-list course-catalog-saved-list--page'>
            <View className='course-catalog-saved-list__heading'>
              <Text>我的蹭课安排</Text>
              <Text>
                {personalItems.length > 0
                  ? `当前学期共 ${personalItems.length} 门，不受课程检索条件影响`
                  : '已加入的课程会集中显示在这里'}
              </Text>
            </View>
            {personalItemsLoading ? (
              <View className='course-catalog-state'>
                <View className='course-catalog-state__loader' />
                <Text>正在读取我的蹭课…</Text>
              </View>
            ) : personalItems.length === 0 ? (
              <View className='course-catalog-empty'>
                <Text className='course-catalog-empty__title'>还没有蹭课安排</Text>
                <Text className='course-catalog-empty__copy'>从课程检索中加入课程后，会在这里集中管理。</Text>
                <View
                  className='course-catalog-empty__action'
                  role='button'
                  ariaLabel='去检索课程'
                  onClick={() => setActiveView('search')}
                >去检索课程</View>
              </View>
            ) : (
              <View className='course-catalog-saved-list__items'>
                {personalItems.map((item) => {
                  const course = personalTimetableItemToCatalogCourse(item)
                  const simulationAdded = simulationCourses.some((draftCourse) => (
                    draftCourse.id.startsWith(simulationCoursePrefix(course))
                  ))
                  const busy = busyItemId === item.id || busyOfferingId === course.offering_id
                  return (
                    <CourseCatalogCard
                      key={item.id}
                      course={course}
                      personalItem={item}
                      simulationAdded={simulationAdded}
                      busy={busy}
                      onAdd={() => void addCourse(course)}
                      onRemove={() => void removeCourse(item)}
                      onRefresh={() => void refreshCourse(item)}
                      onAddSimulation={() => addSimulationCourse(course)}
                      onRemoveSimulation={() => void removeSimulationCourse(course)}
                    />
                  )
                })}
              </View>
            )}
          </View>
        )}
      </View>

      <View className='course-catalog-float'>
        {quickActionsOpen && (
          <View className='course-catalog-float__menu'>
            <View
              className='course-catalog-float__item course-catalog-float__item--simulation'
              role='button'
              ariaLabel='打开模拟选课课表'
              onClick={() => navigateFromQuickAction('/pages/academic/schedule/index?mode=simulation')}
            >模拟选课</View>
            <View
              className='course-catalog-float__item course-catalog-float__item--schedule'
              role='button'
              ariaLabel='打开我的课表'
              onClick={() => navigateFromQuickAction('/pages/academic/schedule/index')}
            >我的课表</View>
          </View>
        )}
        <View
          className={`course-catalog-float__toggle ${quickActionsOpen ? 'course-catalog-float__toggle--open' : ''}`}
          role='button'
          ariaLabel={quickActionsOpen ? '收起课表入口' : '展开课表入口'}
          onClick={() => setQuickActionsOpen((current) => !current)}
        >{quickActionsOpen ? '收起' : '课表'}</View>
      </View>
    </View>
  )
}
