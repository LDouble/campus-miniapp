import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const cardSource = readSource('../src/features/community/post-card.tsx')
const feedSource = readSource('../src/features/community/feed-panel.tsx')
const communityPageSource = readSource('../src/pages/community/index.tsx')
const topicSource = readSource('../src/packages/social/community/topic/index.tsx')
const profileSource = readSource('../src/pages/public-profile/index.tsx')
const overlayDismissalSource = readSource('../src/features/community/use-overlay-dismissal.ts')
const feedStyles = readSource('../src/features/community/feed-panel.scss')
const profileStyles = readSource('../src/pages/public-profile/index.scss')
const darkStyles = readSource('../src/styles/_dark-mode.scss')
const heartAsset = readSource('../src/assets/community/feed-heart.svg')
const commentAsset = readSource('../src/assets/community/comment.svg')

assert.match(cardSource, /const cardId = instanceKey \|\| String\(post\.id\)/u)
assert.match(cardSource, /id=\{`community-post-\$\{cardId\}`\}/u)
assert.match(
  cardSource,
  /id=\{`community-post-\$\{cardId\}`\}[\s\S]*?ariaRole='button'[\s\S]*?onClick=\{\(\) => onOpen\(post\)\}/u,
)
assert.match(cardSource, /'community-post',\s*'api-post'/u)
assert.match(cardSource, /className='community-post__body api-post__body'/u)
assert.doesNotMatch(
  cardSource,
  /className='community-post__body api-post__body'[\s\S]{0,220}?onClick=/u,
)
assert.match(cardSource, /const MAX_POST_IMAGES = 3/u)
assert.match(cardSource, /post\.images\.slice\(0, MAX_POST_IMAGES\)/u)
assert.match(cardSource, /timeFormatter\?: \(value\?: string \| null\) => string/u)
assert.doesNotMatch(cardSource, /CommunityPostCardMode|isHomeMode|mode='home'/u)
assert.match(cardSource, /community-post__avatar-button/u)
assert.match(cardSource, /<UserAvatar[\s\S]*?className='community-post__avatar'[\s\S]*?userId=\{post\.author_deleted \? 0 : post\.author_id\}/u)
assert.doesNotMatch(cardSource, /community-post__avatar--tone/u)
assert.match(cardSource, /community-post__main/u)
assert.match(cardSource, /community-post__content-wrap--clamped/u)
assert.match(cardSource, /useState\(false\)/u)
assert.match(cardSource, /community-post__action-menu/u)
assert.match(cardSource, /actionsOpen:\s*boolean/u)
assert.match(cardSource, /onToggleActions\(post\.id\)/u)
assert.match(cardSource, /<Button[\s\S]*?id=\{`community-post-more-\$\{cardId\}`\}/u)
assert.match(cardSource, /hoverClass='none'/u)
assert.doesNotMatch(cardSource, /hoverClass=(?!'none')|hoverStartTime=|hoverStayTime=|hoverStopPropagation/u)
assert.match(cardSource, /onTouchStart=\{\(event\) => event\.stopPropagation\(\)\}/u)
assert.match(cardSource, /onCloseActions\(\)/u)
assert.match(cardSource, /community-post__social-like/u)
assert.match(cardSource, /community-post__comments-summary/u)
assert.match(cardSource, /<Text>评论<\/Text>/u)
assert.match(cardSource, /onOpenComments\(post\)/u)
assert.match(cardSource, /community-post__social-divider/u)
assert.doesNotMatch(cardSource, /community-post__action-share|openType='share'|data-share-/u)
assert.match(cardSource, /require\('\.\.\/\.\.\/assets\/community\/feed-heart\.svg'\)/u)
assert.match(cardSource, /require\('\.\.\/\.\.\/assets\/community\/comment\.svg'\)/u)
assert.match(cardSource, /onSelectSection\(post\.section_id\)/u)
assert.match(cardSource, /event\.stopPropagation\(\)/u)
assert.match(cardSource, /className='community-post__avatar-button'[\s\S]*?event\.stopPropagation\(\)[\s\S]*?openAuthorOrPost\(\)/u)
assert.match(cardSource, /className='community-post__author'[\s\S]*?event\.stopPropagation\(\)[\s\S]*?openAuthorOrPost\(\)/u)
assert.doesNotMatch(
  cardSource,
  /className='community-post__meta'\s+onClick=\{\(event\) => event\.stopPropagation\(\)\}/u,
)
assert.match(cardSource, /图片审核中/u)
assert.match(cardSource, /community-post__comment-preview/u)
assert.match(cardSource, /id=\{`community-comment-preview-\$\{comment\.id\}`\}/u)
assert.match(cardSource, /comment\.root_id/u)
assert.match(cardSource, /comment\.parent_id/u)
assert.match(cardSource, /comment\.reply_to_comment_id/u)
assert.match(cardSource, /comment\.reply_to_nickname/u)
assert.match(cardSource, /community-post__comment-preview--reply/u)
assert.match(cardSource, /community-post__comment-preview-relation/u)
assert.match(cardSource, /visibleRootIds\.has\(comment\.root_id\)/u)
assert.match(cardSource, /post\.comment_count > 3/u)
assert.match(cardSource, /查看全部 \{post\.comment_count\} 条评论/u)
assert.match(cardSource, /post\.liked_by_nicknames/u)
assert.match(cardSource, /post\.comment_previews/u)
assert.match(cardSource, /community-post__engagement/u)
assert.doesNotMatch(cardSource, /community-post__actions/u)
assert.doesNotMatch(cardSource, /CommunityLevelBadge/u)
assert.doesNotMatch(feedSource, /community-operations/u)
assert.doesNotMatch(feedSource, /api-community__heading/u)
assert.doesNotMatch(feedSource, /getCampusCircleHome/u)

