import { strict as assert } from 'node:assert'
import {
  isAffiliateShortcutActive,
  nextAffiliateShortcutBoundary,
  isSafeAffiliateShortcutImage,
  parseAffiliateShortcutDocument,
  visibleAffiliateShortcuts,
} from '../src/features/affiliate-shortcuts/config'
import {
  createAffiliateShortcutPageSession,
  runAffiliateShortcutCopy,
} from '../src/features/affiliate-shortcuts/page-session'
import { getAffiliateShortcutIconPresentation } from '../src/features/affiliate-shortcuts/icon-policy'

const miniProgramAction = {
  type: 'mini_program',
  app_id: `wx${'a'.repeat(16)}`,
  path: 'pages/index/index?from=campus',
  env_version: 'release',
}

const copyTokenAction = {
  type: 'copy_token',
  copy: {
    page_title: '闪购优惠',
    hero_image_url: 'https://cdn.example.com/hero.png',
    title: '限时优惠',
    description: '打开淘宝领取优惠',
    steps: ['点击复制文案', '打开淘宝并粘贴'],
    target_app: '淘宝',
    content: '￥sample-token￥',
    button_text: '复制文案',
    success_text: '复制成功，请打开淘宝',
  },
}

const item = (id: string, priority: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `入口${id}`,
  icon_url: 'https://cdn.example.com/icon.png',
  enabled: true,
  priority,
  action: miniProgramAction,
  ...overrides,
})

const now = Date.parse('2026-10-19T12:00:00+08:00')
const validDocument = {
  schema_version: 1,
  items: [
    item('same-b', 20),
    item('same-a', 20, { action: copyTokenAction }),
    item('lower-priority', 1),
    item('disabled', 100, { enabled: false }),
    item('not-started', 100, { start_at: '2026-10-19T12:00:01+08:00' }),
    item('ended', 100, { end_at: '2026-10-19T12:00:00+08:00' }),
  ],
}

const parsed = parseAffiliateShortcutDocument(JSON.stringify(validDocument))
assert.ok(parsed, '合法 JSON 配置可解析')
assert.deepEqual(
  visibleAffiliateShortcuts(parsed, now).map(({ id }) => id),
  ['same-a', 'same-b', 'lower-priority'],
  '仅显示当前有效入口，按权重降序并按 ID 稳定排序',
)
assert.equal(parsed.items.find(({ id }) => id === 'same-a')?.action.type, 'copy_token')
assert.equal(isAffiliateShortcutActive(parsed.items[0], now), true)
const endedItem = parsed.items.find(({ id }) => id === 'ended')
assert.ok(endedItem)
assert.equal(isAffiliateShortcutActive(endedItem, now), false)
assert.equal(nextAffiliateShortcutBoundary(parsed, now), Date.parse('2026-10-19T12:00:01+08:00'))

assert.equal(parseAffiliateShortcutDocument(null), null, '缺少配置时不显示入口')
assert.equal(parseAffiliateShortcutDocument('{not-json'), null, '损坏的 JSON 不执行')
assert.equal(parseAffiliateShortcutDocument({ schema_version: 2, items: [] }), null, '未知版本 fail closed')
assert.equal(
  parseAffiliateShortcutDocument({ schema_version: 1, items: [item('duplicate', 1), item('duplicate', 2)] }),
  null,
  '重复入口 ID 不执行',
)
assert.equal(
  parseAffiliateShortcutDocument({ schema_version: 1, items: [item('unsafe', 1, { action: { ...miniProgramAction, path: 'https://example.com' } })] }),
  null,
  '不允许把网页 URL 当作小程序页面路径',
)
assert.equal(
  parseAffiliateShortcutDocument({ schema_version: 1, items: [item('unsafe', 1, { action: { ...miniProgramAction, path: '/pages/index/index' } })] }),
  null,
  '小程序页面路径必须是相对路径',
)
assert.equal(isSafeAffiliateShortcutImage('https://cdn.example.com/icon.png'), true)
assert.equal(isSafeAffiliateShortcutImage('http://cdn.example.com/icon.png'), false)
assert.equal(isSafeAffiliateShortcutImage('javascript:alert(1)'), false)
assert.equal(isSafeAffiliateShortcutImage('https:///missing-host.png'), false)
assert.equal(
  getAffiliateShortcutIconPresentation('javascript:alert(1)', false).src,
  `${process.cwd()}/src/assets/tabbar/goods-active.png`,
  '无效入口图标实际渲染本地好物 PNG 兜底资源',
)
assert.equal(
  getAffiliateShortcutIconPresentation('https://cdn.example.com/icon.png', true).src,
  `${process.cwd()}/src/assets/tabbar/goods-active.png`,
  '远程入口图标加载失败时 Image src 切换为本地 PNG',
)
assert.equal(
  getAffiliateShortcutIconPresentation('https://cdn.example.com/icon.png', false).src,
  'https://cdn.example.com/icon.png',
  '安全的远程入口图标继续作为 Image src 渲染',
)

