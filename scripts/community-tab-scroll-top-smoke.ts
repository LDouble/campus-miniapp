import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const tabBarSource = readSource('../src/custom-tab-bar/index.js')
const communityPageSource = readSource('../src/pages/community/index.tsx')
const communityPageStyle = readSource('../src/pages/community/index.scss')
const communityPageConfig = readSource('../src/pages/community/index.config.ts')
const communityFeedSource = readSource('../src/features/community/feed-panel.tsx')
const communityFeedStyle = readSource('../src/features/community/feed-panel.scss')
const lifeListSource = readSource('../src/features/life-services/list-panel.tsx')
const lifeListStyle = readSource('../src/features/life-services/list-panel.scss')
const loadMoreHookSource = readSource('../src/hooks/use-load-more-signal.ts')

assert.match(
  tabBarSource,
  /if \(index === this\.data\.selected\) \{[\s\S]*?item\.pagePath === 'pages\/community\/index'[\s\S]*?wx\.pageScrollTo\(\{ scrollTop: 0, duration: 240 \}\)[\s\S]*?return/u,
  '重复点击已选中的社区 Tab 应平滑回到页面顶部',
)
assert.doesNotMatch(
  tabBarSource,
  /if \(!item \|\| index === this\.data\.selected\) return/u,
  '自定义 TabBar 不应继续忽略所有重复点击',
)

assert.match(
  communityPageSource,
  /const lifeSectionModules:[\s\S]*?community: 'community',[\s\S]*?errands: 'errand',[\s\S]*?market: 'marketplace',[\s\S]*?carpool: 'carpool'/u,
  '社区 Tab 应继续覆盖校园社区、跑腿、二手和同行四个场景',
)
assert.match(communityPageSource, /useReachBottom/u, '社区 Tab 应监听页面上拉触底')
assert.match(
  communityPageSource,
  /useReachBottom\(\(\) => \{\s*setLoadMoreSignal\(\(current\) => current \+ 1\)/u,
  '每次页面触底应生成一次递增的分页信号',
)
assert.match(
  communityPageSource,
  /<CommunityFeedPanel[\s\S]*?loadMoreSignal=\{loadMoreSignal\}[\s\S]*?<LifeServiceListPanel[\s\S]*?loadMoreSignal=\{loadMoreSignal\}/u,
  '社区、跑腿、二手和找同行应共享页面级自动分页入口',
)
assert.match(communityPageConfig, /onReachBottomDistance:\s*160/u)
assert.match(loadMoreHookSource, /const handledSignalRef = useRef\(signal\)/u)
assert.match(loadMoreHookSource, /handledSignalRef\.current = signal[\s\S]*?if \(!enabled\) return[\s\S]*?onLoadMore\(\)/u)
for (const source of [communityFeedSource, lifeListSource]) {
  assert.match(source, /useLoadMoreSignal\(\{/u)
  assert.match(source, /if \(append && loadingMoreRef\.current\) return/u)
  assert.match(source, /继续上滑加载更多/u)
  assert.match(source, /items\.length > 0 && !canLoadMore|posts\.length > 0 && !canLoadMore/u)
  assert.match(source, /没有更多了/u)
}
assert.doesNotMatch(
  communityFeedSource,
  /className='api-community-load-more'[\s\S]{0,180}onClick=/u,
  '社区列表不应继续依赖点击查看更多',
)
assert.doesNotMatch(
  lifeListSource,
  /className='life-load-more'[\s\S]{0,180}onClick=/u,
  '三类生活服务列表不应继续依赖点击查看更多',
)
assert.match(
  communityPageSource,
  /displayedSection === 'community'[\s\S]*?<CommunityFeedPanel[\s\S]*?<LifeServiceListPanel/u,
  '四个场景应继续共用社区 Tab 页的页面级滚动容器',
)
assert.match(
  communityPageStyle,
  /\.community-page \.custom-navbar \{\s*z-index: 60;\s*\}/u,
  '社区页状态栏保护层应高于吸顶顶部 Bar，避免滚动内容穿透',
)
assert.match(
  communityPageStyle,
  /\.community-page \.custom-navbar\.custom-navbar--compact-immersive:not\(\.custom-navbar--collapsed\) \.custom-navbar__fixed \{[\s\S]*?z-index: 60;[\s\S]*?background: var\(--campus-surface, #fff\);/u,
  '沉浸式导航的状态栏区域应使用实色背景遮住滚动内容',
)
assert.match(
  communityPageStyle,
  /\.community-page \{[\s\S]*?padding-bottom: calc\(112rpx \+ env\(safe-area-inset-bottom\)\);/u,
  '社区页应保留足够的底部 TabBar 安全距离',
)
assert.match(
  readSource('../src/custom-tab-bar/index.wxss'),
  /\.tab-bar__dock \{[\s\S]*?bottom: calc\(0rpx \+ env\(safe-area-inset-bottom\)\);/u,
  'TabBar dock 下沿应贴合安全区上沿，避免底部视觉留白',
)
assert.match(
  communityFeedStyle,
  /\.api-community \{[\s\S]*?padding: 0 32rpx;/u,
  '社区列表不应重复叠加页面级底部导航留白',
)
assert.match(
  lifeListStyle,
  /\.life-panel \{[\s\S]*?padding: 0 28rpx;/u,
  '生活服务列表不应重复叠加页面级底部导航留白',
)
assert.match(
  communityFeedStyle,
  /\.api-community-load-more--end/u,
  '社区列表末页提示应使用紧凑终态样式',
)
assert.match(
  lifeListStyle,
  /\.life-load-more--end/u,
  '生活服务列表末页提示应使用紧凑终态样式',
)

process.stdout.write('community tab scroll top smoke: ok\n')
