import { strict as assert } from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = path.resolve(__dirname, '..')
const detailSource = fs.readFileSync(path.join(root, 'src/pages/community/detail.tsx'), 'utf8')
const repositorySource = fs.readFileSync(path.join(root, 'src/features/life-services/repository.ts'), 'utf8')

assert.match(detailSource, /const ADMIN_WITHDRAW_ACTION = 'admin_withdraw'/)
assert.match(detailSource, /post\.available_actions\.includes\(ADMIN_WITHDRAW_ACTION\)/)
assert.doesNotMatch(detailSource, /getCurrentUser|ADMIN_WITHDRAW_PERMISSION|ADMIN_WITHDRAWABLE_STATUSES/)
assert.match(detailSource, /label: '撤销帖子', run: openAdminWithdraw/)
assert.match(detailSource, /maxlength=\{500\}/)
assert.match(detailSource, /请填写撤销原因/)
assert.match(detailSource, /expected_version: post\.version/)
assert.match(detailSource, /statusCode === 403/)
assert.match(detailSource, /权限不足，无法撤销帖子/)
assert.match(detailSource, /statusCode === 409/)
assert.match(detailSource, /帖子状态已变化，已刷新最新详情/)
assert.match(repositorySource, /adminWithdrawCampusCirclePost\(id: number, input: AdminWithdrawCampusCirclePostBody\)/)
assert.match(repositorySource, /\/api\/v1\/admin\/campus-circle\/posts\/\$\{id\}\/withdraw/)
assert.match(repositorySource, /createIdempotencyKey\(`campus-circle:\$\{id\}:admin-withdraw`\)/)

console.log('community admin withdraw smoke passed')
