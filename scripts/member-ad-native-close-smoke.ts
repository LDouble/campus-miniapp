import { strict as assert } from 'node:assert'
import Module = require('node:module')

const loader = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let refIndex = 0
let nativeClosedState = false
const refs: Array<{ current: unknown }> = []
const ticks: Array<() => void> = []
const effects: Array<() => void | (() => void)> = []
const cleanups: Array<() => void> = []
let queryRect = { left: 20, top: 30, right: 300, bottom: 180, width: 280, height: 150 }
loader._load = function (name, ...args) {
  if (name === 'react/jsx-runtime') {
    const jsx = (type, props) => ({ type, props })
    return { jsx, jsxs: jsx }
  }
  if (name === 'react') return {
    useCallback: (callback) => callback,
    useRef: (value: unknown) => refs[refIndex++] ||= { current: value },
    useEffect: (callback) => effects.push(callback),
    useState: () => [nativeClosedState, (value) => { nativeClosedState = value }],
  }
  if (name === '@tarojs/taro') return { __esModule: true, default: {
    nextTick: (callback) => ticks.push(callback),
    createSelectorQuery: () => {
      let callback: ((rect: unknown) => void) | null = null
      const query = {
        select: () => query,
        boundingClientRect: (handler) => { callback = handler; return query },
        exec: () => { callback?.(queryRect) },
      }
      return query
    },
    onWindowResize: () => {},
    offWindowResize: () => {},
  } }
  if (name === '@tarojs/components') return { View: 'View', Text: 'Text', Image: 'Image', AdCustom: 'AdCustom' }
  if (/\.(svg|png|scss)$/.test(name)) return name
  return originalLoad.call(this, name, ...args)
}

const Popup = require('../src/features/member-ad-popup/popup').default
loader._load = originalLoad
const find = (element, predicate): any => {
  if (!element || typeof element !== 'object') return null
  if (predicate(element)) return element
  return [element.props?.children].flat(Infinity).map((child) => find(child, predicate)).find(Boolean)
}
let rewarded = 0
let closed = 0
const render = (visible = true, claiming = false) => {
  refIndex = 0
  return Popup({ visible, claiming, onReady: () => {}, onPresented: () => {}, onClose: () => { closed++ },
    onAdTap: () => { rewarded++ }, rewardCount: 1 })
}
const show = () => { effects.splice(0).forEach((effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) }); while (ticks.length) ticks.shift()?.() }
const reset = () => { nativeClosedState = false; cleanups.splice(0).forEach((cleanup) => cleanup()); effects.length = 0; refs.length = 0; ticks.length = 0; rewarded = 0; closed = 0 }
const getAd = (tree) => find(tree, (element) => element.type === 'AdCustom')
let tree = render()
let ad = getAd(tree)
ad.props.onLoad()
show()
ad.props.onClose()
assert.equal(rewarded, 1, '已加载且可见的原生关闭触发领取')
assert.equal(closed, 0, '领取结果返回前不能销毁会话')
ad.props.onClose()
assert.equal(rewarded, 1, '重复原生关闭只触发一次')
const findRetry = (element) => find(element, (node) => node.props?.className === 'member-ad-popup__retry')
tree = render(true, true)
assert.equal(findRetry(tree), undefined, '领取中不提供重试入口')
tree = render(true, false)
const retry = findRetry(tree)
assert.ok(retry, '失败回到可领取状态后保留重试入口')
retry.props.onClick()
assert.equal(rewarded, 2, '关闭后的重试沿用同一领取回调')
reset()
tree = render(); ad = getAd(tree)
ad.props.onClose()
assert.equal(rewarded, 0, '未加载关闭不奖励')
reset()
tree = render(); ad = getAd(tree); ad.props.onLoad()
tree.props.onClick()
ad.props.onClose()
assert.equal(rewarded, 0, '遮罩关闭及迟到原生事件不奖励')
reset()
tree = render(); ad = getAd(tree); ad.props.onLoad()
ad.props.onError(); ad.props.onClose()
assert.equal(rewarded, 0, '加载错误不能转为奖励')
reset()
tree = render(); ad = getAd(tree); ad.props.onLoad(); render(false)
ad.props.onClose()
assert.equal(rewarded, 0, '隐藏后的关闭不奖励')
console.log('member ad native close smoke: ok')

reset()
