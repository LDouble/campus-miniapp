import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8')
const appStyle = read('src/app.scss')
const tokenStyle = read('src/styles/_tokens.scss')
const typographyStyle = read('src/styles/_typography.scss')
const homeStyle = read('src/pages/index/index.scss')
const tabBarStyle = read('src/custom-tab-bar/index.wxss')
const lightAppStyle = appStyle.split('.campus-theme--dark')[0]

const globalFontSizeTokens = [...appStyle.matchAll(
  /--campus-font-size-(auxiliary|body|important-body|card-title|page-title|large-title):\s*(\d+(?:\.\d+)?)PX;/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalFontSizeTokens, {
  auxiliary: 12.58,
  body: 14.67,
  'important-body': 15.72,
  'card-title': 16.77,
  'page-title': 18.86,
  'large-title': 20.96,
}, '全局字号 Token 必须对应小米 14 Ultra 393px 逻辑宽度换算后的固定六级系统字体规范')

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
  /--campus-line-height-(auxiliary|body|important-body|card-title|page-title|large-title):\s*(\d+(?:\.\d+)?)PX;/gu,
)].reduce<Record<string, number>>((tokens, match) => ({
  ...tokens,
  [match[1]]: Number(match[2]),
}), {})

assert.deepEqual(globalLineHeightTokens, {
  auxiliary: 18.86,
  body: 23.06,
  'important-body': 24.1,
  'card-title': 25.15,
  'page-title': 28.3,
  'large-title': 31.44,
}, '全局行高 Token 必须对应 393px 逻辑宽度换算后的固定行高')

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

const fixedOuseaTokens: Record<string, string> = {
  badge: '10.48PX',
  caption: '12.58PX',
  label: '14.15PX',
  comment: '15.72PX',
  body: '16.77PX',
  title: '17.29PX',
}
const fixedOuseaLineHeights: Record<string, string> = {
  badge: '14.67PX',
  caption: '17.61PX',
  label: '19.81PX',
  post: '31.02PX',
  comment: '25.94PX',
  title: '24.21PX',
  ui: '19.91PX',
}
const responsiveOuseaSpaces: Record<string, string> = {
  1: '16rpx',
  2: '24rpx',
  3: '32rpx',
  4: '40rpx',
  5: '64rpx',
}
const fixedOuseaBlockSpaces: Record<string, string> = {
  1: '8.38PX',
  2: '12.58PX',
  3: '16.77PX',
  4: '20.96PX',
  5: '33.54PX',
}

for (const [name, value] of Object.entries(fixedOuseaTokens)) {
  assert.match(appStyle, new RegExp(`--ousea-font-size-${name}:\\s*${value};`, 'u'))
  assert.match(
    tokenStyle,
    new RegExp(`\\$ousea-font-size-${name}:\\s*var\\(--ousea-font-size-${name},\\s*${value}\\);`, 'u'),
  )
}
for (const [name, value] of Object.entries(fixedOuseaLineHeights)) {
  assert.match(appStyle, new RegExp(`--ousea-line-height-${name}:\\s*${value};`, 'u'))
  assert.match(
    tokenStyle,
    new RegExp(`\\$ousea-line-height-${name}:\\s*var\\(--ousea-line-height-${name},\\s*${value}\\);`, 'u'),
  )
}
for (const [name, value] of Object.entries(responsiveOuseaSpaces)) {
  assert.match(appStyle, new RegExp(`--ousea-space-${name}:\\s*${value};`, 'u'))
  assert.match(
    tokenStyle,
    new RegExp(`\\$ousea-space-${name}:\\s*var\\(--ousea-space-${name},\\s*${value}\\);`, 'u'),
  )
}
for (const [name, value] of Object.entries(fixedOuseaBlockSpaces)) {
  assert.match(appStyle, new RegExp(`--ousea-space-block-${name}:\\s*${value};`, 'u'))
  assert.match(
    tokenStyle,
    new RegExp(`\\$ousea-space-block-${name}:\\s*var\\(--ousea-space-block-${name},\\s*${value}\\);`, 'u'),
  )
}

