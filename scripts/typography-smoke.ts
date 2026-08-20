import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appStyle = readFileSync(resolve(__dirname, '../src/app.scss'), 'utf8')
const typographyStyle = readFileSync(resolve(__dirname, '../src/styles/_typography.scss'), 'utf8')
const homeStyle = readFileSync(resolve(__dirname, '../src/pages/index/index.scss'), 'utf8')
const tabBarStyle = readFileSync(resolve(__dirname, '../src/custom-tab-bar/index.wxss'), 'utf8')

assert.match(appStyle, /--campus-font-caption:\s*22rpx/u)
assert.match(appStyle, /--campus-font-body:\s*28rpx/u)
assert.match(appStyle, /font-size:\s*30rpx/u, '全局默认字号必须保持在 30rpx')
assert.match(typographyStyle, /page \.community-post__content \{ font-size: 34rpx; \}/u)
assert.match(typographyStyle, /page \.community-detail__body \{ font-size: 30rpx; \}/u)
assert.match(typographyStyle, /page \.business-detail-comment__bubble \{ font-size: 28rpx; \}/u)

const homeFontTokens = [...homeStyle.matchAll(/--home-font-(footnote|auxiliary|tertiary|secondary):\s*(\d+)rpx/gu)]
  .reduce<Record<string, number>>((tokens, match) => ({
    ...tokens,
    [match[1]]: Number(match[2]),
  }), {})

assert.deepEqual(homeFontTokens, {
  footnote: 24,
  auxiliary: 28,
  tertiary: 30,
  secondary: 34,
}, '首页字号必须按微信设计指南保持清晰的 12/14/15/17pt 语义层级')
assert.ok(
  homeFontTokens.footnote < homeFontTokens.auxiliary
    && homeFontTokens.auxiliary < homeFontTokens.tertiary
    && homeFontTokens.tertiary < homeFontTokens.secondary,
  '首页注释、辅助、三级标题和二级标题必须逐级增大',
)
assert.match(
  homeStyle,
  /\.section-heading__title,[\s\S]{0,260}font-size:\s*var\(--home-font-secondary\)/u,
  '首页区块标题必须使用二级标题字号',
)
assert.match(
  homeStyle,
  /\.schedule-card__course-name,[\s\S]{0,360}font-size:\s*var\(--home-font-tertiary\)/u,
  '首页卡片核心标题必须使用三级标题字号',
)
assert.match(
  homeStyle,
  /\.service-panel__subtitle,[\s\S]{0,620}font-size:\s*var\(--home-font-auxiliary\)/u,
  '首页说明文字必须使用辅助内容字号',
)
assert.match(
  homeStyle,
  /\.service-panel__grid-name,[\s\S]{0,760}font-size:\s*var\(--home-font-footnote\)/u,
  '首页五列服务名称不得低于注释字号',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*font-size:\s*24rpx;[^}]*line-height:\s*28rpx;/u,
  '持续可见的 TabBar 标签不得低于 12pt 等效字号',
)

const scssPaths = execFileSync('rg', ['--files', 'src', '-g', '*.scss'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)

for (const path of scssPaths) {
  const source = readFileSync(resolve(__dirname, '..', path), 'utf8')
  const sizes = source.matchAll(/font-size:\s*(\d+)rpx/gu)
  for (const match of sizes) {
    const size = Number(match[1])
    assert.ok(size >= 18, `${path} 仍包含低于 18rpx 的不可读字号：${size}rpx`)
  }
}

process.stdout.write('typography smoke: ok\n')
