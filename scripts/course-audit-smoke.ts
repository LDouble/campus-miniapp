import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8')

const courseCatalogApi = read('src/api/course-catalog.ts')
const courseCatalogPage = read('src/pages/academic/course-catalog/index.tsx')
const courseCatalogStyle = read('src/pages/academic/course-catalog/index.scss')
const coursePassRateSheet = read('src/features/academic-statistics/course-pass-rate-preview/sheet.tsx')
const coursePassRateSheetStyle = read('src/features/academic-statistics/course-pass-rate-preview/sheet.scss')
const academicRepository = read('src/pages/academic/repository.ts')
const schedulePage = read('src/pages/academic/schedule/index.tsx')
const appConfig = read('src/app.config.ts')
const servicesPage = read('src/pages/services/index.tsx')
const homePage = read('src/pages/index/index.tsx')

assert.match(
  courseCatalogApi,
  /keyword:\s*input\.courseName\?\.trim\(\)\s*\|\|\s*undefined/u,
  '课程、课程代码或选课号必须映射到 keyword 查询参数',
)
assert.match(
  courseCatalogApi,
  /teacher:\s*input\.teacher\?\.trim\(\)\s*\|\|\s*undefined/u,
  '教师名必须单独映射到 teacher 查询参数',
)
assert.match(courseCatalogPage, /课程<\/Text>/u, '课程检索页应提供课程检索入口')
assert.match(courseCatalogPage, /placeholder='课程名、选课号、课程号'/u, '课程检索页应提示课程名、选课号和课程号')
assert.match(courseCatalogPage, /教师<\/Text>/u, '课程检索页应提供独立的教师输入框')
assert.match(courseCatalogPage, /placeholder='可选，如：李小明'/u, '课程检索页应提示教师名可选')
assert.match(courseCatalogPage, /课程名、课程代码、选课号检索；教师名和更多筛选条件同时填写时，会同时满足全部条件/u, '页面应说明课程条件与教师条件是 AND 关系')
assert.match(courseCatalogPage, /routeCourseCatalogFilters\(router\.params\)/u, '课程检索页应接收课表带入的筛选条件')
assert.match(courseCatalogPage, /routeCourseCatalogPeriodId\(router\.params\)/u, '课程检索页应接收课表带入的学期')
assert.match(courseCatalogPage, /resolvePeriodId\(records, initialRoutePeriodId\)/u, '课程检索页应优先使用合法的路由学期')
assert.match(courseCatalogPage, /showMoreFilters.*hasCourseCatalogFilters\(initialRouteFilters\)/su, '课表带入筛选条件后应展开更多筛选')
assert.match(courseCatalogPage, /course-catalog-view-tabs/u, '蹭课页应提供课程检索和我的蹭课标签切换')
assert.match(courseCatalogPage, /activeView === 'saved'/u, '我的蹭课标签应切换到独立安排视图')
assert.match(courseCatalogPage, /personalItems\.map/u, '我的蹭课视图应展示当前学期全部已加入安排')
assert.match(courseCatalogPage, /onRemove=\{\(\) => void removeCourse\(item\)\}/u, '我的蹭课视图应支持移除安排')
assert.match(courseCatalogPage, /personalItems\.map\(\(item\) => \{[\s\S]*<CourseCatalogCard/u, '我的蹭课列表应直接复用课程检索卡片组件')
assert.doesNotMatch(courseCatalogPage, /SavedCourseCard|course-catalog-saved-item/u, '我的蹭课列表不应继续使用独立卡片组件或样式')
assert.match(courseCatalogPage, /course\.opening_code/u, '课程卡片应展示服务端返回的选课号')
assert.match(courseCatalogPage, /item\.opening_code/u, '已保存蹭课快照应展示选课号')
assert.match(courseCatalogPage, /course-catalog-card__pass-rate-link/u, '课程卡片应提供查看通过率入口')
assert.match(courseCatalogPage, /onOpenPassRate=\{\(\) => setPassRateCourse\(course\)\}/u, '课程检索和我的蹭课卡片应打开对应课程的通过率浮层')
assert.match(courseCatalogPage, /<CoursePassRateSheet[\s\S]*teacherName=\{passRateCourse\.teachers\[0\] \|\| ''\}/u, '通过率浮层应携带当前课程和教师上下文')
assert.match(coursePassRateSheet, /openCourseStatistics\(\{ courseCode, courseName, teacherName \}\)/u, '通过率浮层应复用课程统计详情跳转')
assert.match(coursePassRateSheetStyle, /max-height:\s*76vh/u, '通过率浮层高度应受小程序可用视口约束')
assert.match(coursePassRateSheetStyle, /@media \(prefers-reduced-motion: reduce\)/u, '通过率浮层应适配减少动态效果')
assert.match(courseCatalogPage, /course-catalog-float__guide/u, '蹭课页应提示悬浮课表入口可以点击')
assert.match(courseCatalogPage, /点击课表按钮展开模拟选课和我的课表入口/u, '悬浮入口引导应明确可点击的去向')
assert.match(courseCatalogPage, /course-catalog-disclaimer/u, '蹭课页应展示明确的用途说明')
assert.match(courseCatalogPage, /不存在真实的选课关系/u, '蹭课说明必须明确不存在真实选课关系')
assert.match(courseCatalogPage, /请前往教务系统操作/u, '蹭课说明必须提示真实选课入口')
assert.match(courseCatalogPage, /hasSeenCourseCatalogDisclaimer/u, '蹭课说明首次展示状态应从本地读取')
assert.match(courseCatalogPage, /course-catalog-disclaimer__collapsed-copy/u, '蹭课说明收起后应展示缩略文案')
assert.match(
  courseCatalogPage,
  /\{disclaimerExpanded && \(\s*<Text className='course-catalog-disclaimer__title'>蹭课说明<\/Text>\s*\)\}/u,
  '蹭课说明标题只应在展开状态显示',
)
assert.match(courseCatalogStyle, /&__collapsed-copy[\s\S]*text-overflow:\s*ellipsis/u, '蹭课说明缩略文案过长时应省略')
assert.match(courseCatalogPage, /course-catalog-card__teacher[\s\S]*course-catalog-card__summary/u, '课程卡片应先展示教师名，再在右侧展示班级说明')
assert.match(courseCatalogStyle, /&__teacher\s*\{[\s\S]*flex:\s*0 0 72rpx[\s\S]*min-width:\s*72rpx[\s\S]*max-width:\s*72rpx/u, '教师名展示槽位应固定为三个中文字符宽度')
assert.match(courseCatalogStyle, /&__summary\s*\{[\s\S]*flex:\s*1 1 0[\s\S]*min-width:\s*0/u, '班级说明应在教师名右侧自适应并截断')
assert.match(courseCatalogStyle, /@keyframes course-catalog-float-guide-pulse[\s\S]*?course-catalog-float-guide-arrow/u, '悬浮课表入口应有按钮脉冲和箭头动画')
assert.doesNotMatch(courseCatalogStyle, /linear-gradient|filter:\s*blur/u, '蹭课页不应使用渐变或装饰光晕')
assert.match(courseCatalogPage, /我的蹭课安排/u, '已保存且未出现在结果中的课程仍应可管理')
assert.match(courseCatalogPage, /全部排课信息替换当前快照/u, '同步最新排课前应明确快照替换范围')
assert.match(courseCatalogPage, /const slotIds = course\.slots\.map/u, '加入蹭课课表必须一次性提交课程的全部排课')
assert.doesNotMatch(courseCatalogPage, /selectedSlotIds|onToggleSlot/u, '蹭课不应要求用户逐节选择上课安排')
assert.match(academicRepository, /mapPersonalTimetableItemCourses/u, '仓储应提供蹭课快照到课表课程的映射')
assert.match(academicRepository, /source:\s*'audit'/u, '蹭课课表课程必须保留 audit 来源')
assert.match(schedulePage, /listPersonalTimetableItems/u, '课程表应读取个人蹭课条目')
assert.match(schedulePage, /personalCourses/u, '课程表应合并蹭课课程')
assert.match(schedulePage, /openCourseCatalogAtTimeSlot/u, '课表应支持从节次格子进入课程检索')
assert.match(schedulePage, /isSimulation \? '选课' : '蹭课'/u, '正常课表和模拟课表应显示不同入口文案')
assert.match(schedulePage, /weekday=\$\{slot\.weekday\}&section=\$\{slot\.section\}&periodId=\$\{encodeURIComponent\(preferences\.schedulePeriodId\)\}/u, '课表入口应携带星期、开始节次和学期')
assert.match(appConfig, /course-catalog\/index/u, '课程检索页必须注册到 academic 分包')
assert.match(servicesPage, /course-audit/u, '服务页必须提供蹭课检索入口')
assert.match(servicesPage, /simulation: 'academic_schedule'/u, '模拟选课入口应复用课表模块配置')
assert.match(servicesPage, /key: 'simulation', name: '模拟选课',[\s\S]*schedule\/index\?mode=simulation/u, '全部服务应提供模拟选课入口')
assert.match(homePage, /key: 'errands',[\s\S]*key: 'course-audit', name: '蹭课',[\s\S]*key: 'classroom'/u, '首页常用服务应在找同行原位置提供蹭课入口')
assert.doesNotMatch(homePage, /key: 'carpool', name: '找同行'/u, '首页常用服务不应继续展示找同行入口')
assert.match(homePage, /if \(!moduleKey\) return 'route' in service/u, '本地页面路由入口不应因缺少运行时模块配置被隐藏')

process.stdout.write('course audit smoke: ok\n')
