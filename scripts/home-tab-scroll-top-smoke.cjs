const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
let component
let now = 1000
const scrolls = []
const switches = []
const source = fs.readFileSync('src/custom-tab-bar/index.js', 'utf8').replace(/^import[\s\S]*?from '[^']+'\n/gmu, '')
vm.runInNewContext(source, {
  __CAMPUS_APP_EDITION__: 'full',
  getAffiliateCapabilitySnapshot: () => ({ capabilities: { enabled: true } }),
  refreshAffiliateCapabilities: async () => ({ capabilities: { enabled: true } }),
  Component: value => { component = value },
  Date: { now: () => now },
  getCurrentPages: () => [{ route: 'pages/index/index' }],
  requestWechatSubscriptionForModule() {},
  requestWechatSubscriptionForPublishSection() {},
  wx: { getStorageSync: () => 0, pageScrollTo: value => scrolls.push(value), switchTab: value => switches.push(value) }
})
const instance = { data: { ...component.data }, ...component.methods, setData(value) { Object.assign(this.data, value) } }
const tap = index => instance.switchTab({ currentTarget: { dataset: { index } } })
tap(0)
assert.equal(scrolls.length, 0, '单击不回顶')
now += 200
tap(0)
assert.equal(scrolls.length, 1, '双击回顶')
assert.equal(scrolls[0].scrollTop, 0)
now += 100
tap(0)
assert.equal(scrolls.length, 1, '三击不重复触发')
now += 400
tap(0)
assert.equal(scrolls.length, 1, '超时不算双击')
tap(1)
assert.equal(switches.length, 1, '切换Tab正常导航')
tap(1)
assert.equal(scrolls.length, 2, '社区重复点击仍回顶')
tap(0)
now += 100
tap(0)
assert.equal(scrolls.length, 2, '切回首页不继承旧点击')
component.pageLifetimes.show.call(instance)
now += 100
tap(0)
assert.equal(scrolls.length, 2, '页面重新显示后重置计时')
now += 100
tap(0)
assert.equal(scrolls.length, 3)
console.log('home tab scroll top: ok')

instance.data.selected = 0
tap(2)
assert.equal(switches.at(-1).url, '/pages/messages/index', '移除优惠中心后消息Tab位于第三项')
assert.equal(scrolls.length, 3, '切换消息Tab不会触发首页回顶')
instance.data.selected = 2
tap(3)
assert.equal(switches.at(-1).url, '/pages/profile/index', '我的Tab位于第四项')
