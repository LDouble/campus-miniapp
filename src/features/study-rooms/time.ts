export const STUDY_ROOM_MEMBER_PREVIEW_LIMIT = 8

export const formatStudyDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export const elapsedStudySeconds = (
  accumulatedSeconds: number,
  activeSince: string | null | undefined,
  nowMs = Date.now(),
) => {
  const base = Math.max(0, Math.floor(Number(accumulatedSeconds) || 0))
  if (!activeSince) return base
  const startedAt = new Date(activeSince).getTime()
  if (!Number.isFinite(startedAt) || startedAt >= nowMs) return base
  return base + Math.floor((nowMs - startedAt) / 1000)
}
