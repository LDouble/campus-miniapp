import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type TokenLeaf = { value: string; type: string }
type TokenTree = TokenLeaf | Record<string, TokenTree>

const tokenJson = JSON.parse(readFileSync(
  resolve(__dirname, '../design-system/campus-miniapp/ousea-design-tokens.json'),
  'utf8',
)) as { global: Record<string, TokenTree> }
const appStyle = readFileSync(resolve(__dirname, '../src/app.scss'), 'utf8')
const sassTokens = readFileSync(resolve(__dirname, '../src/styles/_tokens.scss'), 'utf8')
const master = readFileSync(
  resolve(__dirname, '../design-system/campus-miniapp/MASTER.md'),
  'utf8',
)
const agentRules = readFileSync(resolve(__dirname, '../AGENTS.md'), 'utf8')

const expectedCssVariables: Record<string, string> = {
  '--ousea-lottery-accent': '#ea580c',
  '--ousea-lottery-page': '#faf7f4',
  '--ousea-lottery-warm': '#fff7ed',
  '--ousea-lottery-golden': '#f59e0b',
  '--ousea-lottery-orange': '#f97316',
  '--ousea-lottery-ink': '#1c1917',
  '--ousea-lottery-secondary': '#78716c',
  '--ousea-lottery-muted': '#a8a29e',
  '--ousea-lottery-line': '#f5f5f4',
  '--ousea-cat-sage': '#637b65',
  '--ousea-cat-cream': '#fffbeb',
  '--ousea-cat-paper': '#faf7f2',
  '--ousea-cat-sand': '#f4e7d6',
  '--ousea-cat-line': '#f5f5f4',
  '--ousea-cat-cocoa': '#292524',
  '--ousea-cat-muted': '#847971',
  '--ousea-cat-caramel': '#c86230',
  '--ousea-ocean-50': '#f2f7fe',
  '--ousea-ocean-100': '#e3effe',
  '--ousea-ocean-400': '#4c96f5',
  '--ousea-ocean-500': '#2b7aef',
  '--ousea-ocean-600': '#1d5fd6',
  '--ousea-wave-400': '#38bdf8',
  '--ousea-ink-900': '#1a2333',
  '--ousea-ink-700': '#3a4759',
  '--ousea-ink-500': '#6b7a90',
  '--ousea-ink-300': '#a6b2c2',
  '--ousea-bg-page': '#f5f8fc',
  '--ousea-bg-line': '#e8edf4',
  '--ousea-danger-500': '#e5484d',
  '--ousea-danger-50': '#fdecec',
  '--ousea-like-500': '#f04e6b',
  '--ousea-font-size-badge': '20rpx',
  '--ousea-font-size-caption': '24rpx',
  '--ousea-font-size-label': '27rpx',
  '--ousea-font-size-comment': '30rpx',
  '--ousea-font-size-body': '32rpx',
  '--ousea-font-size-title': '33rpx',
  '--ousea-font-weight-regular': '400',
  '--ousea-font-weight-medium': '500',
  '--ousea-font-weight-semibold': '600',
  '--ousea-font-weight-bold': '700',
  '--ousea-line-height-post': '1.85',
  '--ousea-line-height-comment': '1.65',
  '--ousea-line-height-ui': '1.4',
  '--ousea-space-1': '16rpx',
  '--ousea-space-2': '24rpx',
  '--ousea-space-3': '32rpx',
  '--ousea-space-4': '40rpx',
  '--ousea-space-5': '64rpx',
  '--ousea-radius-pill': '999rpx',
  '--ousea-radius-card-sm': '24rpx',
  '--ousea-radius-card': '32rpx',
  '--ousea-radius-card-lg': '36rpx',
  '--ousea-radius-sheet': '44rpx',
}

const cssVariables = [...appStyle.matchAll(
  /(--ousea-[\w-]+):\s*([^;]+);/gu,
)].reduce<Record<string, string>>((result, match) => ({
  ...result,
  [match[1]]: match[2].trim().toLowerCase(),
}), {})

for (const [name, value] of Object.entries(expectedCssVariables)) {
  assert.equal(cssVariables[name], value, `${name} 必须与 Ousea / Global 源一致`)
  assert.match(
    sassTokens,
    new RegExp(`\\$${name.slice(2)}:\\s*var\\(${name},\\s*${value.replace('.', '\\.')}\\);`, 'u'),
    `${name} 必须有同名 Sass 映射`,
  )
}

assert.equal(
  (tokenJson.global.color as Record<string, Record<string, TokenLeaf>>).ocean['500'].value,
  '#2B7AEF',
  '设计 Token JSON 必须保留 Figma Ousea Ocean 500 原值',
)
assert.equal(
  (tokenJson.global.fontSize as Record<string, TokenLeaf>).label.value,
  '13.5',
  '设计 Token JSON 必须保留 13.5px label 精度',
)

const serviceTokens = (tokenJson.global.color as Record<string, Record<string, TokenLeaf>>).service
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

for (const [key, token] of Object.entries(serviceTokens)) {
  const cssName = `--ousea-service-${key}`
  const value = token.value.toLowerCase()

  assert.equal(cssVariables[cssName], value, `${cssName} 必须与全部服务 Token 源一致`)
  assert.match(
    sassTokens,
    new RegExp(
      `\\$ousea-service-${escapeRegex(key)}:\\s*var\\(${escapeRegex(cssName)},\\s*${escapeRegex(value)}\\);`,
      'u',
    ),
    `${cssName} 必须有同名 Sass 映射`,
  )
}

const serviceShadows = (tokenJson.global.shadow as Record<string, Record<string, TokenLeaf>>).service

