import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const tabBarSource = readSource('../src/custom-tab-bar/index.js')
const communityPageSource = readSource('../src/pages/community/index.tsx')
const communityPageStyle = readSource('../src/pages/community/index.scss')

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

process.stdout.write('community tab scroll top smoke: ok\n')
