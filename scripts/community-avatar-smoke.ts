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

const feedStyleSource = readFileSync(resolve(__dirname, '../src/features/community/feed-panel.scss'), 'utf8')
assert.ok(feedStyleSource.includes('.community-post__review-status--pending'))
assert.ok(feedStyleSource.includes('.community-post__review-status--rejected'))
assert.ok(feedStyleSource.includes('.community-post__image-reviewing'))

const detailSource = readFileSync(resolve(__dirname, '../src/pages/community/detail.tsx'), 'utf8')
assert.equal((detailSource.match(/communityAuthorAvatarUrl\(/g) || []).length >= 3, true)
assert.ok(detailSource.includes("className='community-detail-card__avatar-image'"))
assert.ok(detailSource.includes("className='community-detail-comments__avatar-image'"))
assert.ok(detailSource.includes("className='community-comment__reply-avatar-image'"))

const homeSource = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
assert.ok((homeSource.match(/communityAuthorAvatarUrl\(item\)/g) || []).length >= 2)
assert.ok(homeSource.includes("className='news-card__avatar-image'"))

const schemaSource = readFileSync(resolve(__dirname, '../src/api/generated/schema.ts'), 'utf8')
assert.match(schemaSource, /CampusCirclePostView: \{\n\s+author_avatar_url: string \| null;/)
assert.match(schemaSource, /CommentView: \{\n\s+author_avatar_url: string \| null;/)

process.stdout.write('community avatar smoke: ok\n')