for (const [name, source] of [
  ['社区首页', feedSource],
  ['话题页', topicSource],
  ['个人主页', profileSource],
] as const) {
  assert.match(source, /<CommunityPostCard/u, `${name}未复用公共帖子卡片`)
  assert.match(source, /onToggleLike=\{toggleLike\}/u, `${name}未保留真实点赞回调`)
  assert.match(source, /onOpenComments=/u, `${name}未接入评论输入框入口`)
  assert.match(source, /actionsOpen=\{/u, `${name}未接入单一展开状态`)
  assert.match(source, /onToggleActions=/u, `${name}未接入操作面板切换回调`)
  assert.match(source, /onCommentCreated=\{updateLatest/u, `${name}未接入最新评论回调`)
  assert.match(source, /onSubmittingChange=\{setCommentSubmitting\}/u, `${name}未同步评论提交状态`)
  assert.match(source, /commentPost !== null && !commentSubmitting/u, `${name}提交期间未暂停滚动收起`)
}

for (const [name, source] of [
  ['话题页', topicSource],
  ['个人主页', profileSource],
] as const) {
  assert.match(source, /useDismissCommunityOverlaysOnScroll/u, `${name}滚动时未收起社区操作层`)
  assert.match(source, /dismissSignal=\{commentDismissSignal\}/u, `${name}滚动时未安全关闭评论输入`)
}

assert.match(feedSource, /overlayDismissSignal\?: number/u)
assert.match(feedSource, /onOverlayVisibilityChange\?: \(visible: boolean\) => void/u)
assert.match(feedSource, /commentPost !== null && !commentSubmitting/u)
assert.match(feedSource, /setCommentDismissSignal\(\(current\) => current \+ 1\)/u)
assert.match(feedSource, /dismissSignal=\{commentDismissSignal\}/u)
assert.match(communityPageSource, /useDismissCommunityOverlaysOnScroll/u)
assert.match(communityPageSource, /overlayDismissSignal=\{communityOverlayDismissSignal\}/u)
assert.match(communityPageSource, /onOverlayVisibilityChange=\{setCommunityOverlayVisible\}/u)
assert.match(overlayDismissalSource, /usePageScroll\(\(\) =>/u)
assert.match(overlayDismissalSource, /activeRef\.current = false/u)
assert.match(overlayDismissalSource, /export const suppressCommunityOverlayDismiss/u)
assert.match(overlayDismissalSource, /Date\.now\(\) < dismissSuppressedUntil/u)

assert.match(feedStyles, /\.community-post\s*\{[\s\S]*?display:\s*flex;[\s\S]*?padding:\s*28rpx 32rpx;[\s\S]*?gap:\s*20rpx;/u)
assert.match(feedStyles, /\.community-post__avatar \{[\s\S]*?width:\s*80rpx;[\s\S]*?height:\s*80rpx;[\s\S]*?border-radius:\s*18rpx;/u)
assert.match(feedStyles, /\.community-post__author-line > text:first-child \{[\s\S]*?font-weight:\s*var\(--ousea-font-weight-regular,\s*400\);/u)
assert.match(feedStyles, /\.community-post__content-wrap--clamped \.community-post__content \{[\s\S]*?-webkit-line-clamp:\s*6;/u)
assert.match(feedStyles, /\.community-post__images \{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?gap:\s*8rpx;/u)
assert.match(feedStyles, /\.community-post__images--1 \{[\s\S]*?width:\s*424rpx;[\s\S]*?height:\s*212rpx;/u)
assert.match(feedStyles, /\.community-post__body \{[\s\S]*?z-index:\s*0;[\s\S]*?overflow:\s*hidden;/u)
assert.match(feedStyles, /\.community-post__meta \{[\s\S]*?z-index:\s*2;/u)
assert.match(feedStyles, /\.community-post__meta-actions \{[\s\S]*?z-index:\s*3;/u)
assert.match(feedStyles, /\.community-post__more \{[\s\S]*?z-index:\s*3;/u)
assert.match(feedStyles, /\.community-post__more \{[\s\S]*?width:\s*88rpx;[\s\S]*?height:\s*88rpx;/u)
assert.match(feedStyles, /\.community-post__more::before \{[\s\S]*?width:\s*72rpx;[\s\S]*?height:\s*56rpx;/u)
assert.match(feedStyles, /\.community-post__action-menu \{[\s\S]*?right:\s*96rpx;[\s\S]*?border-radius:\s*12rpx;[\s\S]*?background:\s*var\(--ousea-ink-700,/u)
assert.match(feedStyles, /\.community-post__social-like,\s*\.community-post__comments-summary\s*\{[\s\S]*?font-weight:\s*var\(--ousea-font-weight-medium,\s*500\);/u)
assert.doesNotMatch(feedStyles, /\.community-post__social-like--liked text \{[\s\S]*?font-weight:/u)
assert.match(feedStyles, /\.community-post__social-divider \{[\s\S]*?width:\s*1rpx;[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.24\);/u)
assert.match(feedStyles, /\.community-post__engagement \{[\s\S]*?background:\s*var\(--ousea-ocean-50,/u)
assert.match(feedStyles, /\.community-post__comment-preview \{[\s\S]*?display:\s*block;[\s\S]*?overflow-wrap:\s*anywhere;/u)
assert.doesNotMatch(
  feedStyles,
  /\.community-post__comment-preview--reply\s*\{[\s\S]*?(?:padding-left|margin-left):/u,
)
assert.match(feedStyles, /\.community-post__comment-preview-content\.sticker-content \{[\s\S]*?display:\s*inline;/u)
assert.doesNotMatch(feedStyles, /\.community-post__comment-preview-content(?:\.sticker-content)? \{[\s\S]*?-webkit-line-clamp:/u)
assert.match(feedStyles, /\.community-post-list \{[\s\S]*?gap:\s*0;/u)
assert.match(feedStyles, /\.community-post\s*\{[\s\S]*?border-bottom:\s*0;/u)
assert.match(feedStyles, /\.community-post \+ \.community-post\s*\{[\s\S]*?border-top:\s*1rpx solid var\(--ousea-bg-line, #e8edf4\);/u)
assert.match(feedStyles, /\.community-feed-skeleton__item \+ \.community-feed-skeleton__item\s*\{[\s\S]*?border-top:\s*1rpx solid var\(--ousea-bg-line, #e8edf4\);/u)
assert.doesNotMatch(feedStyles, /community-post--home|community-post__social-summary/u)
assert.match(feedStyles, /calc\(152rpx \+ env\(safe-area-inset-bottom\)\)/u)
assert.match(profileStyles, /\.public-profile-feed \{\s*gap:\s*0;/u)
assert.match(darkStyles, /page \.community-post__social \{/u)
assert.match(darkStyles, /page \.community-post__action-menu \{/u)
assert.match(darkStyles, /page \.community-post__expand \{/u)

assert.match(heartAsset, /viewBox="0 0 13\.9968 13\.9968"/u)
assert.match(heartAsset, /stroke="#576B95"/u)
assert.match(commentAsset, /stroke="#57525E"/u)

for (const forbiddenSample of ['蘑儿轻俏', '海风轻轻吹', '橘子汽水', '摄影日记']) {
  assert.equal(cardSource.includes(forbiddenSample), false, `帖子卡片写死了 Figma 样例：${forbiddenSample}`)
}

process.stdout.write('community list figma smoke: ok\n')
