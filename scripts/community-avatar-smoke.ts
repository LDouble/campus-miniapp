import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
} from '../src/features/community/author'

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

const cardSource = readFileSync(resolve(__dirname, '../src/features/community/post-card.tsx'), 'utf8')
assert.ok(cardSource.includes('communityAuthorAvatarUrl(post)'))
assert.ok(cardSource.includes("className='community-post__avatar-image'"))
assert.ok(cardSource.includes("post.viewer_relation === 'owner'"))
assert.ok(cardSource.includes("post.status === 'pending_review'"))
assert.ok(cardSource.includes("post.status === 'rejected'"))
assert.ok(cardSource.includes("label: '审核中'"))
assert.ok(cardSource.includes("label: '未通过'"))
assert.ok(cardSource.includes('图片审核中'))
assert.ok(cardSource.includes('community-post__image-reviewing--overlay'))
assert.match(cardSource, /community-post__meta[\s\S]*?community-post__section-pill/u)
assert.ok(cardSource.includes('onSelectSection?.(post.section_id)'))
assert.ok(cardSource.includes('event.stopPropagation()'))

const feedStyleSource = readFileSync(resolve(__dirname, '../src/features/community/feed-panel.scss'), 'utf8')
assert.ok(feedStyleSource.includes('.community-post__review-status--pending'))
assert.ok(feedStyleSource.includes('.community-post__review-status--rejected'))
assert.ok(feedStyleSource.includes('.community-post__image-reviewing'))
assert.ok(feedStyleSource.includes('.community-post__image-reviewing--overlay'))
assert.match(feedStyleSource, /\.community-post__avatar-image[\s\S]*?background: #eef3f2;[\s\S]*?border-radius: 50%;/)
assert.match(feedStyleSource, /\.community-post__author-line > text:first-child \{[^}]*flex: 1;/u)
assert.match(feedStyleSource, /\.community-post__section-pill \{[^}]*background: var\(--campus-surface-subtle, #f8fafc\);/u)

const levelBadgeStyleSource = readFileSync(resolve(__dirname, '../src/features/community/level-badge.scss'), 'utf8')
assert.match(levelBadgeStyleSource, /\.community-level-badge \{[^}]*flex: none;[^}]*white-space: nowrap;/u)

const detailSource = readFileSync(resolve(__dirname, '../src/pages/community/detail.tsx'), 'utf8')
assert.equal((detailSource.match(/communityAuthorAvatarUrl\(/g) || []).length, 1)
assert.ok(detailSource.includes("className='community-detail-card__avatar-image'"))
assert.ok(detailSource.includes('community-detail-card__image-reviewing--overlay'))

const detailCommentsSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'), 'utf8')
assert.ok(detailCommentsSource.includes("className='business-detail-comment__avatar-image'"))

const detailStyleSource = readFileSync(resolve(__dirname, '../src/pages/community/detail.scss'), 'utf8')
assert.ok(detailStyleSource.includes('&__image-reviewing--overlay'))
assert.equal((detailStyleSource.match(/background: #eef3f2;\n\s+border-radius: 50%;/g) || []).length >= 3, true)

const publishSource = readFileSync(resolve(__dirname, '../src/pages/publish/index.tsx'), 'utf8')
assert.ok(publishSource.includes('`/pages/community/detail?id=${id}&mode=post`'))

const marketplaceCardSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/marketplace-card.tsx'), 'utf8')
assert.ok(marketplaceCardSource.includes("item.viewer_relation === 'owner' && item.status === 'pending_review'"))
assert.ok(marketplaceCardSource.includes('marketplace-card__reviewing'))

const homeSource = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
assert.ok((homeSource.match(/communityAuthorAvatarUrl\(item\)/g) || []).length >= 2)
assert.ok(homeSource.includes("className='news-card__avatar-image'"))
assert.ok(homeSource.includes("className='campus__avatar-image'"))
assert.ok(homeSource.includes("setAvatarUrl(account.value.user.avatar_url || '')"))

const homeStyleSource = readFileSync(resolve(__dirname, '../src/pages/index/index.scss'), 'utf8')
assert.equal((homeStyleSource.match(/&__avatar-image \{/g) || []).length >= 2, true)
assert.equal((homeStyleSource.match(/background: #eef3f2;\n\s+border-radius: 50%;/g) || []).length >= 2, true)

const profileStyleSource = readFileSync(resolve(__dirname, '../src/pages/profile/index.scss'), 'utf8')
assert.match(profileStyleSource, /&-image \{[\s\S]*?background: var\(--campus-surface-primary, #eff6ff\);[\s\S]*?border-radius: 50%;/)

const avatarImageSource = readFileSync(resolve(__dirname, '../src/components/user-avatar-image/index.tsx'), 'utf8')
assert.ok(avatarImageSource.includes("mode='aspectFill'"))
assert.ok(avatarImageSource.includes('onError={() => setFailedSrc(normalizedSrc)}'))
assert.ok(avatarImageSource.includes('return <Text>{fallback}</Text>'))

const schemaSource = readFileSync(resolve(__dirname, '../src/api/generated/schema.ts'), 'utf8')
assert.match(schemaSource, /CampusCirclePostView: \{\n\s+author_avatar_url: string \| null;/)
assert.match(schemaSource, /CommentView: \{\n\s+author_avatar_url: string \| null;/)

process.stdout.write('community avatar smoke: ok\n')
