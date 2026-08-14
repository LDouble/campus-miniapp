import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { AcademicCoursePassRatePage } from '../../../api/types'
import { listAcademicCoursePassRates } from '../../../api/academic-statistics'
import CustomNavbar from '../../../components/custom-navbar'
import { KeyboardSafeInput } from '../../../components/keyboard-safe-input'
import { openCourseStatistics } from '../../../features/academic-statistics/navigation'
import { apiDateTimeCampusParts } from '../../../utils/date-time'
import './courses.scss'

type CoursePassRate = AcademicCoursePassRatePage['items'][number]

const PAGE_SIZE = 20
const searchIcon = require('../../../assets/icons/search.svg')

const confidenceText = {
  sample_limited: '样本较少',
  reference: '可供参考',
  sufficient: '样本较充足',
} as const

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const formatPublishedAt = (value: string) => {
  if (!value) return ''
  const parts = apiDateTimeCampusParts(value)
  if (!parts) return ''
  return `${parts.year}.${String(parts.month).padStart(2, '0')}.${String(parts.day).padStart(2, '0')}`
}

export default function AcademicStatisticsCoursesPage() {
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<CoursePassRate[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [publishedAt, setPublishedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [errorText, setErrorText] = useState('')
  const requestSequence = useRef(0)

  const loadPage = useCallback(async (
    nextPage: number,
    nextKeyword: string,
  ) => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    if (nextPage === 1) {
      setLoading(true)
      setErrorText('')
    } else {
      setLoadingMore(true)
    }

    try {
      const result = await listAcademicCoursePassRates({
        keyword: nextKeyword,
        page: nextPage,
        pageSize: PAGE_SIZE,
      })
      if (requestId !== requestSequence.current) return
      setItems((previous) => (
        nextPage === 1
          ? result.items
          : [
            ...previous,
            ...result.items.filter((item) => (
              !previous.some((current) => current.course_code === item.course_code)
            )),
          ]
      ))
      setPage(result.page)
      setTotal(result.total)
      setPublishedAt(result.metadata.published_at)
      setErrorText('')
    } catch (error) {
      if (requestId !== requestSequence.current) return
      if (nextPage === 1) {
        setItems([])
        setTotal(0)
        setErrorText(error instanceof Error ? error.message : '课程数据加载失败')
      } else {
        Taro.showToast({ title: '加载更多失败', icon: 'none' })
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage(1, keyword)
    }, keyword ? 180 : 0)
    return () => clearTimeout(timer)
  }, [keyword, loadPage])

  Taro.usePullDownRefresh(() => {
    loadPage(1, keyword).finally(() => Taro.stopPullDownRefresh())
  })

  Taro.useReachBottom(() => {
    if (!loading && !loadingMore && items.length < total) {
      void loadPage(page + 1, keyword)
    }
  })

  const submitSearch = () => {
    const normalized = query.trim()
    if (normalized === keyword) {
      void loadPage(1, normalized)
      return
    }
    setKeyword(normalized)
  }

  const clearSearch = () => {
    setQuery('')
    if (keyword) setKeyword('')
  }

  const heading = keyword ? `“${keyword}”的结果` : '全部课程'

  return (
    <View className='statistics-courses'>
      <View className='statistics-courses__glow statistics-courses__glow--warm' />
      <View className='statistics-courses__glow statistics-courses__glow--teal' />
      <CustomNavbar title='课程通过率' subtitle='匿名历史成绩统计' showBack />

      <View className='statistics-courses__content'>
        <View className='statistics-search'>
          <View className='statistics-search__field'>
            <Image src={searchIcon} mode='aspectFit' />
            <KeyboardSafeInput
              value={query}
              confirmType='search'
              placeholder='搜索课程名称或课程号'
              placeholderClass='statistics-search__placeholder'
              onInput={(event) => setQuery(event.detail.value)}
              onConfirm={submitSearch}
            />
            {!!query && (
              <Text className='statistics-search__clear' onClick={clearSearch}>清除</Text>
            )}
          </View>
          <View
            className='statistics-search__button'
            hoverClass='statistics-search__button--pressed'
            onClick={submitSearch}
          >
            搜索
          </View>
        </View>

        {!loading && !errorText && (
          <View className='statistics-courses__heading'>
            <Text>{heading}</Text>
            <Text>{total} 门课程</Text>
          </View>
        )}

        {loading && (
          <View className='statistics-courses-state'>
            <View className='statistics-courses-state__loader' />
            <Text>正在读取课程统计…</Text>
          </View>
        )}

        {!loading && errorText && (
          <View className='statistics-courses-empty'>
            <Text className='statistics-courses-empty__title'>暂时无法加载课程</Text>
            <Text className='statistics-courses-empty__copy'>{errorText}</Text>
            <View
              className='statistics-courses-empty__action'
              onClick={() => loadPage(1, keyword)}
            >
              重新加载
            </View>
          </View>
        )}

        {!loading && !errorText && items.length === 0 && (
          <View className='statistics-courses-empty'>
            <Text className='statistics-courses-empty__title'>
              {keyword ? '没有找到相关课程' : '暂无课程统计'}
            </Text>
            <Text className='statistics-courses-empty__copy'>
              {keyword ? '换个课程名称或课程号试试' : '达到匿名样本门槛后会展示在这里'}
            </Text>
          </View>
        )}

        {!loading && !errorText && items.length > 0 && (
          <View className='statistics-course-list'>
            {items.map((item) => (
              <View
                key={item.course_code}
                className='statistics-course-card'
                hoverClass='statistics-course-card--pressed'
                onClick={() => openCourseStatistics({
                  courseCode: item.course_code,
                  courseName: item.course_name,
                })}
              >
                <View className='statistics-course-card__head'>
                  <View className='statistics-course-card__identity'>
                    <Text className='statistics-course-card__name'>{item.course_name}</Text>
                    <Text className='statistics-course-card__code'>{item.course_code}</Text>
                  </View>
                  <View className='statistics-course-card__rate'>
                    <Text>{formatPercent(item.pass_rate)}</Text>
                    <Text>通过率</Text>
                  </View>
                </View>
                <View className='statistics-course-card__metrics'>
                  <View>
                    <Text>{item.average_score === undefined
                      ? '—'
                      : item.average_score.toFixed(1)}
                    </Text>
                    <Text>平均分</Text>
                  </View>
                  <View>
                    <Text>{item.valid_count}</Text>
                    <Text>有效样本</Text>
                  </View>
                  <View>
                    <Text>{item.term_count}</Text>
                    <Text>统计学期</Text>
                  </View>
                  <Text className={`statistics-course-card__confidence statistics-course-card__confidence--${item.confidence}`}>
                    {confidenceText[item.confidence]}
                  </Text>
                </View>
              </View>
            ))}
            <View className='statistics-course-list__footer'>
              {loadingMore
                ? '正在加载更多…'
                : items.length < total
                  ? '继续上滑查看更多'
                  : publishedAt
                    ? `数据更新于 ${formatPublishedAt(publishedAt)}`
                    : '已展示全部课程'}
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
