import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { isApiError } from '../../../api/client'
import {
  listGeneralEducationModules,
  searchGeneralEducationCourses,
} from '../../../api/general-education'
import type {
  MemberCourseCatalogGeneralEducationModule,
  MemberGeneralEducationCourse,
  MemberGeneralEducationCourseModule,
} from '../../../api/types'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import CustomNavbar from '../../../components/custom-navbar'
import './index.scss'

const PAGE_SIZE = 20

type GeneralEducationView = 'module' | 'course'

const apiErrorMessage = (error: unknown, fallback: string) => {
  if (isApiError(error)) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

const formatSourceDate = (createdAt: string) => {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function GeneralEducationModuleTags({
  modules,
}: {
  modules: MemberGeneralEducationCourseModule[]
}) {
  return (
    <View className='general-education-course-card__modules' ariaRole='list' ariaLabel='通识模块归属'>
      <Text className='general-education-course-card__modules-label'>通识模块</Text>
      {modules.length > 0 ? (
        <View className='general-education-course-card__module-list'>
          {modules.map((module) => (
            <View key={module.id} className='general-education-course-card__module'>
              <Text>{module.name}</Text>
              {module.sources.length > 0 && (
                <Text className='general-education-course-card__module-count'>
                  {module.sources.length} 条来源
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text className='general-education-course-card__modules-empty'>暂无模块归属</Text>
      )}
    </View>
  )
}

function GeneralEducationSourceHistory({
  modules,
}: {
  modules: MemberGeneralEducationCourseModule[]
}) {
  const sources = modules.flatMap((module) => module.sources.map((source) => ({
    key: `${module.id}-${source.id}`,
    title: `${module.name} · ${source.title}`,
    date: formatSourceDate(source.created_at),
  })))
  const visibleSources = sources.slice(0, 3)

  if (visibleSources.length === 0) return null

  return (
    <View className='general-education-course-card__source-history'>
      <Text className='general-education-course-card__source-label'>归属来源</Text>
      {visibleSources.map((source) => (
        <View key={source.key} className='general-education-course-card__source-row'>
          <Text className='general-education-course-card__source-title'>{source.title}</Text>
          {source.date && <Text className='general-education-course-card__source-date'>{source.date}</Text>}
        </View>
      ))}
      {sources.length > visibleSources.length && (
        <Text className='general-education-course-card__source-more'>
          还有 {sources.length - visibleSources.length} 条来源记录
        </Text>
      )}
    </View>
  )
}

function GeneralEducationCourseCard({ course }: { course: MemberGeneralEducationCourse }) {
  const references = [
    course.course_code ? `课程代码 ${course.course_code}` : '',
    course.offering_unit ? `开设单位 ${course.offering_unit}` : '',
  ].filter(Boolean)

  return (
    <View className='general-education-course-card'>
      <View className='general-education-course-card__head'>
        <Text className='general-education-course-card__name'>{course.course_name}</Text>
      </View>

      {references.length > 0 && (
        <View className='general-education-course-card__references'>
          {references.map((reference) => <Text key={reference}>{reference}</Text>)}
        </View>
      )}

      <GeneralEducationModuleTags modules={course.modules} />
      <GeneralEducationSourceHistory modules={course.modules} />
    </View>
  )
}

function GeneralEducationLoading({ label }: { label: string }) {
  return (
    <View className='general-education-state'>
      <View className='general-education-state__loader' />
      <Text>{label}</Text>
    </View>
  )
}

function GeneralEducationEmpty({ title, copy }: { title: string; copy: string }) {
  return (
    <View className='general-education-empty'>
      <Text className='general-education-empty__title'>{title}</Text>
      <Text className='general-education-empty__copy'>{copy}</Text>
    </View>
  )
}

interface GeneralEducationCourseResultsProps {
  heading: string
  total: number
  items: MemberGeneralEducationCourse[]
  loading: boolean
  loadingMore: boolean
  loadError: unknown
  emptyTitle: string
  emptyCopy: string
  onRetry: () => void
}

function GeneralEducationCourseResults({
  heading,
  total,
  items,
  loading,
  loadingMore,
  loadError,
  emptyTitle,
  emptyCopy,
  onRetry,
}: GeneralEducationCourseResultsProps) {
  if (loading) return <GeneralEducationLoading label='正在检索通识课程…' />

  if (loadError) {
    return (
      <View className='general-education-empty'>
        <Text className='general-education-empty__title'>暂时无法加载课程</Text>
        <Text className='general-education-empty__copy'>
          {apiErrorMessage(loadError, '通识课程加载失败，请稍后重试')}
        </Text>
        <View
          className='general-education-empty__action'
          role='button'
          ariaLabel='重新加载通识课程'
          onClick={onRetry}
        >重新加载</View>
      </View>
    )
  }

  if (items.length === 0) {
    return <GeneralEducationEmpty title={emptyTitle} copy={emptyCopy} />
  }

  return (
    <View className='general-education-results'>
      <View className='general-education-results__heading'>
        <Text>{heading}</Text>
        <Text>{total} 门课程</Text>
      </View>
      <View className='general-education-results__list'>
        {items.map((course) => (
          <GeneralEducationCourseCard
            key={`${course.course_code}-${course.course_name}`}
            course={course}
          />
        ))}
      </View>
      {loadingMore && <Text className='general-education-results__footer'>正在加载更多…</Text>}
      {!loadingMore && items.length < total && (
        <Text className='general-education-results__footer'>上拉加载更多课程</Text>
      )}
    </View>
  )
}

export default function GeneralEducationPage() {
  const [activeView, setActiveView] = useState<GeneralEducationView>('module')
  const [modules, setModules] = useState<MemberCourseCatalogGeneralEducationModule[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState(0)
  const [courseQuery, setCourseQuery] = useState('')
  const [submittedCourseQuery, setSubmittedCourseQuery] = useState('')
  const [items, setItems] = useState<MemberGeneralEducationCourse[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [moduleLoading, setModuleLoading] = useState(true)
  const [moduleLoadError, setModuleLoadError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const courseRequestSequence = useRef(0)
  const moduleRequestSequence = useRef(0)

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === selectedModuleId),
    [modules, selectedModuleId],
  )

  const resetCourseResults = useCallback(() => {
    courseRequestSequence.current += 1
    setItems([])
    setPage(1)
    setTotal(0)
    setLoading(false)
    setLoadingMore(false)
    setLoadError(null)
  }, [])

  const loadCourses = useCallback(async (
    nextModuleId: number,
    nextKeyword: string,
    nextPage = 1,
  ) => {
    if (nextModuleId <= 0 && !nextKeyword.trim()) {
      resetCourseResults()
      return
    }

    const requestId = courseRequestSequence.current + 1
    courseRequestSequence.current = requestId
    if (nextPage === 1) {
      setLoading(true)
      setLoadError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const result = await searchGeneralEducationCourses({
        keyword: nextKeyword,
        moduleId: nextModuleId,
        page: nextPage,
        pageSize: PAGE_SIZE,
      })
      if (courseRequestSequence.current !== requestId) return
      setItems((current) => nextPage === 1
        ? result.items
        : [
          ...current,
          ...result.items.filter((item) => (
            !current.some((candidate) => (
              candidate.course_code === item.course_code
              && candidate.course_name === item.course_name
            ))
          )),
        ])
      setPage(result.page)
      setTotal(result.total)
    } catch (error) {
      if (courseRequestSequence.current !== requestId) return
      if (nextPage === 1) {
        setItems([])
        setPage(1)
        setTotal(0)
        setLoadError(error)
      } else {
        Taro.showToast({ title: apiErrorMessage(error, '加载更多失败'), icon: 'none' })
      }
    } finally {
      if (courseRequestSequence.current === requestId) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [resetCourseResults])

  const loadModules = useCallback(async (
    nextView: GeneralEducationView,
    preferredModuleId = 0,
    nextKeyword = '',
  ) => {
    const requestId = moduleRequestSequence.current + 1
    moduleRequestSequence.current = requestId
    resetCourseResults()
    setModules([])
    setSelectedModuleId(0)
    setModuleLoading(true)
    setModuleLoadError(false)

    if (nextView === 'course' && nextKeyword.trim()) {
      void loadCourses(0, nextKeyword, 1)
    }

    try {
      const result = await listGeneralEducationModules()
      if (moduleRequestSequence.current !== requestId) return
      const nextModules = result.items
        .filter((module) => module.name.trim())
        .map((module) => ({ id: module.id, name: module.name.trim() }))
      const nextModuleId = nextModules.some((module) => module.id === preferredModuleId)
        ? preferredModuleId
        : nextModules[0]?.id || 0
      setModules(nextModules)
      setSelectedModuleId(nextModuleId)
      if (nextView === 'module' && nextModuleId > 0) {
        void loadCourses(nextModuleId, '', 1)
      }
    } catch {
      if (moduleRequestSequence.current === requestId) setModuleLoadError(true)
    } finally {
      if (moduleRequestSequence.current === requestId) setModuleLoading(false)
    }
  }, [loadCourses, resetCourseResults])

  useEffect(() => {
    void loadModules('module')
  }, [loadModules])

  Taro.usePullDownRefresh(() => {
    void loadModules(
      activeView,
      activeView === 'module' ? selectedModuleId : 0,
      activeView === 'course' ? submittedCourseQuery : '',
    ).finally(() => Taro.stopPullDownRefresh())
  })

  Taro.useReachBottom(() => {
    if (loading || loadingMore || items.length >= total) return
    if (activeView === 'module' && selectedModuleId > 0) {
      void loadCourses(selectedModuleId, '', page + 1)
    }
    if (activeView === 'course' && submittedCourseQuery) {
      void loadCourses(0, submittedCourseQuery, page + 1)
    }
  })

  const chooseModule = (moduleId: number) => {
    if (moduleId === selectedModuleId) return
    setSelectedModuleId(moduleId)
    resetCourseResults()
    void loadCourses(moduleId, '', 1)
  }

  const switchView = (nextView: GeneralEducationView) => {
    if (nextView === activeView) return
    setActiveView(nextView)
    resetCourseResults()
    if (nextView === 'module') {
      const nextModuleId = selectedModuleId || modules[0]?.id || 0
      setSelectedModuleId(nextModuleId)
      if (nextModuleId > 0) void loadCourses(nextModuleId, '', 1)
      return
    }
    if (submittedCourseQuery) void loadCourses(0, submittedCourseQuery, 1)
  }

  const submitCourseSearch = () => {
    const normalized = courseQuery.trim()
    setSubmittedCourseQuery(normalized)
    resetCourseResults()
    if (normalized) void loadCourses(0, normalized, 1)
  }

  const clearCourseSearch = () => {
    setCourseQuery('')
    setSubmittedCourseQuery('')
    resetCourseResults()
  }

  const retry = () => {
    if (activeView === 'module') {
      void loadModules('module', selectedModuleId)
      return
    }
    if (submittedCourseQuery) {
      void loadCourses(0, submittedCourseQuery, 1)
      return
    }
    void loadModules('course')
  }

  return (
    <View className='general-education-page'>
      <CustomNavbar title='通识模块查询' subtitle='本科通识课程 · 按模块或课程查归属' showBack />
      <View className='general-education-page__content'>
        <View className='general-education-note' role='status' ariaLabel='通识模块数据说明'>
          <Text className='general-education-note__icon'>i</Text>
          <Text>数据来源于教务处历史通知。</Text>
        </View>

        <View className='general-education-tabs'>
          <View
            className={`general-education-tabs__item ${activeView === 'module' ? 'general-education-tabs__item--active' : ''}`}
            role='button'
            ariaLabel='按通识模块查课程'
            onClick={() => switchView('module')}
          >按模块查课程</View>
          <View
            className={`general-education-tabs__item ${activeView === 'course' ? 'general-education-tabs__item--active' : ''}`}
            role='button'
            ariaLabel='按课程查通识模块'
            onClick={() => switchView('course')}
          >按课程查模块</View>
        </View>

        {activeView === 'module' ? (
          <View className='general-education-module-view'>
            <View className='general-education-module-panel'>
              <View className='general-education-panel-heading'>
                <View>
                  <Text className='general-education-panel-heading__title'>通识模块</Text>
                  <Text className='general-education-panel-heading__copy'>模块选项由服务端下发</Text>
                </View>
                {!moduleLoading && !moduleLoadError && <Text>{modules.length} 个模块</Text>}
              </View>

              {moduleLoading ? (
                <GeneralEducationLoading label='正在读取通识模块…' />
              ) : moduleLoadError ? (
                <View className='general-education-empty general-education-empty--compact'>
                  <Text className='general-education-empty__title'>通识模块暂时不可用</Text>
                  <Text className='general-education-empty__copy'>请稍后重试，模块选项由服务端提供。</Text>
                  <View
                    className='general-education-empty__action'
                    role='button'
                    ariaLabel='重新读取通识模块'
                    onClick={retry}
                  >重新加载</View>
                </View>
              ) : modules.length === 0 ? (
                <GeneralEducationEmpty title='暂无通识模块' copy='管理端导入模块通知后，这里会自动更新。' />
              ) : (
                <View className='general-education-module-grid' role='list' ariaLabel='通识模块列表'>
                  {modules.map((module) => (
                    <View
                      key={module.id}
                      className={`general-education-module-option ${module.id === selectedModuleId ? 'general-education-module-option--active' : ''}`}
                      role='button'
                      ariaLabel={`查看${module.name}课程`}
                      onClick={() => chooseModule(module.id)}
                    >
                      <Text>{module.name}</Text>
                      {module.id === selectedModuleId && <Text className='general-education-module-option__mark'>已选</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {selectedModule && (
              <GeneralEducationCourseResults
                heading={selectedModule.name}
                total={total}
                items={items}
                loading={loading}
                loadingMore={loadingMore}
                loadError={loadError}
                emptyTitle='这个模块暂时没有课程'
                emptyCopy='可以切换其他模块试试。'
                onRetry={retry}
              />
            )}
          </View>
        ) : (
          <View className='general-education-course-view'>
            <View className='general-education-search'>
              <Text className='general-education-search__label'>课程关键词</Text>
              <View className='general-education-search__row'>
                <View className='general-education-search__field'>
                  <KeyboardSafeInput
                    value={courseQuery}
                    maxlength={40}
                    confirmType='search'
                    placeholder='课程名或课程代码'
                    placeholderClass='general-education-search__placeholder'
                    onInput={(event) => setCourseQuery(event.detail.value)}
                    onConfirm={submitCourseSearch}
                  />
                  {!!courseQuery && (
                    <View
                      className='general-education-search__clear'
                      role='button'
                      ariaLabel='清除课程关键词'
                      onClick={clearCourseSearch}
                    >清除</View>
                  )}
                </View>
                <View
                  className='general-education-search__button'
                  role='button'
                  ariaLabel='搜索通识课程'
                  onClick={submitCourseSearch}
                >搜索</View>
              </View>
              <Text className='general-education-search__hint'>搜索结果会展示课程的全部通识模块及来源记录。</Text>
            </View>

            {submittedCourseQuery ? (
              <GeneralEducationCourseResults
                heading={`“${submittedCourseQuery}”的结果`}
                total={total}
                items={items}
                loading={loading}
                loadingMore={loadingMore}
                loadError={loadError}
                emptyTitle='没有找到相关课程'
                emptyCopy='换个课程名称或课程代码试试。'
                onRetry={retry}
              />
            ) : (
              <GeneralEducationEmpty title='输入课程后开始查询' copy='支持课程名称和课程代码。' />
            )}
          </View>
        )}
      </View>
    </View>
  )
}
