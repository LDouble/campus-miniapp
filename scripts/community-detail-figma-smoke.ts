import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const detailSource = readSource('../src/packages/social/community/detail.tsx')
const detailStyle = readSource('../src/packages/social/community/detail.scss')
const commentsSource = readSource('../src/features/life-services/components/detail-comments.tsx')
const commentsStyle = readSource('../src/features/life-services/components/detail-comments.scss')
const avatarSource = readSource('../src/components/user-avatar/index.tsx')
const avatarStyle = readSource('../src/components/user-avatar/index.scss')

// 社区详情只组装通用详情能力；评论的加载、回复、审核与键盘逻辑统一由共享组件承载。
assert.match(detailSource, /import DetailComments from '\.\.\/\.\.\/\.\.\/features\/life-services\/components\/detail-comments'/u)
assert.match(detailSource, /<DetailComments[\s\S]*?targetType='campus_circle_post'[\s\S]*?targetId=\{post\.id\}[\s\S]*?initialCommentId=\{focusedCommentId\}[\s\S]*?displayTotal=\{post\.comment_count\}/u)
assert.match(detailSource, /onApprovedDelta=\{\(delta\) => setPost/u)
assert.match(detailSource, /onMutation=\{\(\) => \{[\s\S]*?markLifeHubSectionDirty\('community'\)/u)
assert.doesNotMatch(detailSource, /(?:CommunityDetailComments|CommunityComments|CommunityCommentComposer)/u)

// Figma 详情主体只能展示真实帖子字段和真实操作，不能把示例社交数据写进页面。
for (const fragment of [
  'community-detail__main',
  'community-detail__author',
  'community-detail__body',
  'community-detail__images',
  'community-detail__campus-label',
  'community-detail__toolbar',
  'community-detail__more',
  'community-detail__review',
]) {
  assert.ok(detailSource.includes(fragment), `社区详情缺少 Figma 主体元素：${fragment}`)
}
assert.match(detailSource, /post\.topic\?\.name/u, '校园标签必须由真实话题数据驱动')
assert.match(detailSource, /post\.liked/u)
assert.match(detailSource, /likeCampusCirclePost/u)
assert.match(detailSource, /unlikeCampusCirclePost/u)
assert.match(detailSource, /openType='share'/u)
assert.match(detailSource, /openContentReport\([\s\S]*?resourceType:\s*'campus_circle_post'/u)
assert.match(detailSource, /showActionSheetSelection/u, '“更多”必须进入真实操作菜单')
assert.match(detailSource, /post\.review_reason/u)
assert.doesNotMatch(detailSource, /(?:关注(?:作者|用户)?|浏览量|地区|所在地区|定位)/u, '详情页不得渲染 Figma 示例关注、浏览量或地区数据')

// 共享评论区必须完整包含标题、三类头像、真实点赞和统一输入栏。
assert.match(commentsSource, /business-detail-comments__heading[\s\S]*?评论 \{displayTotal \?\? total\}/u)
assert.match(commentsSource, /business-detail-comment__avatar/u)
assert.match(commentsSource, /business-detail-comment__reply-avatar/u)
assert.match(commentsSource, /business-detail-composer__avatar/u)
assert.ok((commentsSource.match(/<UserAvatar/g) || []).length >= 3, '根评论、回复和当前用户都必须使用统一头像组件')
assert.ok((commentsSource.match(/userId=\{/g) || []).length >= 3, '根评论、回复和当前用户头像都必须按用户稳定配色')
assert.doesNotMatch(commentsSource, /UserAvatarImage/u)
assert.match(avatarSource, /campus-user-avatar--circle/u)
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
assert.match(detailStyle, /\.community-detail__body\s*\{[^}]*font-size:\s*30rpx;[^}]*line-height:/u)
assert.match(detailStyle, /\.community-detail__images[\s\S]*?border-radius:/u)
assert.match(commentsStyle, /\.business-detail-comments\s*\{[^}]*background:\s*var\(--campus-surface, #fff\);/u)
assert.match(commentsStyle, /\.business-detail-comment__bubble\s*\{[^}]*font-size:\s*28rpx;[^}]*line-height:/u)
assert.match(commentsStyle, /\.business-detail-composer\s*\{[\s\S]*?padding:[^;]*env\(safe-area-inset-bottom\)/u)
assert.match(commentsStyle, /\.business-detail-composer__avatar\s*\{[^}]*width:\s*60rpx;[^}]*height:\s*60rpx;/u)
assert.match(commentsStyle, /\.business-detail-composer textarea\s*\{[^}]*min-height:\s*72rpx;/u)

// 共享组件仍保留各业务场景的默认 tone；社区详情不得通过复制组件取得视觉差异。
assert.match(commentsSource, /tone\?: Exclude<DetailCommentTarget, 'campus_circle_post'> \| 'community'/u)
assert.match(commentsStyle, /business-detail-composer__publish--marketplace/u)
assert.match(commentsStyle, /business-detail-composer__publish--errand/u)
assert.match(commentsStyle, /business-detail-composer__publish--carpool/u)

process.stdout.write('community detail figma smoke: ok\n')
