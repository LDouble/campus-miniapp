import { Text, View } from '@tarojs/components'
import { openCourseStatistics } from '../navigation'
import { useCoursePassRatePreview } from './state'
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
  const {
    bindingRequired,
    data,
    fromCache,
    loading,
  } = useCoursePassRatePreview(courseCode)

  if (
    !courseCode.trim()
    || loading
    || !data
    || !Number.isFinite(data.pass_rate)
    || bindingRequired
  ) return null

  const openDetails = () => {
    void openCourseStatistics({ courseCode, courseName, teacherName })
  }

  return (
    <View
      className='course-reference'
      ariaRole='button'
      ariaLabel={`查看${courseName}课程参考数据`}
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
    </View>
  )
}
