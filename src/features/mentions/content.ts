import type { MentionCandidate } from '../../api/types'

export type MentionContentDeletion = {
  text: string
  cursor: number | null
  removedCandidateIds: number[]
}

const mentionTokenForNickname = (nickname: string) => {
  const normalizedNickname = nickname.trim()
  return normalizedNickname ? `@${normalizedNickname} ` : ''
}

const clampCursor = (content: string, cursor: number) => {
  const normalizedCursor = Number.isFinite(cursor) ? cursor : content.length
  return Math.min(Math.max(0, normalizedCursor), content.length)
}

const mentionTokenRanges = (content: string, nickname: string) => {
  const token = mentionTokenForNickname(nickname)
  if (!token) return []

  const ranges: Array<{ start: number; end: number }> = []
  let searchStart = 0
  while (searchStart < content.length) {
    const start = content.indexOf(token, searchStart)
    if (start < 0) break
    ranges.push({ start, end: start + token.length })
    searchStart = start + token.length
  }

  // Submitted content is trimmed, so the final mention may no longer have
  // the separator that is present while editing.
  const compactToken = token.slice(0, -1)
  if (compactToken && content.endsWith(compactToken)) {
    const start = content.length - compactToken.length
    if (!ranges.some((range) => range.start === start)) {
      ranges.push({ start, end: content.length })
    }
  }
  return ranges
}

const removeRanges = (
  content: string,
  ranges: Array<{ start: number; end: number }>,
) => ranges
  .slice()
  .sort((left, right) => right.start - left.start)
  .reduce((current, range) => `${current.slice(0, range.start)}${current.slice(range.end)}`, content)

const mergeRanges = (ranges: Array<{ start: number; end: number }>) => {
  const merged: Array<{ start: number; end: number }> = []
  ranges
    .slice()
    .sort((left, right) => left.start - right.start)
    .forEach((range) => {
      const previous = merged[merged.length - 1]
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end)
        return
      }
      merged.push({ ...range })
    })
  return merged
}

const pureDeletionRange = (previous: string, next: string) => {
  if (next.length >= previous.length) return null

  let start = 0
  while (start < next.length && previous[start] === next[start]) start += 1

  let previousEnd = previous.length
  let nextEnd = next.length
  while (
    previousEnd > start
    && nextEnd > start
    && previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd -= 1
    nextEnd -= 1
  }

  if (`${previous.slice(0, start)}${previous.slice(previousEnd)}` !== next) return null
  return { start, end: previousEnd }
}

const containsMentionToken = (content: string, nickname: string) => (
  mentionTokenRanges(content, nickname).length > 0
)

export const insertMentionToken = (
  content: string,
  nickname: string,
  selectionStart = content.length,
  selectionEnd = selectionStart,
): { text: string; cursor: number } => {
  const source = typeof content === 'string' ? content : ''
  const start = Math.min(Math.max(0, selectionStart), source.length)
  const end = Math.min(Math.max(start, selectionEnd), source.length)
  const token = mentionTokenForNickname(nickname)
  if (!token) return { text: source, cursor: start }

  return {
    text: `${source.slice(0, start)}${token}${source.slice(end)}`,
    cursor: start + token.length,
  }
}

export const removeMentionTokens = (
  content: string,
  nickname: string,
  cursor = content.length,
): { text: string; cursor: number } => {
  const source = typeof content === 'string' ? content : ''
  const currentCursor = clampCursor(source, cursor)
  const ranges = mentionTokenRanges(source, nickname)
  if (ranges.length === 0) return { text: source, cursor: currentCursor }

  const removedBeforeCursor = ranges.reduce((total, range) => (
    total + Math.max(0, Math.min(currentCursor, range.end) - range.start)
  ), 0)
  return {
    text: removeRanges(source, ranges),
    cursor: Math.max(0, currentCursor - removedBeforeCursor),
  }
}

export const expandMentionDeletion = (
  previousContent: string,
  nextContent: string,
  selected: ReadonlyArray<MentionCandidate>,
): MentionContentDeletion => {
  const previous = typeof previousContent === 'string' ? previousContent : ''
  const next = typeof nextContent === 'string' ? nextContent : ''
  const deletion = pureDeletionRange(previous, next)
  if (!deletion || deletion.start === deletion.end) {
    return { text: next, cursor: null, removedCandidateIds: [] }
  }

  const matchingTokens = selected.flatMap((candidate) => (
    mentionTokenRanges(previous, candidate.nickname).map((range) => ({
      ...range,
      candidateId: candidate.id,
    }))
  )).filter((range) => range.start < deletion.end && range.end > deletion.start)
  if (matchingTokens.length === 0) {
    return { text: next, cursor: null, removedCandidateIds: [] }
  }

  const ranges = mergeRanges([
    deletion,
    ...matchingTokens.map(({ start, end }) => ({ start, end })),
  ])
  const text = removeRanges(previous, ranges)
  const matchingCandidateIds = new Set(matchingTokens.map((range) => range.candidateId))
  const removedCandidateIds = selected
    .filter((candidate) => matchingCandidateIds.has(candidate.id))
    .filter((candidate) => !containsMentionToken(text, candidate.nickname))
    .map((candidate) => candidate.id)

  return {
    text,
    cursor: ranges[0]?.start ?? deletion.start,
    removedCandidateIds,
  }
}
