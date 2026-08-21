import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const tabBarStyle = read('src/custom-tab-bar/index.wxss')
const tabBarTemplate = read('src/custom-tab-bar/index.wxml')
const appSource = read('src/app.ts')

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const match = tabBarStyle.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'u'))
  assert.ok(match, `缺少 ${selector} 样式`)
  return match[1]
}

assert.match(
  rule('.tab-bar'),
  /height:\s*calc\(112rpx \+ env\(safe-area-inset-bottom\)\)/u,
)
assert.match(rule('.tab-bar__dock'), /bottom:\s*0/u)
assert.match(
  rule('.tab-bar__dock'),
  /height:\s*calc\(112rpx \+ env\(safe-area-inset-bottom\)\)/u,
)
assert.match(rule('.tab-bar__item'), /height:\s*112rpx/u)
assert.match(rule('.tab-bar__pill'), /height:\s*112rpx/u)
assert.match(tabBarStyle, /\.tab-bar__badge\s*\{/u)
assert.match(tabBarTemplate, /unreadCount > 0/u)
assert.match(appSource, /noticesRepository\.unreadCount\(\)/u)
assert.match(appSource, /setCustomTabBarUnreadCount/u)
assert.match(rule('.tab-bar__publish-button'), /width:\s*76rpx/u)
assert.match(rule('.tab-bar__publish-button'), /height:\s*76rpx/u)
assert.match(rule('.tab-bar__publish-button'), /transform:\s*translateY\(-16rpx\)/u)
assert.doesNotMatch(tabBarStyle, /border-radius:\s*38rpx/u)
assert.doesNotMatch(tabBarStyle, /backdrop-filter:/u)
assert.doesNotMatch(tabBarStyle, /linear-gradient/u)
assert.match(tabBarStyle, /\.tab-bar--dark \.tab-bar__dock/u)

for (const path of [
  'src/pages/index/index.scss',
  'src/pages/community/index.scss',
]) {
  assert.match(
    read(path),
    /calc\(112rpx \+ env\(safe-area-inset-bottom\)\)/u,
    `${path} 未同步收紧底部内容留白`,
  )
}

console.log('tabbar layout smoke passed')
