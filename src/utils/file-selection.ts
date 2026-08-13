export const getSelectedTempFiles = <T>(
  result: { tempFiles?: T[] } | null | undefined,
): T[] => (
  Array.isArray(result?.tempFiles) ? result.tempFiles : []
)
