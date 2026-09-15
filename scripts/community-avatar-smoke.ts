import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
  communityAuthorTone,
} from '../src/features/community/author'
import { userAvatarTone } from '../src/components/user-avatar/tone'

assert.equal(communityAuthorAvatarUrl({
  author_id: 1,
  author_avatar_url: ' https://media.weouc.com/avatar.jpg ',
}), 'https://media.weouc.com/avatar.jpg')
assert.equal(communityAuthorAvatarUrl({
  author_id: 1,
  author_avatar_url: 'https://media.weouc.com/avatar.jpg',
  author_deleted: true,
}), '')
assert.equal(communityAuthorAvatarUrl({ author_id: 1 }), '')
assert.equal(communityAuthorInitial({ author_id: 1, author_nickname: '校园同学' }), '校')
assert.deepEqual([0, 1, 2, 3, 4].map(userAvatarTone), [0, 1, 2, 3, 0])
assert.equal(communityAuthorTone({ author_id: 7 }), 3)
assert.equal(communityAuthorTone({ author_id: 7, author_deleted: true }), 0)

const cardSource = readFileSync(resolve(__dirname, '../src/features/community/post-card.tsx'), 'utf8')
const imageGridSource = readFileSync(resolve(__dirname, '../src/features/community/components/content-image-grid.tsx'), 'utf8')
assert.ok(cardSource.includes('communityAuthorAvatarUrl(post)'))
assert.ok(cardSource.includes("imageClassName='community-post__avatar-image'"))
assert.ok(cardSource.includes('<UserAvatar'))
assert.ok(cardSource.includes("post.viewer_relation === 'owner'"))
assert.ok(cardSource.includes("post.status === 'pending_review'"))
assert.ok(cardSource.includes("post.status === 'rejected'"))
assert.ok(cardSource.includes("label: '审核中'"))
assert.ok(cardSource.includes("label: '未通过'"))
assert.ok(cardSource.includes('<ContentImageGrid'))
assert.ok(imageGridSource.includes("reviewLabel = '图片审核中'"))
assert.ok(imageGridSource.includes('content-image-grid__reviewing--overlay'))
assert.match(cardSource, /community-post__meta[\s\S]*?community-post__section-pill/u)
assert.ok(cardSource.includes('onSelectSection(post.section_id)'))
assert.ok(cardSource.includes('event.stopPropagation()'))

