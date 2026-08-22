import { hooks } from '@tarojs/shared'

let installed = false

/**
 * Taro 4.1.11 会为每个页面默认生成 onResize，即使页面没有使用 useResize。
 * 微信开发者工具会为这个空生命周期建立 WindowInfoChanged 监听，页面较多时会
 * 出现「listeners ... possibly causing memory leak」提示。当前项目没有使用
 * useResize，因此在页面配置交给微信前移除这个无效入口，避免创建无用监听。
 */
export const installWechatRuntimeCompat = () => {
  if (installed || process.env.TARO_ENV !== 'weapp') return

  installed = true
  hooks.tap('modifyPageObject', (pageObject) => {
    if (typeof pageObject.onResize === 'function') delete pageObject.onResize
  })
}
