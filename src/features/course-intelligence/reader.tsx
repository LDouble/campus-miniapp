import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  addCourseIntelligenceReaction,
  getCourseIntelligenceOverview,
  listCourseIntelligenceReviews,
  reportCourseIntelligenceReview,
} from '../../api/course-intelligence'
import type {
  CourseIntelligenceDimension,
  CourseIntelligenceOverview,
  CourseIntelligenceReview,
} from '../../api/types'
import { apiDateTimeCampusParts } from '../../utils/date-time'
import './reader.scss'

const dimensionOrder: CourseIntelligenceDimension[] = [
  'grading', 'attendance', 'workload', 'exam', 'classroom', 'difficulty_time',
]

const dimensionLabels: Record<CourseIntelligenceDimension, string> = {
  grading: '给分与成绩',
  attendance: '考勤与点名',
  workload: '作业与工作量',
  exam: '考试与考核',
  classroom: '课堂体验',
  difficulty_time: '难度与时间',
}

const dimensionHints: Record<CourseIntelligenceDimension, string> = {
  grading: '给分尺度、成绩构成和反馈',
  attendance: '点名频率、签到和出勤要求',
  workload: '作业、实验、小测与持续投入',
  exam: '结课形式、题型、范围和准备',
  classroom: '讲解、节奏、互动与课堂氛围',
  difficulty_time: '理解难度、复习压力和时间成本',
}

type CourseIntelligenceReaderProps = {
  courseCode: string
  currentTeacherName?: string
  onShareExperience: (teacher?: { teacherId?: number; teacherName?: string }) => void
}

const normalized = (value: string | null | undefined) => (value || '').replace(/\s+/g, '')

const reviewDate = (value: string) => {
  const parts = apiDateTimeCampusParts(value)
  return parts ? `${parts.year}/${parts.month}/${parts.day}` : '时间待确认'
}

const sourceLabel = (value: CourseIntelligenceReview['source_kind']) => (
  value === 'contribution' ? '学生投稿' : '历史讨论'
)

