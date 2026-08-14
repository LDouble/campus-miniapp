import { strict as assert } from 'node:assert'
import {
  buildCampusShareMessage,
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
    path: '/pages/community/topic/index',
    query: { id: 7 },
    imageUrl: 'https://example.com/topic.jpg',
  }),
  {
    title: '海大校园话题',
    path: '/pages/community/topic/index?id=7',
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

console.log('share smoke: ok')
