import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const tabBarStyle = read('src/custom-tab-bar/index.wxss')

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const match = tabBarStyle.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'u'))
  assert.ok(match, `缺少 ${selector} 样式`)
  return match[1]
}

assert.match(
  rule('.tab-bar'),
  /height:\s*calc\(164rpx \+ env\(safe-area-inset-bottom\)\)/u,
)
assert.match(rule('.tab-bar__dock'), /bottom:\s*calc\(22rpx \+ env\(safe-area-inset-bottom\)\)/u)
assert.match(rule('.tab-bar__dock'), /height:\s*112rpx/u)
assert.match(rule('.tab-bar__item'), /height:\s*112rpx/u)
assert.match(rule('.tab-bar__pill'), /height:\s*88rpx/u)
assert.match(rule('.tab-bar__publish-button'), /width:\s*84rpx/u)
assert.match(rule('.tab-bar__publish-button'), /height:\s*84rpx/u)
assert.match(rule('.tab-bar__publish-button'), /transform:\s*translateY\(-24rpx\)/u)
assert.doesNotMatch(tabBarStyle, /height:\s*142rpx/u)
assert.doesNotMatch(tabBarStyle, /translateY\(-40rpx\)/u)
assert.match(tabBarStyle, /@media \(prefers-color-scheme: dark\)/u)

for (const path of [
  'src/pages/index/index.scss',
  'src/features/community/feed-panel.scss',
  'src/features/life-services/list-panel.scss',
]) {
  assert.match(
    read(path),
    /calc\(164rpx \+ env\(safe-area-inset-bottom\)\)/u,
    `${path} 未同步收紧底部内容留白`,
  )
}

console.log('tabbar layout smoke passed')
