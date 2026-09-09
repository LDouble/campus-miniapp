import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const appConfig = source('../src/app.config.ts')
const catalog = source('../src/pages/cat-atlas/index.tsx')
const list = source('../src/pages/cat-atlas/list.tsx')
const detail = source('../src/pages/cat-atlas/detail.tsx')
const report = source('../src/pages/cat-atlas/report.tsx')
const map = source('../src/pages/cat-atlas/map.tsx')
const api = source('../src/api/cat-atlas.ts')
const data = source('../src/features/cat-atlas/data.ts')

assert.match(appConfig, /root: 'pages\/cat-atlas'/u, '猫图鉴应注册为独立分包')
assert.match(appConfig, /'report', 'map'/u, '图鉴分包应注册出没地图')
assert.match(appConfig, /'index', 'list', 'detail'/u, '图鉴分包应注册独立列表页')
assert.match(catalog, /export \{ default \} from '\.\/list'/u, '猫咪图鉴首页应直接复用全部图鉴列表')
assert.doesNotMatch(catalog, /cat-home-hero/u, '猫咪图鉴首页不应再渲染宣传型落地页')
assert.match(list, /listCats/u, '全部图鉴应读取猫咪 API')
assert.match(source('../src/pages/services/index.tsx'), /cat-atlas.*pages\/cat-atlas\/index/u, '服务入口应直接打开猫咪图鉴首页')
assert.doesNotMatch(appConfig, /pagePath: 'pages\/cat-atlas\//u, '猫猫图鉴不应注册为独立 Tab')
assert.match(list, /cat-list-v2__card/u, '独立列表页应渲染猫咪卡片')
assert.match(detail, /我遇到它了/u, '详情页应提供目击打卡入口')
assert.match(report, /uploadMediaImage/u, '投稿页应提供照片上传、预览和重试')
assert.match(report, /submitCat/u, '投稿页应提交新猫审核')
assert.match(map, /区域级目击热点/u, '地图应明确保护精确位置')
assert.match(api, /\/api\/v1\/cats/u, '图鉴应定义后端 API 客户端')
assert.match(data, /name: '橘座'/u, '初始档案应包含橘座')

process.stdout.write('cat atlas smoke: ok\n')
