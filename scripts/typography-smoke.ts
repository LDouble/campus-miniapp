import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appStyle = readFileSync(resolve(__dirname, '../src/app.scss'), 'utf8')
const tokenStyle = readFileSync(resolve(__dirname, '../src/styles/_tokens.scss'), 'utf8')
const typographyStyle = readFileSync(resolve(__dirname, '../src/styles/_typography.scss'), 'utf8')
const homeStyle = readFileSync(resolve(__dirname, '../src/pages/index/index.scss'), 'utf8')
const tabBarStyle = readFileSync(resolve(__dirname, '../src/custom-tab-bar/index.wxss'), 'utf8')
const lightAppStyle = appStyle.split('.campus-theme--dark')[0]

const globalFontSizeTokens = [...appStyle.matchAll(
  /--campus-font-size-(auxiliary|body|important-body|card-title|page-title|large-title):\s*(\d+)rpx;/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalFontSizeTokens, {
  auxiliary: 24,
  body: 28,
  'important-body': 30,
  'card-title': 32,
  'page-title': 36,
  'large-title': 40,
}, '全局字号 Token 必须对应 12 / 14 / 15 / 16 / 18 / 20px 六级系统字体规范')

const globalFontWeightTokens = [...appStyle.matchAll(
  /--campus-font-weight-(regular|medium|semibold):\s*(\d+);/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalFontWeightTokens, {
  regular: 400,
  medium: 500,
  semibold: 600,
}, '全局字重 Token 必须仅使用 400 / 500 / 600')

const globalLineHeightTokens = [...appStyle.matchAll(
  /--campus-line-height-(auxiliary|body|important-body|card-title|page-title|large-title):\s*(\d+)rpx;/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalLineHeightTokens, {
  auxiliary: 36,
  body: 44,
  'important-body': 46,
  'card-title': 48,
  'page-title': 54,
  'large-title': 60,
}, '全局行高 Token 必须对应 18 / 22 / 23 / 24 / 27 / 30px')

const globalTextColorTokens = [...lightAppStyle.matchAll(
  /--campus-text-(primary|secondary|auxiliary):\s*var\(--ousea-(ink-\d+)\);/gu,
)].reduce<Record<string, string>>((tokens, match) => ({
  ...tokens,
  [match[1]]: match[2],
}), {})

assert.deepEqual(globalTextColorTokens, {
  primary: 'ink-900',
  secondary: 'ink-500',
  auxiliary: 'ink-300',
}, 'Campus 浅色文本语义必须严格映射 Ousea Ink Token')

assert.match(
  tokenStyle,
  /\$font-family-sans:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,/u,
  '全局字体必须优先使用系统字体栈',
)

for (const [name, size] of Object.entries(globalFontSizeTokens)) {
  assert.match(
    tokenStyle,
    new RegExp(`\\$font-size-${name}:\\s*var\\(--campus-font-size-${name},\\s*${size}rpx\\);`, 'u'),
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
    new RegExp(`\\$line-height-${name}:\\s*var\\(--campus-line-height-${name},\\s*${lineHeight}rpx\\);`, 'u'),
    `Sass Token 必须映射全局行高：${name}`,
  )
}
for (const [name, color] of Object.entries(globalTextColorTokens)) {
  const fallback = {
    'ink-900': '#1a2333',
    'ink-500': '#6b7a90',
    'ink-300': '#a6b2c2',
  }[color]
  assert.match(
    tokenStyle,
    new RegExp(`\\$color-text-${name}:\\s*var\\(--campus-text-${name},\\s*${fallback}\\);`, 'u'),
    `Sass Token 必须映射全局文本颜色：${name}`,
  )
}

assert.doesNotMatch(
  appStyle,
  /font-family:\s*token\.\$font-family-sans;/u,
  '页面根样式不应强制覆盖系统字体',
)
assert.doesNotMatch(
  typographyStyle,
  /@media\s*\(\s*max-width:\s*360px\s*\)/u,
  '全局排版不应包含 360px 小屏字体断点',
)
assert.match(
  typographyStyle,
  /page \.community-post__content,\s*page \.community-detail__body \{ font-size: var\(--ousea-font-size-body, 32rpx\); \}/u,
  '社区列表与详情正文必须使用同一 Ousea 正文字号 Token',
)
assert.match(
  typographyStyle,
  /page \.business-detail-comment__bubble \{ font-size: var\(--ousea-font-size-body\); \}[\s\S]*?page \.business-detail-comment__reply-content \{ font-size: var\(--ousea-font-size-comment\); \}/u,
)

assert.doesNotMatch(homeStyle, /--home-(?:font|text)-/u, '首页不得重复定义全局字体或文本 Token')
assert.doesNotMatch(
  homeStyle,
  /var\(--campus-font-(?:caption|supporting|body|title|display)/u,
  '首页不得继续消费旧版五级字号 Token',
)
for (const name of ['auxiliary', 'body', 'important-body', 'card-title', 'page-title', 'large-title']) {
  assert.match(homeStyle, new RegExp(`var\\(--campus-font-size-${name},`, 'u'), `首页必须消费全局字号 Token：${name}`)
  assert.match(homeStyle, new RegExp(`var\\(--campus-line-height-${name},`, 'u'), `首页必须消费全局行高 Token：${name}`)
}
for (const name of ['regular', 'medium', 'semibold']) {
  assert.match(homeStyle, new RegExp(`var\\(--campus-font-weight-${name},`, 'u'), `首页必须消费全局字重 Token：${name}`)
}
for (const name of ['secondary', 'auxiliary']) {
  assert.match(homeStyle, new RegExp(`var\\(--campus-text-${name},`, 'u'), `首页必须消费全局文本颜色 Token：${name}`)
}

assert.match(
  homeStyle,
  /\.campus \.custom-navbar__title\s*\{[^}]*font-size:\s*var\(--campus-font-size-page-title,\s*36rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-semibold,\s*600\);[^}]*line-height:\s*var\(--campus-line-height-page-title,\s*54rpx\);/u,
  '首页导航标题必须使用 18px / 600 / 27px 页面标题规范',
)
assert.match(
  homeStyle,
  /\.section-heading__title,[\s\S]{0,360}font-size:\s*var\(--campus-font-size-card-title,\s*32rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-medium,\s*500\);[^}]*line-height:\s*var\(--campus-line-height-card-title,\s*48rpx\);/u,
  '首页区块标题必须使用 16px / 500 / 24px 卡片标题规范',
)
assert.match(
  homeStyle,
  /\.schedule-card__course-name,[\s\S]{0,460}font-size:\s*var\(--campus-font-size-important-body,\s*30rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-important-body,\s*46rpx\);/u,
  '首页课程与内容标题必须使用 15px / 400 / 23px 重要正文规范',
)
assert.match(
  homeStyle,
  /\.service-panel__all,[\s\S]{0,900}font-size:\s*var\(--campus-font-size-body,\s*28rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-body,\s*44rpx\);/u,
  '首页说明与操作文字必须使用 14px / 400 / 22px 正文规范',
)
assert.match(
  homeStyle,
  /\.service-panel__grid-name,[\s\S]{0,1200}font-size:\s*var\(--campus-font-size-auxiliary,\s*24rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-auxiliary,\s*36rpx\);/u,
  '首页服务名称与元信息必须使用 12px / 400 / 18px 辅助信息规范',
)
assert.match(
  homeStyle,
  /\.hero-card[\s\S]{0,1100}&__title\s*\{[^}]*font-size:\s*var\(--campus-font-size-large-title,\s*40rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-semibold,\s*600\);[^}]*line-height:\s*var\(--campus-line-height-large-title,\s*60rpx\);/u,
  '首页 Hero 必须使用 20px / 600 / 30px 大标题规范',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*color:\s*var\(--campus-text-muted,\s*#a6b2c2\);[^}]*font-family:\s*system-ui,[^}]*font-size:\s*var\(--campus-font-size-auxiliary,\s*24rpx\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-auxiliary,\s*36rpx\);/u,
  'TabBar 必须使用系统字体与完整辅助信息规范',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__item--active \.tab-bar__text\s*\{[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  'TabBar 激活态必须保持 400，只用颜色和图标表达选中',
)
assert.match(
  homeStyle,
  /\.news-card__title,[\s\S]{0,300}font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  '首页社区内容标题必须保持 400 字重',
)
assert.match(
  homeStyle,
  /\.marketplace-card__placeholder-headline,[\s\S]{0,560}font-weight:\s*var\(--campus-font-weight-regular,\s*400\);/u,
  '首页二手内容标题必须保持 400 字重',
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
