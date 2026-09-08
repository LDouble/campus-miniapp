import { strict as assert } from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const pinActions = read('src/features/community/pin-action.ts')
const repository = read('src/features/life-services/repository.ts')
const feed = read('src/features/community/feed-panel.tsx')
const card = read('src/features/community/post-card.tsx')
const detail = read('src/pages/community/detail.tsx')

assert.match(pinActions, /post\.available_actions/)
assert.match(pinActions, /actions\.includes\('pin'\)/)
assert.match(pinActions, /actions\.includes\('unpin'\)/)
assert.match(pinActions, /置顶只影响该版块/)
assert.match(repository, /posts\/\$\{id\}\/pin/)
assert.match(repository, /expected_version: input\.expectedVersion/)
assert.match(repository, /pinned: input\.pinned/)
assert.match(feed, /sort: 'latest'/)
assert.match(feed, /onPinAction=\{runPinAction\}/)
assert.match(feed, /statusCode === 403 \|\| actionError\.statusCode === 409/)
assert.match(card, /getCommunityPinAction\(post\)/)
assert.match(card, /onPinAction/)
assert.match(detail, /pin: '置顶到本版块'/)
assert.match(detail, /unpin: '取消本版块置顶'/)
assert.match(detail, /statusCode === 403 \|\| actionError\.statusCode === 409/)

console.log('community section pins smoke: ok')
