import { strict as assert } from 'node:assert'
import { formatCommunityViewCount, getReaderToken, reportPostView } from '../src/features/community/post-view-utils'

const values = new Map<string, unknown>()
const storage = {
  get: () => values.get('reader-token'),
  set: (value: string) => values.set('reader-token', value),
}

const firstToken = getReaderToken(storage)
assert.match(firstToken, /^[\x21-\x7e]{16,128}$/u)
assert.equal(getReaderToken(storage), firstToken)

void (async () => {
  let attempts = 0
  const result = await reportPostView(7, async (postId, readerToken) => {
    attempts += 1
    assert.equal(postId, 7)
    assert.equal(readerToken, firstToken)
    if (attempts === 1) throw new Error('temporary failure')
    return { counted: true, view_count: 128 }
  }, storage)
  assert.deepEqual(result, { counted: true, view_count: 128 })
  assert.equal(attempts, 2)

  assert.equal(formatCommunityViewCount(0), '0')
  assert.equal(formatCommunityViewCount(9999), '9999')
  assert.equal(formatCommunityViewCount(10000), '1.0万')
  assert.equal(formatCommunityViewCount(12500), '1.3万')
  assert.equal(formatCommunityViewCount(undefined), '—')

  process.stdout.write('community post view smoke: ok\n')
})()
