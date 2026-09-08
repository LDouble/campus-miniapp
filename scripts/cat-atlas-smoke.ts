import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const appConfig = source('../src/app.config.ts')
const catalog = source('../src/pages/cat-atlas/index.tsx')
const detail = source('../src/pages/cat-atlas/detail.tsx')
const report = source('../src/pages/cat-atlas/report.tsx')
const data = source('../src/features/cat-atlas/data.ts')

assert.match(appConfig, /root: 'pages\/cat-atlas'/u, '猫图鉴应注册为独立分包')
assert.match(catalog, /猫猫图鉴/u, '应提供猫咪列表入口')
assert.match(detail, /我遇到它了/u, '详情页应提供目击打卡入口')
assert.match(report, /发现了一只新猫/u, '投稿页应支持发现新猫')
assert.match(data, /name: '橘座'/u, '初始档案应包含橘座')

process.stdout.write('cat atlas smoke: ok\n')
