import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as ts from 'typescript'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const detailSource = readSource('../src/pages/community/detail.tsx')
const detailStyle = readSource('../src/pages/community/detail.scss')
const imageGridSource = readSource('../src/features/community/components/content-image-grid.tsx')
const imageGridStyle = readSource('../src/features/community/components/content-image-grid.scss')
const commentsSource = readSource('../src/features/life-services/components/detail-comments.tsx')
const commentsStyle = readSource('../src/features/life-services/components/detail-comments.scss')
const lifeDetailStyle = readSource('../src/features/life-services/detail.scss')
const avatarSource = readSource('../src/components/user-avatar/index.tsx')
const avatarStyle = readSource('../src/components/user-avatar/index.scss')

// 社区详情只组装通用详情能力；评论的加载、回复、审核与键盘逻辑统一由共享组件承载。
assert.match(detailSource, /import DetailComments from '\.\.\/\.\.\/features\/life-services\/components\/detail-comments'/u)
assert.ok(
  detailSource.indexOf("import DetailComments from '../../features/life-services/components/detail-comments'")
    < detailSource.indexOf("import ContentImageGrid from '../../features/community/components/content-image-grid'"),
  '共享评论样式必须先于图片网格进入帖子详情，避免 common chunk 的 CSS 顺序冲突',
)
assert.match(detailSource, /<DetailComments[\s\S]*?targetType='campus_circle_post'[\s\S]*?targetId=\{post\.id\}[\s\S]*?initialCommentId=\{focusedCommentId\}[\s\S]*?showHeading=\{false\}/u)
// 执行真实 JSX 回调，检查用户可见计数和精选页返回状态，不约束箭头函数写法。
const ast = ts.createSourceFile('detail.tsx', detailSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const callbacks = new Map<string, string>()
const visit = (node: ts.Node) => {
  if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
    callbacks.set(node.name.getText(ast), node.initializer.expression.getText(ast))
  }
  ts.forEachChild(node, visit)
}
visit(ast)
let currentPost = { id: 7, comment_count: 2 }
const returned: unknown[] = []
const dirty: string[] = []
const returnRef = { current: true }
const callback = (name: string) => {
  assert.ok(callbacks.has(name), `缺少 ${name} 回调`)
  const code = ts.transpile(`const handler = ${callbacks.get(name)}`, { target: ts.ScriptTarget.ES2020 })
  return new Function('setPost', 'todayHotReturnRef', 'post', 'saveTodayHotDetailReturn', 'markLifeHubSectionDirty', `${code}; return handler`)(
    (update: (post: typeof currentPost) => typeof currentPost) => { currentPost = update(currentPost) },
    returnRef, currentPost,
    (id: number, value: unknown) => returned.push({ id, value }),
    (section: string) => dirty.push(section),
  )
}
callback('onApprovedDelta')(1)
assert.equal(currentPost.comment_count, 3)
assert.deepEqual(returned.pop(), { id: 7, value: { approvedCommentDelta: 1 } })
callback('onApprovedDelta')(-10)
assert.equal(currentPost.comment_count, 0, '删除评论后计数不能为负')
returned.length = 0
returnRef.current = false
callback('onApprovedDelta')(1)
assert.equal(currentPost.comment_count, 1)
assert.equal(returned.length, 0, '普通详情不能写入精选页返回状态')
returnRef.current = true
const comment = { id: 123 }
callback('onMutation')({ type: 'create', comment })
assert.deepEqual(dirty, ['community'])
assert.deepEqual(returned.pop(), { id: 7, value: { comment } })
assert.doesNotMatch(detailSource, /(?:CommunityDetailComments|CommunityComments|CommunityCommentComposer)/u)

