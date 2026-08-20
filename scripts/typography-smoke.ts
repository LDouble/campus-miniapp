import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appStyle = readFileSync(resolve(__dirname, '../src/app.scss'), 'utf8')
const tokenStyle = readFileSync(resolve(__dirname, '../src/styles/_tokens.scss'), 'utf8')
const typographyStyle = readFileSync(resolve(__dirname, '../src/styles/_typography.scss'), 'utf8')
const homeStyle = readFileSync(resolve(__dirname, '../src/pages/index/index.scss'), 'utf8')
const tabBarStyle = readFileSync(resolve(__dirname, '../src/custom-tab-bar/index.wxss'), 'utf8')

const globalFontSizeTokens = [...appStyle.matchAll(
  /--campus-font-(caption|supporting|body|title|display):\s*(\d+)rpx;/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalFontSizeTokens, {
  caption: 22,
  supporting: 24,
  body: 28,
  title: 32,
  display: 34,
}, '全局字号 Token 必须保留首页真机验证后的五级语义层级')
assert.ok(
  globalFontSizeTokens.caption < globalFontSizeTokens.supporting
    && globalFontSizeTokens.supporting < globalFontSizeTokens.body
    && globalFontSizeTokens.body < globalFontSizeTokens.title
    && globalFontSizeTokens.title < globalFontSizeTokens.display,
  '全局注释、辅助、正文、标题和展示字号必须逐级增大',
)

const globalFontWeightTokens = [...appStyle.matchAll(
  /--campus-font-weight-(regular|medium|emphasis):\s*(\d+);/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalFontWeightTokens, {
  regular: 400,
  medium: 500,
  emphasis: 600,
}, '全局字重 Token 必须避免 Android 厂商字体产生不必要的粗细跳变')

const globalLineHeightTokens = [...appStyle.matchAll(
  /--campus-line-height-(heading|caption|body):\s*(\d+(?:\.\d+)?);/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalLineHeightTokens, {
  heading: 1.3,
  caption: 1.35,
  body: 1.4,
}, '全局行高 Token 必须覆盖标题、注释和正文节奏')

for (const [name, size] of Object.entries(globalFontSizeTokens)) {
  assert.match(
    tokenStyle,
    new RegExp(`\\$font-size-${name}:\\s*var\\(--campus-font-${name},\\s*${size}rpx\\);`, 'u'),
    `Sass Token 必须映射全局字号：${name}`,
  )
}
for (const [name, weight] of Object.entries(globalFontWeightTokens)) {
  assert.match(
    tokenStyle,
    new RegExp(`\\$font-weight-${name}:\\s*var\\(--campus-font-weight-${name},\\s*${weight}\\);`, 'u'),
    `Sass Token 必须映射全局字重：${name}`,
  )
}
for (const [name, lineHeight] of Object.entries(globalLineHeightTokens)) {
  assert.match(
    tokenStyle,
    new RegExp(`\\$line-height-${name}:\\s*var\\(--campus-line-height-${name},\\s*${lineHeight}\\);`, 'u'),
    `Sass Token 必须映射全局行高：${name}`,
  )
}

assert.match(appStyle, /font-size:\s*30rpx/u, '全局默认字号必须保持在 30rpx')
assert.match(typographyStyle, /page \.community-post__content \{ font-size: 34rpx; \}/u)
assert.match(typographyStyle, /page \.community-detail__body \{ font-size: 30rpx; \}/u)
assert.match(typographyStyle, /page \.business-detail-comment__bubble \{ font-size: 28rpx; \}/u)

assert.doesNotMatch(homeStyle, /--home-(?:font|text)-/u, '首页不得重复定义全局字体或文本 Token')
for (const name of ['caption', 'supporting', 'body', 'title', 'display']) {
  assert.match(homeStyle, new RegExp(`var\\(--campus-font-${name},`, 'u'), `首页必须消费全局字号 Token：${name}`)
}
for (const name of ['regular', 'medium', 'emphasis']) {
  assert.match(homeStyle, new RegExp(`var\\(--campus-font-weight-${name},`, 'u'), `首页必须消费全局字重 Token：${name}`)
}
for (const name of ['heading', 'caption', 'body']) {
  assert.match(homeStyle, new RegExp(`var\\(--campus-line-height-${name},`, 'u'), `首页必须消费全局行高 Token：${name}`)
}
assert.match(
  homeStyle,
  /\.section-heading__title,[\s\S]{0,380}font-size:\s*var\(--campus-font-title,\s*32rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-medium,\s*500\);/u,
  '首页区块标题必须使用紧凑二级标题字号与中等字重',
)
assert.match(
  homeStyle,
  /\.schedule-card__course-name,[\s\S]{0,460}font-size:\s*var\(--campus-font-body,\s*28rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  '首页 28rpx 卡片标题必须使用 Regular，避免 Android 厂商字体把 Medium 映射得过粗',
)
assert.match(
  homeStyle,
  /\.service-panel__subtitle,[\s\S]{0,900}font-size:\s*var\(--campus-font-supporting,\s*24rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  '首页 24rpx 说明与操作文字必须使用 Regular',
)
assert.match(
  homeStyle,
  /\.service-panel__grid-name,[\s\S]{0,1160}font-size:\s*var\(--campus-font-caption,\s*22rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  '首页 22rpx 服务名称与注释文字必须使用 Regular',
)
assert.match(
  homeStyle,
  /\.hero-card[\s\S]{0,1100}&__title\s*\{[^}]*font-size:\s*var\(--campus-font-display,\s*34rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-medium,\s*500\);/u,
  '首页 Hero 必须使用展示字号与中等字重',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*font-size:\s*var\(--campus-font-caption,\s*22rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-caption,\s*1\.35\);/u,
  '持续可见的 TabBar 标签必须保持紧凑且使用正常字重',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__item--active \.tab-bar__text\s*\{[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  'TabBar 激活态必须保持 400，只用颜色表达选中，避免跨 Android 字体产生粗细跳变',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*color:\s*#718096;/u,
  'TabBar 小号灰字必须使用更高对比度颜色',
)
assert.match(
  homeStyle,
  /color:\s*var\(--campus-text-secondary,\s*#62748e\);/u,
  '首页辅助灰字必须使用可随暗色模式切换的高对比度语义色',
)
assert.match(
  homeStyle,
  /\.news-card__title,[\s\S]{0,260}font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  '首页社区正文必须使用 400 字重',
)
assert.match(
  homeStyle,
  /\.marketplace-card__placeholder-headline,[\s\S]{0,500}font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
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
