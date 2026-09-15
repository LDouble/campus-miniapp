import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CampusCirclePostView } from '../src/api/types'
import {
  communityDetailSnapshotTtl,
  consumeCommunityDetailSnapshot,
  saveCommunityDetailSnapshot,
} from '../src/features/community/detail-snapshot'

const post = (id: number) => ({ id, section_id: 1 }) as CampusCirclePostView

saveCommunityDetailSnapshot(post(11), 1_000)
assert.equal(consumeCommunityDetailSnapshot(11, 1_001)?.id, 11)
assert.equal(consumeCommunityDetailSnapshot(11, 1_002), null)

saveCommunityDetailSnapshot(post(12), 2_000)
assert.equal(consumeCommunityDetailSnapshot(12, 2_000 + communityDetailSnapshotTtl), null)

const detailSource = readFileSync(resolve(__dirname, '../src/pages/community/detail.tsx'), 'utf8')
const detailStyle = readFileSync(resolve(__dirname, '../src/pages/community/detail.scss'), 'utf8')
const feedSource = readFileSync(resolve(__dirname, '../src/features/community/feed-panel.tsx'), 'utf8')
assert.match(detailSource, /options\.snapshot === '1'\s*\? consumeCommunityDetailSnapshot\(id\)/u)
assert.match(detailSource, /if \(snapshot\) \{[\s\S]*?setPost\(snapshot\)[\s\S]*?setLoading\(false\)[\s\S]*?return/u)
assert.match(detailSource, /if \(snapshot\)[\s\S]*?return\s*\}\s*void load\(id, normalizedCommentId\)/u)
assert.match(detailSource, /usePullDownRefresh\(\(\) => \{[\s\S]*?void load\(postId, focusedCommentId\)/u)
assert.match(detailSource, /!loading && !error && post && \([\s\S]*?<DetailComments/u)
assert.match(detailSource, /const load = async[\s\S]*?getCampusCirclePost\(id\)/u)
assert.match(detailSource, /CommunityLevelBadge/u)
assert.match(detailSource, /id='community-detail-comment'/u)
assert.match(detailSource, /post\.liked \? communityDetailIcons\.heartActive : communityDetailIcons\.heart/u)
assert.match(detailSource, /showHeading=\{false\}/u)
assert.doesNotMatch(detailSource, /headingLabel=/u)
assert.doesNotMatch(detailSource, /headingCountBadge/u)
assert.match(detailStyle, /Figma 2:3879/u)
assert.match(detailStyle, /\.community-detail__main \{[\s\S]*?padding: 32rpx 32rpx 0;/u)
assert.doesNotMatch(detailStyle, /backdrop-filter:/u)
assert.match(
  detailStyle,
  /\.community-detail__actions \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?border-top: 1rpx solid var\(--campus-border, #e8edf4\);/u,
)
assert.equal((detailSource.match(/className='community-detail__action-slot'/gu) || []).length, 3)
assert.match(detailStyle, /\.community-detail__action-slot \{[\s\S]*?justify-content: center;/u)
assert.match(detailStyle, /\.community-detail__action \{[\s\S]*?width: auto;[\s\S]*?min-width: 88rpx;[\s\S]*?min-height: 88rpx;/u)
assert.doesNotMatch(detailSource, /<Text>分享<\/Text>/u)
assert.match(detailStyle, /community-detail-heart-pop/u)
assert.doesNotMatch(detailStyle, /\.community-detail \.business-detail-comments/u)
assert.doesNotMatch(detailStyle, /\.community-detail \.business-detail-comment/u)

// 详情互动返回列表时，已有帖子必须保持可见，刷新请求不能重新切到首屏骨架。
assert.match(feedSource, /const loadedQueryKeyRef = useRef<string \| null>\(null\)/u)
assert.match(feedSource, /loadedQueryKeyRef\.current = queryKey/u)
assert.match(feedSource, /const isCurrentQueryLoaded = loadedQueryKeyRef\.current === queryKey/u)
assert.match(feedSource, /const hasCurrentPosts = isCurrentQueryLoaded && posts\.length > 0/u)
assert.match(feedSource, /loading && !hasCurrentPosts/u)
assert.match(feedSource, /const shouldRenderPostList = isCurrentQueryLoaded[\s\S]*?posts\.length > 0 \|\| \(!loading && !error\)/u)
assert.match(feedSource, /activeSection && shouldRenderPostList/u)

for (const sourcePath of [
  '../src/features/community/feed-panel.tsx',
  '../src/pages/community/topic/index.tsx',
  '../src/pages/public-profile/index.tsx',
  '../src/pages/my-services/index.tsx',
]) {
  const source = readFileSync(resolve(__dirname, sourcePath), 'utf8')
  assert.match(source, /saveCommunityDetailSnapshot\(/u, sourcePath)
  assert.match(source, /snapshot=1/u, sourcePath)
}

process.stdout.write('community detail navigation smoke: ok\n')
