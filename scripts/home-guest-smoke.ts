import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAcademicCalendarLabel } from '../src/pages/academic/utils'
import type { AcademicPeriod } from '../src/pages/academic/types'

const homeSource = readFileSync(
  resolve(__dirname, '../src/pages/index/index.tsx'),
  'utf8',
)
const homeDataSource = readFileSync(
  resolve(__dirname, '../src/features/home/data.ts'),
  'utf8',
)
const homeStyleSource = readFileSync(
  resolve(__dirname, '../src/pages/index/index.scss'),
  'utf8',
)
const freshBarrageStyleSource = readFileSync(
  resolve(__dirname, '../src/features/community/fresh-barrage.scss'),
  'utf8',
)
const homeServiceKeysSource = homeSource.match(
  /const homeServiceKeys = new Set\(\[([\s\S]*?)\]\)/,
)?.[1] || ''

assert.ok(
  homeServiceKeysSource.includes("'classroom'"),
  '首页常用服务白名单必须包含空教室入口',
)

assert.ok(
  homeSource.includes('getAcademicVerificationStatus()'),
  '首页刷新教务数据前必须先查询校园身份认证状态',
)
assert.ok(
  homeSource.includes("verification.value.identity?.status !== 'verified'"),
  '首页必须让未认证用户直接使用缓存',
)
assert.ok(
  homeSource.includes('academicStorage.getScheduleCache(')
    && homeSource.includes('account.ok ? account.value.user.id : getActiveAcademicUserId()'),
  '首页课表预览应仅使用当前用户的本地缓存',
)
assert.ok(
  homeSource.includes('!hasCachedCourses && hasCredential'),
  '首页只有持有当前用户教务凭据时才可刷新课程，避免自动跳转重新绑定',
)
assert.ok(
  homeSource.includes('getAcademicCalendarLabel(latestAcademic?.periods || [])'),
  '首页标签必须与课表卡片使用同一次教务学期结果',
)
assert.ok(
  homeSource.includes('setAcademicCalendarLabel(getAcademicCalendarLabel(latestAcademic?.periods || []))'),
  '首页学期标签不得改用公共校历数据源',
)
assert.ok(
  homeDataSource.includes('getCampusSections(config, selectedCampus)'),
  '首页课程状态与排序必须使用首页当前选择校区的时间表',
)
assert.ok(
  !homeDataSource.includes('course.campus || selectedCampus'),
  '课程记录中的校区不得覆盖首页当前选择校区的时间表',
)
assert.ok(
  homeSource.includes('第 {item.course.startSection}-{item.course.endSection} 节'),
  '首页课程卡片必须展示具体节次',
)
assert.ok(
  !homeSource.includes('{item.startTime}'),
  '首页课程卡片不得展示具体上课时间',
)
assert.match(
  homeStyleSource,
  /&__pill\s*\{[\s\S]*?color:\s*var\(--campus-primary-strong,[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/u,
  '首页横幅标签必须使用深色文字搭配浅色底，不能白字叠白底',
)
assert.match(
  homeStyleSource,
  /\.hero-card--image \.hero-card__pill\s*\{[\s\S]*?color:\s*#fff;[\s\S]*?background:\s*rgba\(15,\s*23,\s*42,\s*0\.62\)/u,
  '图片横幅标签必须使用白字搭配深色遮罩',
)
assert.match(
  homeStyleSource,
  /background:\s*linear-gradient\(\s*153deg,\s*#326ea9 0%,\s*#287992 48%,\s*#24766e 100%\s*\)/u,
  '首页 hero 必须使用中等饱和度渐变，避免蓝青色过曝',
)
assert.match(
  homeStyleSource,
  /&__glow\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.16\)/u,
  '首页 hero 高光透明度不得过高',
)
assert.match(
  homeStyleSource,
  /&__compact-title\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;/u,
  '首页帖子摘要必须最多显示两行',
)
assert.match(
  freshBarrageStyleSource,
  /\.fresh-barrage__content\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;/u,
  '首页弹幕内容必须最多显示两行',
)

const periods: AcademicPeriod[] = [{
  id: '2026-autumn',
  label: '2026-2027 学年秋季学期',
  shortLabel: '26秋',
  startDate: '2026-08-31',
  weeks: 18,
  isCurrent: true,
}]
assert.equal(
  getAcademicCalendarLabel(periods, new Date('2026/08/09 12:00:00')),
  '8月31日开学',
)
assert.equal(
  getAcademicCalendarLabel(periods, new Date('2026/09/07 12:00:00')),
  '第 2 周',
)
assert.equal(
  getAcademicCalendarLabel(periods, new Date('2027/01/10 12:00:00')),
  '本学期已结束',
)

process.stdout.write('home guest access smoke: ok\n')
