import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const orderPage = readSource('../src/pages/my-services/index.tsx')
const errandDetail = readSource('../src/pages/errands/detail.tsx')
const repository = readSource('../src/features/life-services/repository.ts')

assert.match(repository, /status_group: search\.statusGroup/u)
assert.match(repository, /keyword: search\.keyword\?\.trim\(\) \|\| undefined/u)
assert.doesNotMatch(orderPage, /items\.filter\(/u, '订单搜索不能只筛选已加载的本地分页数据')

assert.match(orderPage, /updated\.cancellation_status === 'processing'/u)
assert.match(orderPage, /退款处理中，请稍后刷新/u)
assert.match(errandDetail, /response\.errand\.cancellation_status === 'processing'/u)

assert.match(orderPage, /orderActions\.includes\('pickup'\)/u)
assert.match(orderPage, /orderActions\.includes\('deliver'\)/u)
assert.doesNotMatch(orderPage, /payment_status[^\n]+pickup/u, '履约按钮只依赖服务端 available_actions')

console.log('payment order center smoke: ok')
