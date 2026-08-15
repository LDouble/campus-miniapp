export const normalizeRouteValues = (values: unknown, limit = 8) => {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  values.forEach((value) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) return
    seen.add(key)
    normalized.push(trimmed)
  })
  return normalized.slice(0, limit)
}
