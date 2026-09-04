import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { isApiError } from '../../../api/client'
import {
  getActiveAcademicUserId,
  loadAcademicCredential,
  type AcademicEducationLevel,
} from '../../../api/academic-credential'
import {
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
import { academicRepository } from '../repository'
import type { AcademicPeriod } from '../types'
import { formatCourseWeeks, weekdays } from '../utils'
import './index.scss'

const PAGE_SIZE = 20
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

const personalSlotSummary = (slot: PersonalTimetableItemView['slots'][number], fallback?: string | null) => {
  const location = slotLocation(slot, fallback)
  return [
    `${weekdays[slot.weekday - 1] || `星期${slot.weekday}`} 第 ${slot.start_section}-${slot.end_section} 节`,
    formatCourseWeeks(slot.weeks),
    location,
  ].filter(Boolean).join(' · ')
}

const personalStatusLabel = (status: PersonalTimetableItemView['source_status']) => (
  status === 'updated'
    ? '目录有更新'
    : status === 'withdrawn'
      ? '课程已下架'
      : '已加入课表'
)

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
  busy: boolean
  onAdd: () => void
  onRemove: () => void
  onRefresh: () => void
}

function CourseCatalogCard({
  course,
  personalItem,
  busy,
  onAdd,
  onRemove,
  onRefresh,
}: CourseCatalogCardProps) {
  const summary = courseSummary(course)
  const isAdded = Boolean(personalItem)
  const hasSlots = course.slots.length > 0
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
        {isAdded && (
          <View className={`course-catalog-card__status course-catalog-card__status--${personalItem?.source_status}`}>
            {personalStatusLabel(personalItem?.source_status || 'current')}
          </View>
        )}
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
          {course.offering_unit && <Text className='course-catalog-card__unit'>{course.offering_unit}</Text>}
        </View>
        {summary && <Text className='course-catalog-card__summary'>{summary}</Text>}
        {!course.slots.length && (course.campus || course.location_text) && (
          <Text>地点：{[course.campus, course.location_text].filter(Boolean).join(' · ')}</Text>
        )}
      </View>

      {!isAdded && (
        <SlotScheduleList course={course} />
      )}

      <View className='course-catalog-card__actions'>
        {!isAdded && (
          <View
            className={`course-catalog-card__action course-catalog-card__action--primary ${!hasSlots ? 'course-catalog-card__action--disabled' : ''}`}
            role='button'
            ariaLabel={`加入${course.course_name}到蹭课课表`}
            onClick={hasSlots && !busy ? onAdd : undefined}
          >
            {busy ? '正在加入…' : '加入我的蹭课课表'}
          </View>
        )}
        {isAdded && personalItem?.source_status === 'updated' && (
          <View
            className='course-catalog-card__action course-catalog-card__action--primary'
            role='button'
            ariaLabel={`同步${course.course_name}的最新排课`}
            onClick={busy ? undefined : onRefresh}
          >
            {busy ? '正在同步…' : '同步最新排课'}
          </View>
        )}
        {isAdded && (
          <View
            className='course-catalog-card__action course-catalog-card__action--quiet'
            role='button'
            ariaLabel={`移除${course.course_name}的蹭课安排`}
            onClick={busy ? undefined : onRemove}
          >
            移除
          </View>
        )}
      </View>
    </View>
  )
}

interface SavedCourseCardProps {
  item: PersonalTimetableItemView
  busy: boolean
  onRemove: () => void
  onRefresh: () => void
}

