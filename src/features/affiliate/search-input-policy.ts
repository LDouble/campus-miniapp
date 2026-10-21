export type AffiliateSearchInputRoute =
  | { type: 'empty' }
  | { type: 'keyword'; keyword: string }
  | { type: 'resolve'; content: string; reason: 'url' | 'taokouling' | 'share' }
  | { type: 'too_long'; reason: 'keyword' | 'content' }

type AffiliateSearchInputActions = {
  search: (keyword: string) => void
  resolve: (content: string) => void
}

const MAX_SEARCH_KEYWORD_LENGTH = 100
const MAX_RESOLVE_CONTENT_LENGTH = 2048
const URL_SCHEME_PATTERN = /\b(?:https?|ftp|taobao|tmall|tbopen):/iu
const URL_LIKE_SCHEME_PATTERN = /\b[a-z][a-z\d+.-]*:\/\/\S*/iu
const WEB_PREFIX_PATTERN = /(?:^|[\s([{])www\./iu
const BARE_DOMAIN_PATTERN = /(?:^|[\s([{])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}(?::\d{1,5})?(?:[/?#]\S*)?(?=$|[\s)\]},>"'])/iu
const TAOBAO_DOMAIN_PATTERN = /(?:^|[\s(])(?:m\.)?tb\.cn(?:\/|$)|(?:item|detail|uland|s)\.(?:taobao|tmall)\.com(?:\/|$)/iu
const TAO_TOKEN_PATTERN = /[￥¥€₤₳]\s*[a-z0-9_-]{6,32}\s*[￥¥€₤₳]/iu
const SHARE_TEXT_PATTERN = /淘口令|复制(?:这条信息|淘口令|口令)|打开(?:手机)?(?:淘宝|天猫)|长按复制/iu

/** classifyAffiliateSearchInput 将可识别的商品分享输入路由到受控解析，并限制关键词长度。 */
export const classifyAffiliateSearchInput = (input: string): AffiliateSearchInputRoute => {
  const content = input.trim()
  const contentLength = Array.from(content).length
  if (!content) return { type: 'empty' }
  if (contentLength > MAX_RESOLVE_CONTENT_LENGTH) return { type: 'too_long', reason: 'content' }

  if (URL_SCHEME_PATTERN.test(content)
    || URL_LIKE_SCHEME_PATTERN.test(content)
    || WEB_PREFIX_PATTERN.test(content)
    || BARE_DOMAIN_PATTERN.test(content)
    || TAOBAO_DOMAIN_PATTERN.test(content)) {
    return { type: 'resolve', content, reason: 'url' }
  }
  if (SHARE_TEXT_PATTERN.test(content)) {
    return { type: 'resolve', content, reason: 'share' }
  }
  if (TAO_TOKEN_PATTERN.test(content)) {
    return { type: 'resolve', content, reason: 'taokouling' }
  }
  if (contentLength > MAX_SEARCH_KEYWORD_LENGTH) return { type: 'too_long', reason: 'keyword' }
  return { type: 'keyword', keyword: content }
}

/** dispatchAffiliateSearchInput 确保链接或分享内容不会被提交到商品关键词搜索。 */
export const dispatchAffiliateSearchInput = (
  input: string,
  actions: AffiliateSearchInputActions,
): AffiliateSearchInputRoute => {
  const route = classifyAffiliateSearchInput(input)
  if (route.type === 'keyword') actions.search(route.keyword)
  if (route.type === 'resolve') actions.resolve(route.content)
  return route
}
