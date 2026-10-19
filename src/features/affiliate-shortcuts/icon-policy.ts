import { isSafeAffiliateShortcutImage } from './config'

const fallbackIconSource = require('../../assets/tabbar/goods-active.png') as string

/** getAffiliateShortcutIconPresentation 返回实际 Image src 与是否为本地兜底图标。 */
export const getAffiliateShortcutIconPresentation = (url: string, failed: boolean) => {
  const validUrl = !failed && isSafeAffiliateShortcutImage(url)
  return {
    src: validUrl ? url : fallbackIconSource,
    isFallback: !validUrl,
  }
}
