import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  parseUndergraduateCourses,
  parseUndergraduateGrades,
  parseUndergraduatePeriods,
  parseUndergraduateScheduleTime,
} from '../../src/features/academic-direct/parsers/undergraduate'
import {
  parseGraduateCourses,
  parseGraduateExams,
  parseGraduateGrades,
  parseGraduatePeriods,
  parseGraduateSelections,
  parseGraduateWeeks,
} from '../../src/features/academic-direct/parsers/graduate'

test('本科课表解析课程、单双周和节次', () => {
  const body = `
    <table class="qz-weeklyTable">
      <tr>
        <td class="qz-weeklyTable-label">第一大节</td>
        <td class="qz-hasCourse" colsize="1">
          <ul><li class="qz-toolitiplists">
            <div class="qz-tooltipContent-title">高等数学</div>
            <div class="qz-tooltipContent-detaillists">
              <div class="qz-tooltipContent-detailitem">课程号：MATH101</div>
              <div class="qz-tooltipContent-detailitem">选课号：SEL-1</div>
              <div class="qz-tooltipContent-detailitem">老师：张老师</div>
              <div class="qz-tooltipContent-detailitem">地点：教学楼 101</div>
              <div class="qz-tooltipContent-detailitem">时间：1-8周(单)【1-2节】</div>
            </div>
          </li></ul>
        </td>
      </tr>
    </table>`
  const courses = parseUndergraduateCourses(body, '2025-2026-2')

  assert.equal(courses.length, 1)
  assert.deepEqual(courses[0], {
    id: 'SEL-1',
    period_id: '2025-2026-2',
    course_code: 'MATH101',
    name: '高等数学',
    teacher: '张老师',
    campus: '',
    location: '教学楼 101',
    weekday: 1,
    start_section: 1,
    end_section: 2,
    weeks: [1, 3, 5, 7],
  })
  assert.deepEqual(
    parseUndergraduateScheduleTime('2,4、6周【3至4节】').weeks,
    [2, 4, 6],
  )
})

test('本科教务直连解析学期选择器', () => {
  const periods = parseUndergraduatePeriods(`
    <select id="xnxq01id">
      <option value="2025-2026-2" selected>2025-2026-2</option>
      <option value="invalid">无效项</option>
    </select>
  `)
  assert.equal(periods.length, 1)
  assert.equal(periods[0].id, '2025-2026-2')
  assert.equal(periods[0].is_current, true)
  assert.equal(periods[0].start_date, '2025-09-01')
})

test('本科成绩解析兼容分页 JSON 包装和等级制', () => {
  const records = parseUndergraduateGrades(
    JSON.stringify({
      data: {
        rows: [
          { kcmc: '大学英语', kch: 'EN101', xf: '2.0', zcjstr: '优秀', xqstr: '2025-2026-2' },
          { kcmc: '线性代数', kch: 'MA102', xf: 3, cj: '89', xqstr: '2025-2026-2' },
        ],
      },
    }),
    'json',
    '',
  )

  assert.equal(records.length, 2)
  assert.equal(records[0].grade_type, 'level')
  assert.equal(records[0].grade_level, '优秀')
  assert.equal(records[0].score, null)
  assert.equal(records[1].grade_type, 'number')
  assert.equal(records[1].score, 89)
})

test('研究生课表处理 rowspan、元数据和连续节次', () => {
  const body = `
    <table>
      <tr>
        <th>时间</th><th>节次</th>
        <th>星期一</th><th>星期二</th><th>星期三</th><th>星期四</th>
        <th>星期五</th><th>星期六</th><th>星期日</th>
      </tr>
      <tr>
        <td rowspan="2">上午</td><td>第1节</td>
        <td rowspan="2">
          <a class="c666" href="/course?kcId=GRA101" title="1-8周">
            <strong class="f14">机器学习</strong><br>李老师<br>实验楼 A201
          </a>
        </td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td>第2节</td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
    </table>`
  const courses = parseGraduateCourses(body, 'html', '2025:12')

  assert.equal(courses.length, 1)
  assert.equal(courses[0].course_code, 'GRA101')
  assert.equal(courses[0].name, '机器学习')
  assert.equal(courses[0].teacher, '李老师')
  assert.equal(courses[0].location, '实验楼 A201')
  assert.equal(courses[0].weekday, 1)
  assert.equal(courses[0].start_section, 1)
  assert.equal(courses[0].end_section, 2)
  assert.deepEqual(courses[0].weeks, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(parseGraduateWeeks('第(1)周、3-5周'), [1, 3, 4, 5])
})

const graduateHistoryTable = `
  <table>
    <tr>
      <th>课程编号</th><th>课程名称</th><th>课程性质</th><th>学分</th>
      <th>选课学年</th><th>学期</th><th>修读情况/成绩</th><th>任课教师</th>
    </tr>
    <tr>
      <td>GR001</td><td>学术写作</td><td>必修</td><td>2</td>
      <td>2025-2026</td><td>春</td><td>考试 | 92</td><td>王老师</td>
    </tr>
    <tr>
      <td>GR002</td><td>科研伦理</td><td>选修</td><td>1</td>
      <td>2025-2026</td><td>春</td><td>正在申请免修</td><td>赵老师</td>
    </tr>
  </table>`

test('研究生成绩和选课结果按学期过滤并保留修读文本', () => {
  const grades = parseGraduateGrades(graduateHistoryTable, 'html', '2025:12')
  const selections = parseGraduateSelections(graduateHistoryTable, 'html', '2025:12')
  const periods = parseGraduatePeriods(graduateHistoryTable)

  assert.equal(grades.length, 1)
  assert.equal(grades[0].score, 92)
  assert.equal(grades[0].period_id, '2025:12')
  assert.equal(selections.length, 2)
  assert.equal(selections[1].status, 'pending')
  assert.equal(selections[1].result_text, '正在申请免修')
  assert.equal(periods.length, 1)
  assert.equal(periods[0].id, '2025:12')
})

test('研究生考试安排组合日期与时间范围', () => {
  const body = `
    <table>
      <tr>
        <th>课程名称</th><th>课程编号</th><th>考试日期</th><th>考试时间</th>
        <th>考试地点</th><th>座位号</th><th>考试性质</th>
      </tr>
      <tr>
        <td>数据分析</td><td>DA101</td><td>2026年01月08日</td><td>09:00-11:00</td>
        <td>教学楼 202</td><td>18</td><td>期末考试</td>
      </tr>
    </table>`
  const exams = parseGraduateExams(body, 'html', '2025:11')

  assert.equal(exams.length, 1)
  assert.equal(exams[0].start_at, '2026-01-08T09:00:00+08:00')
  assert.equal(exams[0].end_at, '2026-01-08T11:00:00+08:00')
  assert.equal(exams[0].phase, '期末')
})
