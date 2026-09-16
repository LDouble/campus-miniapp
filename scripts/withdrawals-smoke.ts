import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const payments = readSource('../src/api/payments.ts')
const earnings = readSource('../src/pages/earnings/index.tsx')

assert.match(payments, /path: '\/api\/v1\/withdrawals\/summary'/u)
assert.match(payments, /path: '\/api\/v1\/withdrawals\/mine'/u)
assert.match(payments, /path: '\/api\/v1\/withdrawals'/u)
assert.doesNotMatch(earnings, /transferSettlementPayable/u, '收益页不能逐单发起打款')
assert.match(earnings, /getMyWithdrawal\(withdrawal\.id\)/u)
assert.match(earnings, /detail\.status !== 'awaiting_user_confirmation' \|\| !detail\.transfer/u)
assert.match(earnings, /可提现金额已变化，请刷新后重新确认/u)
assert.match(earnings, /review_reason/u)

console.log('withdrawals smoke: ok')
