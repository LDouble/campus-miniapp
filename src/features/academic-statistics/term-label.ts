export type AcademicStatisticsTermPoint = {
  term_code: string
  term_label?: string | null
  education_level?: string | null
  period_id?: string | null
}

const seasonByTermSuffix: Record<string, string> = {
  '1': '夏',
  '2': '秋',
  '3': '春',
}

export const formatAcademicStatisticsTerm = (
  point: AcademicStatisticsTermPoint,
) => {
  const termLabel = point.term_label?.trim()
  if (termLabel) return termLabel

  const parts = point.term_code.split('-')
  if (parts.length !== 3) return point.term_code

  const season = seasonByTermSuffix[parts[2]]
  if (!season) return point.term_code

  return `${parts[0].slice(-2)}-${parts[1].slice(-2)} ${season}`
}

export const academicStatisticsTermKey = (
  point: AcademicStatisticsTermPoint,
) => (
  `${point.education_level || 'unknown'}:${point.period_id || point.term_code}`
)