const feedStyleSource = readFileSync(resolve(__dirname, '../src/features/community/feed-panel.scss'), 'utf8')
const imageGridStyleSource = readFileSync(resolve(__dirname, '../src/features/community/components/content-image-grid.scss'), 'utf8')
assert.ok(feedStyleSource.includes('.community-post__review-status--pending'))
assert.ok(feedStyleSource.includes('.community-post__review-status--rejected'))
assert.ok(imageGridStyleSource.includes('.content-image-grid__reviewing'))
assert.ok(imageGridStyleSource.includes('.content-image-grid__reviewing--overlay'))
assert.match(feedStyleSource, /\.community-post__avatar \{[\s\S]*?width: 80rpx;[\s\S]*?height: 80rpx;[\s\S]*?border-radius: 18rpx;/)
assert.match(feedStyleSource, /\.community-post__avatar-image \{\s*border-radius: inherit;/)
assert.match(feedStyleSource, /\.community-post__author-line > text:first-child \{[^}]*flex: 1;/u)
assert.match(feedStyleSource, /\.community-post__section-pill,[\s\S]*?\.community-post__section-label \{[\s\S]*?background: transparent;/u)

const levelBadgeStyleSource = readFileSync(resolve(__dirname, '../src/features/community/level-badge.scss'), 'utf8')
assert.match(levelBadgeStyleSource, /\.community-level-badge \{[^}]*flex: none;[^}]*white-space: nowrap;/u)

const detailSource = readFileSync(resolve(__dirname, '../src/pages/community/detail.tsx'), 'utf8')
assert.equal((detailSource.match(/communityAuthorAvatarUrl\(/g) || []).length, 1)
assert.ok(detailSource.includes('<DetailAuthorHeader'))
assert.ok(detailSource.includes('<ContentImageGrid'))

const detailAuthorHeaderSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-author-header.tsx'), 'utf8')
const detailAuthorHeaderStyleSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-author-header.scss'), 'utf8')
assert.match(detailAuthorHeaderSource, /shape='rounded'/u)
assert.match(detailAuthorHeaderStyleSource, /\.detail-author-header__avatar \{[^}]*width: 80rpx;[^}]*height: 80rpx;/u)

const detailCommentsSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'), 'utf8')
assert.ok(detailCommentsSource.includes("imageClassName='business-detail-comment__avatar-image'"))
assert.match(detailCommentsSource, /src=\{comment\.author_deleted \? '' : comment\.author_avatar_url\}/u)

const detailStyleSource = readFileSync(resolve(__dirname, '../src/pages/community/detail.scss'), 'utf8')
assert.ok(detailStyleSource.includes('.community-detail__review-status'))
assert.doesNotMatch(detailStyleSource, /\.community-detail__(?:__author|__avatar|__author-name)/u)

const detailCommentsStyleSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-comments.scss'), 'utf8')
const freshBarrageStyleSource = readFileSync(resolve(__dirname, '../src/features/community/fresh-barrage.scss'), 'utf8')
const listPanelStyleSource = readFileSync(resolve(__dirname, '../src/features/life-services/list-panel.scss'), 'utf8')
const marketplaceCardStyleSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/marketplace-card.scss'), 'utf8')
const publicProfileStyleSource = readFileSync(resolve(__dirname, '../src/pages/public-profile/index.scss'), 'utf8')
const darkModeStyleSource = readFileSync(resolve(__dirname, '../src/styles/_dark-mode.scss'), 'utf8')

const publishSource = readFileSync(resolve(__dirname, '../src/pages/publish/index.tsx'), 'utf8')
assert.ok(publishSource.includes('`/pages/community/detail?id=${id}&mode=post`'))

const marketplaceCardSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/marketplace-card.tsx'), 'utf8')
assert.ok(marketplaceCardSource.includes("item.viewer_relation === 'owner' && item.status === 'pending_review'"))
assert.ok(marketplaceCardSource.includes('marketplace-card__reviewing'))

const homeSource = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
assert.match(homeSource, /import CommunityPostCard(?:,\s*\{[^}]+\})? from '\.\.\/\.\.\/features\/community\/post-card'/u)
assert.match(homeSource, /onToggleLike=\{item\.source_type === 'campus_circle_post'[\s\S]*?toggleHomeFeedLike\(item\)[\s\S]*?: undefined\}/u)
assert.ok(homeSource.includes("imageClassName='campus__avatar-image'"))
assert.ok(homeSource.includes("setAvatarUrl(account.value.user.avatar_url || '')"))

const homeStyleSource = readFileSync(resolve(__dirname, '../src/pages/index/index.scss'), 'utf8')
assert.equal((homeStyleSource.match(/&__avatar-image \{/g) || []).length >= 2, true)
assert.equal((homeStyleSource.match(/background: #eef3f2;\n\s+border-radius: inherit;/g) || []).length >= 2, true)
assert.match(homeStyleSource, /&__avatar \{[^}]*width: 72rpx;[^}]*border: 0;[^}]*box-shadow: none;/u)
assert.match(homeStyleSource, /&__avatar \{[^}]*width: 52rpx;[^}]*border: 0;[^}]*box-shadow: none;/u)
assert.doesNotMatch(homeStyleSource, /border: (?:3|4)rpx solid rgba\(255, 255, 255, 0\.(?:86|92)\);/u)
assert.doesNotMatch(homeStyleSource, /box-shadow: (?:5rpx 7rpx 14rpx|8rpx 10rpx 24rpx)/u)

const profileStyleSource = readFileSync(resolve(__dirname, '../src/pages/profile/index.scss'), 'utf8')
assert.match(profileStyleSource, /&__avatar \{[\s\S]*?border-radius: 50%;[\s\S]*?&-image \{[\s\S]*?border-radius: inherit;/u)

const avatarSource = readFileSync(resolve(__dirname, '../src/components/user-avatar/index.tsx'), 'utf8')
const avatarStyleSource = readFileSync(resolve(__dirname, '../src/components/user-avatar/index.scss'), 'utf8')
assert.match(avatarSource, /shape = 'circle'/u)
assert.match(avatarSource, /`campus-user-avatar--\$\{shape\}`/u)
assert.match(avatarSource, /`campus-user-avatar--tone-\$\{tone\}`/u)
assert.match(avatarSource, /const tone = userAvatarTone\(userId\)/u)
assert.match(avatarSource, /<UserAvatarImage[\s\S]*?fallbackClassName=/u)
assert.match(avatarStyleSource, /\.campus-user-avatar\.campus-user-avatar--circle \{[\s\S]*?overflow: hidden;[\s\S]*?border-radius: 50%;/u)
assert.match(avatarStyleSource, /\.campus-user-avatar\.campus-user-avatar--rounded \{[\s\S]*?border-radius: 18rpx;/u)
assert.match(avatarStyleSource, /\.campus-user-avatar > \.campus-user-avatar__image \{[\s\S]*?border-radius: inherit;/u)
assert.match(avatarStyleSource, /\.campus-user-avatar \{[^}]*border: 0;[^}]*box-shadow: none;/u)

for (const [label, source, selector] of [
  ['社区列表', feedStyleSource, '\\.community-post__avatar'],
  ['首页弹幕', freshBarrageStyleSource, '\\.fresh-barrage__avatar'],
  ['详情作者', detailAuthorHeaderStyleSource, '\\.detail-author-header__avatar'],
  ['生活服务列表', listPanelStyleSource, '\\.business-card-avatar'],
  ['二手列表', marketplaceCardStyleSource, '\\.marketplace-card__avatar'],
  ['公开主页', publicProfileStyleSource, '\\.public-profile-hero__avatar'],
  ['评论回复', detailCommentsStyleSource, '\\.business-detail-comment__reply-avatar'],
  ['评论输入栏', detailCommentsStyleSource, '\\.business-detail-composer__avatar'],
] as const) {
  assert.match(
    source,
    new RegExp(`${selector} \\{[^}]*border: 0;[^}]*box-shadow: none;`, 'u'),
    `${label}头像仍叠加页面装饰`,
  )
}

assert.match(detailCommentsStyleSource, /\.business-detail-comment__avatar \{[^}]*border: 0;[^}]*box-shadow: none;/u)
assert.match(profileStyleSource, /&__avatar \{[^}]*width: 104rpx;[^}]*border: 0;[^}]*box-shadow: none;/u)
assert.doesNotMatch(darkModeStyleSource, /& \.campus__avatar,|& \.business-detail-(?:comment__avatar|comment__reply-avatar|composer__avatar)|& \.business-card-avatar--(?:errand|carpool)/u)
for (const [tone, background, color] of [
  [0, '#eaf3ff', '#2b7aef'],
  [1, '#edf4ff', '#2b7aef'],
  [2, '#fff0ec', '#c55d4d'],
  [3, '#fff5e7', '#a66d25'],
] as const) {
  assert.match(
    avatarStyleSource,
    new RegExp(`\\.campus-user-avatar\\.campus-user-avatar--tone-${tone} \\{[^}]*background: ${background};[^}]*color: ${color};`, 'u'),
  )
}

for (const path of [
  '../src/pages/index/index.tsx',
  '../src/pages/profile/index.tsx',
  '../src/pages/public-profile/index.tsx',
  '../src/features/community/fresh-barrage.tsx',
  '../src/features/community/post-card.tsx',
  '../src/features/life-services/components/carpool-card.tsx',
  '../src/features/life-services/components/errand-card.tsx',
  '../src/features/life-services/components/marketplace-card.tsx',
  '../src/features/life-services/components/detail-author-header.tsx',
  '../src/features/life-services/components/detail-comments.tsx',
]) {
  const source = readFileSync(resolve(__dirname, path), 'utf8')
  assert.match(source, /import UserAvatar from/u, `${path} 未接入公共头像组件`)
  assert.doesNotMatch(source, /UserAvatarImage/u, `${path} 仍在直接渲染底层头像图片`)
  assert.equal(
    (source.match(/<UserAvatar\b/g) || []).length,
    (source.match(/\buserId=\{/g) || []).length,
    `${path} 存在未按用户稳定配色的头像`,
  )
}

assert.match(detailSource, /import DetailAuthorHeader from/u)
assert.doesNotMatch(detailSource, /UserAvatarImage/u)

const avatarImageSource = readFileSync(resolve(__dirname, '../src/components/user-avatar-image/index.tsx'), 'utf8')
assert.ok(avatarImageSource.includes("mode='aspectFill'"))
assert.ok(avatarImageSource.includes('onError={() => setFailedSrc(normalizedSrc)}'))
assert.ok(avatarImageSource.includes('return <Text className={fallbackClassName}>{fallback}</Text>'))

const schemaSource = readFileSync(resolve(__dirname, '../src/api/generated/schema.ts'), 'utf8')
assert.match(schemaSource, /CampusCirclePostView: \{\n\s+author_avatar_url: string \| null;/)
assert.match(schemaSource, /CommentView: \{\n\s+author_avatar_url: string \| null;/)
assert.match(schemaSource, /HomeFeedItemView: \{[\s\S]*?author_avatar_url\?: string \| null;/)

process.stdout.write('community avatar smoke: ok\n')
