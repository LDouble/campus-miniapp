import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FavoriteItem } from '../src/api/types'
import {
  favoriteListItemKey,
  hasMoreFavoriteItems,
  mergeFavoriteItems,
} from '../src/features/favorites/list-state'
import { favoriteItemToHomeFeedItem } from '../src/features/favorites/feed-adapter'
import { favoriteDetailURL } from '../src/features/favorites/links'

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const item = (resource_type: FavoriteItem['resource_type'], resource_id: number) => ({
  resource_type,
  resource_id,
  favorited_at: '2026-08-22T12:00:00Z',
  availability: 'available',
} as FavoriteItem)

const first = item('marketplace', 11)
const second = item('errand', 22)
const duplicate = { ...first, availability: 'unavailable' as const }
assert.equal(favoriteListItemKey(first), 'marketplace:11')
assert.deepEqual(
  mergeFavoriteItems([first], [duplicate, second]),
  [first, second],
  '分页合并按资源类型和 ID 去重，并保留先到的数据',
)
assert.equal(hasMoreFavoriteItems(19, 20), true)
assert.equal(hasMoreFavoriteItems(20, 20), false)
assert.equal(hasMoreFavoriteItems(21, 20), false)

const preview: NonNullable<FavoriteItem['preview']> = {
  author_avatar_url: null,
  author_id: 7,
  author_nickname: '小园',
  campus: '崂山校区',
  category: '教材',
  cover_url: null,
  created_at: '2026-08-22T11:00:00Z',
  currency: 'CNY',
  deadline: null,
  departure_at: null,
  destination: null,
  dropoff_location: null,
  images: [{ media_id: 42, url: 'https://cdn.example/book.jpg' }],
  intent: 'sell',
  occupied_seats: null,
  origin: null,
  pickup_location: null,
  price_cents: 1200,
  published_at: '2026-08-22T12:00:00Z',
  resource_id: 11,
  resource_type: 'marketplace',
  review_status: 'approved',
  reward_cents: null,
  status: 'published',
  summary: '高等数学教材',
  title: '二手教材',
  total_seats: null,
}
const feedItem = favoriteItemToHomeFeedItem({ ...first, preview })
assert.equal(feedItem?.source_type, 'marketplace_listing')
assert.equal(feedItem?.source_id, 11)
assert.equal(feedItem?.amount_cents, 1200)
assert.equal(feedItem?.content, '二手教材\n高等数学教材')
assert.equal(feedItem?.images[0]?.media_id, 42)
assert.equal(feedItem?.feed_time, preview.published_at)
assert.equal(
  favoriteItemToHomeFeedItem({ ...first, availability: 'unavailable', preview }),
  null,
  '不可用收藏不能转换为首页 feed 卡',
)

const api = source('../src/api/favorites.ts')
assert.match(api, /path: '\/api\/v1\/favorites'/u, '收藏列表使用后端收藏协议')
assert.match(api, /resource_type: query\.resourceType/u, '收藏列表支持类型筛选')
assert.match(api, /page_size: normalizePageSize\(query\.pageSize\)/u, '收藏列表规范化分页大小')
assert.match(api, /method,\n\s*query: \{ resource_type: resourceType \}/u, '收藏状态请求统一携带资源类型')
assert.match(api, /method: 'GET' \| 'PUT' \| 'DELETE'/u, '收藏入口覆盖查询、收藏和取消收藏')

const page = source('../src/pages/favorites/index.tsx')
assert.match(page, /listMyFavorites\(\{ page: targetPage, pageSize: FAVORITES_PAGE_SIZE \}\)/u, '列表按页请求收藏数据')
assert.match(page, /FAVORITES_PAGE_SIZE = 20/u, '列表使用固定分页大小')
assert.match(page, /useReachBottom\(/u, '列表支持触底加载更多')
assert.match(page, /usePullDownRefresh\(/u, '列表支持下拉刷新')
assert.match(page, /requestVersionRef/u, '列表用请求版本丢弃过期响应')
assert.match(page, /mergeFavoriteItems\(current, result\.items\)/u, '分页追加使用去重合并')
assert.doesNotMatch(page, /lifeServicesRepository|getCampusCirclePost|getMarketplaceListing|getErrand|getCarpoolTrip/u, '收藏列表不为卡片逐条请求详情')

const card = source('../src/features/favorites/favorite-card.tsx')
assert.match(card, /CommunityPostCard/u, '可用收藏必须复用首页 feed 卡')
assert.match(card, /favoriteItemToHomeFeedItem/u, '收藏卡片必须通过 feed 适配器复用首页数据结构')
assert.match(card, /trailingAction=/u, '收藏卡片必须把取消收藏动作注入 feed 卡操作区')
assert.match(card, /initialFavorited\s*\n\s*loadState=\{false\}/u, '收藏卡片不重复查询收藏状态')
assert.match(card, /内容已不可用/u, '卡片展示资源不可用状态')
assert.match(card, /openFavoriteDetail\(item\)/u, '卡片只在用户点击时进入详情')

const postCard = source('../src/features/community/post-card.tsx')
assert.match(postCard, /trailingAction\?: ReactNode/u, '公共 feed 卡支持注入收藏操作')
assert.match(postCard, /onToggleActions\?:/u, '公共 feed 卡允许收藏页隐藏动态操作菜单')

assert.equal(
  favoriteDetailURL(item('campus_circle_post', 31)),
  '/packages/social/community/detail?id=31&mode=post',
  '校园动态详情路由映射错误',
)
assert.equal(
  favoriteDetailURL(item('marketplace', 32)),
  '/packages/social/marketplace/detail?id=32',
  '二手详情路由映射错误',
)
assert.equal(
  favoriteDetailURL(item('errand', 33)),
  '/packages/social/errands/detail?id=33',
  '跑腿详情路由映射错误',
)
assert.equal(
  favoriteDetailURL(item('carpool', 34)),
  '/packages/social/carpool/detail?id=34',
  '找同行详情路由映射错误',
)

const types = source('../src/features/favorites/types.ts')
assert.match(types, /export \{ favoriteDetailURL, favoriteResourceKey \} from '\.\/links'/u, '收藏类型模块应复用纯路由映射')

const profile = source('../src/pages/profile/index.tsx')
assert.match(profile, /收藏/u, '个人页提供收藏入口')
assert.match(profile, /\/pages\/favorites\/index/u, '收藏入口指向收藏列表页')

const appConfig = source('../src/app.config.ts')
assert.match(appConfig, /root: 'pages\/favorites'/u, '收藏列表配置为分包页面')
assert.match(appConfig, /sourceRoot: 'pages\/favorites'/u, '收藏分包 sourceRoot 正确')
assert.match(page, /community-post-list/u, '收藏列表沿用首页 feed 列表容器')

const details = [
  ['community', '../src/packages/social/community/detail.tsx', 'campus_circle_post'],
  ['marketplace', '../src/packages/social/marketplace/detail.tsx', 'marketplace'],
  ['errand', '../src/packages/social/errands/detail.tsx', 'errand'],
  ['carpool', '../src/packages/social/carpool/detail.tsx', 'carpool'],
] as const
for (const [name, path, resourceType] of details) {
  const detail = source(path)
  assert.match(detail, /FavoriteToggle/u, `${name}详情缺少收藏按钮`)
  assert.match(detail, new RegExp(`resourceType='${resourceType}'`, 'u'), `${name}详情收藏类型错误`)
}

process.stdout.write('favorites smoke: ok\n')
