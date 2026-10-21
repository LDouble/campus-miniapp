import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import ts = require('typescript')

const source = ts.createSourceFile(
  'goods-home.tsx',
  readFileSync('src/pages/goods/index.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const variable = (name: string) => {
  let found: ts.VariableDeclaration | undefined
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node
    if (!found) node.forEachChild(visit)
  }
  visit(source)
  assert.ok(found?.initializer, `首页应定义 ${name}`)
  return found!.initializer!.getText(source)
}

const executable = ts.transpileModule([
  `const showShortcutsForCurrentTime = ${variable('showShortcutsForCurrentTime')}`,
  `const loadShortcuts = ${variable('loadShortcuts')}`,
  'return { loadShortcuts }',
].join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

const createHarness = () => {
  const requests: Array<ReturnType<typeof deferred<{ items: Array<{ id: string }> } | null>>> = []
  let shortcuts: Array<{ id: string }> = [{ id: 'previously-visible' }]
  const shortcutRequestRevision = { current: 0 }
  const shortcutDocumentRef = { current: null as { items: Array<{ id: string }> } | null }
  const shortcutTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  const loadAffiliateShortcutDocument = () => {
    const request = deferred<{ items: Array<{ id: string }> } | null>()
    requests.push(request)
    return request.promise
  }
  const setShortcuts = (value: Array<{ id: string }>) => { shortcuts = value }
  const useCallback = (callback: unknown) => callback
  const visibleAffiliateShortcuts = (document: { items: Array<{ id: string }> } | null) => document?.items || []
  const nextAffiliateShortcutBoundary = () => null
  const context = {
    shortcutRequestRevision,
    shortcutDocumentRef,
    shortcutTimerRef,
    loadAffiliateShortcutDocument,
    setShortcuts,
    useCallback,
    visibleAffiliateShortcuts,
    nextAffiliateShortcutBoundary,
    clearTimeout: () => undefined,
    setTimeout: () => 1 as unknown as ReturnType<typeof setTimeout>,
  }
  const { loadShortcuts } = new Function(...Object.keys(context), executable)(...Object.values(context)) as {
    loadShortcuts: () => Promise<void>
  }
  return {
    loadShortcuts,
    resolveRequest: (index: number, document: { items: Array<{ id: string }> } | null) => requests[index].resolve(document),
    get shortcuts() { return shortcuts },
  }
}

const run = async () => {
  const harness = createHarness()
  const initialLoad = harness.loadShortcuts()
  assert.deepEqual(harness.shortcuts, [], '配置刷新发出时应先隐藏旧入口，避免执行过期目标')
  harness.resolveRequest(0, { items: [{ id: 'current' }] })
  await initialLoad
  assert.deepEqual(harness.shortcuts, [{ id: 'current' }], '当前响应成功后恢复最新入口')

  const staleRefresh = harness.loadShortcuts()
  const currentRefresh = harness.loadShortcuts()
  assert.deepEqual(harness.shortcuts, [], '再次刷新期间仍暂时隐藏旧入口')
  harness.resolveRequest(1, { items: [{ id: 'stale' }] })
  await staleRefresh
  assert.deepEqual(harness.shortcuts, [], '较早的刷新响应不能重新显示旧入口')
  harness.resolveRequest(2, { items: [{ id: 'newest' }] })
  await currentRefresh
  assert.deepEqual(harness.shortcuts, [{ id: 'newest' }], '仅最后一次刷新响应可以恢复入口')

  const unavailableRefresh = harness.loadShortcuts()
  harness.resolveRequest(3, null)
  await unavailableRefresh
  assert.deepEqual(harness.shortcuts, [], '无可用配置时保持隐藏')

  console.log('affiliate shortcuts home refresh visibility: ok')
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
