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

const detailSource = readFileSync(resolve(__dirname, '../src/packages/social/community/detail.tsx'), 'utf8')
const detailStyle = readFileSync(resolve(__dirname, '../src/packages/social/community/detail.scss'), 'utf8')
assert.match(detailSource, /options\.snapshot === '1'\s*\? consumeCommunityDetailSnapshot\(id\)/u)
assert.match(detailSource, /if \(snapshot\) \{[\s\S]*?setPost\(snapshot\)[\s\S]*?setLoading\(false\)[\s\S]*?return/u)
assert.match(detailSource, /if \(snapshot\)[\s\S]*?return\s*\}\s*void load\(id, normalizedCommentId\)/u)
assert.match(detailSource, /usePullDownRefresh\(\(\) => \{[\s\S]*?void load\(postId, focusedCommentId\)/u)
assert.match(detailSource, /!loading && !error && post && \([\s\S]*?<DetailComments/u)
assert.match(detailSource, /const load = async[\s\S]*?getCampusCirclePost\(id\)/u)
assert.match(detailSource, /CommunityLevelBadge/u)
assert.match(detailSource, /id='community-detail-comment'/u)
assert.match(detailSource, /post\.liked \? communityDetailIcons\.heartActive : communityDetailIcons\.heart/u)
assert.match(detailSource, /headingLabel='全部评论'/u)
assert.match(detailSource, /headingCountBadge/u)
assert.match(detailStyle, /Figma 2:3879/u)
assert.match(detailStyle, /\.community-detail__main \{[\s\S]*?padding: 36rpx 36rpx 0;/u)
assert.doesNotMatch(detailStyle, /backdrop-filter:/u)
assert.match(
  detailStyle,
  /\.community-detail__actions \{[\s\S]*?border-top: 1rpx solid var\(--campus-border, #e8edf4\);/u,
)
assert.match(detailStyle, /community-detail-heart-pop/u)
assert.match(
  detailStyle,
  /\.community-detail \.business-detail-comments__heading > view:first-child \{[\s\S]*?background: linear-gradient\(180deg, var\(--campus-primary, #2b7fff\), var\(--campus-primary-cyan, #00d3f3\)\);/u,
)
assert.match(
  detailStyle,
  /\.community-detail \.business-detail-comment__replies \{[\s\S]*?background: var\(--campus-surface-subtle, #f2f7fe\);/u,
)

for (const sourcePath of [
  '../src/features/community/feed-panel.tsx',
  '../src/packages/social/community/topic/index.tsx',
  '../src/pages/public-profile/index.tsx',
  '../src/packages/social/my-services/index.tsx',
]) {
  const source = readFileSync(resolve(__dirname, sourcePath), 'utf8')
  assert.match(source, /saveCommunityDetailSnapshot\(/u, sourcePath)
  assert.match(source, /snapshot=1/u, sourcePath)
}

process.stdout.write('community detail navigation smoke: ok\n')
