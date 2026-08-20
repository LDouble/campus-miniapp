import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAcademicCalendarLabel } from '../src/pages/academic/utils'
import type { AcademicPeriod } from '../src/pages/academic/types'
import {
  communitySectionNamesById,
  formatHomeMomentsTime,
  homeMomentsBusinessLabels,
} from '../src/features/home/moments'
import type { CampusCircleSectionView } from '../src/api/types'

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
const communityPostStyleSource = readFileSync(
  resolve(__dirname, '../src/features/community/feed-panel.scss'),
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
for (const serviceKey of [
  'schedule',
  'grades',
  'exams',
  'result',
  'materials',
  'calendar',
  'errands',
  'carpool',
  'classroom',
  'campus-card',
]) {
  assert.ok(
    homeServiceKeysSource.includes(`'${serviceKey}'`),
    `首页 5×2 常用服务必须包含 ${serviceKey}`,
  )
}
assert.equal(
  homeServiceKeysSource.match(/'[^']+'/gu)?.length,
  10,
  '首页常用服务必须固定为 5×2 的十个高频入口',
)
assert.ok(
  homeSource.includes("name: '校园卡'")
    && homeSource.includes("route: '/pages/campus-service/index?type=campus-card'"),
  '校园卡入口必须跳转到可用的校园卡服务页',
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
    && homeSource.includes("className='official-notices-home__heading-bar'")
    && homeSource.includes("className='official-notices-home__title'>全校通知"),
  '全校通知必须使用 Figma 对齐的蓝色标题标记',
)
assert.ok(
  homeSource.includes("campaign: require('../../assets/icons/campaign.svg')")
    && homeSource.includes("<Image src={icons.campaign} mode='aspectFit' />"),
  '通知条目必须复用 Figma 对应的 campaign 矢量图标',
)
assert.ok(
  homeSource.includes('listMarketplace({ page: 1, pageSize: 4 })')
    && homeSource.includes('const homeMomentsFeed = buildHomeMomentsFeed(communityPosts, marketItems)')
    && homeSource.includes('homeMomentsFeed.map((entry, index) => {'),
  '首页必须把社区与二手真实数据合并为单一朋友圈 Feed',
)
assert.ok(
  !homeSource.includes("className='community-panel'")
    && !homeSource.includes("className='market-panel'")
    && !homeSource.includes('同学们在淘')
    && !homeSource.includes('FullMarketplaceCard'),
  '首页必须删除旧校园动态卡片和独立二手区块',
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
  homeSource.includes("import CommunityPostCard from '../../features/community/post-card'")
    && !homeSource.includes("mode='home'")
    && homeSource.includes('onToggleLike={toggleCommunityLike}')
    && homeSource.includes('timeFormatter={formatHomeMomentsTime}'),
  '首页社区动态必须复用统一帖子卡片组件并保留首页时间格式',
)
assert.ok(
  !homeSource.includes('{item.startTime}'),
  '首页课程卡片不得展示具体上课时间',
)
assert.match(
  homeStyleSource,
  /&__pill\s*\{[\s\S]*?color:\s*#fff;[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.16\)/u,
  '首页横幅标签必须使用 Ousea 渐变上的半透明白色胶囊',
)
assert.match(
  homeStyleSource,
  /\.hero-card--image \.hero-card__pill\s*\{[\s\S]*?color:\s*#fff;[\s\S]*?background:\s*rgba\(15,\s*23,\s*42,\s*0\.62\)/u,
  '图片横幅标签必须使用白字搭配深色遮罩',
)
assert.match(
  homeStyleSource,
  /background:\s*linear-gradient\(135deg,\s*var\(--ousea-ocean-600,[\s\S]*?var\(--ousea-ocean-500,[\s\S]*?var\(--ousea-wave-400,/u,
  '首页 Hero 必须消费 Ousea Ocean 到 Wave 的全局渐变 Token',
)
assert.match(
  homeStyleSource,
  /&__glow\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.16\)/u,
  '首页 hero 高光透明度不得过高',
)
assert.match(
  homeStyleSource,
  /\.moments-feed\s*\{[\s\S]*?&__media\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,/u,
  '首页校园动态图片必须使用最多三列的朋友圈式网格',
)
assert.ok(
  homeSource.includes("className='moments-panel__bar'")
    && homeSource.includes("moments-panel__title'>校园动态")
    && homeSource.includes('<Text>进社区</Text>'),
  '校园动态标题区必须使用 Ousea 标记，并保留明确的社区入口',
)
assert.ok(
  homeSource.includes("kind: 'community'")
    && homeSource.includes("kind: 'marketplace'")
    && homeSource.includes('onOpen={openCommunityPost}')
    && homeSource.includes('openMarketplaceListing(marketplaceItem)'),
  '朋友圈 Feed 必须保留社区与二手各自的详情路由',
)
assert.ok(
  homeSource.includes("coursePreview.dayLabel === '假期' ? '假期中'")
    && homeSource.includes('`${holidayCountdown}天后开学`')
    && !homeSource.includes("className='schedule-card__countdown'")
    && !homeSource.includes('holidayCountdown ? coursePreview.dateLabel'),
  '假期课表卡必须把动态开学倒计时放在主文案下方，并移除重复开学日期',
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
  /\.service-panel\s*\{\s*padding:\s*28rpx 20rpx 26rpx;[\s\S]{0,520}&__simple-head\s*\{[^}]*min-height:\s*48rpx;[^}]*padding:\s*0 12rpx 16rpx;/u,
  '常用服务卡片必须使用 Figma 对齐的单行标题区',
)
assert.match(
  homeStyleSource,
  /&__heading-bar\s*\{[^}]*width:\s*8rpx;[^}]*height:\s*32rpx;[^}]*background:\s*linear-gradient\(180deg,\s*#2b7aef,\s*#38bdf8\);/u,
  '常用服务标题必须保留 Ousea 海洋蓝渐变标记',
)
assert.match(
  homeStyleSource,
  /&__grid-icon,[\s\S]{0,700}width:\s*84rpx;[^}]*height:\s*84rpx;[^}]*background:\s*#f2f7fe;[^}]*border:\s*2rpx solid #e3effe;[^}]*border-radius:\s*26rpx;/u,
  '常用服务图标底座必须匹配 Ousea 尺寸、底色、描边与圆角',
)
assert.match(
  homeStyleSource,
  /Figma 14:726[\s\S]*?\.official-notices-home\s*\{[^}]*padding:\s*0 32rpx 16rpx;[^}]*border-radius:\s*var\(--ousea-radius-card-lg,[^}]*box-shadow:\s*0 8rpx 16rpx rgba\(29, 95, 214, 0\.05\);/u,
  '全校通知卡必须匹配 Figma 14:726 的白底、圆角与轻蓝阴影',
)
assert.match(
  homeStyleSource,
  /&__icon\s*\{[^}]*width:\s*80rpx;[^}]*height:\s*80rpx;[^}]*background:\s*var\(--campus-surface-primary,[^}]*border-radius:\s*26rpx;/u,
  '通知条目必须使用 Ousea 浅蓝图标底座',
)
assert.match(
  homeStyleSource,
  /&__copy-title\s*\{[^}]*display:\s*-webkit-box;[^}]*font-size:\s*var\(--ousea-font-size-label,[^}]*-webkit-line-clamp:\s*2;/u,
  '通知标题必须支持两行并使用 Ousea label 字号',
)
assert.match(
  homeStyleSource,
  /\.moments-panel\s*\{[^}]*order:\s*7;[^}]*background:\s*var\(--campus-surface,[^}]*border-radius:\s*var\(--ousea-radius-card-lg,/u,
  '朋友圈 Feed 必须是首页唯一的动态卡片容器',
)
assert.match(
  homeStyleSource,
  /\.moments-feed\s*\{[\s\S]*?&__item\s*\{[^}]*display:\s*flex;[^}]*gap:\s*20rpx;[^}]*border-top:\s*0;[\s\S]*?& \+ &\s*\{[^}]*border-top:\s*1rpx solid var\(--ousea-bg-line, #e8edf4\);/u,
  '朋友圈 Feed 条目必须按照 Figma 使用浅色顶部分界线',
)
assert.match(
  homeStyleSource,
  /&__name\s*\{[\s\S]{0,420}?color:\s*var\(--ousea-ocean-400,\s*#4c96f5\);[\s\S]{0,220}?font-weight:\s*var\(--ousea-font-weight-regular,\s*400\);/u,
  '朋友圈 Feed 昵称必须使用 Ousea Ocean 400 与 Regular 400',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__social\s*\{[^}]*display:\s*flex;[^}]*border-radius:\s*12rpx;[^}]*background:\s*var\(--campus-surface-subtle,/u,
  '帖子卡片必须使用首页风格的浅底互动摘要',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__meta\s*\{[^}]*padding:\s*12rpx 0 8rpx;/u,
  '帖子卡片操作行必须保留首页垂直间距',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__social\s*\{[^}]*margin-top:\s*4rpx;/u,
  '帖子卡片互动摘要必须保留首页垂直间距',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__social-divider\s*\{[^}]*display:\s*none;/u,
  '帖子卡片互动摘要内部不得显示横向分隔线',
)

const homeMomentsNow = new Date('2026-08-20T12:00:00+08:00').getTime()
assert.equal(
  formatHomeMomentsTime('2026-08-20T11:45:00+08:00', homeMomentsNow),
  '15分钟前',
  '首页 Feed 1 小时内必须显示分钟数',
)
assert.equal(
  formatHomeMomentsTime('2026-08-20T08:00:00+08:00', homeMomentsNow),
  '4小时前',
  '首页 Feed 24 小时内必须显示小时数',
)
assert.equal(
  formatHomeMomentsTime('2026-08-19T12:00:00+08:00', homeMomentsNow),
  '1天',
  '首页 Feed 满 24 小时后才显示天数',
)
assert.equal(
  formatHomeMomentsTime('2026-07-21T12:00:00+08:00', homeMomentsNow),
  '30天',
  '首页 Feed 30 天内必须统一显示为 x天',
)
assert.equal(
  formatHomeMomentsTime('2026-07-20T12:00:00+08:00', homeMomentsNow),
  '07月20日 12:00',
  '首页 Feed 超过 30 天后必须恢复具体日期时间',
)
assert.deepEqual(
  homeMomentsBusinessLabels,
  { marketplace: '二手', errand: '跑腿', carpool: '找同行' },
  '首页 Feed 业务板块名必须统一使用二手、跑腿、找同行',
)
const homeCommunitySections = [{
  id: 1,
  name: '校园生活',
  children: [{ id: 2, name: '校园趣事', children: [] }],
}] as CampusCircleSectionView[]
assert.deepEqual(
  communitySectionNamesById(homeCommunitySections),
  { 1: '校园生活', 2: '校园趣事' },
  '首页 Feed 社区项必须能解析真实子板块名',
)
assert.ok(
  homeSource.includes("className='moments-feed__meta-copy'")
    && homeSource.includes('{formatHomeMomentsTime(marketplaceItem.created_at)} · {homeMomentsBusinessLabels.marketplace}')
    && homeSource.includes("communitySectionNames[communityItem.section_id] || '校园动态'")
    && homeSource.includes('sectionName={communitySectionNames[communityItem.section_id] || \'校园动态\'}'),
  '首页 Feed 时间后必须跟真实社区板块名或业务板块名',
)
assert.match(
  homeStyleSource,
  /&__meta-copy\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/u,
  '首页 Feed 时间与板块名单行溢出时不得挤压双点操作',
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
