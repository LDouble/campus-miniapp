import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8')

const courseCatalogApi = read('src/api/course-catalog.ts')
const courseCatalogPage = read('src/pages/academic/course-catalog/index.tsx')
const courseCatalogStyle = read('src/pages/academic/course-catalog/index.scss')
const academicRepository = read('src/pages/academic/repository.ts')
const schedulePage = read('src/pages/academic/schedule/index.tsx')
const appConfig = read('src/app.config.ts')
const servicesPage = read('src/pages/services/index.tsx')

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
assert.match(courseCatalogPage, /course\.opening_code/u, '课程卡片应展示服务端返回的选课号')
assert.match(courseCatalogPage, /item\.opening_code/u, '已保存蹭课快照应展示选课号')
assert.doesNotMatch(courseCatalogStyle, /linear-gradient|filter:\s*blur/u, '蹭课页不应使用渐变或装饰光晕')
assert.match(courseCatalogPage, /我的蹭课安排/u, '已保存且未出现在结果中的课程仍应可管理')
assert.match(courseCatalogPage, /全部排课信息替换当前快照/u, '同步最新排课前应明确快照替换范围')
assert.match(courseCatalogPage, /const slotIds = course\.slots\.map/u, '加入蹭课课表必须一次性提交课程的全部排课')
assert.doesNotMatch(courseCatalogPage, /selectedSlotIds|onToggleSlot/u, '蹭课不应要求用户逐节选择上课安排')
assert.match(academicRepository, /mapPersonalTimetableItemCourses/u, '仓储应提供蹭课快照到课表课程的映射')
assert.match(academicRepository, /source:\s*'audit'/u, '蹭课课表课程必须保留 audit 来源')
assert.match(schedulePage, /listPersonalTimetableItems/u, '课程表应读取个人蹭课条目')
assert.match(schedulePage, /personalCourses/u, '课程表应合并蹭课课程')
assert.match(appConfig, /course-catalog\/index/u, '课程检索页必须注册到 academic 分包')
assert.match(servicesPage, /course-audit/u, '服务页必须提供蹭课检索入口')

process.stdout.write('course audit smoke: ok\n')
