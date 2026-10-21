import { strict as assert } from 'node:assert'
import Module = require('node:module')

// 用组件真实回调验证可见性和加载顺序，原生广告网络行为另由模拟器核对。
const loader = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let refIndex = 0
let refs: Array<{ current: unknown }> = []
let effects: Array<() => void | (() => void)> = []
const ticks: Array<() => void> = []
loader._load = function (name, ...args) {
  if (name === 'react/jsx-runtime') {
    const jsx = (type, props) => ({ type, props })
    return { jsx, jsxs: jsx }
  }
  if (name === 'react') return {
    useCallback: (callback) => callback,
    useRef: (value: unknown) => refs[refIndex++] ||= { current: value },
    useEffect: (callback: () => void | (() => void)) => { effects.push(callback) },
  }
  if (name === '@tarojs/taro') return { __esModule: true, default: { nextTick: (callback) => ticks.push(callback) } }
  if (name === '@tarojs/components') return { View: 'View', Text: 'Text', Image: 'Image', AdCustom: 'AdCustom' }
  if (/\.(svg|png|scss)$/.test(name)) return name
  return originalLoad.call(this, name, ...args)
}
const Popup = require('../src/features/member-ad-popup/popup').default
loader._load = originalLoad
const findAd = (element): any => {
  if (!element || typeof element !== 'object') return null
  if (element.type === 'AdCustom') return element
  return [element.props?.children].flat(Infinity).map(findAd).find(Boolean)
}
let ready = 0
let closed = 0
let presented = 0
const onReady = () => { ready++ }
const onClose = () => { closed++ }
const onPresented = () => { presented++ }
const render = (visible = false) => {
  refIndex = 0
  return Popup({ visible, onReady, onPresented, onClose })
}
let tree = render()
assert.equal(tree.props.className.includes('member-ad-popup--preparing'), true, 'adLoad 前浮层必须不可见且不拦截用户操作')
const ad = findAd(tree)
assert.ok(ad, '准备阶段必须挂载同一个广告组件才能接收 adLoad')
ad.props.onLoad()
assert.equal(ready, 1, '只有广告加载事件才通知首页准备完成')
ad.props.onLoad()
assert.equal(ready, 1, '重复加载事件不得重复弹出')
tree = render(true)
assert.equal(tree.props.className.includes('member-ad-popup--preparing'), false, '首页允许展示后应显示浮层')
ad.props.onError()
ad.props.onLoad()
assert.equal(closed, 1)
assert.equal(ready, 1, '错误后的迟到回调不得重新展示')

refs = []; effects = []; ready = 0; closed = 0
let timeout: (() => void) | undefined
const originalSetTimeout = global.setTimeout
const originalClearTimeout = global.clearTimeout
global.setTimeout = ((callback) => { timeout = callback; return 1 }) as unknown as typeof setTimeout
global.clearTimeout = (() => {}) as unknown as typeof clearTimeout
try {
  tree = render()
  const cleanups = effects.map((effect) => effect())
  timeout?.()
  assert.equal(closed, 1, '加载超时必须结束准备状态')
  findAd(tree).props.onLoad()
  assert.equal(ready, 0, '超时后迟到加载事件不能弹出')
  cleanups.forEach((cleanup) => cleanup?.())
  refs = []; effects = []; ready = 0; closed = 0
  tree = render()
  const unmount = effects.map((effect) => effect())
  unmount.forEach((cleanup) => cleanup?.())
  findAd(tree).props.onLoad()
  assert.equal(ready, 0, '离页卸载后的加载事件不能弹出')

  refs = []; effects = []; ticks.length = 0; presented = 0
  tree = render(false)
  effects.splice(0).forEach((effect) => effect())
  findAd(tree).props.onLoad()
  tree = render(false)
  effects.splice(0).forEach((effect) => effect())
  ticks.splice(0).forEach((tick) => tick())
  assert.equal(presented, 0, '广告已加载但被其他弹层挡住时不计频控')
  tree = render(true)
  effects.splice(0).forEach((effect) => effect())
  assert.equal(presented, 0, '提交原生可见状态前不能记时')
  render(false)
  ticks.splice(0).forEach((tick) => tick())
  assert.equal(presented, 0, '可见状态尚未提交便被阻挡时不计频控')
  tree = render(true)
  effects.splice(0).forEach((effect) => effect())
  ticks.splice(0).forEach((tick) => tick())
  assert.equal(presented, 1, '真正提交可见状态后记录一次展示')
  render(true)
  effects.splice(0).forEach((effect) => effect())
  ticks.splice(0).forEach((tick) => tick())
  assert.equal(presented, 1, '重复渲染不得延长本次冷却时间')
} finally {
  global.setTimeout = originalSetTimeout
  global.clearTimeout = originalClearTimeout
}
console.log('广告加载：隐藏准备、load 后展示、重复事件、失败、超时、卸载及实际展示记时检查通过')
