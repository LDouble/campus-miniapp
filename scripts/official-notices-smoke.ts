import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseOfficialNoticeMarkdown } from '../src/features/official-notices/markdown'

const blocks = parseOfficialNoticeMarkdown([
  '# 重要安排',
  '',
  '请于 **8 月 20 日** 前完成。',
  '- 下载附件',
  '> 以学校原文为准',
  '[学校原文](https://jwc.ouc.edu.cn/example.htm)',
].join('\n'))

assert.deepEqual(blocks.map((item) => item.kind), [
  'heading',
  'paragraph',
  'list',
  'quote',
  'paragraph',
])
assert.equal(blocks[1].text, '请于 8 月 20 日 前完成。')
assert.match(blocks[4].text, /https:\/\/jwc\.ouc\.edu\.cn/)

const repositorySource = readFileSync(
  resolve(__dirname, '../src/features/official-notices/repository.ts'),
  'utf8',
)
assert.ok(
  !repositorySource.includes('anonymous: true'),
  '公开通知仍需静默微信会话以获得 guest 权限，不能绕过后端鉴权',
)
assert.equal(
  (repositorySource.match(/skipAcademicVerificationGuard: true/g) || []).length,
  2,
  '通知列表和详情不得触发学籍绑定守卫',
)

const appConfigSource = readFileSync(resolve(__dirname, '../src/app.config.ts'), 'utf8')
assert.ok(appConfigSource.includes("'pages/official-notices/index'"))
assert.ok(appConfigSource.includes("'pages/official-notices/detail'"))

const homeSource = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
assert.ok(homeSource.includes('pageSize: 2'), '首页只应获取两条最新全校通知')
assert.ok(homeSource.includes("'/pages/official-notices/index'"), '首页应提供全校通知固定入口')

process.stdout.write('official notices smoke: ok\n')
