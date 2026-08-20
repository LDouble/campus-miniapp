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
assert.match(master, /Ousea \/ Global[^。]*唯一基础视觉源/u)
assert.match(master, /不得新建[^。\n]*同义基础 Token/u)
assert.match(agentRules, /All new miniapp UI[^.]*Ousea \/ Global[^.]*single source of truth/u)

process.stdout.write('Ousea design tokens smoke: ok\n')
