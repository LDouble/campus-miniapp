import { HttpHeaders } from './types'

export const normalizeHeaders = (
  headers: Record<string, unknown> = {},
): HttpHeaders => {
  const result: HttpHeaders = {}
  Object.entries(headers).forEach(([name, value]) => {
    if (value === undefined || value === null) return
    const key = name.toLowerCase()
    const entries = Array.isArray(value)
      ? value.map((entry) => String(entry))
      : [String(value)]
    const current = result[key]
    if (!current) result[key] = entries.length === 1 ? entries[0] : entries
    else {
      result[key] = [
        ...(Array.isArray(current) ? current : [current]),
        ...entries,
      ]
    }
  })
  return result
}

export const mergeHeaders = (...groups: Array<Record<string, unknown>>) => {
  const merged: HttpHeaders = {}
  groups.forEach((group) => {
    const normalized = normalizeHeaders(group)
    Object.entries(normalized).forEach(([name, value]) => {
      const values = Array.isArray(value) ? value : [value]
      const current = merged[name]
      if (!current) merged[name] = values.length === 1 ? values[0] : values
      else {
        merged[name] = [...new Set([
          ...(Array.isArray(current) ? current : [current]),
          ...values,
        ])]
      }
    })
  })
  return merged
}

export const headerValues = (headers: HttpHeaders, name: string) => {
  const value = headers[name.toLowerCase()]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export const firstHeader = (headers: HttpHeaders, name: string) => (
  headerValues(headers, name)[0] || ''
)