// Figma 详情主体只能展示真实帖子字段和真实操作，不能把示例社交数据写进页面。
for (const fragment of [
  'community-detail__main',
  'community-detail__body',
  'community-detail__topic',
  'community-detail__actions',
  'community-detail__more',
  'community-detail__review',
]) {
  assert.ok(detailSource.includes(fragment), `社区详情缺少 Figma 主体元素：${fragment}`)
}
assert.match(detailSource, /<ContentImageGrid[\s\S]*?images=\{post\.images\}[\s\S]*?preview/u)
assert.match(imageGridSource, /mode=\{layoutCount === 1 \? 'widthFix' : 'aspectFill'\}/u)
assert.match(detailSource, /<DetailAuthorHeader/u, '帖子详情必须复用正文级作者头部')
assert.match(detailSource, /communityPostTopics\(post\)/u, '校园标签必须由真实话题数据驱动')
assert.match(detailSource, /<MentionContent[\s\S]*?trailing=\{topicLinks\.map/u, '话题标签应尾随正文展示')
assert.doesNotMatch(detailSource, /community-detail__topics/u, '话题标签不得单独占用一行')
assert.match(detailSource, /post\.liked/u)
assert.match(detailSource, /likeCampusCirclePost/u)
assert.match(detailSource, /unlikeCampusCirclePost/u)
assert.match(detailSource, /openType='share'/u)
assert.match(detailSource, /openContentReport\([\s\S]*?resourceType:\s*'campus_circle_post'/u)
assert.match(detailSource, /showActionSheetSelection/u, '“更多”必须进入真实操作菜单')
assert.match(detailSource, /post\.review_reason/u)
assert.doesNotMatch(detailSource, /community-detail__view-count/u, '详情页暂不展示浏览量')
assert.doesNotMatch(detailSource, /(?:关注(?:作者|用户)?|地区|所在地区|定位)/u, '详情页不得渲染 Figma 示例关注或地区数据')

// 共享评论区必须支持场景化标题，并完整包含三类头像、真实点赞和统一输入栏。
assert.match(
  commentsSource,
  /showHeading = true[\s\S]*?\{showHeading && \([\s\S]*?business-detail-comments__heading[\s\S]*?\{headingLabel \|\| `评论 \$\{displayTotal \?\? total\}`\}/u,
  '共享评论标题必须支持场景文案，并让无互动栏场景继续展示普通文本评论数',
)
assert.doesNotMatch(commentsSource, /headingCountBadge|business-detail-comments__heading-count/u, '评论标题不得重新引入数量胶囊')
assert.doesNotMatch(commentsStyle, /\.business-detail-comments__heading-count/u, '评论数量不得使用胶囊底板')
assert.match(detailSource, /showHeading=\{false\}/u, '帖子详情已有互动栏，不得重复渲染评论章节标题')
assert.doesNotMatch(detailSource, /headingLabel=/u)
assert.doesNotMatch(detailSource, /headingCountBadge/u)
assert.match(commentsSource, /business-detail-comment__avatar/u)
assert.match(commentsSource, /business-detail-comment__reply-avatar/u)
assert.match(commentsSource, /business-detail-composer__avatar/u)
assert.ok((commentsSource.match(/<UserAvatar/g) || []).length >= 3, '根评论、回复和当前用户都必须使用统一头像组件')
assert.ok((commentsSource.match(/userId=\{/g) || []).length >= 3, '根评论、回复和当前用户头像都必须按用户稳定配色')
assert.doesNotMatch(commentsSource, /UserAvatarImage/u)
assert.match(avatarSource, /shape = 'circle'/u)
assert.match(avatarSource, /`campus-user-avatar--\$\{shape\}`/u)
assert.match(avatarSource, /campus-user-avatar--tone-/u)
assert.match(avatarStyle, /border-radius:\s*50%;/u)
assert.match(commentsSource, /const toggleCommentLike = useCallback/u)
assert.match(commentsSource, /likeResource/u)
assert.match(commentsSource, /unlikeResource/u)
assert.match(commentsSource, /<KeyboardSafeTextarea/u)
assert.match(commentsSource, /business-detail-composer__publish/u)

// 详情与共享评论区采用白底实体面，且页面内容、评论输入栏都必须让出安全区。
assert.match(detailStyle, /\.community-detail\s*\{[^}]*background:\s*var\(--campus-surface, #fff\);/u)
assert.match(detailStyle, /\.community-detail__content\s*\{[^}]*padding:[^;]*env\(safe-area-inset-bottom\)/u)
assert.match(detailStyle, /\.community-detail__main\s*\{[^}]*background:\s*var\(--campus-surface, #fff\);/u)
assert.match(
  detailStyle,
  /\.community-detail__body\s*\{[^}]*color:\s*var\(--campus-text-heading, #1a2333\);[^}]*font-size:\s*var\(--ousea-font-size-body, 32rpx\);[^}]*font-weight:\s*var\(--ousea-font-weight-regular, 400\);[^}]*line-height:\s*var\(--ousea-line-height-post, 1.85\);/u,
  '详情正文必须与列表共用 Ousea 正文排版 Token',
)
assert.match(
  commentsStyle,
  /\.business-detail-comment__bubble \{[^}]*font-size:\s*var\(--ousea-font-size-body, 32rpx\);[^}]*line-height:\s*var\(--ousea-line-height-comment, 1.65\);/u,
  '评论正文必须使用可读性更高的 Ousea 字号与行高 Token',
)
assert.match(
  commentsStyle,
  /\.business-detail-comment__reply-relation,[\s\S]*?\.business-detail-comment__reply-target \{[^}]*color:\s*var\(--campus-text-body, #3a4759\);/u,
  '评论昵称必须使用统一的高对比语义灰色',
)
assert.doesNotMatch(detailStyle, /\.community-detail \.business-detail-comment/u, '社区详情不得覆盖公共评论列表样式')
assert.equal((detailSource.match(/className='community-detail__action-slot'/gu) || []).length, 3, '互动项必须使用三个非交互等分槽位定位')
assert.match(detailStyle, /\.community-detail__actions \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u)
assert.match(detailStyle, /\.community-detail__action \{[\s\S]*?width: auto;[\s\S]*?min-width: 88rpx;[\s\S]*?min-height: 88rpx;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/u, '操作按钮必须自适应内容且保持安全热区，不得恢复胶囊底板')
assert.doesNotMatch(detailStyle, /\.community-detail__action--liked \{[^}]*background:/u, '点赞激活态只改变前景，不得恢复胶囊底板')
assert.match(detailSource, /className='community-detail__action community-detail__action--share'[\s\S]*?ariaLabel='分享这条动态'[\s\S]*?<Image[^>]*communityDetailIcons\.share/u, '纯图标分享必须保留安全热区和无障碍名称')
assert.doesNotMatch(detailSource, /<Text>分享<\/Text>/u)
assert.match(imageGridStyle, /\.content-image-grid__frame \{[\s\S]*?border-radius:\s*10rpx;/u)
assert.match(detailStyle, /\.detail-author-header__meta > \.community-detail__review-status/u)
assert.match(commentsStyle, /\.business-detail-comments\s*\{[^}]*background:\s*var\(--campus-surface, #fff\);/u)
assert.match(
  lifeDetailStyle,
  /\.life-detail__content > \.business-detail-comments\s*\{[^}]*margin-right:\s*-32rpx;[^}]*margin-left:\s*-32rpx;/u,
  '生活服务详情必须抵消页面 gutter，确保共享评论内容与社区详情同为 32rpx 起始线',
)
assert.match(commentsStyle, /\.business-detail-comment__bubble\s*\{[^}]*font-size:\s*var\(--ousea-font-size-body, 32rpx\);[^}]*line-height:/u)
assert.match(commentsStyle, /\.business-detail-composer\s*\{[\s\S]*?padding:[^;]*env\(safe-area-inset-bottom\)/u)
assert.match(commentsStyle, /\.business-detail-composer__avatar\s*\{[^}]*width:\s*64rpx;[^}]*height:\s*64rpx;/u)
assert.match(commentsStyle, /\.business-detail-composer textarea,[\s\S]*?min-height:\s*80rpx;/u)

// 共享组件仍保留各业务场景的默认 tone；社区详情不得通过复制组件取得视觉差异。
assert.match(commentsSource, /tone\?: Exclude<DetailCommentTarget, 'campus_circle_post'> \| 'community'/u)
assert.match(commentsStyle, /business-detail-composer__publish--marketplace/u)
assert.match(commentsStyle, /business-detail-composer__publish--errand/u)
assert.match(commentsStyle, /business-detail-composer__publish--carpool/u)

process.stdout.write('community detail figma smoke: ok\n')
