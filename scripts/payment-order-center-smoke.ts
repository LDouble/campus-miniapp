import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cancellationProgressCopy,
  primaryOrderAction,
  usesServerOrderSearch,
} from '../src/features/life-services/payment-order-state'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const orderPage = readSource('../src/pages/my-services/index.tsx')
const errandDetail = readSource('../src/pages/errands/detail.tsx')
const repository = readSource('../src/features/life-services/repository.ts')

assert.match(repository, /status_group: search\.statusGroup/u)
assert.match(repository, /keyword: search\.keyword\?\.trim\(\) \|\| undefined/u)
assert.equal(usesServerOrderSearch('orders'), true)
assert.equal(usesServerOrderSearch('published'), false)
assert.equal(cancellationProgressCopy('processing', 'none'), '取消处理中')
assert.equal(cancellationProgressCopy('processing', 'refunding'), '退款处理中')
assert.equal(cancellationProgressCopy('succeeded', 'refunding'), '')
assert.equal(primaryOrderAction(['pickup', 'deliver']), 'pickup')
assert.equal(primaryOrderAction(['cancel']), null)

assert.match(orderPage, /usesServerOrderSearch\(view\.section\) \|\| !keyword\.trim\(\)/u, '订单搜索不能只筛选已加载的本地分页数据')

assert.match(orderPage, /cancellationProgressCopy\(updated\.cancellation_status, updated\.payment_status\)/u)
assert.match(orderPage, /cancellationProgressCopy\(order\.cancellation_status, order\.payment_status\)/u)
assert.match(errandDetail, /cancellationProgressCopy\(\s*response\.errand\.cancellation_status,/u)

assert.match(orderPage, /primaryOrderAction\(orderActions\)/u)
assert.doesNotMatch(orderPage, /payment_status[^\n]+pickup/u, '履约按钮只依赖服务端 available_actions')

console.log('payment order center smoke: ok')
