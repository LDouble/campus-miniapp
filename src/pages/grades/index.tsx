import { Picker, ScrollView, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import { AcademicHeader } from '../../components/AcademicHeader'
import { DesignIcon } from '../../components/DesignIcon'
import { gradeItems, semesterOptions, summarizeGrades } from '../../services/academic-display'
import './index.scss'

type Filter = 'all' | 'passed' | 'pending'

const filterLabels: Record<Filter, string> = { all: '全部课程', passed: '已出成绩', pending: '待公布' }

export default function Grades () {
  const [semester, setSemester] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const summary = useMemo(() => summarizeGrades(gradeItems), [])
  const grades = gradeItems.filter(item => filter === 'all' || item.status === filter)

  return <View className='grades-page'>
    <View className='grade-texture' />
    <AcademicHeader title='成绩单' meta='RECORD' tone='paper' />

    <ScrollView scrollY className='grade-scroll'>
      <View className='grade-intro'>
        <Text className='grade-eyebrow'>ACADEMIC RECORD</Text>
        <Text className='grade-title'>这一学期，{'\n'}每一分都有回响。</Text>
        <Picker mode='selector' range={semesterOptions} value={semester} onChange={event => setSemester(Number(event.detail.value))}>
          <View className='grade-term'><DesignIcon name='calendar' /><Text>{semesterOptions[semester]}</Text><Text>⌄</Text></View>
        </Picker>
      </View>

      <View className='score-sheet'>
        <View className='score-main'>
          <Text className='score-label'>加权平均分</Text>
          <View><Text className='score-number'>{summary.average.toFixed(1)}</Text><Text className='score-unit'>/ 100</Text></View>
          <Text className='score-note'>较上学期保持稳定</Text>
        </View>
        <View className='score-stamp'><Text>已修</Text><Text>{summary.credits}</Text><Text>学分</Text></View>
        <View className='score-stats'>
          <View><Text>{summary.gradePoint.toFixed(2)}</Text><Text>平均绩点</Text></View>
          <View><Text>{summary.passed}</Text><Text>已通过课程</Text></View>
          <View><Text>100%</Text><Text>课程通过率</Text></View>
        </View>
      </View>

      <View className='grade-section-head'>
        <View><Text className='section-index'>01</Text><Text className='section-title'>课程明细</Text></View>
        <Text className='sample-tag'>展示样例</Text>
      </View>

      <ScrollView scrollX className='filter-scroll' enhanced showScrollbar={false}>
        <View className='grade-filters'>
          {(Object.keys(filterLabels) as Filter[]).map(item => <View key={item} className={`grade-filter ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>{filterLabels[item]}</View>)}
        </View>
      </ScrollView>

      <View className='grade-list'>
        {grades.map((item, index) => <View className='grade-item' key={item.id}>
          <View className='grade-order'>{String(index + 1).padStart(2, '0')}</View>
          <View className='grade-course'>
            <View><Text className='grade-name'>{item.name}</Text><Text className='grade-category'>{item.category} · {item.credit} 学分</Text></View>
            {item.status === 'passed'
              ? <View className={`grade-result ${item.score >= 90 ? 'excellent' : ''}`}><Text>{item.score}</Text><Text>绩点 {item.gradePoint.toFixed(1)}</Text></View>
              : <View className='grade-pending'><Text>待公布</Text><Text>教务更新后显示</Text></View>}
          </View>
        </View>)}
      </View>

      <View className='grade-note'><View className='note-line' /><Text>成绩数据以学校教务系统最终记录为准</Text></View>
      <Text className='grade-footnote'>当前为界面样例 · 教务接口接入后自动同步</Text>
    </ScrollView>
  </View>
}
