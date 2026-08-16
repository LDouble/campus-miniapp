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
  '/packages/social/community/detail?id=12&mode=post&comment_id=44',
)

const detailCommentsSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'),
  'utf8',
)
const detailCommentsStyle = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.scss'),
  'utf8',
)
const communityDetailStyle = readFileSync(
  resolve(__dirname, '../src/packages/social/community/detail.scss'),
  'utf8',
)

assert.doesNotMatch(detailCommentsSource, /收起回复/u)
assert.match(detailCommentsSource, /!thread\?\.expanded && hasHiddenReplies/u)
assert.doesNotMatch(detailCommentsSource, /business-detail-comment__meta-action/u)
assert.match(detailCommentsSource, /showActionSheetSelection/u)
assert.match(detailCommentsSource, /onLongPress=\{\(\) => onOpenActions\(comment\)\}/u)
assert.match(detailCommentsSource, /const DetailCommentThread = memo/u)
assert.match(detailCommentsSource, /const \{ descendants, memberNames, replyTree, showThreadAction \} = useMemo/u)
assert.match(detailCommentsSource, /const existingIds = new Set\(current\.map\(\(entry\) => entry\.id\)\)/u)
assert.match(detailCommentsSource, /threadInFlightRef/u)
assert.match(detailCommentsSource, /clearPendingTimers/u)
const startReplySource = detailCommentsSource.match(
  /const startReply = useCallback\([\s\S]*?\n  const finishComposerClose/u,
)?.[0] || ''
assert.match(startReplySource, /setReplyTarget\(comment\)[\s\S]*openComposer\(\)/u)
assert.doesNotMatch(startReplySource, /loadThread|updateThreads|getCommentThread/u)
assert.match(detailCommentsSource, /const COMPOSER_CLOSE_DURATION = 180/u)
assert.match(detailCommentsSource, /const COMMENT_FOCUS_DURATION = 2200/u)
assert.match(detailCommentsSource, /const focusCommentTemporarily = useCallback/u)
assert.match(detailCommentsSource, /focusedCommentClearRef\.current\?\.\(\)/u)
assert.match(detailCommentsSource, /focusCommentTemporarily\(focusId\)/u)
assert.match(detailCommentsSource, /focusCommentTemporarily\(created\.id\)/u)
assert.match(detailCommentsSource, /current === commentId \? 0 : current/u)
assert.match(detailCommentsSource, /const \[composerClosing, setComposerClosing\] = useState\(false\)/u)
assert.match(detailCommentsSource, /const shouldFollowKeyboard = inputFocused \|\| keyboardHeight > 0/u)
assert.match(detailCommentsSource, /setComposerClosing\(true\)[\s\S]*setInputFocused\(false\)[\s\S]*Taro\.hideKeyboard/u)
assert.match(detailCommentsSource, /composerCloseSequenceRef\.current === closeSequence/u)
assert.match(detailCommentsSource, /scheduleTimeout\(\(\) => \{[\s\S]*finishComposerClose\(\)[\s\S]*keyboardTransitionDuration \+ 120/u)
assert.match(detailCommentsSource, /const handleKeyboardHeightChange = useCallback/u)
assert.match(detailCommentsSource, /const handleComposerBlur = useCallback/u)
assert.match(
  detailCommentsSource,
  /if \(!composerClosingRef\.current && !stickerPickerOpenRef\.current\) closeComposer\(\)/u,
)
assert.match(detailCommentsSource, /onBlur=\{handleComposerBlur\}/u)
assert.match(detailCommentsSource, /event\.detail\.duration/u)
assert.match(detailCommentsSource, /transitionDuration: `\$\{keyboardTransitionDuration\}ms`/u)
assert.match(detailCommentsSource, /onKeyboardHeightChange=\{handleKeyboardHeightChange\}/u)
assert.doesNotMatch(detailCommentsSource, /onKeyboardVisibilityChange=/u)
assert.doesNotMatch(
  detailCommentsSource,
  /business-detail-composer__control-spacer/u,
  '发布箭头右侧不得保留透明占位',
)
assert.doesNotMatch(
  detailCommentsStyle,
  /business-detail-composer__control-spacer/u,
  '发布箭头占位样式应同步移除',
)
assert.match(detailCommentsSource, /catchMove=\{composerOpen && !composerClosing\}/u)
assert.match(detailCommentsSource, /onTouchStart=\{composerOpen && !composerClosing \? closeComposer : undefined\}/u)
assert.doesNotMatch(detailCommentsSource, /\{composerOpen && \([\s\S]*business-detail-composer__backdrop/u)
assert.match(detailCommentsSource, /<Text onTouchStart=\{closeComposer\}>取消<\/Text>/u)
assert.match(detailCommentsSource, /placeholder=\{replyTarget \? '写下回复\.\.\.' : placeholder\}/u)
assert.doesNotMatch(
  detailCommentsSource,
  /placeholder=\{replyTarget \? `@\$\{compactCommentName/u,
  '回复对象已在输入框上方展示，输入框中不得重复显示',
)
assert.match(detailCommentsSource, /\{enabled \? \([\s\S]*<KeyboardSafeTextarea/u)
assert.match(detailCommentsSource, /focus=\{composerOpen && inputFocused\}/u)
assert.doesNotMatch(detailCommentsSource, /business-detail-composer__collapsed-input/u)
assert.match(detailCommentsSource, /transform: `translate3d\(0, -\$\{keyboardHeight\}px, 0\)`/u)
assert.doesNotMatch(detailCommentsSource, /style=\{\{ bottom: `\$\{keyboardHeight\}px` \}\}/u)
assert.match(detailCommentsSource, /className='business-detail-comments__skeleton'/u)
assert.match(detailCommentsSource, /\[0, 1, 2\]\.map\(\(index\) =>/u)
assert.match(detailCommentsSource, /!loading && comments\.length === 0/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__bubble \{[^}]*background: transparent;/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__author \{[^}]*--campus-text-muted/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__reply-identity \{[^}]*--campus-text-muted/u)
assert.match(detailCommentsStyle, /business-detail-comment__reply--focused[^}]*box-shadow: inset/u)
assert.match(detailCommentsStyle, /\.business-detail-comments__skeleton \{[^}]*min-height: 474rpx;/u)
assert.match(detailCommentsStyle, /business-detail-comments-skeleton-shimmer/u)
assert.match(detailCommentsStyle, /@media \(prefers-reduced-motion: reduce\)[\s\S]*business-detail-comments__skeleton-avatar/u)
assert.match(detailCommentsStyle, /\.business-detail-composer \{[\s\S]*background: var\(--campus-surface, #fff\);/u)
assert.doesNotMatch(detailCommentsStyle, /\.business-detail-composer \{[\s\S]*?backdrop-filter:/u)
assert.match(detailCommentsStyle, /\.business-detail-composer \{[\s\S]*transition: transform 180ms ease-out;/u)
assert.match(detailCommentsStyle, /\.business-detail-composer__backdrop \{[^}]*pointer-events: none;/u)
assert.match(detailCommentsStyle, /\.business-detail-composer__backdrop--active \{ pointer-events: auto; \}/u)
assert.match(
  detailCommentsStyle,
  /\.business-detail-composer textarea \{[^}]*border: 1rpx solid var\(--campus-border, #e8eef6\);[^}]*background: transparent;/u,
  '回复输入框不得使用横向铺满的灰色背景',
)
assert.match(
  detailCommentsStyle,
  /\.business-detail-composer__replying text:last-child \{[^}]*color: var\(--campus-text-secondary, #62748e\);/u,
  '取消回复应使用中性色，避免呈现为危险操作',
)
assert.doesNotMatch(
  detailCommentsStyle,
  /\.business-detail-composer__replying text:last-child \{[^}]*--campus-danger/u,
  '取消回复不得使用危险红色',
)
assert.match(communityDetailStyle, /\.community-detail-card \+ \.business-detail-comments \{[^}]*margin-top: 0;[^}]*padding-top: 30rpx;/u)

console.log('comment reply smoke: ok')