function SavedCourseCard({ item, busy, onRemove, onRefresh }: SavedCourseCardProps) {
  return (
    <View className='course-catalog-saved-item'>
      <View className='course-catalog-saved-item__head'>
        <View className='course-catalog-saved-item__identity'>
          <Text className='course-catalog-saved-item__name'>{item.course_name}</Text>
          <Text className='course-catalog-saved-item__meta'>
            {[
              item.course_code && `课程代码：${item.course_code}`,
              item.opening_code && `选课号：${item.opening_code}`,
              item.teachers.length ? `教师：${item.teachers.join('、')}` : '教师未填写',
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View className={`course-catalog-card__status course-catalog-card__status--${item.source_status}`}>
          {personalStatusLabel(item.source_status)}
        </View>
      </View>
      <Text className='course-catalog-saved-item__slots'>
        {item.slots.length
          ? item.slots.map((slot) => personalSlotSummary(slot, item.location_text)).join('；')
          : '原安排暂无可展示的排课信息'}
      </Text>
      {item.source_status === 'withdrawn' && (
        <Text className='course-catalog-saved-item__note'>课程已从当前目录下架，原安排仍保留在课表中。</Text>
      )}
      <View className='course-catalog-card__actions'>
        {item.source_status === 'updated' && (
          <View
            className='course-catalog-card__action course-catalog-card__action--primary'
            role='button'
            ariaLabel={`同步${item.course_name}的最新排课`}
            onClick={busy ? undefined : onRefresh}
          >
            {busy ? '正在同步…' : '同步最新排课'}
          </View>
        )}
        <View
          className='course-catalog-card__action course-catalog-card__action--quiet'
          role='button'
          ariaLabel={`移除${item.course_name}的蹭课安排`}
          onClick={busy ? undefined : onRemove}
        >
          移除
        </View>
      </View>
    </View>
  )
}

export default function CourseCatalogPage() {
  const [educationLevel, setEducationLevel] = useState<AcademicEducationLevel>(getDefaultEducationLevel)
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [periodId, setPeriodId] = useState('')
  const [courseName, setCourseName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [submittedCourseName, setSubmittedCourseName] = useState('')
  const [submittedTeacher, setSubmittedTeacher] = useState('')
  const [items, setItems] = useState<MemberCourseCatalogCourse[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [periodLoading, setPeriodLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [personalItems, setPersonalItems] = useState<PersonalTimetableItemView[]>([])
  const [busyOfferingId, setBusyOfferingId] = useState('')
  const [busyItemId, setBusyItemId] = useState(0)
  const requestSequence = useRef(0)
  const personalItemsRequestSequence = useRef(0)

  const personalItemsByOffering = useMemo(
    () => new Map(personalItems.map((item) => [item.offering_id, item])),
    [personalItems],
  )

  const unlistedPersonalItems = useMemo(() => {
    const visibleOfferingIds = new Set(items.map((item) => item.offering_id))
    return personalItems.filter((item) => !visibleOfferingIds.has(item.offering_id))
  }, [items, personalItems])

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
      return
    }
    const requestId = personalItemsRequestSequence.current + 1
    personalItemsRequestSequence.current = requestId
    try {
      const result = await listPersonalTimetableItems(nextEducationLevel, nextPeriodId)
      if (personalItemsRequestSequence.current !== requestId) return
      setPersonalItems(result.items)
    } catch {
      // 个人课表状态不是检索主链路，失败时仍允许搜索和加入。
      if (personalItemsRequestSequence.current === requestId) setPersonalItems([])
    }
  }, [])

  const loadCourses = useCallback(async (
    nextCourseName: string,
    nextTeacher: string,
    nextPage = 1,
    nextEducationLevel = educationLevel,
    nextPeriodId = periodId,
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
  }, [educationLevel, periodId])

  useEffect(() => {
    let active = true
    setPeriodLoading(true)
    // 复用学业仓库的周期缓存，避免课程检索页重复请求校历。
    academicRepository.getPeriods()
      .then((records) => {
        if (!active) return
        setPeriods(records)
        setPeriodId((current) => current || records.find((period) => period.isCurrent)?.id || records[0]?.id || '')
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
  }, [])

  useEffect(() => {
    if (!periodId) return
    void loadCourses(submittedCourseName, submittedTeacher)
    void loadPersonalItems(educationLevel, periodId)
  }, [educationLevel, loadCourses, loadPersonalItems, periodId, submittedCourseName, submittedTeacher])

  Taro.useReachBottom(() => {
    if (loading || loadingMore || items.length >= total || !periodId) return
    void loadCourses(submittedCourseName, submittedTeacher, page + 1)
  })

  const submitSearch = () => {
    const nextCourseName = courseName.trim()
    const nextTeacher = teacher.trim()
    setSubmittedCourseName(nextCourseName)
    setSubmittedTeacher(nextTeacher)
    if (nextCourseName === submittedCourseName && nextTeacher === submittedTeacher) {
      void loadCourses(nextCourseName, nextTeacher, 1)
    }
  }

  const chooseEducationLevel = (next: AcademicEducationLevel) => {
    if (next === educationLevel) return
    setEducationLevel(next)
    setItems([])
    setPage(1)
    setTotal(0)
  }

  const choosePeriod = (next: string) => {
    if (next === periodId) return
    setPeriodId(next)
    setItems([])
    setPage(1)
    setTotal(0)
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

  const heading = submittedCourseName || submittedTeacher
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
        </View>
        </View>

        <View className='course-catalog-tip'>
          <Text>可按课程名、课程代码、选课号检索；教师名同时填写时，会同时满足两个条件。</Text>
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
                const busy = busyOfferingId === course.offering_id
                  || Boolean(personalItem && busyItemId === personalItem.id)
                return (
                  <CourseCatalogCard
                    key={course.offering_id}
                    course={course}
                    personalItem={personalItem}
                    busy={busy}
                    onAdd={() => void addCourse(course)}
                    onRemove={() => {
                      if (personalItem) void removeCourse(personalItem)
                    }}
                    onRefresh={() => {
                      if (personalItem) void refreshCourse(personalItem)
                    }}
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

        {!periodLoading && !loading && unlistedPersonalItems.length > 0 && (
          <View className='course-catalog-saved-list'>
            <View className='course-catalog-saved-list__heading'>
              <Text>我的蹭课安排</Text>
              <Text>不在当前检索结果中的已保存课程</Text>
            </View>
            <View className='course-catalog-saved-list__items'>
              {unlistedPersonalItems.map((item) => (
                <SavedCourseCard
                  key={item.id}
                  item={item}
                  busy={busyItemId === item.id}
                  onRemove={() => void removeCourse(item)}
                  onRefresh={() => void refreshCourse(item)}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
