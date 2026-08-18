import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { openCourseStatistics } from '../navigation'
import {
  CoursePassRate,
  getCoursePassRatePreview,
} from '../repository'
import {
  isAcademicBindingRequiredError,
  openAcademicCredentialBinding,
} from '../../academic-verification/binding-guidance'
import './index.scss'

type Props = {
  courseCode?: string
  courseName: string
  teacherName?: string
}

const confidenceText = {
  sample_limited: '样本较少',
  reference: '可供参考',
  sufficient: '样本较充足',
} as const

export default function CoursePassRatePreview({
  courseCode = '',
  courseName,
  teacherName = '',
}: Props) {
  const [data, setData] = useState<CoursePassRate | null>(null)
  const [loading, setLoading] = useState(Boolean(courseCode.trim()))
  const [empty, setEmpty] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [bindingRequired, setBindingRequired] = useState(false)

  useEffect(() => {
    const normalized = courseCode.trim()
    if (!normalized) {
      setLoading(false)
      setEmpty(true)
      return
    }
    let active = true
    setLoading(true)
    setEmpty(false)
    setData(null)
    setFromCache(false)
    setBindingRequired(false)
    getCoursePassRatePreview(normalized)
      .then((result) => {
        if (!active) return
        setData(result.data)
        setFromCache(result.fromCache)
        setEmpty(!result.data)
      })
      .catch((error) => {
        if (!active) return
        setData(null)
        setFromCache(false)
        setBindingRequired(isAcademicBindingRequiredError(error))
        setEmpty(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [courseCode])

  if (!courseCode.trim()) return null

  const openDetails = () => {
    if (bindingRequired) {
      void openAcademicCredentialBinding()
      return
    }
    void openCourseStatistics({ courseCode, courseName, teacherName })
  }

  return (
    <View
      className={[
        'course-reference',
        loading ? 'course-reference--loading' : '',
        empty ? 'course-reference--empty' : '',
      ].filter(Boolean).join(' ')}
      hoverClass='course-reference--pressed'
      onClick={openDetails}
    >
      <View className='course-reference__heading'>
        <View>
          <Text className='course-reference__title'>课程参考</Text>
          <Text className='course-reference__hint'>
            {fromCache ? '网络异常，展示上次数据' : '匿名汇总的历史成绩'}
          </Text>
        </View>
        <Text className='course-reference__arrow'>›</Text>
      </View>
      {loading && (
        <View className='course-reference__skeleton'>
          <View />
          <View />
        </View>
      )}
      {!loading && data && !bindingRequired && (
        <View className='course-reference__metrics'>
          <View>
            <Text>{Math.round(data.pass_rate * 100)}%</Text>
            <Text>历史通过率</Text>
          </View>
          <View>
            <Text>{data.average_score === undefined ? '—' : data.average_score.toFixed(1)}</Text>
            <Text>百分制平均分</Text>
          </View>
          <View>
            <Text>{data.valid_count}</Text>
            <Text>{confidenceText[data.confidence]}</Text>
          </View>
        </View>
      )}
      {!loading && empty && (
        <Text className='course-reference__empty'>
          {bindingRequired ? '绑定教务账号后查看课程通过率' : '暂未积累到足够的历史样本'}
        </Text>
      )}
    </View>
  )
}
