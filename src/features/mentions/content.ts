export const insertMentionToken = (
  content: string,
  nickname: string,
  selectionStart = content.length,
  selectionEnd = selectionStart,
): { text: string; cursor: number } => {
  const source = typeof content === 'string' ? content : ''
  const normalizedNickname = nickname.trim()
  const start = Math.min(Math.max(0, selectionStart), source.length)
  const end = Math.min(Math.max(start, selectionEnd), source.length)
  if (!normalizedNickname) return { text: source, cursor: start }

  const token = `@${normalizedNickname} `
  return {
    text: `${source.slice(0, start)}${token}${source.slice(end)}`,
    cursor: start + token.length,
  }
}
