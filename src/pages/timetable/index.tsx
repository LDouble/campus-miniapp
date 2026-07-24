import { Picker, ScrollView, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import { AcademicHeader } from '../../components/AcademicHeader'
import { DesignIcon } from '../../components/DesignIcon'
import { getCoursesForDay, semesterOptions } from '../../services/academic-display'
import './index.scss'

const weekdays = [
  { short: '一', date: '23' },
  { short: '二', date: '24' },
  { short: '三', date: '25' },
  { short: '四', date: '26' },
  { short: '五', date: '27' },
  { short: '六', date: '28' },
  { short: '日', date: '29' }
]

const sectionTimes: Record<number, string> = {
  1: '08:00', 3: '10:10', 5: '14:00', 7: '16:10', 9: '19:00'
}

export default function Timetable () {
  const [semester, setSemester] = useState(0)
  const [week, setWeek] = useState(8)
  const [weekday, setWeekday] = useState(1)
  const courses = useMemo(() => getCoursesForDay(weekday), [weekday])

  return <View className='timetable-page'>
    <View className='academic-orb academic-orb-a' />
    <View className='academic-orb academic-orb-b' />
    <AcademicHeader title='我的课表' meta='SCHEDULE' tone='sage' />

    <ScrollView scrollY className='academic-scroll'>
      <View className='term-row'>
        <Picker mode='selector' range={semesterOptions} value={semester} onChange={event => setSemester(Number(event.detail.value))}>
          <View className='term-picker'><Text>{semesterOptions[semester]}</Text><Text className='picker-chevron'>⌄</Text></View>
        </Picker>
        <View className='sync-state'><View className='sync-dot' /><Text>展示样例</Text></View>
      </View>

      <View className='week-panel'>
        <View className='week-switch'>
          <Text onClick={() => setWeek(value => Math.max(1, value - 1))}>‹</Text>
          <View><Text className='week-label'>第 {week} 周</Text><Text className='week-range'>3月23日 — 3月29日</Text></View>
          <Text onClick={() => setWeek(value => Math.min(20, value + 1))}>›</Text>
        </View>
        <ScrollView scrollX className='weekday-scroll' enhanced showScrollbar={false}>
          <View className='weekday-row'>
            {weekdays.map((day, index) => {
              const value = index + 1
              return <View key={day.short} className={`weekday ${weekday === value ? 'active' : ''}`} onClick={() => setWeekday(value)}>
                <Text className='weekday-name'>周{day.short}</Text>
                <Text className='weekday-date'>{day.date}</Text>
                {getCoursesForDay(value).length > 0 && <View className='course-dot' />}
              </View>
            })}
          </View>
        </ScrollView>
      </View>

      <View className='day-heading'>
        <View><Text className='day-kicker'>TODAY · WEEK {week}</Text><Text className='day-title'>周{weekdays[weekday - 1].short}的课程</Text></View>
        <Text className='course-count'>{courses.length} 门</Text>
      </View>

      <View className='course-list'>
        {courses.map(course => <View className='course-row' key={course.id}>
          <View className='course-time'><Text>{sectionTimes[course.startSection] || `${course.startSection}节`}</Text><Text>{course.startSection}-{course.endSection}节</Text></View>
          <View className='timeline'><View className={`timeline-dot tone-${course.tone}`} /><View className='timeline-line' /></View>
          <View className={`course-block tone-${course.tone}`}>
            <View className='course-top'><Text className='course-name'>{course.name}</Text><Text className='course-weeks'>{course.weeks}</Text></View>
            <View className='course-meta'><DesignIcon name='location' /><Text>{course.location}</Text><Text className='meta-divider'>·</Text><Text>{course.teacher}</Text></View>
          </View>
        </View>)}
        {courses.length === 0 && <View className='free-day'><View className='free-mark'>OFF</View><Text className='free-title'>今天没有课程</Text><Text className='free-copy'>留一点空白，去图书馆或操场走走</Text></View>}
      </View>
      <Text className='academic-footnote'>当前为界面样例 · 教务接口接入后自动同步</Text>
    </ScrollView>
  </View>
}
