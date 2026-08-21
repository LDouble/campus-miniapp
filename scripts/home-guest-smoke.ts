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
const feedAdapterSource = readFileSync(
  resolve(__dirname, '../src/features/home/feed-post-adapter.ts'),
  'utf8',
)
const lifeServicesRepositorySource = readFileSync(
  resolve(__dirname, '../src/features/life-services/repository.ts'),
  'utf8',
)
const communityPostStyleSource = readFileSync(
  resolve(__dirname, '../src/features/community/feed-panel.scss'),
  'utf8',
)
const contentImageGridStyleSource = readFileSync(
  resolve(__dirname, '../src/features/community/components/content-image-grid.scss'),
  'utf8',
)
const generatedApiSource = readFileSync(
  resolve(__dirname, '../src/api/generated/schema.ts'),
  'utf8',
)
const freshBarrageStyleSource = readFileSync(
  resolve(__dirname, '../src/features/community/fresh-barrage.scss'),
  'utf8',
)
const visibleHomeServicesSource = homeSource.match(
  /const visibleHomeServices = quickServices\.filter\(\(service\) => \{([\s\S]*?)\n  \}\)/,
)?.[1] || ''
const serviceModuleKeysSource = homeSource.match(
  /const serviceModuleKeys:[\s\S]*?= \{([\s\S]*?)\n\}/,
)?.[1] || ''

