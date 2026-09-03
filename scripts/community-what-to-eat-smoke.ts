import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const feed = source('../src/features/community/feed-panel.tsx')
const card = source('../src/features/community/what-to-eat-feed-card.tsx')
const style = source('../src/features/community/what-to-eat-feed-card.scss')

assert.match(feed, /pickRandomFood\(campus\)/u, 'Feed 应复用今天吃什么随机接口')
assert.match(feed, /WHAT_TO_EAT_CACHE_KEY/u, '推荐结果应按当天缓存')
assert.match(feed, /Math\.min\(3, posts\.length - 1\)/u, '随机卡应插入帖子前几条内容附近')
assert.match(feed, /WhatToEatFeedCard/u, 'Feed 应渲染今天吃什么卡片')
assert.match(card, /onPick/u, '推荐卡应支持换一个')
assert.match(card, /openWhatToEatDetail/u, '推荐卡应支持进入详情')
assert.match(style, /page\.dark|page\.theme-dark/u, '推荐卡应覆盖暗黑模式')

process.stdout.write('community what-to-eat smoke: ok\n')
