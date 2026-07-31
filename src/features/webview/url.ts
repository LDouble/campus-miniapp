const MAX_WEBVIEW_URL_LENGTH = 2048
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

export const normalizeWebViewUrl = (value?: string) => {
  const normalized = String(value || '').trim()
  if (
    !normalized
    || normalized.length > MAX_WEBVIEW_URL_LENGTH
    || !normalized.toLowerCase().startsWith('https://')
    || /\s/.test(normalized)
  ) {
    return ''
  }

  const target = normalized.slice('https://'.length)
  const authorityEnd = target.search(/[/?#]/)
  const authority = authorityEnd === -1 ? target : target.slice(0, authorityEnd)
  if (!authority || authority.includes('@') || authority.includes('[')) return ''

  const portSeparator = authority.lastIndexOf(':')
  const hostname = portSeparator === -1
    ? authority
    : authority.slice(0, portSeparator)
  const port = portSeparator === -1 ? '' : authority.slice(portSeparator + 1)
  if (
    !hostname.includes('.')
    || hostname.split('.').some((label) => !HOST_LABEL_PATTERN.test(label))
    || (port && (!/^\d{1,5}$/.test(port) || Number(port) > 65535))
  ) {
    return ''
  }
  return normalized
}

export const decodeWebViewUrl = (value?: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const direct = normalizeWebViewUrl(raw)
  if (direct) return direct
  try {
    return normalizeWebViewUrl(decodeURIComponent(raw))
  } catch {
    return ''
  }
}
