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
  homeSource.includes('<Text>{campusName}</Text>')
    && !homeSource.includes('中国海洋大学 · {campusName}'),
  '首页校区筛选只应显示当前校区，不重复学校全称',
)
assert.ok(
  !homeSource.includes('学习生活，一触即达')
    && !homeSource.includes('service-panel__subtitle'),
  '常用服务标题区必须移除冗余介绍文案',
)
assert.ok(
  homeSource.includes("className='official-notices-home__heading'")
    && homeSource.indexOf("official-notices-home__eyebrow'>OFFICIAL")
      < homeSource.indexOf("official-notices-home__title'>全校通知"),
  'OFFICIAL 与全校通知必须由同一标题容器按顺序展示',
)
assert.equal(
  homeSource.match(/className='section-heading__heading'/gu)?.length,
  2,
  '校园动态和二手区块必须共用单行标题容器',
)
assert.ok(
  homeSource.includes('listMarketplace({ page: 1, pageSize: 2 })')
    && homeSource.includes('const visibleMarketItems = marketItems.slice(0, 2)')
    && homeSource.includes('visibleMarketItems.map((item) => (')
    && !homeSource.includes("className='market-list__column'"),
  '首页二手必须收敛为两条等宽预览，不能继续渲染四条瀑布流',
)
assert.ok(
  !homeSource.includes('FreshBarrage')
    && !homeSource.includes("../../features/community/fresh-barrage"),
  '首页不得再用悬浮弹幕覆盖校园动态区块',
)

assert.ok(
  homeSource.includes('getAcademicVerificationStatus({ force })'),
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
  homeSource.includes("plainStickerContent(post.content || '').trim()")
    && (homeSource.match(/communityPostPreviewText\(item\)/gu)?.length || 0) === 2,
  '首页社区摘要必须把贴纸标记转换为可读文本，不能直接暴露协议字符串',
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
assert.match(
  homeStyleSource,
  /\.hero-card\s*\{[\s\S]*?&__title,[\s\S]*?&__subtitle\s*\{[^}]*display:\s*-webkit-box;[^}]*overflow:\s*hidden;[^}]*white-space:\s*normal;/u,
  '首页所有 Hero 文案分支都必须具备长文本截断容器',
)
assert.match(
  homeStyleSource,
  /\.hero-card--notice \.hero-card__title\s*\{[^}]*-webkit-line-clamp:\s*2;/u,
  '运营横幅标题必须最多显示两行',
)
assert.match(
  homeStyleSource,
  /\.hero-card--notice \.hero-card__subtitle\s*\{[^}]*-webkit-line-clamp:\s*1;/u,
  '运营横幅副标题必须稳定为一行',
)
assert.match(
  homeStyleSource,
  /\.market-panel \.marketplace-card--compact\s*\{[\s\S]*?\.marketplace-card__description\s*\{[^}]*display:\s*-webkit-box;[^}]*white-space:\s*normal;[^}]*-webkit-line-clamp:\s*2;/u,
  '首页二手卡片描述必须最多显示两行',
)
assert.match(
  homeStyleSource,
  /\.marketplace-card__description \.sticker-content__text\s*\{[^}]*white-space:\s*normal;/u,
  '二手卡片内部 StickerContent 文本不得绕过宿主截断规则',
)
assert.match(
  homeStyleSource,
  /\.service-panel\s*\{\s*padding:\s*16rpx 24rpx 14rpx;[\s\S]{0,260}&__simple-head\s*\{[^}]*min-height:\s*56rpx;[^}]*padding-bottom:\s*4rpx;/u,
  '常用服务卡片必须使用紧凑的单行标题区',
)
assert.match(
  homeStyleSource,
  /\.official-notices-home\s*\{\s*padding:\s*18rpx 24rpx 12rpx;[\s\S]{0,440}&__heading\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*baseline;[^}]*white-space:\s*nowrap;/u,
  '官方通知中英文标题必须保持单行并对齐基线',
)
assert.match(
  homeStyleSource,
  /\.section-heading\s*\{[^}]*min-height:\s*82rpx;[\s\S]{0,260}&__heading\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*baseline;[^}]*white-space:\s*nowrap;/u,
  '校园动态和二手标题必须使用统一的单行标题节奏',
)
for (const selector of ['community-panel', 'market-panel']) {
  assert.match(
    homeStyleSource,
    new RegExp(`\\.${selector}\\s*\\{[^}]*padding:\\s*18rpx 24rpx 20rpx;[^}]*margin:\\s*0 0 24rpx;[^}]*overflow:\\s*hidden;[^}]*border-radius:\\s*40rpx;`, 'u'),
    `${selector} 必须恢复为与首页上半区一致的完整卡片容器`,
  )
}
assert.match(
  homeStyleSource,
  /\.news-card\s*\{\s*gap:\s*0;[\s\S]{0,360}&__item\s*\{[^}]*background:\s*transparent;[^}]*border-top:\s*1rpx solid var\(--campus-border,[^}]*box-shadow:\s*none;/u,
  '校园动态必须在统一容器内呈现连续内容行，不能重复套卡片阴影',
)
assert.match(
  homeStyleSource,
  /\.market-list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(280rpx,\s*1fr\)\);[^}]*align-items:\s*stretch;/u,
  '首页二手网格必须在一条数据时自动铺满、两条数据时保持等宽',
)
assert.match(
  homeStyleSource,
  /\.market-panel \.marketplace-card--compact\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*border-radius:\s*28rpx;[^}]*box-shadow:\s*none;/u,
  '首页二手卡片必须等高填充网格并移除重复阴影',
)
assert.match(
  homeStyleSource,
  /\.market-panel \.marketplace-card--compact\s*\{[\s\S]{0,620}\.marketplace-card__placeholder-kicker\s*\{[^}]*display:\s*none;/u,
  '首页窄版二手卡片必须隐藏与出售标签重叠的重复英文标识',
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
