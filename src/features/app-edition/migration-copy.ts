export type MigrationGuideCopy = {
  target_name: string
  title: string
  description: string
  entry_button_text: string
  open_button_text: string
  hint: string
}

export const DEFAULT_MIGRATION_GUIDE_COPY: MigrationGuideCopy = {
  target_name: '海大校园新版',
  title: '校园生活服务已迁移',
  description: '校园社区、闲置互助、课程资料与社团服务，现已在「海大校园新版」提供。',
  entry_button_text: '查看新版服务',
  open_button_text: '打开新版小程序',
  hint: '将在微信中打开另一小程序',
}

const copyLimits: Record<keyof MigrationGuideCopy, number> = {
  target_name: 30,
  title: 40,
  description: 140,
  entry_button_text: 20,
  open_button_text: 20,
  hint: 50,
}

const normalizeField = (value: unknown, fallback: string, limit: number) => {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized && Array.from(normalized).length <= limit
    ? normalized
    : fallback
}

export const normalizeMigrationGuideCopy = (
  value: unknown,
): MigrationGuideCopy => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const targetName = normalizeField(
    source.target_name,
    DEFAULT_MIGRATION_GUIDE_COPY.target_name,
    copyLimits.target_name,
  )
  const fallbackDescription = targetName === DEFAULT_MIGRATION_GUIDE_COPY.target_name
    ? DEFAULT_MIGRATION_GUIDE_COPY.description
    : `校园社区、闲置互助、课程资料与社团服务，现已在「${targetName}」提供。`

  return {
    target_name: targetName,
    title: normalizeField(
      source.title,
      DEFAULT_MIGRATION_GUIDE_COPY.title,
      copyLimits.title,
    ),
    description: normalizeField(
      source.description,
      fallbackDescription,
      copyLimits.description,
    ),
    entry_button_text: normalizeField(
      source.entry_button_text,
      DEFAULT_MIGRATION_GUIDE_COPY.entry_button_text,
      copyLimits.entry_button_text,
    ),
    open_button_text: normalizeField(
      source.open_button_text,
      DEFAULT_MIGRATION_GUIDE_COPY.open_button_text,
      copyLimits.open_button_text,
    ),
    hint: normalizeField(
      source.hint,
      DEFAULT_MIGRATION_GUIDE_COPY.hint,
      copyLimits.hint,
    ),
  }
}
