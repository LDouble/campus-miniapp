import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const authorSource = readSource('../src/features/life-services/components/detail-author-header.tsx')
const authorStyle = readSource('../src/features/life-services/components/detail-author-header.scss')
const avatarSource = readSource('../src/components/user-avatar/index.tsx')
const avatarStyle = readSource('../src/components/user-avatar/index.scss')
const introSource = readSource('../src/features/life-services/components/detail-business-intro.tsx')
const lifeDetailStyle = readSource('../src/features/life-services/detail.scss')
const marketStyle = readSource('../src/pages/marketplace/detail.scss')

const detailSources = {
  community: readSource('../src/pages/community/detail.tsx'),
  errands: readSource('../src/pages/errands/detail.tsx'),
  marketplace: readSource('../src/pages/marketplace/detail.tsx'),
  carpool: readSource('../src/pages/carpool/detail.tsx'),
}

assert.match(authorSource, /<UserAvatar[\s\S]*?shape='rounded'/u)
assert.match(authorSource, /openPublicProfile\(userId\)/u)
assert.match(authorSource, /detail-author-header__action/u)
assert.match(authorStyle, /\.detail-author-header__avatar \{[^}]*width: 80rpx;[^}]*height: 80rpx;/u)
assert.match(authorStyle, /\.detail-author-header__identity \{[^}]*min-height: 88rpx;/u)
assert.match(authorStyle, /\.detail-author-header__name \{[^}]*color: var\(--ousea-ocean-600, #1d5fd6\);[^}]*font-weight: var\(--ousea-font-weight-medium, 500\);/u)
assert.match(avatarSource, /shape\?: 'circle' \| 'rounded'/u)
assert.match(avatarSource, /shape = 'circle'/u)
assert.match(avatarStyle, /\.campus-user-avatar\.campus-user-avatar--rounded \{[^}]*border-radius: 18rpx;/u)

for (const [kind, source] of Object.entries(detailSources)) {
  assert.match(source, /import DetailAuthorHeader from/u, `${kind}: 未引入公共详情作者头部`)
  assert.match(source, /<DetailAuthorHeader/u, `${kind}: 未渲染公共详情作者头部`)
  assert.doesNotMatch(source, /DetailAuthorNavbar|barContent=/u, `${kind}: 作者信息仍占用导航栏`)
}

assert.match(
  detailSources.community,
  /<DetailAuthorHeader[\s\S]*?profileEnabled=\{!post\.author_deleted\}[\s\S]*?badge=\{<CommunityLevelBadge/u,
  '帖子详情必须保留作者删除态和等级徽章',
)
assert.match(detailSources.community, /<DetailAuthorHeader[\s\S]*?<View className='community-detail__topic'/u)
assert.match(detailSources.errands, /<DetailAuthorHeader[\s\S]*?<DetailBusinessIntro[\s\S]*?title=\{item\.description\}/u)
assert.match(detailSources.carpool, /<DetailAuthorHeader[\s\S]*?<DetailBusinessIntro[\s\S]*?title=\{item\.description\}/u)
assert.doesNotMatch(detailSources.carpool, /<DetailBusinessIntro[\s\S]*?description=\{item\.description\}/u)
assert.match(
  detailSources.marketplace,
  /<DetailAuthorHeader[\s\S]*?<View className='market-detail-hero'>[\s\S]*?className='market-detail-title'[\s\S]*?item\.image_urls\.length > 0 && \([\s\S]*?<ContentImageGrid[\s\S]*?market-detail-main--price/u,
  '二手详情必须按作者、标题、可选真实图片、价格顺序展示',
)
assert.doesNotMatch(detailSources.marketplace, /market-detail-gallery__empty|coverTone/u, '纯文字二手详情不得生成伪图片卡')
assert.match(
  introSource,
  /\{title\?\.trim\(\) && \([\s\S]*?detail-overview__title[\s\S]*?\{\(visibleBadges\.length > 0 \|\| action\) && \(/u,
  '跑腿与找同行标题必须位于标签前',
)
assert.match(lifeDetailStyle, /\.detail-overview__title \{[^}]*font-size: var\(--ousea-font-size-title, 33rpx\);[^}]*font-weight: var\(--ousea-font-weight-medium, 500\);/u)
assert.match(marketStyle, /\.market-detail-title \{[^}]*font-size: var\(--ousea-font-size-title, 33rpx\);[^}]*font-weight: var\(--ousea-font-weight-medium, 500\);/u)
assert.equal(
  existsSync(resolve(__dirname, '../src/features/life-services/components/detail-author-navbar.tsx')),
  false,
  '废弃的导航栏作者组件应被移除',
)

process.stdout.write('detail author header smoke: ok\n')
