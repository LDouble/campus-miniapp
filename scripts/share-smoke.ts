import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCampusShareMessage,
  buildCampusShareTimelineMessage,
  buildSharePath,
} from '../src/features/share/message'

assert.equal(
  buildSharePath('pages/shuttle/detail', {
    id: 12,
    date: '2026-08-14',
    empty: '',
    missing: undefined,
  }),
  '/pages/shuttle/detail?id=12&date=2026-08-14',
)

assert.equal(
  buildSharePath('/pages/community/index?section=community', { tab: 'hot topics' }),
  '/pages/community/index?section=community&tab=hot%20topics',
)

assert.deepEqual(
  buildCampusShareMessage({
    title: '  校车\n班次  ',
    path: '/pages/shuttle/index',
    imageUrl: '   ',
  }),
  {
    title: '校车 班次',
    path: '/pages/shuttle/index',
  },
)

assert.deepEqual(
  buildCampusShareMessage({
    title: '',
    fallbackTitle: '海大校园话题',
    path: '/packages/social/community/topic/index',
    query: { id: 7 },
    imageUrl: 'https://example.com/topic.jpg',
  }),
  {
    title: '海大校园话题',
    path: '/packages/social/community/topic/index?id=7',
    imageUrl: 'https://example.com/topic.jpg',
  },
)

assert.equal(
  buildCampusShareMessage({
    title: '海'.repeat(50),
    path: '/pages/index/index',
  }).title.length,
  36,
)

assert.deepEqual(
  buildCampusShareTimelineMessage({
    title: '  校园\n话题  ',
    path: '/packages/social/community/topic/index?source=timeline',
    query: { id: 7, tab: 'hot topics' },
    imageUrl: ' https://example.com/topic.jpg ',
  }),
  {
    title: '校园 话题',
    query: 'source=timeline&id=7&tab=hot%20topics',
    imageUrl: 'https://example.com/topic.jpg',
  },
)

assert.deepEqual(
  buildCampusShareTimelineMessage({
    title: '',
    fallbackTitle: '海大校园',
    path: '/pages/index/index',
    imageUrl: '   ',
  }),
  { title: '海大校园' },
)

const shareHookSource = readFileSync(
  resolve(__dirname, '../src/features/share/index.ts'),
  'utf8',
)
assert.match(shareHookSource, /useShareAppMessage, useShareTimeline/u)
assert.match(shareHookSource, /useShareTimeline\(\(\) => buildCampusShareTimelineMessage/u)
assert.match(shareHookSource, /factory\(\{ from: 'menu' \}\)/u)

const sharePages = execFileSync(
  'rg',
  ['-l', 'useCampusShare', 'src/pages', 'src/packages', '-g', '*.tsx'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)

assert.equal(sharePages.length, 18, '朋友圈配置检查应覆盖全部现有分享页面')
for (const pagePath of sharePages) {
  const configPath = pagePath.replace(/\.tsx$/u, '.config.ts')
  const configSource = readFileSync(resolve(__dirname, '..', configPath), 'utf8')
  assert.match(configSource, /enableShareAppMessage:\s*true/u, `${configPath} 未开启好友分享`)
  assert.match(configSource, /enableShareTimeline:\s*true/u, `${configPath} 未开启朋友圈分享`)
}

console.log('share smoke: ok')
