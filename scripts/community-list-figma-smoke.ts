import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const cardSource = readSource('../src/features/community/post-card.tsx')
const feedSource = readSource('../src/features/community/feed-panel.tsx')
const topicSource = readSource('../src/packages/social/community/topic/index.tsx')
const profileSource = readSource('../src/pages/public-profile/index.tsx')
const feedStyles = readSource('../src/features/community/feed-panel.scss')
const profileStyles = readSource('../src/pages/public-profile/index.scss')
const darkStyles = readSource('../src/styles/_dark-mode.scss')
const heartAsset = readSource('../src/assets/community/feed-heart.svg')

assert.match(cardSource, /id=\{`community-post-\$\{post\.id\}`\}/u)
assert.match(cardSource, /'community-post',\s*'api-post'/u)
assert.match(cardSource, /className='community-post__body api-post__body'/u)
assert.match(cardSource, /const MAX_FEED_IMAGES = 9/u)
assert.match(cardSource, /post\.images\.slice\(0, MAX_FEED_IMAGES\)/u)
assert.match(cardSource, /community-post__avatar-button/u)
assert.match(cardSource, /<UserAvatar[\s\S]*?className='community-post__avatar'[\s\S]*?userId=\{post\.author_deleted \? 0 : post\.author_id\}/u)
assert.doesNotMatch(cardSource, /community-post__avatar--tone/u)
assert.match(cardSource, /community-post__main/u)
assert.match(cardSource, /community-post__content-wrap--clamped/u)
assert.match(cardSource, /community-post__social-like/u)
assert.match(cardSource, /community-post__comments-summary/u)
assert.match(cardSource, /查看全部 \$\{post\.comment_count\} 条评论/u)
assert.match(cardSource, /openType='share'/u)
assert.match(cardSource, /data-share-title=\{shareTitle\}/u)
assert.match(cardSource, /require\('\.\.\/\.\.\/assets\/community\/feed-heart\.svg'\)/u)
assert.match(cardSource, /onSelectSection\(post\.section_id\)/u)
assert.match(cardSource, /event\.stopPropagation\(\)/u)
assert.match(cardSource, /图片审核中/u)
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
}

assert.match(feedStyles, /grid-template-columns:\s*80rpx minmax\(0, 1fr\)/u)
assert.match(feedStyles, /\.community-post__avatar \{[\s\S]*?width:\s*80rpx;[\s\S]*?height:\s*80rpx;[\s\S]*?border-radius:\s*50%;/u)
assert.match(feedStyles, /\.community-post__author-line > text:first-child \{[\s\S]*?font-weight:\s*400;/u)
assert.match(feedStyles, /\.community-post__content-wrap--clamped \.community-post__content \{[\s\S]*?-webkit-line-clamp:\s*6;/u)
assert.match(feedStyles, /\.community-post__images \{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?gap:\s*12rpx;/u)
assert.match(feedStyles, /\.community-post__images--1 \{[\s\S]*?width:\s*414rpx;[\s\S]*?height:\s*258rpx;/u)
assert.match(feedStyles, /\.community-post__images--9/u)
assert.match(feedStyles, /\.community-post__more \{[\s\S]*?width:\s*56rpx;[\s\S]*?height:\s*32rpx;/u)
assert.match(feedStyles, /\.community-post__social \{[\s\S]*?background:\s*#f7f7f7;/u)
assert.match(feedStyles, /\.community-post__social-like \{[\s\S]*?font-weight:\s*420;/u)
assert.doesNotMatch(feedStyles, /\.community-post__social-like--liked text \{[\s\S]*?font-weight:/u)
assert.match(feedStyles, /\.community-post-list \{[\s\S]*?gap:\s*0;/u)
assert.match(feedStyles, /border-bottom:\s*2rpx solid #f3f4f6;/u)
assert.match(feedStyles, /calc\(152rpx \+ env\(safe-area-inset-bottom\)\)/u)
assert.match(profileStyles, /\.public-profile-feed \{\s*gap:\s*0;/u)
assert.match(darkStyles, /page \.community-post__social \{/u)
assert.match(darkStyles, /page \.community-post__expand \{/u)

assert.match(heartAsset, /viewBox="0 0 13\.9968 13\.9968"/u)
assert.match(heartAsset, /stroke="#576B95"/u)

for (const forbiddenSample of ['蘑儿轻俏', '海风轻轻吹', '橘子汽水', '摄影日记']) {
  assert.equal(cardSource.includes(forbiddenSample), false, `帖子卡片写死了 Figma 样例：${forbiddenSample}`)
}

process.stdout.write('community list figma smoke: ok\n')
