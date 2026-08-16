import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type ThemeDefinition = {
  light: Record<string, string>
  dark: Record<string, string>
}

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const theme = JSON.parse(read('src/theme.json')) as ThemeDefinition
const appConfig = read('src/app.config.ts')
const appStyle = read('src/app.scss')
const darkModeStyle = read('src/styles/_dark-mode.scss')
const tokens = read('src/styles/_tokens.scss')
const tabBarStyle = read('src/custom-tab-bar/index.wxss')

const requiredThemeKeys = [
  'navigationBarBackgroundColor',
  'navigationBarTextStyle',
  'backgroundColor',
  'backgroundTextStyle',
  'tabBarColor',
  'tabBarSelectedColor',
  'tabBarBackgroundColor',
  'tabBarBorderStyle',
]

assert.match(appConfig, /darkmode:\s*true/u)
assert.match(appConfig, /themeLocation:\s*'theme\.json'/u)
assert.match(appConfig, /navigationBarBackgroundColor:\s*'@navigationBarBackgroundColor'/u)
assert.match(appConfig, /backgroundColor:\s*'@backgroundColor'/u)
assert.match(appConfig, /backgroundTextStyle:\s*'@backgroundTextStyle'/u)

for (const key of requiredThemeKeys) {
  assert.ok(theme.light[key], `浅色主题缺少 ${key}`)
  assert.ok(theme.dark[key], `暗色主题缺少 ${key}`)
}

assert.notEqual(theme.light.backgroundColor, theme.dark.backgroundColor)
assert.notEqual(theme.light.navigationBarTextStyle, theme.dark.navigationBarTextStyle)
assert.match(appStyle, /@media \(prefers-color-scheme: dark\)/u)
assert.match(appStyle, /--campus-surface:\s*#111827/u)
assert.match(appStyle, /--campus-icon-surface-orange:\s*#3a291a/u)
assert.match(tokens, /\$color-on-accent:\s*#fff/u)
assert.doesNotMatch(tokens, /\$color-on-accent:\s*var\(--campus-surface/u)
assert.match(tabBarStyle, /@media \(prefers-color-scheme: dark\)/u)
assert.match(darkModeStyle, /page \.icon-button > image/u)
assert.match(darkModeStyle, /page \.service-panel__grid-icon/u)
assert.match(darkModeStyle, /page \.errand-card,/u)
assert.match(darkModeStyle, /page \.errand-route,/u)
assert.match(darkModeStyle, /page \.marketplace-card__placeholder/u)
assert.match(darkModeStyle, /page \.life-primary-tabs__inner/u)
assert.match(darkModeStyle, /page \.life-primary-tabs__item--active/u)
assert.match(darkModeStyle, /page \.community-root-tabs__item--active/u)
assert.match(darkModeStyle, /page \.community-page__search-action/u)
assert.match(darkModeStyle, /page \.api-community__filter/u)
assert.match(darkModeStyle, /page \.community-feed-skeleton__line/u)
assert.match(darkModeStyle, /page \.fresh-barrage__item/u)
assert.match(darkModeStyle, /page \.community-level-badge--gold/u)
assert.match(darkModeStyle, /page \.community-topic-hero/u)
assert.match(darkModeStyle, /page \.community-detail-card__review/u)
assert.match(darkModeStyle, /page \.bottom-sheet-layer/u)
assert.match(darkModeStyle, /page \.academic-sheet,/u)
assert.match(darkModeStyle, /page \.period-options__item--active/u)
assert.match(darkModeStyle, /page \.grade-summary,/u)
assert.match(darkModeStyle, /page \.shuttle-detail-panel/u)
assert.match(darkModeStyle, /page \.shuttle-detail-actions/u)
assert.match(darkModeStyle, /page \.calendar-hero,/u)
assert.doesNotMatch(darkModeStyle, /page\s+image\s*\{/u, '不能全局反色用户上传的图片')

const pageConfigPaths = require('node:child_process')
  .execFileSync('rg', ['--files', 'src/pages', '-g', '*.config.ts'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)

for (const path of pageConfigPaths) {
  const source = read(path)
  if (/backgroundColor:/u.test(source)) {
    assert.match(source, /backgroundColor:\s*'@backgroundColor'/u, `${path} 未使用主题背景变量`)
  }
  if (/backgroundTextStyle:/u.test(source)) {
    assert.match(
      source,
      /backgroundTextStyle:\s*'@backgroundTextStyle'/u,
      `${path} 未使用主题下拉刷新变量`,
    )
  }
}

const parseHex = (value: string): [number, number, number] => {
  const normalized = value.replace('#', '')
  assert.equal(normalized.length, 6, `无法解析颜色：${value}`)
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number]
}

const luminance = (value: string) => {
  const channels = parseHex(value).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const contrast = (foreground: string, background: string) => {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

assert.ok(contrast('#f8fafc', '#111827') >= 4.5, '暗色标题与卡片背景对比度不足')
assert.ok(contrast('#d7e0ec', '#111827') >= 4.5, '暗色正文与卡片背景对比度不足')
assert.ok(contrast('#8494aa', '#0b1220') >= 4.5, '暗色辅助文字与页面背景对比度不足')
assert.ok(contrast('#aab8ca', '#172033') >= 4.5, '暗色社区未选中标签对比度不足')
assert.ok(contrast('#ffffff', '#0e7490') >= 4.5, '暗色社区选中标签对比度不足')
assert.ok(contrast('#ffffff', '#2563eb') >= 4.5, '暗色社区主操作文字对比度不足')
assert.ok(contrast('#fde68a', '#38331a') >= 4.5, '暗色社区等级徽章对比度不足')
assert.ok(contrast('#ffffff', '#1d4ed8') >= 4.5, '暗色学业与校车头图文字对比度不足')
assert.ok(contrast('#93c5fd', '#172554') >= 4.5, '暗色浮层选项文字对比度不足')

console.log('dark mode smoke: ok')
