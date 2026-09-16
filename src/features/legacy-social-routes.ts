// 2026-08-25 社交页面迁回主包前已对外发布的路径。
export const legacySocialPages = ['community/detail', 'community/topic/index', 'publish/index', 'my-services/index', 'errands/detail', 'marketplace/detail', 'carpool/detail', 'content-report/index', 'direct-messages/index', 'direct-messages/chat'] as const

export const normalizeLegacySocialPath = (path: string) => {
  const [pathname] = path.split('?')
  const page = pathname.replace(/^\/packages\/social\//, '')
  if (!pathname.startsWith('/packages/social/')
    || !(legacySocialPages as readonly string[]).includes(page)) return path
  return path.replace('/packages/social/', '/pages/')
}

export const legacySocialTargetUrl = (page: string, query: Record<string, string | undefined>) => {
  const search = Object.entries(query)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `/pages/${page}${search ? `?${search}` : ''}`
}
