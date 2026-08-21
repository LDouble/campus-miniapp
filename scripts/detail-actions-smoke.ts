import { strict as assert } from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  buildDetailFooterActions,
  splitDetailActions,
} from '../src/features/life-services/detail-actions'

const labels = {
  edit: '编辑商品',
  submit_review: '提交审核',
  withdraw: '撤回商品',
}

const actions = buildDetailFooterActions({
  availableActions: ['withdraw', 'edit', 'submit_review', 'withdraw'],
  labels,
  priority: ['submit_review', 'withdraw', 'edit'],
  dangerActions: ['withdraw'],
  onAction: () => undefined,
})

assert.deepEqual(actions.map((action) => action.key), ['withdraw', 'edit', 'submit_review'])
assert.equal(actions[0].label, '撤回商品')
assert.equal(actions[0].emphasis, 'danger')
assert.equal(actions[1].emphasis, 'secondary')
assert.equal(actions[2].emphasis, 'primary')

const withdrawOnly = buildDetailFooterActions({
  availableActions: ['withdraw'],
  labels,
  priority: ['withdraw'],
  dangerActions: ['withdraw'],
  onAction: () => undefined,
})

assert.equal(withdrawOnly.length, 1)
assert.equal(withdrawOnly[0].label, '撤回商品')
assert.equal(withdrawOnly[0].emphasis, 'danger')

const splitActions = splitDetailActions(actions, ['edit', 'withdraw'])
assert.deepEqual(splitActions.overflowActions.map((action) => action.key), ['withdraw', 'edit'])
assert.deepEqual(splitActions.inlineActions.map((action) => action.key), ['submit_review'])

const root = path.resolve(__dirname, '..')
const overflowSource = fs.readFileSync(
  path.join(root, 'src/features/life-services/components/detail-overflow-actions.tsx'),
  'utf8',
)

assert.match(overflowSource, /actions\.map\(\(action\) =>/)
assert.doesNotMatch(overflowSource, /actions\.slice\(/)
assert.match(overflowSource, /useDismissCommunityOverlaysOnScroll/)
assert.match(overflowSource, /if \(action\.busy\) return/)

for (const [detailPath, overflowKeys] of [
  ['src/packages/social/errands/detail.tsx', "['edit', 'cancel']"],
  ['src/packages/social/carpool/detail.tsx', "['edit', 'cancel']"],
  ['src/packages/social/marketplace/detail.tsx', "['edit', 'withdraw']"],
] as const) {
  const source = fs.readFileSync(path.join(root, detailPath), 'utf8')
  assert.match(source, /<DetailOverflowActions actions=\{overflowActions\} \/>/)
  assert.match(source, /splitDetailActions\(/)
  assert.ok(source.includes(overflowKeys))
  assert.match(source, /actions=\{inlineActions\}/)
  assert.match(source, /className='detail-overview__report'/)
  assert.doesNotMatch(source, /key: 'report'/)
}

console.log('detail action resolver smoke passed')