assert.ok(
  !homeSource.includes('const homeServiceKeys')
    && !homeSource.includes('const homeServices ='),
  '首页常用服务不得再维护固定数量的二次白名单',
)
assert.ok(
  lifeServicesRepositorySource.includes("path: '/api/v1/home/feed'")
    && lifeServicesRepositorySource.includes('page_size: search.pageSize || 20'),
  '首页混排仓储必须请求 /api/v1/home/feed 并正确传递分页参数',
)
assert.ok(
  visibleHomeServicesSource.includes('const moduleKey = serviceModuleKeys[service.key]')
    && visibleHomeServicesSource.includes('if (!moduleKey) return false')
    && visibleHomeServicesSource.includes(".state === 'enabled'"),
  '首页常用服务必须只展示具有模块映射且运行时状态为 enabled 的入口',
)
assert.ok(
  homeSource.includes("name: '校园卡'")
    && !serviceModuleKeysSource.includes("'campus-card'"),
  '静态校园卡演示页可以保留，但没有真实模块协议前不得进入首页常用服务',
)
assert.ok(
  serviceModuleKeysSource.includes("'pass-rate': 'academic_statistics'")
    && serviceModuleKeysSource.includes("shuttle: 'shuttle'")
    && serviceModuleKeysSource.includes("community: 'community'")
    && serviceModuleKeysSource.includes("market: 'marketplace'"),
  '首页入口注册表必须覆盖服务端已启用但旧固定十项遗漏的服务',
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
  homeSource.includes('listHomeFeed({ page: 1, pageSize: 8 })')
    && homeSource.includes('homeFeedItems.map((item, index) => {')
    && homeSource.includes('<CommunityPostCard'),
  '首页必须消费后端混排接口并按服务端顺序渲染',
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
  homeSource.includes('useDismissCommunityOverlaysOnScroll')
    && homeSource.includes('dismissSignal={commentDismissSignal}')
    && homeSource.includes('setCommentDismissSignal((current) => current + 1)'),
  '首页滚动时必须收起帖子操作菜单，并经安全关闭信号收起评论输入',
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
  homeSource.includes("import CommunityPostCard, { type CommunityPostCommentPreview } from '../../features/community/post-card'")
    && homeSource.includes('timeFormatter={formatHomeMomentsTime}')
    && feedAdapterSource.includes('liked: reaction?.liked ?? item.liked')
    && feedAdapterSource.includes('liked_by_nicknames: reaction?.likedByNicknames ?? item.liked_by_nicknames')
    && feedAdapterSource.includes('comment_previews: item.comment_previews'),
  '首页四类混排必须复用 CommunityPostCard 并接入真实点赞昵称和评论预览',
)
assert.match(
  generatedApiSource,
  /HomeFeedItemView:[\s\S]*?liked: boolean;[\s\S]*?PublicCommentPreview:[\s\S]*?parent_id: number \| null;[\s\S]*?reply_to_comment_id: number \| null;[\s\S]*?reply_to_nickname: string \| null;[\s\S]*?root_id: number;/u,
  '首页混排生成类型必须包含服务端点赞状态和二级评论关系字段',
)
assert.ok(
  feedAdapterSource.includes("title: '跑腿 · 待接单'")
    && feedAdapterSource.includes('`报酬 ${reward}`')
    && feedAdapterSource.includes('deadlineLimit(item.deadline, item.feed_time)'),
  '跑腿摘要必须按 Figma 展示待接单、报酬和限时信息',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__business-preview\s*\{[\s\S]*?padding:\s*16rpx 20rpx;[\s\S]*?gap:\s*18rpx;[\s\S]*?background:\s*var\(--ousea-grey-50, #f7f8fa\);/u,
  '跑腿业务摘要必须匹配 Figma 的灰底、内边距和间距',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__business-icon\s*\{[\s\S]*?width:\s*72rpx;[\s\S]*?height:\s*72rpx;[\s\S]*?background:\s*var\(--ousea-ocean-50, #f2f7fe\);/u,
  '跑腿业务摘要图标必须匹配 Figma 的 72rpx 浅蓝图标块',
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
  contentImageGridStyleSource,
  /\.content-image-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/u,
  '首页校园动态图片必须使用最多三列的朋友圈式网格',
)
assert.ok(
  homeSource.includes("className='moments-panel__bar'")
    && homeSource.includes("moments-panel__title'>校园动态")
    && homeSource.includes('<Text>进社区</Text>'),
  '校园动态标题区必须使用 Ousea 标记，并保留明确的社区入口',
)
assert.ok(
  homeSource.includes('campus_circle_post: `/packages/social/community/detail?id=${item.source_id}`')
    && homeSource.includes('marketplace_listing: `/packages/social/marketplace/detail?id=${item.source_id}`')
    && homeSource.includes('errand: `/packages/social/errands/detail?id=${item.source_id}`')
    && homeSource.includes('carpool: `/packages/social/carpool/detail?id=${item.source_id}`'),
  '混排 Feed 必须保留四类内容各自的详情路由',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__more\s*\{[\s\S]*?width:\s*88rpx;[\s\S]*?height:\s*88rpx;/u,
  '首页混排 Feed 双点入口必须提供稳定点击热区',
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
  /\.service-panel\s*\{\s*padding:\s*24rpx 20rpx 20rpx;[\s\S]{0,620}&__simple-head\s*\{[^}]*min-height:\s*96rpx;[^}]*padding:\s*0 12rpx 8rpx;[^}]*box-sizing:\s*border-box;/u,
  '常用服务卡片必须使用紧凑外壳，并为标题操作保留安全热区',
)
assert.match(
  homeStyleSource,
  /&__all\s*\{[^}]*min-width:\s*88rpx;[^}]*min-height:\s*88rpx;/u,
  '常用服务“全部”入口必须保留 88rpx 触控热区',
)
assert.match(
  homeStyleSource,
  /&__heading-bar\s*\{[^}]*width:\s*8rpx;[^}]*height:\s*32rpx;[^}]*background:\s*linear-gradient\(180deg,\s*#2b7aef,\s*#38bdf8\);/u,
  '常用服务标题必须保留 Ousea 海洋蓝渐变标记',
)
assert.match(
  homeStyleSource,
  /&__grid-icon,[\s\S]{0,520}&__grid-item--pink &__grid-icon\s*\{[^}]*width:\s*76rpx;[^}]*height:\s*76rpx;[^}]*margin-bottom:\s*8rpx;[^}]*background:\s*var\(--ousea-ocean-50,[^}]*border:\s*2rpx solid var\(--ousea-ocean-100,[^}]*border-radius:\s*24rpx;/u,
  '常用服务图标必须统一使用 Ousea 浅蓝底板、描边与圆角',
)
assert.match(
  homeStyleSource,
  /&__home-grid\s*\{[^}]*gap:\s*8rpx 4rpx;[\s\S]{0,180}&__home-grid &__grid-item\s*\{[^}]*height:\s*132rpx;/u,
  '常用服务宫格必须使用紧凑行距和 132rpx 安全触控高度',
)
assert.doesNotMatch(
  homeStyleSource,
  /\.service-panel__home-grid \.service-panel__grid-item\s*\{[^}]*height:\s*163rpx;/u,
  '常用服务不得被后置样式重新拉高',
)
assert.match(
  homeStyleSource,
  /&__grid-icon image\s*\{\s*filter:\s*brightness\(0\) saturate\(100%\)[^;}]+;/u,
  '常用服务图标必须统一使用蓝色滤镜',
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
  communityPostStyleSource,
  /\.community-post \+ \.community-post\s*\{[^}]*border-top:\s*1rpx solid var\(--ousea-bg-line, #e8edf4\);/u,
  '朋友圈 Feed 条目必须按照 Figma 使用浅色顶部分界线',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__author-line > text:first-child\s*\{[\s\S]{0,420}?color:\s*var\(--campus-primary-strong,\s*#1d5fd6\);[\s\S]{0,220}?font-weight:\s*var\(--ousea-font-weight-regular,\s*400\);/u,
  '首页混排昵称必须与 CommunityPostCard 使用同一套深海蓝 Regular 样式',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__action-menu::before\s*\{[^}]*top:\s*50%;[^}]*height:\s*72rpx;[^}]*border-radius:\s*12rpx;[^}]*background:\s*var\(--ousea-ink-700,/u,
  '帖子卡片展开的互动菜单必须使用独立于触控盒的紧凑深灰可见层',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__more\s*\{[^}]*width:\s*88rpx;[^}]*height:\s*88rpx;/u,
  '帖子卡片三个点必须提供足够大的触控热区',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__comment-preview\s*\{/u,
  '帖子卡片必须展示提交成功后的最新评论预览',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__meta\s*\{[^}]*padding:\s*12rpx 0 8rpx;/u,
  '帖子卡片操作行必须保留首页垂直间距',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__action-menu\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/u,
  '帖子卡片互动菜单必须与时间/操作行垂直居中',
)
assert.match(
  communityPostStyleSource,
  /\.community-post__social-divider\s*\{[^}]*width:\s*1rpx;[^}]*height:\s*40rpx;[^}]*background:\s*rgba\(255, 255, 255, 0\.24\);/u,
  '微信式互动菜单必须使用白色细分隔线区分点赞与评论',
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
assert.match(
  homeStyleSource,
  /&__time\s*\{[\s\S]*?color:\s*var\(--campus-text-muted,/u,
  '首页 Feed 时间必须使用弱化文本 Token',
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
