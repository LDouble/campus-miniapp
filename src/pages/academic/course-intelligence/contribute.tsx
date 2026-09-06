import { useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { KeyboardSafeTextarea } from '../../../components/keyboard-safe-input'
import { createCourseIntelligenceContribution } from '../../../api/course-intelligence'
import type {
  CourseIntelligenceAttendedStatus,
  CourseIntelligenceContributionInput,
  CourseIntelligenceDimension,
  CourseIntelligenceVisibility,
} from '../../../api/types'
import './contribute.scss'

const dimensions: Array<{ value: CourseIntelligenceDimension; label: string; hint: string }> = [
  { value: 'grading', label: '给分与成绩', hint: '给分尺度、成绩构成' },
  { value: 'attendance', label: '考勤与点名', hint: '点名频率、出勤要求' },
  { value: 'workload', label: '作业与工作量', hint: '作业、实验、小测' },
  { value: 'exam', label: '考试与考核', hint: '结课形式、题型范围' },
  { value: 'classroom', label: '课堂体验', hint: '讲解、节奏、互动' },
  { value: 'difficulty_time', label: '难度与时间', hint: '复习压力、时间投入' },
]

const attendedOptions: Array<{ value: CourseIntelligenceAttendedStatus; label: string }> = [
  { value: 'attended', label: '我亲自上过' },
  { value: 'auditing', label: '我旁听过' },
  { value: 'dropped', label: '中途退选' },
  { value: 'unknown', label: '不确定' },
]

const decodeParam = (value?: string) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default function CourseIntelligenceContributionPage() {
  const router = useRouter()
  const courseCode = decodeParam(router.params.course_code).trim()
  const courseName = decodeParam(router.params.course_name).trim()
  const teacherName = decodeParam(router.params.teacher_name).trim()
  const term = decodeParam(router.params.term).trim()
  const teacherID = Number(router.params.teacher_id)
  const teacherId = Number.isFinite(teacherID) && teacherID > 0 ? teacherID : undefined
  const [selectedDimensions, setSelectedDimensions] = useState<CourseIntelligenceDimension[]>([])
  const [attendedStatus, setAttendedStatus] = useState<CourseIntelligenceAttendedStatus>('attended')
  const [visibility, setVisibility] = useState<CourseIntelligenceVisibility>('anonymous')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const contextTitle = useMemo(() => courseName || courseCode || '当前课程', [courseCode, courseName])

  const toggleDimension = (value: CourseIntelligenceDimension) => {
    setSelectedDimensions((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length >= 6 ? current : [...current, value]
    ))
  }

  const submit = async () => {
    if (!courseCode) {
      Taro.showToast({ title: '缺少课程上下文', icon: 'none' })
      return
    }
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      Taro.showToast({ title: '请先写下你的真实经历', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const input: CourseIntelligenceContributionInput = {
        course_code: courseCode,
        ...(courseName ? { course_name: courseName } : {}),
        ...(teacherId ? { teacher_id: teacherId } : {}),
        ...(teacherName ? { teacher_name: teacherName } : {}),
        ...(term ? { term } : {}),
        context_source: 'course_statistics',
        attended_status: attendedStatus,
        visibility,
        ...(selectedDimensions.length ? { guided_dimensions: selectedDimensions } : {}),
        content: trimmedContent,
      }
      await createCourseIntelligenceContribution(input)
      const result = await Taro.showModal({
        title: '已提交，正在处理',
        content: '你的原文已保存，后台会完成隐私检测、审核和情报抽取。处理完成后会显示在课程情报中。',
        showCancel: false,
        confirmText: '知道了',
      })
      if (result.confirm) Taro.navigateBack()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '提交失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='course-intelligence-contribute'>
      <CustomNavbar title='分享选课经验' subtitle={courseCode || '课程情报'} showBack />
      <View className='course-intelligence-contribute__content'>
        <View className='course-intelligence-contribute__context'>
          <Text className='course-intelligence-contribute__eyebrow'>当前课程</Text>
          <Text className='course-intelligence-contribute__course'>{contextTitle}</Text>
          <Text className='course-intelligence-contribute__meta'>
            {courseCode || '课程编号待确认'}{teacherName ? ` · ${teacherName}` : ''}{term ? ` · ${term}` : ''}
          </Text>
        </View>

        <View className='course-intelligence-contribute__section'>
          <View className='course-intelligence-contribute__heading'>
            <Text>先选你想分享的方向</Text>
            <Text>可多选，也可以不选</Text>
          </View>
          <View className='course-intelligence-contribute__dimension-grid'>
            {dimensions.map((item) => {
              const selected = selectedDimensions.includes(item.value)
              return (
                <View
                  key={item.value}
                  className={selected ? 'course-intelligence-contribute__dimension course-intelligence-contribute__dimension--selected' : 'course-intelligence-contribute__dimension'}
                  ariaRole='checkbox'
                  ariaLabel={`${selected ? '取消' : '选择'}${item.label}`}
                  onClick={() => toggleDimension(item.value)}
                >
                  <Text>{item.label}</Text>
                  <Text>{item.hint}</Text>
                </View>
              )
            })}
          </View>
        </View>

        <View className='course-intelligence-contribute__section'>
          <View className='course-intelligence-contribute__heading'>
            <Text>你的亲身经历</Text>
            <Text>自由表达是主体</Text>
          </View>
          <KeyboardSafeTextarea
            value={content}
            maxlength={10000}
            autoHeight
            placeholder='例如：平时不点名，作业每周一次；期末闭卷，主要考课件和课堂例题。'
            onInput={(event) => setContent(event.detail.value)}
          />
          <Text className='course-intelligence-contribute__tip'>请不要填写手机号、学号、联系方式或私人聊天内容。不要把一次经历写成对教师人格的判断。</Text>
        </View>

        <View className='course-intelligence-contribute__section'>
          <View className='course-intelligence-contribute__heading'>
            <Text>修读状态</Text>
            <Text>帮助读者判断信息语境</Text>
          </View>
          <View className='course-intelligence-contribute__options'>
            {attendedOptions.map((item) => (
              <View
                key={item.value}
                className={attendedStatus === item.value ? 'course-intelligence-contribute__option course-intelligence-contribute__option--selected' : 'course-intelligence-contribute__option'}
                onClick={() => setAttendedStatus(item.value)}
              >{item.label}</View>
            ))}
          </View>
        </View>

        <View className='course-intelligence-contribute__section'>
          <View className='course-intelligence-contribute__heading'>
            <Text>对外展示</Text>
            <Text>后台保留受控提交者标识</Text>
          </View>
          <View className='course-intelligence-contribute__options'>
            {(['anonymous', 'public'] as CourseIntelligenceVisibility[]).map((item) => (
              <View
                key={item}
                className={visibility === item ? 'course-intelligence-contribute__option course-intelligence-contribute__option--selected' : 'course-intelligence-contribute__option'}
                onClick={() => setVisibility(item)}
              >{item === 'anonymous' ? '匿名展示' : '展示我的昵称'}</View>
            ))}
          </View>
        </View>

        <View className='course-intelligence-contribute__footer'>
          <Text>提交后会先保存原文，再异步进行隐私检测、审核和 AI 抽取。</Text>
          <View
            className={submitting ? 'course-intelligence-contribute__submit course-intelligence-contribute__submit--disabled' : 'course-intelligence-contribute__submit'}
            ariaRole='button'
            ariaLabel='提交选课经验'
            onClick={() => { if (!submitting) void submit() }}
          >{submitting ? '正在提交…' : '提交我的经验'}</View>
        </View>
      </View>
    </View>
  )
}
