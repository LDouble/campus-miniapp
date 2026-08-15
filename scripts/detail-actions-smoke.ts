import { strict as assert } from 'node:assert'
import { buildDetailFooterActions } from '../src/features/life-services/detail-actions'

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

console.log('detail action resolver smoke passed')
