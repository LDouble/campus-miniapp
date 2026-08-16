import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appStyle = readFileSync(resolve(__dirname, '../src/app.scss'), 'utf8')
const typographyStyle = readFileSync(resolve(__dirname, '../src/styles/_typography.scss'), 'utf8')

assert.match(appStyle, /--campus-font-caption:\s*22rpx/u)
assert.match(appStyle, /--campus-font-body:\s*28rpx/u)
assert.match(appStyle, /font-size:\s*30rpx/u, '全局默认字号必须保持在 30rpx')
assert.match(typographyStyle, /page \.community-post__content \{ font-size: 30rpx; \}/u)
assert.match(typographyStyle, /page \.community-detail-card__body \{ font-size: 30rpx; \}/u)
assert.match(typographyStyle, /page \.community-detail-comments \.community-comment__content \{ font-size: 28rpx; \}/u)

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