assert.match(
  tokenStyle,
  /\$font-family-sans:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,/u,
  '全局字体必须优先使用系统字体栈',
)
for (const [name, size] of Object.entries(globalFontSizeTokens)) {
  assert.match(
    tokenStyle,
    new RegExp(`\\$font-size-${name}:\\s*var\\(--campus-font-size-${name},\\s*${size}PX\\);`, 'u'),
    `Sass Token 必须映射固定字号：${name}`,
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
    new RegExp(`\\$line-height-${name}:\\s*var\\(--campus-line-height-${name},\\s*${lineHeight}PX\\);`, 'u'),
    `Sass Token 必须映射固定行高：${name}`,
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

assert.match(
  appStyle,
  /font-family:\s*token\.\$font-family-sans;[^}]*font-size:\s*token\.\$font-size-body;[^}]*font-weight:\s*token\.\$font-weight-regular;[^}]*line-height:\s*token\.\$line-height-body;/u,
  '全局默认文字必须使用系统字体与正文完整语义角色',
)
assert.match(
  appStyle,
  /page button\s*\{[^}]*min-block-size:\s*0;[^}]*min-height:\s*0;/u,
  '原生 button 默认最小块尺寸不得参与页面布局',
)
assert.match(
  typographyStyle,
  /page \.community-post__content,\s*page \.community-detail__body \{ font-size: var\(--ousea-font-size-body, 16\.77PX\); \}/u,
  '社区列表与详情正文必须使用同一 Ousea 固定正文字号 Token',
)
assert.match(
  typographyStyle,
  /page \.business-detail-comment__bubble \{ font-size: var\(--ousea-font-size-body\); \}[^]*?page \.business-detail-comment__reply-content \{ font-size: var\(--ousea-font-size-comment\); \}/u,
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
  /\.campus \.custom-navbar__title\s*\{[^}]*font-size:\s*var\(--campus-font-size-page-title,\s*18\.86PX\);[^}]*font-weight:\s*var\(--campus-font-weight-semibold,\s*600\);[^}]*line-height:\s*var\(--campus-line-height-page-title,\s*28\.3PX\);/u,
  '首页导航标题必须使用 18.86PX / 600 / 28.3PX 页面标题规范',
)
assert.match(
  homeStyle,
  /\.section-heading__title,[\s\S]{0,360}font-size:\s*var\(--campus-font-size-card-title,\s*16\.77PX\);[^}]*font-weight:\s*var\(--campus-font-weight-medium,\s*500\);[^}]*line-height:\s*var\(--campus-line-height-card-title,\s*25\.15PX\);/u,
  '首页区块标题必须使用 16.77PX / 500 / 25.15PX 卡片标题规范',
)
assert.match(
  homeStyle,
  /\.schedule-card__course-name,[\s\S]{0,460}font-size:\s*var\(--campus-font-size-important-body,\s*15\.72PX\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-important-body,\s*24\.1PX\);/u,
  '首页课程与内容标题必须使用 15.72PX / 400 / 24.1PX 重要正文规范',
)
assert.match(
  homeStyle,
  /\.service-panel__all,[\s\S]{0,900}font-size:\s*var\(--campus-font-size-body,\s*14\.67PX\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-body,\s*23\.06PX\);/u,
  '首页说明与操作文字必须使用 14.67PX / 400 / 23.06PX 正文规范',
)
assert.match(
  homeStyle,
  /\.service-panel__grid-name,[\s\S]{0,1200}font-size:\s*var\(--campus-font-size-auxiliary,\s*12\.58PX\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-auxiliary,\s*18\.86PX\);/u,
  '首页服务名称与元信息必须使用 12.58PX / 400 / 18.86PX 辅助信息规范',
)
assert.match(
  homeStyle,
  /\.hero-card[\s\S]{0,1100}&__title\s*\{[^}]*font-size:\s*var\(--campus-font-size-large-title,\s*20\.96PX\);[^}]*font-weight:\s*var\(--campus-font-weight-semibold,\s*600\);[^}]*line-height:\s*var\(--campus-line-height-large-title,\s*31\.44PX\);/u,
  '首页 Hero 必须使用 20.96PX / 600 / 31.44PX 大标题规范',
)
assert.match(
  tabBarStyle,
  /\.tab-bar__text\s*\{[^}]*color:\s*var\(--campus-text-muted,\s*#a6b2c2\);[^}]*font-family:\s*system-ui,[^}]*font-size:\s*var\(--campus-font-size-auxiliary,\s*12\.58PX\);[^}]*font-weight:\s*var\(--campus-font-weight-regular,\s*400\);[^}]*line-height:\s*var\(--campus-line-height-auxiliary,\s*18\.86PX\);/u,
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

const stylePaths = execFileSync('rg', ['--files', 'src', '-g', '*.scss', '-g', '*.wxss'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)

for (const path of stylePaths) {
  const source = read(path)
  const sourceWithoutSafeArea = source.replace(
    /(?:^|[;{])[^;{}]*safe-area-inset-(?:top|right|bottom|left)[^;{}]*/gu,
    '',
  )
  assert.doesNotMatch(
    source,
    /(?<![-\w])font-size\s*:\s*[^;{}]*(?:rpx|vw)/u,
    `${path} 的字号不得继续使用 rpx/vw 流体单位`,
  )
  assert.doesNotMatch(
    source,
    /(?<![-\w])line-height\s*:\s*[^;{}]*(?:rpx|vw)/u,
    `${path} 的行高不得继续使用 rpx/vw 流体单位`,
  )
  assert.doesNotMatch(
    sourceWithoutSafeArea,
    /(?<![-\w])(?:margin-top|margin-bottom|padding-top|padding-bottom|row-gap)\s*:\s*[^;{}]*(?:rpx|vw)/u,
    `${path} 的纵向间距不得继续使用 rpx/vw 流体单位`,
  )
  assert.doesNotMatch(
    source,
    /(?<![-\w])(?:font-size|line-height)\s*:\s*[^;{}]*\d+(?:\.\d+)?px\b/u,
    `${path} 的固定文本单位必须写成 PX 以绕过 Taro pxtransform`,
  )
}

process.stdout.write('typography smoke: ok\n')
