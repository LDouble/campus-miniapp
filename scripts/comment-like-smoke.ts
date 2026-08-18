import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CommentView, ReactionState } from '../src/api/types'
import {
  applyCommentReaction,
  commentLikeFailure,
} from '../src/features/community/comment-likes'

const reply = {
  id: 42,
  available_actions: ['reply', 'like'],
  like_count: 2,
  liked: false,
  reply_preview: [],
} as CommentView
const root = {
  id: 41,
  available_actions: ['reply', 'like'],
  like_count: 5,
  liked: false,
  reply_preview: [reply],
} as CommentView
const likedReply: ReactionState = {
  resource_type: 'comment',
  resource_id: reply.id,
  like_count: 3,
  liked: true,
}

const roots = [root]
const updatedPreview = applyCommentReaction(roots, likedReply)
assert.notStrictEqual(updatedPreview, roots)
assert.equal(updatedPreview[0].reply_preview[0].like_count, 3)
assert.equal(updatedPreview[0].reply_preview[0].liked, true)
assert.equal(updatedPreview[0].reply_preview[0].available_actions.includes('like'), false)
assert.equal(updatedPreview[0].reply_preview[0].available_actions.includes('unlike'), true)

const thread = applyCommentReaction([reply], likedReply)
assert.equal(thread[0].like_count, 3)
assert.equal(thread[0].liked, true)

const unlikedReply = applyCommentReaction(thread, { ...likedReply, like_count: 2, liked: false })
assert.equal(unlikedReply[0].like_count, 2)
assert.equal(unlikedReply[0].liked, false)
assert.equal(unlikedReply[0].available_actions.includes('like'), true)
assert.equal(unlikedReply[0].available_actions.includes('unlike'), false)

assert.strictEqual(
  applyCommentReaction(roots, { ...likedReply, resource_type: 'campus_circle_post' }),
  roots,
)

assert.deepEqual(commentLikeFailure({
  code: 'cannot_like_own_comment',
  message: 'conflict',
  statusCode: 409,
}), { message: '不能点赞自己的评论', refresh: false })
assert.deepEqual(commentLikeFailure({
  code: 'comment_not_found',
  message: 'not found',
  statusCode: 404,
}), { message: '评论已不可见，已为你刷新', refresh: true })
assert.deepEqual(commentLikeFailure({
  code: 'request_conflict',
  message: 'conflict',
  statusCode: 409,
}), { message: '评论状态已变化，已为你刷新', refresh: true })
assert.deepEqual(commentLikeFailure({
  code: 'request_failed',
  message: '服务暂不可用',
  statusCode: 503,
}), { message: '服务暂不可用', refresh: false })

const repositorySource = readFileSync(
  resolve(__dirname, '../src/features/life-services/repository.ts'),
  'utf8',
)
const commentsSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'),
  'utf8',
)
const commentsStyle = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.scss'),
  'utf8',
)
const generatedSchema = readFileSync(
  resolve(__dirname, '../src/api/generated/schema.ts'),
  'utf8',
)

assert.match(repositorySource, /path: `\/api\/v1\/likes\/\$\{id\}`/u)
assert.match(repositorySource, /query: \{ resource_type: resourceType \}/u)
assert.match(commentsSource, /likeInFlightRef\.current\.has\(comment\.id\)/u)
assert.match(commentsSource, /likeInFlightRef\.current\.add\(comment\.id\)/u)
assert.match(commentsSource, /likeInFlightRef\.current\.delete\(comment\.id\)/u)
assert.match(commentsSource, /applyCommentReaction\(thread\.descendants, reaction\)/u)
assert.match(commentsSource, /error\.code === 'academic_verification_required'/u)
assert.match(commentsSource, /canToggleLike \? \(/u)
assert.match(commentsSource, /className='business-detail-comment__like-count'/u)
assert.doesNotMatch(commentsSource, /business-detail-comment__like--disabled/u)
assert.match(commentsStyle, /\.business-detail-comment__like--active/u)
assert.match(commentsStyle, /\.business-detail-comment__like-count/u)
assert.match(commentsStyle, /business-detail-comment-like-pop/u)
assert.match(generatedSchema, /"\/api\/v1\/likes\/\{id\}"/u)
assert.match(generatedSchema, /like_count: number;\n\s+liked: boolean;/u)
assert.match(generatedSchema, /CommentViewerAction:.*"like" \| "unlike"/u)

console.log('comment like smoke: ok')
