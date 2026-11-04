import { strict as assert } from 'node:assert'
import Module = require('node:module')

const loader = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let refIndex = 0
const refs: Array<{ current: unknown }> = []
const ticks: Array<() => void> = []
let queryRect = { left: 20, top: 30, right: 300, bottom: 180, width: 280, height: 150 }
loader._load = function (name, ...args) {
  if (name === 'react/jsx-runtime') {
    const jsx = (type, props) => ({ type, props })
    return { jsx, jsxs: jsx }
  }
  if (name === 'react') return {
    useCallback: (callback) => callback,
    useRef: (value: unknown) => refs[refIndex++] ||= { current: value },
    useEffect: () => {},
    useState: (value) => [value, () => {}],
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
const onAdTap = () => { rewarded++ }
const onReady = () => {}
const onClose = () => {}
const render = (visible: boolean) => {
  refIndex = 0
  return Popup({ visible, onReady, onPresented: () => {}, onClose, onAdTap, rewardCount: 1 })
}
const point = (clientX: number, clientY: number) => ({ identifier: 1, clientX, clientY, pageX: clientX, pageY: clientY })
let tree = render(true)
const ad = find(tree, (element) => element.type === 'AdCustom')
const area = find(tree, (element) => String(element.props?.className || '').split(' ').includes('member-ad-popup__ad'))
assert.ok(ad && area)
ad.props.onLoad()

area.props.onClick?.()
assert.equal(rewarded, 0, '普通 click 不可代替已验证热区短触摸')
area.props.onTouchStart({ touches: [point(100, 80)] })
area.props.onTouchEnd({ changedTouches: [point(104, 82)] })
while (ticks.length) ticks.shift()?.()
assert.equal(rewarded, 1, '矩形热区内短触摸领取一次')

area.props.onTouchStart({ touches: [point(100, 80)] })
area.props.onTouchEnd({ changedTouches: [point(320, 82)] })
while (ticks.length) ticks.shift()?.()
assert.equal(rewarded, 1, '热区外结束不领取')

area.props.onTouchStart({ touches: [point(100, 80)] })
area.props.onTouchEnd({ changedTouches: [point(100, 80)] })
tree = render(false)
while (ticks.length) ticks.shift()?.()
assert.equal(rewarded, 1, '隐藏后到达的矩形查询结果作废')

tree = render(true)
const resizedArea = find(tree, (element) => String(element.props?.className || '').split(' ').includes('member-ad-popup__ad'))
queryRect = { left: 40, top: 50, right: 220, bottom: 130, width: 180, height: 80 }
resizedArea.props.onTouchStart({ touches: [point(100, 80)] })
resizedArea.props.onTouchEnd({ changedTouches: [point(100, 80)] })
while (ticks.length) ticks.shift()?.()
assert.equal(rewarded, 2, '释放时重新测量尺寸变化后的广告矩形')

console.log('member ad popup hotspot smoke: ok')
