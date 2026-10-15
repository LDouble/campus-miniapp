/** createAffiliateImageFallbackState 追踪商品图片来源并忽略旧来源的延迟失败事件。 */
export function createAffiliateImageFallbackState() {
  let currentSource = ''
  let generation = 0
  let failedToken: string | null = null

  const select = (source: string) => {
    if (source !== currentSource) {
      currentSource = source
      generation += 1
      failedToken = null
    }
    return `${generation}:${source}`
  }

  return {
    select,
    isFailed(token: string) {
      return failedToken === token
    },
    markFailed(token: string) {
      if (token !== `${generation}:${currentSource}`) return false
      failedToken = token
      return true
    },
  }
}
