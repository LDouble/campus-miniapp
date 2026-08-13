export type DayViewClassroom<T> = {
  classroom: T
  /** The building name is kept outside the classroom payload for API flexibility. */
  building: string
  available_sections: readonly number[]
}

export type DayViewBuildingGroup<T> = {
  building: string
  classrooms: readonly DayViewClassroom<T>[]
}

/** Normalizes the only nullable collection returned by the day-availability API. */
export const normalizeDayAvailabilityGroups = <T extends { available_sections?: readonly number[] | null }>(
  groups: readonly { building: string; classrooms?: readonly T[] | null }[] | null | undefined,
) => (Array.isArray(groups) ? groups : []).map((group) => ({
  ...group,
  classrooms: (Array.isArray(group?.classrooms) ? group.classrooms : []).map((item) => ({
    ...item,
    available_sections: Array.isArray(item?.available_sections) ? item.available_sections : [],
  })),
}))

/**
 * Returns the stable, bounded section set for one classroom. Invalid values,
 * duplicates and sections outside the requested day range are omitted.
 */
export const normalizeAvailableSections = (
  sections: readonly number[] | null | undefined,
  maxSection = 12,
) => {
  if (!Number.isInteger(maxSection) || maxSection < 1) return []
  const candidates = Array.isArray(sections) ? sections : []
  return [...new Set(candidates.filter((section) => (
    Number.isInteger(section) && section >= 1 && section <= maxSection
  )))].sort((left, right) => left - right)
}

/** Filters day-view groups locally; an empty value or `all` means every building. */
export const filterDayViewBuilding = <T extends { building: string }>(
  groups: readonly T[],
  building?: string,
) => {
  const selected = building?.trim()
  if (!selected || selected === 'all') return groups
  return groups.filter((group) => group.building === selected)
}

/** Formats consecutive available sections, e.g. [1, 2, 5] as `1—2节、5节`. */
export const formatAvailableSectionRanges = (
  sections: readonly number[] | null | undefined,
  maxSection = 12,
) => {
  const normalized = normalizeAvailableSections(sections, maxSection)
  if (normalized.length === 0) return '暂无空闲时段'

  const ranges: string[] = []
  let start = normalized[0]
  let end = start
  for (const section of normalized.slice(1)) {
    if (section === end + 1) {
      end = section
      continue
    }
    ranges.push(start === end ? `${start}节` : `${start}—${end}节`)
    start = section
    end = section
  }
  ranges.push(start === end ? `${start}节` : `${start}—${end}节`)
  return ranges.join('、')
}
