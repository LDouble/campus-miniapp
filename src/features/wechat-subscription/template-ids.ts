const MAX_TEMPLATE_IDS = 3

export const normalizeWechatSubscribeTemplateIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const ids = value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 128)

  return Array.from(new Set(ids)).slice(0, MAX_TEMPLATE_IDS)
}

// 保留纯字符串解析器供配置迁移和 smoke test 使用。
export const parseWechatSubscribeTemplateIds = (value: string): string[] => {
  return normalizeWechatSubscribeTemplateIds(value.split(','))
}