for (const [key, token] of Object.entries(serviceShadows)) {
  const cssName = `--ousea-service-shadow-${key}`
  const value = token.value.toLowerCase()

  assert.equal(cssVariables[cssName], value, `${cssName} 必须与全部服务阴影 Token 源一致`)
  assert.match(
    sassTokens,
    new RegExp(
      `\\$ousea-service-shadow-${escapeRegex(key)}:\\s*var\\(${escapeRegex(cssName)},\\s*${escapeRegex(value)}\\);`,
      'u',
    ),
    `${cssName} 必须有同名 Sass 映射`,
  )
}

for (const key of [
  'page-top', 'page-middle', 'page-base', 'surface', 'surface-glass', 'border', 'divider', 'text', 'text-heading', 'text-body', 'text-muted', 'elevated',
  ...['blue', 'green', 'orange'].flatMap((tone) => [`accent-${tone}`, `count-${tone}`]),
  ...['blue', 'green', 'pink', 'purple', 'orange', 'cyan'].flatMap((tone) => [
    `${tone}-start`, `${tone}-end`, `${tone}-border`, `${tone}-foreground`,
  ]),
]) {
  assert.match(
    appStyle,
    new RegExp(`--campus-service-${escapeRegex(key)}:\\s*var\\(--ousea-service-[\\w-]+\\);`, 'u'),
    `全部服务必须提供 --campus-service-${key} 语义令牌`,
  )
}

for (const key of ['card', 'blue', 'green', 'pink', 'purple', 'orange', 'cyan']) {
  assert.match(
    appStyle,
    new RegExp(`--campus-service-shadow-${key}:\\s*var\\(--ousea-service-shadow-[\\w-]+\\);`, 'u'),
    `全部服务必须提供 --campus-service-shadow-${key} 语义令牌`,
  )
}

for (const key of ['blue', 'green', 'pink', 'purple', 'orange', 'cyan']) {
  assert.match(
    appStyle,
    new RegExp(`--campus-service-shadow-category-${key}:\\s*var\\(--ousea-service-shadow-[\\w-]+\\);`, 'u'),
    `全部服务必须提供 --campus-service-shadow-category-${key} 语义令牌`,
  )
}

const todayHotTokens = (tokenJson.global.color as Record<string, Record<string, TokenLeaf>>)['today-hot']

for (const [key, token] of Object.entries(todayHotTokens)) {
  const cssName = `--ousea-today-hot-${key}`
  const value = token.value.toLowerCase()

  assert.equal(cssVariables[cssName], value, `${cssName} 必须与今日上头 Token 源一致`)
  assert.match(
    sassTokens,
    new RegExp(`\\$ousea-today-hot-${escapeRegex(key)}:\\s*var\\(${escapeRegex(cssName)},\\s*${escapeRegex(value)}\\);`, 'u'),
    `${cssName} 必须有同名 Sass 映射`,
  )
}

for (const key of Object.keys(todayHotTokens)) {
  assert.match(
    appStyle,
    new RegExp(`--campus-today-hot-${key}:\\s*var\\(--ousea-today-hot-[\\w-]+\\);`, 'u'),
    `浅色主题必须提供 --campus-today-hot-${key} 语义令牌`,
  )
}

const todayHotShadows = (tokenJson.global.shadow as Record<string, Record<string, TokenLeaf>>)['today-hot']

for (const [key, token] of Object.entries(todayHotShadows)) {
  const cssName = `--ousea-today-hot-shadow-${key}`
  const value = token.value.toLowerCase()

  assert.equal(cssVariables[cssName], value, `${cssName} 必须与今日上头阴影 Token 源一致`)
  assert.match(
    sassTokens,
    new RegExp(`\\$ousea-today-hot-shadow-${escapeRegex(key)}:\\s*var\\(${escapeRegex(cssName)},`, 'u'),
    `${cssName} 必须有同名 Sass 映射`,
  )
  assert.match(
    appStyle,
    new RegExp(`--campus-today-hot-shadow-${escapeRegex(key)}:\\s*var\\(${escapeRegex(cssName)}\\);`, 'u'),
    `浅色主题必须提供 --campus-today-hot-shadow-${key} 语义令牌`,
  )
}

assert.match(
  appStyle,
  /\.campus-theme--dark\s*\{[\s\S]*--campus-today-hot-surface:\s*var\(--campus-surface\);[\s\S]*--campus-today-hot-label:\s*var\(--campus-text-heading\);[\s\S]*--campus-today-hot-muted:\s*var\(--campus-text-muted\);/u,
  '暗色主题必须复用 Campus 表面、标题与辅助文字语义',
)

assert.match(
  appStyle,
  /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[\s\S]*--campus-service-page-top:\s*var\(--ousea-service-dark-page-top\);/u,
  '系统深色场景必须覆盖全部服务页面令牌',
)
assert.match(master, /global\.color\.service/u)
assert.match(master, /global\.shadow\.service/u)
assert.match(master, /--campus-service-\*/u)
assert.match(master, /Ousea \/ Global[^。]*唯一基础视觉源/u)
assert.match(master, /不得新建[^。\n]*同义基础 Token/u)
assert.match(agentRules, /All new miniapp UI[^.]*Ousea \/ Global[^.]*default design source/u)

for (const [cat, global] of [['page', 'page'], ['surface', 'surface'], ['subtle', 'surface-subtle'], ['border', 'border']]) {
  assert.ok(appStyle.includes(`--campus-cat-${cat}: var(--campus-${global});`), '猫咪图鉴基础表面必须复用全局语义')
}

process.stdout.write('Ousea design tokens smoke: ok\n')
