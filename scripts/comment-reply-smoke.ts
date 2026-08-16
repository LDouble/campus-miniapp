import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCampusCircleCommentInput,
  buildCommentTree,
  commentReplyTargetName,
  commentRootId,
  mergeLocalThreadReply,
} from '../src/features/community/comments'
import { noticeActionRoute } from '../src/features/notices/action-route'

const root = {
  id: 41,
  root_id: 41,
  parent_id: null,
  reply_to_user_id: null,
  reply_count: 1,
  author_id: 7,
  author_nickname: '海风同学',
}
const firstReply = {
  id: 43,
  root_id: 41,
  parent_id: 41,
  reply_to_user_id: 7,
  reply_count: 0,
  author_id: 9,
  author_nickname: '木棉同学',
}
const pendingReply = {
  id: 44,
  root_id: 41,
  parent_id: 43,
  reply_to_user_id: 9,
  reply_count: 0,
  author_id: 7,
  author_nickname: '海风同学',
}

assert.deepEqual(
  buildCampusCircleCommentInput(12, '  回复内容  ', firstReply),
  {
    target_type: 'campus_circle_post',
    target_id: 12,
    parent_id: 43,
    content: '回复内容',
  },
)
assert.deepEqual(
  buildCampusCircleCommentInput(12, '  根评论  ', null),
  {
    target_type: 'campus_circle_post',
    target_id: 12,
    content: '根评论',
  },
)
assert.equal(commentRootId(firstReply), 41)
assert.equal(commentReplyTargetName(firstReply, [root, firstReply]), '海风同学')

const merged = mergeLocalThreadReply([firstReply], pendingReply)
assert.deepEqual(merged.map((item) => item.id), [43, 44])
assert.equal(merged[0].reply_count, 1)
assert.strictEqual(mergeLocalThreadReply(merged, pendingReply), merged)

const tree = buildCommentTree(root.id, [pendingReply, firstReply])
assert.equal(tree.length, 1)
assert.equal(tree[0].comment.id, firstReply.id)
assert.equal(tree[0].children[0].comment.id, pendingReply.id)

assert.equal(
  noticeActionRoute('/api/v1/campus-circle/posts/12?comment_id=44'),
  '/pages/community/detail?id=12&mode=post&comment_id=44',
)

const detailCommentsSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'),
  'utf8',
)
const detailCommentsStyle = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.scss'),
  'utf8',
)

assert.doesNotMatch(detailCommentsSource, /收起回复/u)
assert.match(detailCommentsSource, /!thread\?\.expanded && hasHiddenReplies/u)
assert.doesNotMatch(detailCommentsSource, /business-detail-comment__meta-action/u)
assert.match(detailCommentsSource, /showActionSheetSelection/u)
assert.match(detailCommentsSource, /onLongPress=\{\(\) => void openCommentActions\(comment\)\}/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__bubble \{[^}]*background: transparent;/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__author \{[^}]*--campus-text-muted/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__reply-identity \{[^}]*--campus-text-muted/u)

console.log('comment reply smoke: ok')
