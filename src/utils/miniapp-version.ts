import Taro from '@tarojs/taro'
import { normalizeMiniappVersion } from './miniapp-version-value'

export { normalizeMiniappVersion } from './miniapp-version-value'

const compiledMiniappVersion = () => (
  typeof __CAMPUS_MINIAPP_VERSION__ === 'string'
    ? normalizeMiniappVersion(__CAMPUS_MINIAPP_VERSION__)
    : ''
)

/** getMiniappVersion 优先返回构建注入版本，未设置时回退微信运行时版本。 */
export const getMiniappVersion = () => {
  const compiled = compiledMiniappVersion()
  if (compiled) return compiled
  try {
    return normalizeMiniappVersion(Taro.getAccountInfoSync().miniProgram?.version)
  } catch {
    return ''
  }
}

/** miniappVersionCacheScope 返回用于隔离版本相关本地缓存的稳定作用域。 */
export const miniappVersionCacheScope = (version = getMiniappVersion()) => (
  version ? `version:${encodeURIComponent(version)}` : 'unversioned'
)
