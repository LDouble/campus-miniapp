import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Asset = { source(): string }
type Assets = Record<string, Asset>
type AppManifest = { pages?: string[], subPackages?: Array<{ root?: string, pages?: string[] }> }

const root = process.cwd()
const { sources } = require('webpack') as { sources: { RawSource: new (value: string) => Asset } }
const installWeappCompat = require('../config/plugins/weapp-compat.js') as (ctx: {
  modifyBuildAssets(callback: ({ assets }: { assets: Assets }) => void): void
}) => void
const raw = (value: string): Asset => new sources.RawSource(value)
const sourceOf = (assets: Assets, assetPath: string) => String(assets[assetPath]?.source())

const applyPlugin = (assets: Assets) => {
  let callback: ((payload: { assets: Assets }) => void) | undefined
  installWeappCompat({ modifyBuildAssets(hook) { callback = hook } })
  assert.ok(callback, '构建兼容插件必须注册 modifyBuildAssets hook')
  const previous = process.env.TARO_ENV
  process.env.TARO_ENV = 'weapp'
  try { callback({ assets }) } finally {
    if (previous === undefined) delete process.env.TARO_ENV
    else process.env.TARO_ENV = previous
  }
}

const fixtureAssets = (): Assets => ({
  'base.wxml': raw('<template name="taro_tmpl"><view class="{{i.cl}}"><template is="taro_tmpl" data="{{i:item,c:1,l:xs.f(\'\',item.nn)}}" /></view></template>'),
  'pages/home/index.wxml': raw('<view><template is="taro_tmpl" data="{{root:root}}" /></view>'),
  'pages/home/index.json': raw('{}'),
  // 业务自行声明的 page-meta 必须原样保留，不能被主题构建逻辑重写。
  'pages/existing/index.wxml': raw('<page-meta data-preserved="yes" /><view><template is="taro_tmpl" data="{{root:root}}" /></view>'),
  'pages/existing/index.json': raw('{}'),
  'components/card/index.wxml': raw('<view><template is="taro_tmpl" data="{{root:root}}" /></view>'),
  'components/card/index.json': raw('{"component":true}'),
})

const fixtures = fixtureAssets()
const originalComponent = sourceOf(fixtures, 'components/card/index.wxml')
applyPlugin(fixtures)
const base = sourceOf(fixtures, 'base.wxml')
const home = sourceOf(fixtures, 'pages/home/index.wxml')
const existing = sourceOf(fixtures, 'pages/existing/index.wxml')

assert.match(base, /class="\{\{c===1\?'campus-theme ':''\}\}\{\{i\.cl\}\}"/u, '页面根必须静态带 campus-theme 标记')
assert.doesNotMatch(base, /campus-theme--|t:t|__campusTheme/u, '构建根标记不得携带动态主题数据')
assert.doesNotMatch(home, /<page-meta\b|__campusTheme|,t:/u, '普通页面不得注入主题 page-meta 或动态主题数据')
assert.match(home, /data="\{\{root:root\}\}"/u, '普通页面必须保留原始 root 数据绑定')
assert.match(existing, /^<page-meta\b[^>]*data-preserved="yes"/u, '业务自有 page-meta 必须保留')
assert.doesNotMatch(existing, /__campusTheme|,t:/u, '业务自有 page-meta 不得被主题数据污染')
assert.equal(sourceOf(fixtures, 'components/card/index.wxml'), originalComponent, 'component:true 的组件不得被页面主题构建逻辑修改')

const firstPass = Object.fromEntries(Object.entries(fixtures).map(([assetPath, asset]) => [assetPath, String(asset.source())]))
applyPlugin(fixtures)
for (const [assetPath, expected] of Object.entries(firstPass)) {
  assert.equal(sourceOf(fixtures, assetPath), expected, `第二次执行不得改变 ${assetPath}`)
}

const outputRoot = join(root, 'dist/full')
if (existsSync(outputRoot)) {
  const app = JSON.parse(readFileSync(join(outputRoot, 'app.json'), 'utf8')) as AppManifest
  const pagePaths = [
    ...(app.pages || []),
    ...(app.subPackages || []).flatMap(({ root: packageRoot = '', pages = [] }) => pages.map(page => `${packageRoot}/${page}`.replace(/^\//u, ''))),
  ]
  assert.ok(pagePaths.length > 0, 'app.json 必须声明至少一个页面')
  for (const pagePath of pagePaths) {
    const source = readFileSync(join(outputRoot, `${pagePath}.wxml`), 'utf8')
    assert.doesNotMatch(source, /__campusTheme|,t:/u, `${pagePath} 不得保留动态主题注入`)
  }
  const builtBase = readFileSync(join(outputRoot, 'base.wxml'), 'utf8')
  assert.match(builtBase, /campus-theme/u, '构建产物根节点必须有静态 campus-theme 标记')
  assert.doesNotMatch(builtBase, /campus-theme--|t:t|__campusTheme/u, '构建产物不得保留动态主题根标记')
  process.stdout.write('theme build smoke: fixture and dist/full ok\n')
} else {
  process.stdout.write('theme build smoke: fixture ok; dist/full 不存在，跳过构建产物扫描\n')
}
