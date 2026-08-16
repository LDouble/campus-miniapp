import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')

const cardSource = readSource('../src/features/community/post-card.tsx')
const feedSource = readSource('../src/features/community/feed-panel.tsx')
const topicSource = readSource('../src/pages/community/topic/index.tsx')
const profileSource = readSource('../src/pages/public-profile/index.tsx')
const commentsSource = readSource('../src/features/life-services/components/detail-comments.tsx')

assert.match(cardSource, /import \{ memo \} from 'react'/u)
assert.match(cardSource, /export default memo\(CommunityPostCard\)/u)
assert.match(cardSource, /motionDelay > 0 \? 'motion-enter' : ''/u)

assert.match(feedSource, /const toggleLike = useCallback/u)
assert.match(feedSource, /const openPost = useCallback/u)
assert.match(feedSource, /const openAuthor = useCallback/u)
assert.match(feedSource, /motionDelay=\{index < 4 \? index \+ 1 : undefined\}/u)
assert.match(feedSource, /onToggleLike=\{toggleLike\}/u)
assert.doesNotMatch(feedSource, /motionDelay=\{Math\.min\(index \+ 1, 4\)\}/u)

assert.match(profileSource, /const openCommunityPost = useCallback/u)
assert.match(profileSource, /const toggleLike = useCallback/u)
assert.match(profileSource, /onToggleLike=\{toggleLike\}/u)

assert.match(topicSource, /const TOPIC_POSTS_PAGE_SIZE = 20/u)
assert.match(topicSource, /const requestSequence = useRef\(0\)/u)
assert.match(topicSource, /const seen = new Set\(current\.map\(\(post\) => post\.id\)\)/u)
assert.match(topicSource, /pageSize: TOPIC_POSTS_PAGE_SIZE/u)
assert.match(topicSource, /posts\.length < total/u)
assert.match(topicSource, /onClick=\{loadMore\}/u)

assert.match(commentsSource, /const DetailCommentThread = memo/u)
assert.match(commentsSource, /const \{ descendants, memberNames, replyTree, showThreadAction \} = useMemo/u)
assert.match(commentsSource, /const existingIds = new Set\(current\.map\(\(entry\) => entry\.id\)\)/u)
assert.match(commentsSource, /listRequestSequenceRef/u)
assert.match(commentsSource, /threadInFlightRef/u)
assert.match(commentsSource, /clearPendingTimers/u)

process.stdout.write('community performance smoke: ok\n')
