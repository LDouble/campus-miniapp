import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const appConfig = source('../src/app.config.ts')
const catalog = source('../src/pages/cat-atlas/index.tsx')
const detail = source('../src/pages/cat-atlas/detail.tsx')
const report = source('../src/pages/cat-atlas/report.tsx')
const map = source('../src/pages/cat-atlas/map.tsx')
const api = source('../src/api/cat-atlas.ts')
const data = source('../src/features/cat-atlas/data.ts')

assert.match(appConfig, /root: 'pages\/cat-atlas'/u, '猫图鉴应注册为独立分包')
assert.match(appConfig, /'report', 'map'/u, '图鉴分包应注册出没地图')
assert.match(catalog, /猫猫图鉴/u, '应提供猫咪列表入口')
assert.match(catalog, /listCats/u, '列表应读取猫咪 API')
assert.match(detail, /我遇到它了/u, '详情页应提供目击打卡入口')
assert.match(report, /MediaImageEditor/u, '投稿页应提供照片上传、预览和重试')
assert.match(report, /submitCat/u, '投稿页应提交新猫审核')
assert.match(map, /区域级目击热点/u, '地图应明确保护精确位置')
assert.match(api, /\/api\/v1\/cats/u, '图鉴应定义后端 API 客户端')
assert.match(data, /name: '橘座'/u, '初始档案应包含橘座')

process.stdout.write('cat atlas smoke: ok\n')