export default function CourseIntelligenceReader({
  courseCode,
  currentTeacherName = '',
  onShareExperience,
}: CourseIntelligenceReaderProps) {
  const [overview, setOverview] = useState<CourseIntelligenceOverview | null>(null)
  const [reviews, setReviews] = useState<CourseIntelligenceReview[]>([])
  const [teacherId, setTeacherId] = useState<number | undefined>()
  const [teacherName, setTeacherName] = useState(currentTeacherName.trim())
  const [dimension, setDimension] = useState<CourseIntelligenceDimension | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reacted, setReacted] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextOverview, nextReviews] = await Promise.all([
        getCourseIntelligenceOverview(courseCode, { teacherId, teacherName }),
        listCourseIntelligenceReviews(courseCode, {
          teacherId,
          teacherName,
          dimension: dimension === 'all' ? undefined : dimension,
          page: 1,
          pageSize: 20,
        }),
      ])
      setOverview(nextOverview)
      setReviews(nextReviews.items)
      if (teacherId === undefined && teacherName) {
        const matchingTeacher = nextOverview.teachers.find((teacher) => (
          normalized(teacher.teacher_name) === normalized(teacherName)
        ))
        if (matchingTeacher?.teacher_id) setTeacherId(matchingTeacher.teacher_id)
      }
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }, [courseCode, dimension, teacherId, teacherName])

  useEffect(() => {
    if (courseCode) void load()
  }, [courseCode, load])

  const selectedTeacherName = useMemo(() => {
    if (teacherId !== undefined && overview) {
      return overview.teachers.find((teacher) => teacher.teacher_id === teacherId)?.teacher_name || teacherName
    }
    return teacherName
  }, [overview, teacherId, teacherName])

  const selectTeacher = (nextTeacherId?: number | null, nextTeacherName = '') => {
    setTeacherId(nextTeacherId || undefined)
    setTeacherName(nextTeacherName.trim())
  }

  const toggleUseful = async (review: CourseIntelligenceReview) => {
    if (reacted[review.id]) return
    try {
      await addCourseIntelligenceReaction(review.id, 'useful')
      setReacted((current) => ({ ...current, [review.id]: true }))
      Taro.showToast({ title: '已记录反馈', icon: 'success' })
    } catch {
      Taro.showToast({ title: '反馈失败，请稍后重试', icon: 'none' })
    }
  }

  const report = async (review: CourseIntelligenceReview) => {
    const result = await Taro.showModal({
      title: '举报这条情报',
      content: '如果内容涉及隐私、失实或不当表达，可以提交给管理员复核。',
      confirmText: '提交举报',
      cancelText: '取消',
    })
    if (!result.confirm) return
    try {
      await reportCourseIntelligenceReview(review.id, 'other')
      Taro.showToast({ title: '已提交举报', icon: 'success' })
    } catch {
      Taro.showToast({ title: '举报失败，请稍后重试', icon: 'none' })
    }
  }

  return (
    <View className='course-intelligence'>
      {loading && (
        <View className='course-intelligence__state'>
          <View className='course-intelligence__loader' />
          <Text>正在整理学生情报…</Text>
        </View>
      )}

      {!loading && Boolean(error) && (
        <View className='course-intelligence__state course-intelligence__state--error'>
          <Text className='course-intelligence__state-title'>情报暂时无法加载</Text>
          <Text>{error instanceof Error ? error.message : '校园服务暂时不可用'}</Text>
          <View className='course-intelligence__text-action' onClick={() => { void load() }}>重新加载</View>
        </View>
      )}

      {!loading && !error && overview && (
        <>
          <View className='course-intelligence__notice'>
            <Text className='course-intelligence__notice-title'>先看具体经验，再做自己的判断</Text>
            <Text>情报保留学生原话、来源和适用时间，不生成教师总分或排行榜。</Text>
          </View>

          <View className='course-intelligence__filters'>
            <Text className='course-intelligence__eyebrow'>教师范围</Text>
            <View className='course-intelligence__teacher-tabs'>
              <View
                className={teacherId === undefined && !teacherName ? 'course-intelligence__teacher-tab course-intelligence__teacher-tab--active' : 'course-intelligence__teacher-tab'}
                onClick={() => selectTeacher()}
              >全部教师</View>
              {overview.teachers.map((teacher) => (
                <View
                  key={`${teacher.teacher_id || 'name'}-${normalized(teacher.teacher_name)}`}
                  className={(teacher.teacher_id && teacher.teacher_id === teacherId) || (!teacherId && normalized(teacher.teacher_name) === normalized(teacherName)) ? 'course-intelligence__teacher-tab course-intelligence__teacher-tab--active' : 'course-intelligence__teacher-tab'}
                  onClick={() => selectTeacher(teacher.teacher_id, teacher.teacher_name)}
                >
                  {teacher.teacher_name}
                </View>
              ))}
            </View>
            {selectedTeacherName && <Text className='course-intelligence__filter-note'>当前查看：{selectedTeacherName}</Text>}
            {selectedTeacherName && overview.sample_count === 0 && (
              <Text className='course-intelligence__filter-note'>暂时还没有这位老师的情报，你可以分享第一条选课经验。</Text>
            )}
          </View>

          <View className='course-intelligence__section'>
            <View className='course-intelligence__section-heading'>
              <View>
                <Text>情报概览</Text>
                <Text>{overview.sample_count} 条原子观点 · 低样本时只展示原文</Text>
              </View>
            </View>
            <View className='course-intelligence__dimension-grid'>
              {dimensionOrder.map((item) => {
                const summary = overview.dimensions.find((value) => value.dimension === item)
                return (
                  <View key={item} className='course-intelligence__dimension-card'>
                    <View className='course-intelligence__dimension-head'>
                      <Text>{dimensionLabels[item]}</Text>
                      <Text>{summary?.sample_count || 0} 条</Text>
                    </View>
                    <Text className='course-intelligence__dimension-summary'>
                      {summary?.summary || dimensionHints[item]}
                    </Text>
                    <Text className={`course-intelligence__dimension-status course-intelligence__dimension-status--${summary?.status || 'insufficient'}`}>
                      {summary?.status === 'ready' ? '样本可供参考' : summary?.status === 'conflicted' ? '体验存在差异' : '样本仍偏少'}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View className='course-intelligence__section'>
            <View className='course-intelligence__section-heading'>
              <View>
                <Text>学生原始观点</Text>
                <Text>每条观点都保留可回溯的证据片段</Text>
              </View>
            </View>
            <View className='course-intelligence__dimension-filter'>
              <View className={dimension === 'all' ? 'course-intelligence__dimension-filter-item course-intelligence__dimension-filter-item--active' : 'course-intelligence__dimension-filter-item'} onClick={() => setDimension('all')}>全部</View>
              {dimensionOrder.map((item) => (
                <View key={item} className={dimension === item ? 'course-intelligence__dimension-filter-item course-intelligence__dimension-filter-item--active' : 'course-intelligence__dimension-filter-item'} onClick={() => setDimension(item)}>{dimensionLabels[item]}</View>
              ))}
            </View>

            {reviews.length > 0 ? (
              <View className='course-intelligence__review-list'>
                {reviews.map((review) => (
                  <View key={review.id} className='course-intelligence__review-card'>
                    <View className='course-intelligence__review-meta'>
                      <Text>{dimensionLabels[review.dimension]}</Text>
                      <Text>{sourceLabel(review.source_kind)} · {review.applicable_term || reviewDate(review.published_at)}</Text>
                    </View>
                    <Text className='course-intelligence__review-content'>{review.content}</Text>
                    <View className='course-intelligence__evidence'>
                      <Text>原文证据</Text>
                      <Text>“{review.evidence_span}”</Text>
                    </View>
                    <View className='course-intelligence__review-actions'>
                      <View className={reacted[review.id] ? 'course-intelligence__review-action course-intelligence__review-action--active' : 'course-intelligence__review-action'} onClick={() => { void toggleUseful(review) }}>
                        {reacted[review.id] ? '已标记有帮助' : '这条有帮助'}
                      </View>
                      <View className='course-intelligence__review-action course-intelligence__review-action--muted' onClick={() => { void report(review) }}>举报</View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className='course-intelligence__empty-copy'>当前筛选下还没有具体观点，欢迎分享你的亲身经验。</View>
            )}
          </View>

          {overview.exam.sample_count > 0 && (
            <View className='course-intelligence__exam'>
              <View className='course-intelligence__section-heading'>
                <View>
                  <Text>考试内容与方式</Text>
                  <Text>历史经验不等同于本学期确定安排</Text>
                </View>
              </View>
              <Text>{overview.exam.sample_count} 条考试相关观点，具体请结合学期和教师查看。</Text>
            </View>
          )}

          {overview.recent_changes.length > 0 && (
            <View className='course-intelligence__changes'>
              <Text className='course-intelligence__changes-title'>近期变化</Text>
              {overview.recent_changes.map((change) => (
                <View key={`${change.term}-${change.dimension}`}>
                  <Text>{change.term} · {dimensionLabels[change.dimension]}</Text>
                  <Text>{change.description}</Text>
                </View>
              ))}
            </View>
          )}

          <View className='course-intelligence__source-notes'>
            {overview.source_notes.map((note) => <Text key={note}>· {note}</Text>)}
          </View>
        </>
      )}

      <View className='course-intelligence__cta-wrap'>
        <View className='course-intelligence__cta' onClick={() => onShareExperience({ teacherId, teacherName: selectedTeacherName })}>
          <Text>分享我的选课经验</Text>
          <Text>自由表达，AI 会在后台整理维度</Text>
        </View>
      </View>
    </View>
  )
}
