import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const values = new Map<string, unknown>()
let failRead = false
let failWrite = false
const taro = {
  getStorageSync(key: string) {
    if (failRead) throw new Error('storage read failed')
    return values.get(key)
  },
  setStorageSync(key: string, value: unknown) {
    if (failWrite) throw new Error('storage write failed')
    values.set(key, value)
  },
}

const taroModuleId = require.resolve('@tarojs/taro')
const originalTaroModule = require.cache[taroModuleId]
require.cache[taroModuleId] = {
  id: taroModuleId,
  filename: taroModuleId,
  loaded: true,
  exports: { __esModule: true, default: taro },
  children: [],
  paths: [],
} as NodeModule

const preferencesModuleId = require.resolve('../src/features/service-shortcuts/preferences')
delete require.cache[preferencesModuleId]
const {
  DEFAULT_SHORTCUTS,
  MAX_SHORTCUTS,
  SHORTCUT_STORAGE_KEY,
  moveShortcut,
  normalizeShortcuts,
  readShortcuts,
  saveShortcuts,
}: typeof import('../src/features/service-shortcuts/preferences') = require(preferencesModuleId)

try {
  assert.equal(MAX_SHORTCUTS, 9)
  assert.deepEqual(normalizeShortcuts(undefined), DEFAULT_SHORTCUTS, '非数组输入应回退默认快捷服务')
  assert.deepEqual(normalizeShortcuts([]), [], '用户明确清空快捷服务时不能恢复默认值')

  const moreThanLimit = [
    'community', 'schedule', 'grades', 'exams', 'result',
    'pass-rate', 'course-audit', 'general-education', 'simulation', 'calendar',
  ]
  assert.deepEqual(
    normalizeShortcuts(['unknown', 'community', 'schedule', 'community', 1, ...moreThanLimit.slice(2)]),
    moreThanLimit.slice(0, MAX_SHORTCUTS),
    '未知值、非字符串和重复项应被过滤，并保留用户的首次选择顺序及上限',
  )

  assert.deepEqual(readShortcuts(), DEFAULT_SHORTCUTS, '首次读取应使用默认快捷服务')
  values.set(SHORTCUT_STORAGE_KEY, { version: 2, keys: [] })
  assert.deepEqual(readShortcuts(), DEFAULT_SHORTCUTS, '不兼容版本不能覆盖默认快捷服务')
  values.set(SHORTCUT_STORAGE_KEY, { version: 1, keys: 'schedule' })
  assert.deepEqual(readShortcuts(), DEFAULT_SHORTCUTS, '损坏存储数据不能覆盖默认快捷服务')

  assert.equal(saveShortcuts([]), true)
  assert.deepEqual(readShortcuts(), [], '保存空选择后必须能重新读到空选择')

  assert.equal(saveShortcuts(['what-to-eat', 'schedule', 'grades', 'what-to-eat', 'unknown']), true)
  assert.deepEqual(values.get(SHORTCUT_STORAGE_KEY), {
    version: 1,
    keys: ['what-to-eat', 'schedule', 'grades'],
  }, '持久化数据应带版本并保持归一化后的顺序')
  assert.deepEqual(readShortcuts(), ['what-to-eat', 'schedule', 'grades'], '保存后重新读取必须保持用户排序')

  const persistedBeforeCancel = readShortcuts()
  const cancelledDraft = moveShortcut([...persistedBeforeCancel, 'exams'], 3, 0)
  assert.deepEqual(cancelledDraft, ['exams', 'what-to-eat', 'schedule', 'grades'])
  assert.deepEqual(readShortcuts(), persistedBeforeCancel, '仅编辑草稿且未保存时不得修改已持久化快捷服务')

  const original = ['schedule', 'grades', 'exams']
  assert.deepEqual(moveShortcut(original, 0, 2), ['grades', 'exams', 'schedule'])
  assert.deepEqual(original, ['schedule', 'grades', 'exams'], '移动排序不得修改调用方数组')
  assert.strictEqual(moveShortcut(original, -1, 1), original, '越界起点应保留原数组')
  assert.strictEqual(moveShortcut(original, 1, 3), original, '越界终点应保留原数组')

  const savedBeforeFailure = values.get(SHORTCUT_STORAGE_KEY)
  failWrite = true
  assert.equal(saveShortcuts(['community']), false, '写入失败必须通知调用方')
  assert.equal(values.get(SHORTCUT_STORAGE_KEY), savedBeforeFailure, '写入失败不得替换原有偏好')
  failWrite = false
  failRead = true
  assert.deepEqual(readShortcuts(), DEFAULT_SHORTCUTS, '读取失败应安全回退默认快捷服务')
  failRead = false

  const pageSource = readFileSync(resolve(__dirname, '../src/pages/services/index.tsx'), 'utf8')
  assert.match(pageSource, /setDraft\(\[\.\.\.keys\]\)/u, '进入编辑必须复制已保存值为草稿')
  assert.match(pageSource, /onClick=\{\(\) => setEditing\(false\)\}>取消/u, '取消只退出编辑，不提交草稿')
  assert.match(pageSource, /if \(!saveShortcuts\(draft\)\)/u, '完成编辑需要处理草稿保存失败')

  console.log('service shortcuts smoke: ok')
} finally {
  if (originalTaroModule) require.cache[taroModuleId] = originalTaroModule
  else delete require.cache[taroModuleId]
  delete require.cache[preferencesModuleId]
}
