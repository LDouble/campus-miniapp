import { Text, View } from '@tarojs/components'
import { openCourseStatistics } from '../navigation'
import {
  academicBindingGuidance,
  openAcademicCredentialBinding,
} from '../../academic-verification/binding-guidance'
import { requestWechatSubscriptionAndStopPropagation } from '../../wechat-subscription'
import { useCoursePassRatePreview } from './state'
import './sheet.scss'

type Props = {
  courseCode: string
  courseName: string
  onClose: () => void
  teacherName?: string
}

const confidenceText = {
  sample_limited: '样本较少',
  reference: '可供参考',
  sufficient: '样本较充足',
} as const

const errorMessage = (error: unknown) => (
  error instanceof Error && error.message
    ? error.message
    : '暂时无法获取课程参考数据'
)

export default function CoursePassRateSheet({
  courseCode,
  courseName,
  onClose,
  teacherName = '',
}: Props) {
  const {
    bindingRequired,
    data,
    error,
    fromCache,
    loading,
    reload,
  } = useCoursePassRatePreview(courseCode)

  const openDetails = () => {
    void openCourseStatistics({ courseCode, courseName, teacherName })
  }

  return (
    <View className='course-pass-rate-overlay' onClick={onClose}>
      <View
        className='course-pass-rate-sheet'
        onClick={requestWechatSubscriptionAndStopPropagation}
      >
        <View className='course-pass-rate-sheet__handle' />
        <View
          className='course-pass-rate-sheet__close'
          role='button'
          ariaLabel='关闭课程通过率'
          onClick={onClose}
        >×</View>
        <View className='course-pass-rate-sheet__header'>
          <Text className='course-pass-rate-sheet__eyebrow'>课程参考</Text>
          <Text className='course-pass-rate-sheet__title'>{courseName}</Text>
          <Text className='course-pass-rate-sheet__subtitle'>匿名汇总的历史成绩，仅供选课与旁听参考</Text>
        </View>

        {loading && (
          <View className='course-pass-rate-sheet__state'>
            <View className='course-pass-rate-sheet__loader' />
            <Text>正在查询历史通过率…</Text>
          </View>
        )}

        {!loading && bindingRequired && (
          <View className='course-pass-rate-sheet__state'>
            <Text className='course-pass-rate-sheet__state-title'>{academicBindingGuidance.title}</Text>
            <Text>{academicBindingGuidance.message}</Text>
            <View
              className='course-pass-rate-sheet__text-action'
              role='button'
              ariaLabel={academicBindingGuidance.actionLabel}
              onClick={() => void openAcademicCredentialBinding()}
            >{academicBindingGuidance.actionLabel}</View>
          </View>
        )}

        {!loading && !bindingRequired && !data && (
          <View className='course-pass-rate-sheet__state'>
            <Text className='course-pass-rate-sheet__state-title'>暂时没有可展示的数据</Text>
            <Text>{error ? errorMessage(error) : '当前课程尚未积累到足够的历史样本'}</Text>
            {Boolean(error) && (
              <View
                className='course-pass-rate-sheet__text-action'
                role='button'
                ariaLabel='重新查询课程通过率'
                onClick={reload}
              >重新查询</View>
            )}
          </View>
        )}

        {!loading && data && (
          <>
            <View className='course-pass-rate-sheet__metrics'>
              <View className='course-pass-rate-sheet__metric course-pass-rate-sheet__metric--primary'>
                <Text>{Math.round(data.pass_rate * 100)}%</Text>
                <Text>历史通过率</Text>
              </View>
              <View className='course-pass-rate-sheet__metric'>
                <Text>{data.average_score === undefined ? '—' : data.average_score.toFixed(1)}</Text>
                <Text>百分制平均分</Text>
              </View>
              <View className='course-pass-rate-sheet__metric'>
                <Text>{data.valid_count}</Text>
                <Text>{confidenceText[data.confidence]}</Text>
              </View>
            </View>
            {fromCache && <Text className='course-pass-rate-sheet__cache'>网络异常，展示上次保存的数据</Text>}
            <View
              className='course-pass-rate-sheet__details-action'
              role='button'
              ariaLabel={`查看${courseName}的完整通过率详情`}
              onClick={openDetails}
            >
              <Text>查看完整详情</Text>
              <Text>›</Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
