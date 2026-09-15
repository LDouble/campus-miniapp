import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const iconPath = '../src/assets/icons/more-horizontal.svg'
const iconSource = readSource(iconPath)

assert.match(iconSource, /viewBox="0 0 24 24"/u)
for (const center of ['6', '12', '18']) {
  assert.match(iconSource, new RegExp(`<circle cx="${center}" cy="12" r="2\\.1" fill="#1D5FD6"\/>`, 'u'))
}

const consumers = [
  '../src/features/community/post-card.tsx',
  '../src/pages/community/detail.tsx',
  '../src/features/life-services/components/errand-card.tsx',
  '../src/features/life-services/components/carpool-card.tsx',
  '../src/features/life-services/components/detail-overflow-actions.tsx',
]

for (const path of consumers) {
  const source = readSource(path)
  assert.match(source, /more-horizontal\.svg/u, `${path} 未复用公共更多图标`)
  assert.match(source, /<Image/u, `${path} 未使用 Taro Image 渲染更多图标`)
  assert.doesNotMatch(source, /••|\.\.\.<\/Text>/u, `${path} 仍在使用字体点号`)
}

const sourcePaths = execFileSync(
  'rg',
  ['--files', 'src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.js', '-g', '*.jsx'],
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
const allSources = sourcePaths.map((path) => readFileSync(resolve(__dirname, '..', path), 'utf8')).join('\n')
assert.doesNotMatch(allSources, /••/u, '源码中不得重新使用字体圆点表达更多操作')
assert.doesNotMatch(allSources, /assets\/community\/(?:detail-more|more)\.svg/u)

assert.equal(existsSync(resolve(__dirname, '../src/assets/community/detail-more.svg')), false)
assert.equal(existsSync(resolve(__dirname, '../src/assets/community/more.svg')), false)

const feedStyle = readSource('../src/features/community/feed-panel.scss')
const listStyle = readSource('../src/features/life-services/list-panel.scss')
const detailStyle = readSource('../src/features/life-services/detail.scss')
const darkStyle = readSource('../src/styles/_dark-mode.scss')

assert.match(feedStyle, /\.community-post__more image \{[^}]*width: 36rpx;[^}]*height: 36rpx;/u)
assert.doesNotMatch(feedStyle, /\.community-post__more text/u)
assert.match(listStyle, /\.business-card-more \{[^}]*width: 36rpx;[^}]*height: 36rpx;[^}]*margin: 9rpx;/u)
assert.match(detailStyle, /\.detail-overflow-actions__trigger image \{[^}]*width: 36rpx;[^}]*height: 36rpx;/u)
assert.doesNotMatch(detailStyle, /\.detail-overflow-actions__trigger text/u)
assert.match(
  darkStyle,
  /& \.community-detail__more image,[\s\S]*?& \.community-post__more image,[\s\S]*?& \.business-card-more,[\s\S]*?& \.detail-overflow-actions__trigger image,/u,
  '公共更多图标缺少暗色模式定向提亮',
)

process.stdout.write('more icon smoke: ok\n')
