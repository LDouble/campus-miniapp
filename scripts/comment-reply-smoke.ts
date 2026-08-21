import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCampusCircleCommentInput,
  buildCommentTree,
  commentReplyTargetName,
  commentRootId,
  mergeLocalThreadReply,
  mergePublicCommentPreview,
  orderPublicCommentPreviews,
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
assert.deepEqual(
  buildCampusCircleCommentInput(12, '  带图评论  ', null, 88),
  {
    target_type: 'campus_circle_post',
    target_id: 12,
    content: '带图评论',
    media_id: 88,
  },
)
assert.equal(commentRootId(firstReply), 41)
assert.equal(commentReplyTargetName(firstReply, [root, firstReply]), '海风同学')

const merged = mergeLocalThreadReply([firstReply], pendingReply)
assert.deepEqual(merged.map((item) => item.id), [43, 44])
assert.equal(merged[0].reply_count, 1)
assert.strictEqual(mergeLocalThreadReply(merged, pendingReply), merged)

const mergedPublicReply = mergePublicCommentPreview([
  {
    id: 41,
    author_id: 7,
    author_nickname: '海风同学',
    parent_id: null,
    root_id: 41,
    reply_to_comment_id: null,
    reply_to_nickname: null,
    content: '根评论',
    created_at: '2026-08-21T00:00:00+08:00',
  },
], {
  ...pendingReply,
  target_id: 12,
  author_deleted: false,
  content: '二级回复',
  created_at: '2026-08-21T00:01:00+08:00',
} as never, {
  id: firstReply.id,
  authorNickname: firstReply.author_nickname,
})
assert.deepEqual(mergedPublicReply.map((item) => item.id), [41, 44])
assert.equal(mergedPublicReply[1].parent_id, 43)
assert.equal(mergedPublicReply[1].root_id, 41)
assert.equal(mergedPublicReply[1].reply_to_comment_id, 43)
assert.equal(mergedPublicReply[1].reply_to_nickname, '木棉同学')

