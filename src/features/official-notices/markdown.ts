export type NoticeMarkdownBlock = {
  id: string
  kind: 'heading' | 'list' | 'ordered-list' | 'paragraph' | 'quote' | 'separator'
  level?: number
  text: string
}

const inlineText = (value: string) => value
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g, '$1（$2）')
  .replace(/(`{1,3}|\*\*|__|~~)/g, '')
  .trim()

export const parseOfficialNoticeMarkdown = (markdown: string): NoticeMarkdownBlock[] => {
  const blocks: NoticeMarkdownBlock[] = []
  let inCodeFence = false
  markdown.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (/^```/.test(line)) {
      inCodeFence = !inCodeFence
      return
    }
    if (!line) return
    if (/^([-*_])\1{2,}$/.test(line)) {
      blocks.push({ id: `separator-${index}`, kind: 'separator', text: '' })
      return
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      blocks.push({
        id: `heading-${index}`,
        kind: 'heading',
        level: heading[1].length,
        text: inlineText(heading[2]),
      })
      return
    }
    const unordered = line.match(/^[-*+]\s+(.+)$/)
    if (unordered) {
      blocks.push({ id: `list-${index}`, kind: 'list', text: inlineText(unordered[1]) })
      return
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    if (ordered) {
      blocks.push({ id: `ordered-${index}`, kind: 'ordered-list', text: inlineText(ordered[1]) })
      return
    }
    const quote = line.match(/^>\s?(.+)$/)
    if (quote) {
      blocks.push({ id: `quote-${index}`, kind: 'quote', text: inlineText(quote[1]) })
      return
    }
    blocks.push({
      id: `${inCodeFence ? 'quote' : 'paragraph'}-${index}`,
      kind: inCodeFence ? 'quote' : 'paragraph',
      text: inlineText(line),
    })
  })
  return blocks
}
