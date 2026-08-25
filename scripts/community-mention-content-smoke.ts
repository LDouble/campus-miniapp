import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { insertMentionToken } from '../src/features/mentions/content'

assert.deepEqual(
  insertMentionToken('前后', '海风同学', 1),
  { text: '前@海风同学 后', cursor: 7 },
)
assert.deepEqual(
  insertMentionToken('替换这里', '木棉同学', 1, 3),
  { text: '替@木棉同学 里', cursor: 7 },
)
assert.deepEqual(insertMentionToken('文本', '', 1), { text: '文本', cursor: 1 })

const componentSource = readFileSync(
  resolve(__dirname, '../src/components/mention-content/index.tsx'),
  'utf8',
)
assert.ok(componentSource.includes('content_segments') || componentSource.includes('segments'))
assert.ok(componentSource.includes('openPublicProfile'))
assert.ok(componentSource.includes('event.stopPropagation()'))

const postSource = readFileSync(
  resolve(__dirname, '../src/features/community/post-card.tsx'),
  'utf8',
)
const commentSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'),
  'utf8',
)
assert.ok(postSource.includes('<MentionContent'))
assert.ok(commentSource.includes('<MentionContent'))

process.stdout.write('community mention content smoke: ok\n')