const thirtyItems = Array.from({ length: 30 }, (_, index) => item(`entry-${index}`, index))
assert.equal(
  parseAffiliateShortcutDocument({ schema_version: 1, items: thirtyItems })?.items.length,
  30,
  '服务端约定的 30 个入口上限可解析',
)
assert.equal(
  parseAffiliateShortcutDocument({ schema_version: 1, items: [...thirtyItems, item('entry-30', 30)] }),
  null,
  '超过 30 个入口时整体 fail closed',
)
assert.equal(
  parseAffiliateShortcutDocument({
    schema_version: 1,
    items: [item('copy-extra-field', 1, { action: { ...copyTokenAction, app_id: miniProgramAction.app_id } })],
  }),
  null,
  '口令动作不接受小程序专属字段',
)
assert.ok(parseAffiliateShortcutDocument({
  schema_version: 1,
  items: [item('copy-newline', 1, {
    action: { ...copyTokenAction, copy: { ...copyTokenAction.copy, content: '第一行\n第二行' } },
  })],
}), '口令文案允许换行')

const copyItem = parseAffiliateShortcutDocument({
  schema_version: 1,
  items: [item('copy-me', 1, { action: copyTokenAction })],
})?.items[0]
assert.ok(copyItem)

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const runSessionAssertions = async () => {
  const copySession = createAffiliateShortcutPageSession()
  copySession.activate()
  const expiringCopy = parseAffiliateShortcutDocument({
    schema_version: 1,
    items: [item('expires-before-copy', 1, {
      end_at: '2026-10-19T12:00:00+08:00',
      action: copyTokenAction,
    })],
  })?.items[0]
  assert.ok(expiringCopy)
  const expiryRevision = copySession.beginCopy()
  assert.notEqual(expiryRevision, null)
  const expiryEvents: string[] = []
  await runAffiliateShortcutCopy({
    session: copySession,
    revision: expiryRevision!,
    loadCurrent: async () => expiringCopy,
    writeClipboard: async () => { expiryEvents.push('clipboard') },
    now: () => Date.parse('2026-10-19T12:00:00+08:00'),
    onUnavailable: () => expiryEvents.push('unavailable'),
    onValidated: () => expiryEvents.push('validated'),
    onCopied: () => expiryEvents.push('copied'),
    onError: () => expiryEvents.push('error'),
    onFinish: () => expiryEvents.push('finished'),
  })
  assert.deepEqual(expiryEvents, ['unavailable', 'finished'], '配置核验等待跨过结束时间后拒绝写剪贴板')

  const pendingConfig = deferred<typeof copyItem | null>()
  const cancelledEvents: string[] = []
  const pendingCopyRevision = copySession.beginCopy()
  assert.notEqual(pendingCopyRevision, null, '页面可见时允许开始复制校验')
  const pendingCopy = runAffiliateShortcutCopy({
    session: copySession,
    revision: pendingCopyRevision!,
    loadCurrent: () => pendingConfig.promise,
    writeClipboard: async () => { cancelledEvents.push('clipboard') },
    onUnavailable: () => cancelledEvents.push('unavailable'),
    onValidated: () => cancelledEvents.push('validated'),
    onCopied: () => cancelledEvents.push('copied'),
    onError: () => cancelledEvents.push('error'),
    onFinish: () => cancelledEvents.push('finished'),
  })
  copySession.deactivate()
  pendingConfig.resolve(copyItem!)
  await pendingCopy
  assert.deepEqual(cancelledEvents, [], '配置请求未完成时离开页面，不写剪贴板、不更新界面')

  copySession.activate()
  const clipboardWrite = deferred<unknown>()
  const clipboardEvents: string[] = []
  const clipboardRevision = copySession.beginCopy()
  assert.notEqual(clipboardRevision, null)
  const pendingClipboardCopy = runAffiliateShortcutCopy({
    session: copySession,
    revision: clipboardRevision!,
    loadCurrent: async () => copyItem!,
    writeClipboard: async () => {
      clipboardEvents.push('clipboard')
      return clipboardWrite.promise
    },
    onUnavailable: () => clipboardEvents.push('unavailable'),
    onValidated: () => clipboardEvents.push('validated'),
    onCopied: () => clipboardEvents.push('copied'),
    onError: () => clipboardEvents.push('error'),
    onFinish: () => clipboardEvents.push('finished'),
  })
  for (let index = 0; index < 5 && !clipboardEvents.includes('clipboard'); index += 1) {
    await Promise.resolve()
  }
  assert.deepEqual(clipboardEvents, ['validated', 'clipboard'], '配置核验后才写入剪贴板')
  copySession.deactivate()
  clipboardWrite.resolve(undefined)
  await pendingClipboardCopy
  assert.deepEqual(clipboardEvents, ['validated', 'clipboard'], '剪贴板等待期间离开页面，不显示成功提示或写入页面状态')

  copySession.activate()
  const lockedRevision = copySession.beginCopy()
  assert.notEqual(lockedRevision, null)
  assert.equal(copySession.beginCopy(), null, '复制请求未结束时不能重复触发')
  copySession.beginLoad()
  assert.equal(copySession.isCopyCurrent(lockedRevision!), false, '重新加载时旧复制请求立即失效')
  copySession.deactivate()
}

void runSessionAssertions().then(() => {
  process.stdout.write('快捷入口配置解析、有效期、稳定排序与会话安全检查通过。\n')
}).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
