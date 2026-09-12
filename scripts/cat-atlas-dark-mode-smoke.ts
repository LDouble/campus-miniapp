import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'sass'
import postcss from 'postcss'
import { parseDocument } from 'htmlparser2'
import { is, selectOne } from 'css-select'

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const catalog = source('../src/pages/cat-atlas/catalog.scss')
const atlas = source('../src/pages/cat-atlas/atlas.scss')
const report = source('../src/pages/cat-atlas/report-journal.scss')
const sightings = source('../src/pages/cat-atlas/sightings-journal.scss')

for (const [name, styles] of Object.entries({ catalog, atlas, report, sightings })) {
  assert.match(styles, /\.campus-theme--dark/u, `${name} must provide a dark-mode override`)
  assert.match(styles, /var\(--campus-page\)/u, `${name} must use the semantic page surface in dark mode`)
  assert.match(styles, /var\(--campus-surface\)/u, `${name} must use the semantic card surface in dark mode`)
  assert.match(styles, /var\(--campus-text-heading\)/u, `${name} must use the semantic heading colour in dark mode`)
  assert.match(styles, /var\(--campus-border\)/u, `${name} must use the semantic border colour in dark mode`)
}

assert.match(catalog, /\.cat-journal\.campus-theme--dark/u, '图鉴列表必须匹配页面根元素自身的主题类')
assert.match(atlas, /\.cat-page\.campus-theme--dark/u, '详情、地图和档案页必须匹配页面根元素自身的主题类')
assert.match(atlas, /\.cat-detail-page\.campus-theme--dark/u, '详情页的 Figma 局部令牌必须在深色模式覆盖')
assert.match(report, /\.cat-report-journal\.campus-theme--dark/u, '上报页必须匹配页面根元素自身的主题类')
assert.match(sightings, /\.cat-journal-page\.campus-theme--dark/u, '动态页必须匹配页面根元素自身的主题类')
assert.match(atlas, /\.cat-detail-bottom \{ border-top-color: var\(--campus-border\)/u, '详情底栏在深色模式必须使用语义边框')
assert.match(atlas, /\.cat-map-canvas \{ border-color: var\(--campus-border\)/u, '地图画布在深色模式不得保留浅色描边')
assert.match(atlas, /&\.atlas-form-page,\s*&\.catalog-page \{ background: var\(--campus-page\); \}/u, '档案建议与我的图鉴根节点必须覆盖浅色背景')
assert.match(atlas, /\.catalog-tabs \.is-active \{ background: var\(--campus-surface-errand\); color: #fff; \}/u, '我的图鉴激活标签在深色模式必须保持可读对比')
assert.match(atlas, /\.catalog-grid__photo--empty \{ border-color: var\(--campus-border\); background: var\(--campus-surface-subtle\);/u, '我的图鉴空态在深色模式不得保留浅色底')
assert.match(atlas, /\.cat-profile-suggestion-page__footer \{ border-top-color: var\(--campus-border\); background: var\(--campus-surface-glass\); \}/u, '档案建议固定底栏必须适配深色表面')
assert.match(atlas, /\.cat-detail-nav-pill__item image \{ filter: brightness\(0\) invert\(1\); \}/u, '详情固定深色 SVG 在暗色模式必须可见')
assert.match(atlas, /--figma-accent: var\(--campus-errand\);/u, '详情暖色小字在深色模式必须使用可读业务强调色')

const compiledAtlas = postcss.parse(compile(resolve(__dirname, '../src/pages/cat-atlas/atlas.scss'), { logger: { warn() {}, debug() {} } }).css)
const rootFor = (pageClass: 'catalog-page' | 'atlas-form-page') => selectOne('view', parseDocument(
  `<page><view class="campus-theme campus-theme--dark ${pageClass}"></view></page>`,
).children)!
const matchingBackgrounds = (pageClass: 'catalog-page' | 'atlas-form-page') => {
  const backgrounds: string[] = []
  compiledAtlas.walkRules(rule => {
    if (rule.parent?.type === 'atrule') return
    if (!rule.selectors.some(selector => !selector.includes('::') && is(rootFor(pageClass), selector))) return
    rule.walkDecls('background', decl => { backgrounds.push(decl.value) })
  })
  return backgrounds
}

for (const pageClass of ['catalog-page', 'atlas-form-page'] as const) {
  assert.equal(
    matchingBackgrounds(pageClass).at(-1),
    'var(--campus-page)',
    `${pageClass} 的深色根节点背景必须最终命中语义 page 色`,
  )
}

const detachedRoot = selectOne('view', parseDocument('<page><view class="campus-theme--dark catalog-page"></view></page>').children)!
assert.equal(is(detachedRoot, '.campus-theme--dark .catalog-page'), false, '祖先选择器不能代替页面根节点自身选择器')

process.stdout.write('cat atlas dark mode smoke: ok\n')