const rootPreview = mergedPublicReply[0]
const replyPreview = mergedPublicReply[1]
const anotherRootPreview = {
  ...rootPreview,
  id: 55,
  root_id: 55,
  author_nickname: '山海同学',
}
assert.deepEqual(
  orderPublicCommentPreviews([replyPreview, rootPreview, anotherRootPreview]).map((item) => item.id),
  [41, 44, 55],
)
const localPreviewBeyondServerLimit = mergePublicCommentPreview(
  [rootPreview, replyPreview, anotherRootPreview],
  {
    ...pendingReply,
    id: 46,
    target_id: 12,
    author_deleted: false,
    content: '刚刚追加的二级回复',
    created_at: '2026-08-21T00:02:00+08:00',
  } as never,
  { id: firstReply.id, authorNickname: firstReply.author_nickname },
)
assert.equal(localPreviewBeyondServerLimit.length, 4)
assert.deepEqual(localPreviewBeyondServerLimit.map((item) => item.id), [41, 46, 44, 55])

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
const communityCommentSheetSource = readFileSync(
  resolve(__dirname, '../src/features/community/comment-sheet.tsx'),
  'utf8',
)
const detailCommentsStyle = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.scss'),
  'utf8',
)
const commentImageSource = readFileSync(
  resolve(__dirname, '../src/features/community/components/comment-image.tsx'),
  'utf8',
)
const commentImageStyle = readFileSync(
  resolve(__dirname, '../src/features/community/components/comment-image.scss'),
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
assert.match(startReplySource, /setReplyAnchorSelector\(`#detail-comment-reply-\$\{comment\.id\}`\)/u)
assert.match(startReplySource, /replyTargetScrollSequenceRef\.current \+= 1/u)
assert.doesNotMatch(startReplySource, /loadThread|updateThreads|getCommentThread/u)
assert.match(detailCommentsSource, /const COMPOSER_CLOSE_DURATION = 180/u)
assert.match(detailCommentsSource, /const COMMENT_FOCUS_DURATION = 2200/u)
assert.match(detailCommentsSource, /const focusCommentTemporarily = useCallback/u)
assert.match(detailCommentsSource, /focusedCommentClearRef\.current\?\.\(\)/u)
assert.match(detailCommentsSource, /focusCommentTemporarily\(focusId\)/u)
assert.match(detailCommentsSource, /focusCommentTemporarily\(created\.id\)/u)
assert.match(detailCommentsSource, /current === commentId \? 0 : current/u)
assert.match(detailCommentsSource, /const \[composerClosing, setComposerClosing\] = useState\(false\)/u)
assert.match(detailCommentsSource, /initialComposerOpen\?: boolean/u)
assert.match(detailCommentsSource, /initialComposerOpenedRef/u)
assert.match(detailCommentsSource, /if \(!initialComposerOpen \|\| !enabled \|\| initialComposerOpenedRef\.current\) return/u)
assert.match(detailCommentsSource, /closeComposerSignal\?: number/u)
assert.match(detailCommentsSource, /lastCloseComposerSignalRef/u)
assert.match(detailCommentsSource, /composerOnly\?: boolean/u)
assert.match(detailCommentsSource, /if \(composerOnly\)/u)
assert.match(detailCommentsSource, /\{!composerOnly && \(/u)
assert.match(communityCommentSheetSource, /initialComposerOpen/u)
assert.match(communityCommentSheetSource, /composerOnly/u)
assert.match(communityCommentSheetSource, /closeComposerSignal/u)
assert.match(communityCommentSheetSource, /onCommentCreated\?: \(comment: CommentView\) => void/u)
assert.match(communityCommentSheetSource, /mutation\.type === 'create'/u)
assert.match(communityCommentSheetSource, /onCommentCreated\?\.\(mutation\.comment\)/u)
assert.match(communityCommentSheetSource, /type CommentSheetTarget/u)
assert.match(communityCommentSheetSource, /targetType=\{targetType\}/u)
assert.match(communityCommentSheetSource, /markLifeHubSectionDirty\(dirtySection\)/u)
assert.match(communityCommentSheetSource, /dismissSignal\?: number/u)
assert.match(communityCommentSheetSource, /lastDismissSignalRef/u)
assert.match(communityCommentSheetSource, /requestClose\(\)/u)
assert.match(communityCommentSheetSource, /if \(closingRef\.current \|\| submittingRef\.current\) return/u)
assert.match(communityCommentSheetSource, /onSubmittingChange=\{\(submitting\) => \{/u)
assert.match(communityCommentSheetSource, /onSubmittingChange\?\.\(submitting\)/u)
assert.match(detailCommentsSource, /onSubmittingChange\?\.\(true\)/u)
assert.match(detailCommentsSource, /onSubmittingChange\?\.\(false\)/u)
assert.match(
  communityCommentSheetSource,
  /setCustomTabBarHidden\(true\)[\s\S]*return \(\) => setCustomTabBarHidden\(false\)/u,
  '列表评论框打开时必须隐藏自定义 TabBar，并在关闭后恢复',
)
assert.doesNotMatch(communityCommentSheetSource, /listComments|business-detail-comments/u)
assert.match(
  detailCommentsSource,
  /business-detail-comment__reply-to[\s\S]*?src=\{icons\.reply\}[\s\S]*?business-detail-comment__reply-target/u,
  '二级评论必须用统一 SVG 图标表达回复关系',
)
assert.match(
  detailCommentsStyle,
  /\.business-detail-comment__reply-identity \{[^}]*gap: 0;[^}]*white-space: nowrap;[\s\S]*?\.business-detail-comment__reply-relation,[\s\S]*?\.business-detail-comment__reply-target \{[^}]*flex: 0 1 auto;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/u,
  '二级回复关系必须按内容紧贴排列，空间不足时两个昵称再收缩省略',
)
assert.doesNotMatch(detailCommentsSource, />\s*@\{replyTargetName\}\s*</u, '回复关系中的两个昵称之间不应插入 @')
assert.match(
  detailCommentsSource,
  /business-detail-comment__reply-relation'>[\s\S]*?commentAuthorName\(comment\)[\s\S]*?comment\.author_id === targetAuthorId[\s\S]*?business-detail-comment__author-badge'>作者[\s\S]*?business-detail-comment__reply-to'[\s\S]*?src=\{icons\.reply\}[\s\S]*?business-detail-comment__reply-target/u,
  '二级评论的作者标签必须紧跟评论者昵称，不能放在被回复者之后',
)
assert.match(
  detailCommentsSource,
  /const isOwnComment = comment\.author_id === currentUserId[\s\S]*?const likeLabel = isOwnComment\s*\? `\$\{comment\.like_count\}赞`\s*:\s*String\(comment\.like_count\)/u,
  '自己的评论应显示“x赞”，其他评论只显示爱心数量',
)
assert.match(
  detailCommentsStyle,
  /\.business-detail-comment__like--own image \{ display: none; \}/u,
  '自己的评论不得展示爱心',
)
assert.match(
  detailCommentsSource,
  /business-detail-comment__author'>\{commentAuthorName\(comment\)\}<\/Text>\s*\{comment\.author_id === targetAuthorId && <Text className='business-detail-comment__author-badge'>作者<\/Text>\}/u,
  '作者徽章必须紧随昵称展示',
)
assert.match(
  detailCommentsSource,
  /business-detail-comment__reply-content[\s\S]*?business-detail-comment__footer[\s\S]*?business-detail-comment__time/u,
  '二级评论时间必须移到正文下方',
)
assert.match(detailCommentsSource, /const shouldFollowKeyboard = inputFocused \|\| keyboardHeight > 0/u)
assert.match(detailCommentsSource, /setComposerClosing\(true\)[\s\S]*setInputFocused\(false\)[\s\S]*Taro\.hideKeyboard/u)
assert.match(detailCommentsSource, /composerCloseSequenceRef\.current === closeSequence/u)
assert.match(detailCommentsSource, /scheduleTimeout\(\(\) => \{[\s\S]*finishComposerClose\(\)[\s\S]*keyboardTransitionDuration \+ 120/u)
assert.match(detailCommentsSource, /const handleKeyboardHeightChange = useCallback/u)
assert.match(detailCommentsSource, /const handleComposerBlur = useCallback/u)
assert.match(
  detailCommentsSource,
  /const handleComposerBlur = useCallback\(\(\) => \{[\s\S]*?setInputFocused\(false\)[\s\S]*?if \(composerOnly\) return[\s\S]*?closeComposer\(\)/u,
  '列表评论框不得因真机 Textarea blur 提前卸载并丢失本地回填',
)
assert.match(
  detailCommentsSource,
  /if \([\s\S]*?composerClosingRef\.current[\s\S]*?stickerPickerOpenRef\.current[\s\S]*?composerActionPendingRef\.current[\s\S]*?closeComposer\(\)/u,
)
assert.match(detailCommentsSource, /onBlur=\{handleComposerBlur\}/u)
assert.match(detailCommentsSource, /event\.detail\.duration/u)
assert.match(detailCommentsSource, /transitionDuration: `\$\{keyboardTransitionDuration\}ms`/u)
assert.match(detailCommentsSource, /onKeyboardHeightChange=\{handleKeyboardHeightChange\}/u)
assert.match(detailCommentsSource, /purpose: 'comment'/u)
assert.match(detailCommentsSource, /media_id: commentImage\.mediaId/u)
assert.match(detailCommentsSource, /MAX_COMMENT_IMAGES/u)
assert.match(detailCommentsSource, /const restoreComposerFocus = useCallback/u)
assert.match(
  detailCommentsSource,
  /const actionCloseSequence = composerCloseSequenceRef\.current[\s\S]*?chooseMediaImages[\s\S]*?restoreComposerFocus\(\)/u,
  '选图结束后必须恢复评论输入焦点',
)
assert.match(
  detailCommentsSource,
  /onClick=\{\(\) => \{\s*void chooseCommentImage\(\)/u,
  '图片按钮点击后必须保持选图动作标记',
)
assert.match(detailCommentsSource, /上传失败 · 重试/u)
assert.match(detailCommentsSource, /setCommentImage\(null\)/u)
assert.match(commentImageSource, /previewContentImages\(url, \[url\]\)/u)
assert.match(commentImageSource, /ariaLabel=\{`预览\$\{label\}`\}/u)
assert.match(commentImageStyle, /community-comment-image--compact/u)
assert.match(detailCommentsSource, /`#community-comment-preview-\$\{initialReplyTarget\.id\}`/u)
assert.match(detailCommentsSource, /query\.select\(targetSelector\)\.boundingClientRect\(\)/u)
assert.match(detailCommentsSource, /query\.select\('\.business-detail-composer'\)\.boundingClientRect\(\)/u)
assert.match(detailCommentsSource, /suppressCommunityOverlayDismiss\(REPLY_TARGET_DISMISS_SUPPRESSION\)/u)
assert.match(detailCommentsSource, /suppressCommunityOverlayDismiss\(REPLY_OPEN_DISMISS_SUPPRESSION\)/u)
assert.match(detailCommentsSource, /Taro\.pageScrollTo\(\{[\s\S]*?scrollTop:[\s\S]*?duration: REPLY_TARGET_SCROLL_DURATION/u)
assert.match(detailCommentsSource, /business-detail-comments__reply-viewport-reserve/u)
assert.match(detailCommentsSource, /onReplyKeyboardHeightChange\?\.\(replyKeyboardHeight\)/u)
assert.match(communityCommentSheetSource, /community-comment-sheet__reply-viewport-reserve/u)
assert.match(communityCommentSheetSource, /onReplyKeyboardHeightChange=\{setReplyKeyboardHeight\}/u)
assert.match(
  detailCommentsSource,
  /const closeComposer = useCallback\(\(\) => \{\s*replyTargetScrollSequenceRef\.current \+= 1/u,
)
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
assert.match(detailCommentsSource, /catchMove\s+ariaRole=/u)
assert.match(detailCommentsSource, /const handleComposerBackdropTouchStart = useCallback/u)
assert.match(detailCommentsSource, /onTouchStart=\{handleComposerBackdropTouchStart\}/u)
assert.doesNotMatch(detailCommentsSource, /\{composerOpen && \([\s\S]*business-detail-composer__backdrop/u)
assert.match(
  detailCommentsSource,
  /id=\{`business-comment-cancel-reply-\$\{replyTarget\.id\}`\}[\s\S]*?onTouchStart=\{\(\) => \{[\s\S]*?if \(!submitting\) closeComposer\(\)/u,
)
assert.match(
  detailCommentsSource,
  /business-detail-composer__publish--disabled[\s\S]*?onClick=\{\(\) => \{[\s\S]*?if \(hasComposerContent && !submitting\) void submit\(\)/u,
)
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
assert.match(detailCommentsStyle, /\.business-detail-comment__author \{[^}]*--campus-text-body/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__reply-identity \{[^}]*white-space: nowrap;/u)
assert.match(detailCommentsStyle, /\.business-detail-comment__reply-content \{[^}]*overflow-wrap: anywhere;[^}]*white-space: pre-wrap;/u)
assert.match(detailCommentsStyle, /business-detail-comment__reply--focused[^}]*box-shadow:/u)
assert.match(detailCommentsStyle, /\.business-detail-comments__skeleton \{[^}]*min-height: 420rpx;/u)
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
assert.match(
  detailCommentsStyle,
  /\.business-detail-comment__replies \{[^}]*margin: 0 0 12rpx 80rpx;[^}]*background: var\(--campus-surface-subtle, #f5f8fc\);/u,
  '回复面板应固定缩进到一级评论正文列，面板内回复不得递归缩进',
)
assert.doesNotMatch(detailCommentsStyle, /\.business-detail-comment-thread\s*\{[^}]*border/u, '一级评论之间不得显示横线')
assert.doesNotMatch(detailCommentsStyle, /\.business-detail-comment__reply-node \+[^}]*border-top/u, '回复之间不得显示横线')

console.log('comment reply smoke: ok')
