export interface ParsedHttpUrl {
  scheme: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  href: string
}

const ABSOLUTE_URL_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/

const normalizePath = (path: string) => {
  const absolute = path.startsWith('/')
  const trailingSlash = path.endsWith('/')
  const output: string[] = []
  path.split('/').forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') {
      output.pop()
      return
    }
    output.push(segment)
  })
  const normalized = `${absolute ? '/' : ''}${output.join('/')}`
  if (!normalized) return '/'
  return trailingSlash && normalized !== '/' ? `${normalized}/` : normalized
}

const parseAuthority = (authority: string) => {
  if (!authority || authority.includes('@')) {
    throw new Error('URL authority is invalid')
  }
  if (authority.startsWith('[')) {
    throw new Error('IPv6 URL is not supported by this session')
  }
  const separator = authority.lastIndexOf(':')
  const hostname = (separator > -1 ? authority.slice(0, separator) : authority)
    .trim()
    .toLowerCase()
  const port = separator > -1 ? authority.slice(separator + 1).trim() : ''
  if (!hostname || (port && !/^\d+$/.test(port))) {
    throw new Error('URL host is invalid')
  }
  return { hostname, port }
}

export const parseHttpUrl = (value: string): ParsedHttpUrl => {
  const matched = ABSOLUTE_URL_PATTERN.exec(value.trim())
  if (!matched) throw new Error('URL must be absolute')
  const scheme = matched[1].toLowerCase()
  if (scheme !== 'http' && scheme !== 'https') {
    throw new Error('URL scheme is not supported')
  }
  const { hostname, port: rawPort } = parseAuthority(matched[2])
  const port = (
    (scheme === 'https' && rawPort === '443')
    || (scheme === 'http' && rawPort === '80')
  ) ? '' : rawPort
  const pathname = normalizePath(matched[3] || '/')
  const search = matched[4] || ''
  const hash = matched[5] || ''
  const authority = `${hostname}${port ? `:${port}` : ''}`
  return {
    scheme,
    hostname,
    port,
    pathname,
    search,
    hash,
    href: `${scheme}://${authority}${pathname}${search}${hash}`,
  }
}

const splitRelativeReference = (reference: string) => {
  const hashIndex = reference.indexOf('#')
  const withoutHash = hashIndex >= 0 ? reference.slice(0, hashIndex) : reference
  const hash = hashIndex >= 0 ? reference.slice(hashIndex) : ''
  const searchIndex = withoutHash.indexOf('?')
  return {
    pathname: searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash,
    search: searchIndex >= 0 ? withoutHash.slice(searchIndex) : '',
    hash,
  }
}

export const resolveHttpUrl = (baseValue: string, referenceValue: string) => {
  const reference = referenceValue.trim()
  if (!reference) throw new Error('redirect location is empty')
  if (ABSOLUTE_URL_PATTERN.test(reference)) return parseHttpUrl(reference).href

  const base = parseHttpUrl(baseValue)
  if (reference.startsWith('//')) {
    return parseHttpUrl(`${base.scheme}:${reference}`).href
  }

  const parts = splitRelativeReference(reference)
  let pathname = parts.pathname
  if (!pathname) pathname = base.pathname
  else if (!pathname.startsWith('/')) {
    const directory = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1)
    pathname = `${directory}${pathname}`
  }
  const normalizedPath = normalizePath(pathname)
  const search = parts.search || (!parts.pathname ? base.search : '')
  const authority = `${base.hostname}${base.port ? `:${base.port}` : ''}`
  return `${base.scheme}://${authority}${normalizedPath}${search}${parts.hash}`
}

export const stripHash = (value: string) => {
  const parsed = parseHttpUrl(value)
  return parsed.href.slice(0, parsed.href.length - parsed.hash.length)
}

export const appendQuery = (
  value: string,
  entries: Array<[string, string]>,
) => {
  const parsed = parseHttpUrl(value)
  const existing = parsed.search.startsWith('?') ? parsed.search.slice(1) : ''
  const values = existing ? existing.split('&').filter(Boolean) : []
  entries.forEach(([name, entry]) => {
    const encodedName = encodeURIComponent(name)
    const prefix = `${encodedName}=`
    const next = `${prefix}${encodeURIComponent(entry)}`
    const index = values.findIndex((item) => (
      item === encodedName || item.startsWith(prefix)
    ))
    if (index >= 0) values[index] = next
    else values.push(next)
  })
  const authority = `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`
  return `${parsed.scheme}://${authority}${parsed.pathname}${values.length ? `?${values.join('&')}` : ''}`
}

