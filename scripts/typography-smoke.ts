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
  footnote: 22,
  auxiliary: 24,
  tertiary: 28,
  secondary: 32,
}, '首页字号必须保留适合高密度信息流的紧凑语义层级')
assert.ok(
  homeFontTokens.footnote < homeFontTokens.auxiliary
    && homeFontTokens.auxiliary < homeFontTokens.tertiary
    && homeFontTokens.tertiary < homeFontTokens.secondary,
  '首页注释、辅助、三级标题和二级标题必须逐级增大',
)
assert.match(homeStyle, /--home-font-weight-regular:\s*400;/u)
assert.match(homeStyle, /--home-font-weight-heading:\s*500;/u)
assert.match(homeStyle, /--home-font-weight-emphasis:\s*600;/u)
assert.match(
  homeStyle,
  /\.section-heading__title,[\s\S]{0,300}font-size:\s*var\(--home-font-secondary\);[^}]*font-weight:\s*var\(--home-font-weight-heading\);/u,
  '首页区块标题必须使用紧凑二级标题字号与中等字重',
)
assert.match(
  homeStyle,
  /\.schedule-card__course-name,[\s\S]{0,420}font-size:\s*var\(--home-font-tertiary\);[^}]*font-weight:\s*var\(--home-font-weight-regular\);/u,
  '首页 28rpx 卡片标题必须使用 Regular，避免 Android 厂商字体把 Medium 映射得过粗',
)
assert.match(
  homeStyle,
  /\.service-panel__subtitle,[\s\S]{0,760}font-size:\s*var\(--home-font-auxiliary\);[^}]*font-weight:\s*var\(--home-font-weight-regular\);/u,
  '首页 24rpx 说明与操作文字必须使用 Regular',
)
assert.match(
  homeStyle,
  /\.service-panel__grid-name,[\s\S]{0,980}font-size:\s*var\(--home-font-footnote\);[^}]*font-weight:\s*var\(--home-font-weight-regular\);/u,
  '首页 22rpx 服务名称与注释文字必须使用 Regular',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*font-size:\s*22rpx;[^}]*font-weight:\s*400;[^}]*line-height:\s*26rpx;/u,
  '持续可见的 TabBar 标签必须保持紧凑且使用正常字重',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__item--active \.tab-bar__text\s*\{[^}]*font-weight:\s*400;/u,
  'TabBar 激活态必须保持 400，只用颜色表达选中，避免跨 Android 字体产生粗细跳变',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*color:\s*#718096;/u,
  'TabBar 小号灰字必须使用更高对比度颜色',
)
assert.match(
  homeStyle,
  /--home-text-muted-readable:\s*var\(--campus-text-secondary,\s*#62748e\);/u,
  '首页辅助灰字必须使用可随暗色模式切换的高对比度语义色',
)
assert.match(
  homeStyle,
  /\.news-card__title,[\s\S]{0,220}font-weight:\s*var\(--home-font-weight-regular\);/u,
  '首页社区正文必须使用 400 字重',
)
assert.match(
  homeStyle,
  /\.marketplace-card__placeholder-headline,[\s\S]{0,400}font-weight:\s*var\(--home-font-weight-regular\);/u,
  '首页二手标题必须使用 400 字重',
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
