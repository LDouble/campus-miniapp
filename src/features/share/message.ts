const DEFAULT_SHARE_TITLE = '海大校园'
const MAX_SHARE_TITLE_LENGTH = 36

type ShareQueryValue = string | number | boolean | null | undefined

export type CampusShareInput = {
  title?: string
  fallbackTitle?: string
  path: string
  query?: Record<string, ShareQueryValue>
  imageUrl?: string
}

export type CampusShareMessage = {
  title: string
  path: string
  imageUrl?: string
}

const normalizedTitle = (value?: string) => (
  (value || '').replace(/\s+/g, ' ').trim()
)

export const buildSharePath = (
  path: string,
  query: Record<string, ShareQueryValue> = {},
) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  if (!search) return normalizedPath
  return `${normalizedPath}${normalizedPath.includes('?') ? '&' : '?'}${search}`
}

export const buildCampusShareMessage = ({
  title,
  fallbackTitle = DEFAULT_SHARE_TITLE,
  path,
  query,
  imageUrl,
}: CampusShareInput): CampusShareMessage => {
  const safeFallback = normalizedTitle(fallbackTitle) || DEFAULT_SHARE_TITLE
  const safeTitle = normalizedTitle(title) || safeFallback
  const safeImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : ''
  const message: CampusShareMessage = {
    title: safeTitle.slice(0, MAX_SHARE_TITLE_LENGTH),
    path: buildSharePath(path, query),
  }
  return safeImageUrl ? { ...message, imageUrl: safeImageUrl } : message
}
