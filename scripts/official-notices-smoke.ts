import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseOfficialNoticeMarkdown } from '../src/features/official-notices/markdown'
import {
  canLoadOfficialNoticeFeed,
  mergeOfficialNoticeFeed,
} from '../src/features/official-notices/feed'

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
  3,
  '通知页码列表、游标列表和详情不得触发学籍绑定守卫',
)
assert.ok(repositorySource.includes("path: '/api/v1/official-notices/feed'"), '通知列表应使用游标 feed 契约')

const feedItems = [
  { id: 1 },
  { id: 2 },
] as Parameters<typeof mergeOfficialNoticeFeed>[0]
const mergedFeed = mergeOfficialNoticeFeed(feedItems, [
  { id: 2 },
  { id: 3 },
] as Parameters<typeof mergeOfficialNoticeFeed>[1])
assert.deepEqual(mergedFeed.map((item) => item.id), [1, 2, 3], '加载更多应按 ID 去重')
assert.equal(canLoadOfficialNoticeFeed(false, true, 'cursor'), true)
assert.equal(canLoadOfficialNoticeFeed(true, true, 'cursor'), false, '并发加载更多必须被阻止')
assert.equal(canLoadOfficialNoticeFeed(false, false, null), false, '末页不得继续请求')

const listPageSource = readFileSync(
  resolve(__dirname, '../src/pages/official-notices/index.tsx'),
  'utf8',
)
assert.ok(listPageSource.includes('officialNoticesRepository.feed({'))
assert.ok(listPageSource.includes('requestVersion.current !== version'), '筛选刷新必须忽略过期响应')
assert.ok(!listPageSource.includes('result.total'), '游标列表不得依赖精确总数')

const appConfigSource = readFileSync(resolve(__dirname, '../src/app.config.ts'), 'utf8')
assert.ok(appConfigSource.includes("'pages/official-notices/index'"))
assert.ok(appConfigSource.includes("'pages/official-notices/detail'"))

const homeSource = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
assert.ok(homeSource.includes('pageSize: 2'), '首页只应获取两条最新全校通知')
assert.ok(homeSource.includes('officialNoticesRepository.feed({'), '首页最新通知不得触发精确总数查询')
assert.ok(homeSource.includes("'/pages/official-notices/index'"), '首页应提供全校通知固定入口')

const detailSource = readFileSync(resolve(__dirname, '../src/pages/official-notices/detail.tsx'), 'utf8')
assert.ok(detailSource.includes('Taro.setClipboardData({ data: target })'), '学校原文应直接复制到剪贴板')
assert.ok(detailSource.includes('复制原文地址'), '详情页应明确说明原文操作是复制地址')
assert.ok(
  !detailSource.includes("openExternal(notice.original_url || '')"),
  '学校原文不得再尝试通过 WebView 打开',
)
assert.ok(detailSource.includes('Taro.downloadFile({ url: target })'), '附件应先下载到本地临时路径')
assert.ok(detailSource.includes('Taro.openDocument({'), '附件应使用微信原生文档预览')
assert.ok(detailSource.includes('showMenu: true'), '原生文档预览应允许用户转发或保存')
assert.ok(detailSource.includes("result.statusCode < 200 || result.statusCode >= 300"), '附件下载应校验 HTTP 状态码')
assert.ok(detailSource.includes("copyAttachmentUrl(target, '打开失败，附件地址已复制')"), '附件打开失败应复制地址兜底')
assert.ok(!detailSource.includes('Taro.navigateTo({ url: `/pages/webview/index?url='), '附件不得再通过 WebView 打开')

process.stdout.write('official notices smoke: ok\n')
