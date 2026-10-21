import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const tabBarStyle = read('src/custom-tab-bar/index.wxss')
const tabBarTemplate = read('src/custom-tab-bar/index.wxml')
const tabBarLogic = read('src/custom-tab-bar/index.js')
const appConfig = read('src/app.config.ts')
const appSource = read('src/app.ts')
const tabBarHelpers = read('src/utils/tabbar.ts')
const publishButton = read('src/components/publish-floating-button/index.tsx')
const publishButtonStyle = read('src/components/publish-floating-button/index.scss')

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const match = tabBarStyle.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'u'))
  assert.ok(match, `缺少 ${selector} 样式`)
  return match[1]
}

assert.match(
  rule('.tab-bar'),
  /height:\s*calc\(96rpx \+ env\(safe-area-inset-bottom\)\)/u,
)
assert.match(rule('.tab-bar__dock'), /bottom:\s*0/u)
assert.match(
  rule('.tab-bar__dock'),
  /height:\s*calc\(96rpx \+ env\(safe-area-inset-bottom\)\)/u,
)
assert.match(rule('.tab-bar__item'), /height:\s*96rpx/u)
assert.match(rule('.tab-bar__pill'), /height:\s*96rpx/u)
assert.match(tabBarStyle, /\.tab-bar__badge\s*\{/u)
assert.match(tabBarTemplate, /unreadCount > 0/u)
assert.match(appSource, /noticesRepository\.unreadCount\(\)/u)
assert.match(appSource, /setCustomTabBarUnreadCount/u)
assert.doesNotMatch(tabBarStyle, /tab-bar__publish-button/u, '底栏不应保留凸起发布按钮')
assert.doesNotMatch(tabBarTemplate, /tab-bar__item--publish/u, '发布入口不应占据底栏位置')
assert.match(tabBarLogic, /requestWechatSubscriptionForPublishSection\(publishSection\)/u)
assert.match(tabBarLogic, /navigateTo\(\{ url: `\/pages\/publish\/index\?section=\$\{publishSection\}` \}\)/u)
assert.match(publishButton, /openCustomTabBarPublish\(\)/u)
assert.match(tabBarLogic, /this\.data\.list\.findIndex\(item => item\.pagePath === route\)/u)
assert.match(tabBarHelpers, /for \(let index = pages\.length - 1; index >= 0; index -= 1\)/u)
assert.match(tabBarLogic, /pages\/goods\/index/u)
assert.match(appConfig, /pages\/goods\/index/u)
assert.match(appConfig, /pages\/community\/index/u)
assert.match(appConfig, /pages\/messages\/index/u)
assert.match(tabBarStyle, /\.tab-bar__item\s*\{[\s\S]*?flex:\s*1/u)
assert.match(tabBarStyle, /\.tab-bar__badge\s*\{[\s\S]*?left:\s*calc\(50% \+ 12rpx\)/u)
assert.match(publishButtonStyle, /bottom:\s*calc\(112rpx \+ env\(safe-area-inset-bottom\)\)/u)
assert.match(read('src/pages/index/index.scss'), /\.campus--publish-fab\s*\{[\s\S]*?padding-bottom:\s*calc\(224rpx \+ env\(safe-area-inset-bottom\)\)/u)
assert.match(read('src/pages/community/index.scss'), /\.community-page--publish-fab\s*\{[\s\S]*?padding-bottom:\s*calc\(224rpx \+ env\(safe-area-inset-bottom\)\)/u)
assert.match(read('src/pages/index/index.tsx'), /<PublishFloatingButton\s*\/>/u)
assert.match(read('src/pages/community/index.tsx'), /<PublishFloatingButton\s*\/>/u)
assert.match(appConfig, /assets\/tabbar\/goods\.png/u)
assert.match(appConfig, /assets\/tabbar\/goods-active\.png/u)
assert.doesNotMatch(tabBarStyle, /border-radius:\s*38rpx/u)
assert.doesNotMatch(tabBarStyle, /backdrop-filter:/u)
assert.doesNotMatch(tabBarStyle, /linear-gradient/u)
assert.match(
  tabBarStyle,
  /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[\s\S]*\.tab-bar__dock/u,
  '底栏深色外观必须由系统深色媒体查询驱动',
)

for (const path of [
  'src/pages/index/index.scss',
  'src/pages/community/index.scss',
  'src/pages/messages/index.scss',
  'src/pages/profile/index.scss',
]) {
  assert.match(
    read(path),
    /calc\(96rpx \+ env\(safe-area-inset-bottom\)\)/u,
    `${path} 未同步收紧底部内容留白`,
  )
}

console.log('tabbar layout smoke passed')
