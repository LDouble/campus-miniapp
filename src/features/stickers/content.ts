export const STICKER_CONTENT_VERSION = 'v1'

export type StickerDefinition = {
  id: string
  label: string
}

export type StickerContentPart =
  | { type: 'text'; text: string }
  | { type: 'sticker'; sticker: StickerDefinition }

// 该清单是内容协议的唯一白名单。它刻意不依赖图片资源，使协议可在服务端
// 预处理和 Node smoke test 中使用，而不会触发小程序静态资源的 require。
export const campusStickerDefinitions: readonly StickerDefinition[] = [
  { id: 'sticker-01', label: '开心' },
  { id: 'sticker-02', label: '调皮' },
  { id: 'sticker-03', label: '大哭' },
  { id: 'sticker-04', label: '委屈' },
  { id: 'sticker-05', label: '无语' },
  { id: 'sticker-06', label: '震惊' },
  { id: 'sticker-07', label: '生气' },
  { id: 'sticker-08', label: '害羞' },
  { id: 'sticker-09', label: '坏笑' },
  { id: 'sticker-10', label: '吃瓜' },
  { id: 'sticker-11', label: '点赞' },
  { id: 'sticker-12', label: '鼓掌' },
  { id: 'sticker-13', label: 'OK' },
  { id: 'sticker-14', label: '拜托' },
  { id: 'sticker-15', label: '摸鱼' },
  { id: 'sticker-16', label: '躺平' },
  { id: 'sticker-17', label: '开摆' },
  { id: 'sticker-18', label: '干饭' },
  { id: 'sticker-19', label: '破防' },
  { id: 'sticker-20', label: '早八' },
  { id: 'sticker-21', label: '下课' },
  { id: 'sticker-22', label: '上课中' },
  { id: 'sticker-23', label: '睡着了' },
  { id: 'sticker-24', label: '赶截止日' },
  { id: 'sticker-25', label: '考试崩溃' },
  { id: 'sticker-26', label: '耍酷' },
  { id: 'sticker-27', label: '刷手机' },
  { id: 'sticker-28', label: '满分' },
  { id: 'sticker-29', label: '赶 DDL' },
  { id: 'sticker-30', label: '来救我' },
  { id: 'sticker-31', label: '许愿' },
  { id: 'sticker-32', label: '送你星星' },
]

const stickerById = new Map(campusStickerDefinitions.map((sticker) => [sticker.id, sticker]))
const stickerByLabel = new Map(campusStickerDefinitions.map((sticker) => [sticker.label, sticker]))
const markerPattern = /\[\[campus-sticker:([\s\S]*?)\]\]/gu
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
const stickerTokenPattern = new RegExp(
  `\\[(${[...stickerByLabel.keys()].sort((left, right) => right.length - left.length).map(escapeRegExp).join('|')})\\]`,
  'gu',
)

const appendTextPart = (parts: StickerContentPart[], text: string) => {
  if (!text) return
  const previous = parts[parts.length - 1]
  if (previous?.type === 'text') {
    previous.text += text
    return
  }
  parts.push({ type: 'text', text })
}

const appendStickerTokens = (parts: StickerContentPart[], text: string) => {
  let cursor = 0

  for (const match of text.matchAll(stickerTokenPattern)) {
    const token = match[0]
    const start = match.index ?? 0
    const sticker = stickerByLabel.get(match[1])

    appendTextPart(parts, text.slice(cursor, start))
    if (sticker) parts.push({ type: 'sticker', sticker })
    else appendTextPart(parts, token)
    cursor = start + token.length
  }

  appendTextPart(parts, text.slice(cursor))
}

const safeFallbackLabel = (label: string) => {
  const normalized = label.trim()
  return normalized
    && normalized.length <= 20
    && !/[\[\]\r\n\u0000-\u001f]/u.test(normalized)
    ? normalized
    : '表情'
}

const parseMarker = (payload: string) => {
  const [version = '', id = '', ...labelParts] = payload.split(':')
  const declaredLabel = safeFallbackLabel(labelParts.join(':'))
  const knownSticker = stickerById.get(id)

  if (
    version === STICKER_CONTENT_VERSION
    && knownSticker
    && knownSticker.label === labelParts.join(':')
  ) {
    return { sticker: knownSticker, fallbackLabel: knownSticker.label }
  }

  return {
    sticker: null,
    fallbackLabel: knownSticker?.label || declaredLabel,
  }
}

export const stickerTokenForId = (stickerId: string) => {
  const sticker = stickerById.get(stickerId)
  return sticker ? `[${sticker.label}]` : ''
}

export function insertStickerToken(
  content: string,
  stickerId: string,
  selectionStart = content.length,
  selectionEnd = selectionStart,
): { text: string; cursor: number } {
  const source = typeof content === 'string' ? content : ''
  const token = stickerTokenForId(stickerId)
  const start = Math.min(Math.max(0, selectionStart), source.length)
  const end = Math.min(Math.max(start, selectionEnd), source.length)

  if (!token) return { text: source, cursor: start }
  return {
    text: `${source.slice(0, start)}${token}${source.slice(end)}`,
    cursor: start + token.length,
  }
}

/** 新内容直接保存可读的 `[标签]`，便于 Push 和不支持图片的客户端降级展示。 */
export function serializeStickerTokens(content: string): string {
  return typeof content === 'string' ? content : ''
}

export function stickerIdsFromEditableContent(content: string): string[] {
  const source = typeof content === 'string' ? content : ''
  return [...source.matchAll(stickerTokenPattern)].flatMap((match) => {
    const sticker = stickerByLabel.get(match[1])
    return sticker ? [sticker.id] : []
  })
}

/**
 * 将发布器中的正文和表情选择结果编码为可直接展示的 `[标签]`。
 * 无法命中本地白名单的 ID 会被忽略，避免将任意资源标识写入内容。
 */
export function serializeStickerContent(text: string, stickerIds: string[]): string {
  const normalizedText = typeof text === 'string' ? text : ''
  const markers = stickerIds
    .map((id) => stickerById.get(id))
    .filter((sticker): sticker is StickerDefinition => Boolean(sticker))
    .map((sticker) => `[${sticker.label}]`)

  return `${normalizedText}${markers.join('')}`
}

/**
 * 解析新 `[标签]` 与历史带 ID 标记。支持的内容还原为图片片段；
 * 未知标签原样保留，未知历史标记降级为 `[具体含义]`。
 */
export function parseStickerContent(content: string): StickerContentPart[] {
  const source = typeof content === 'string' ? content : ''
  const parts: StickerContentPart[] = []
  let cursor = 0

  for (const match of source.matchAll(markerPattern)) {
    const marker = match[0]
    const start = match.index ?? 0
    const parsedMarker = parseMarker(match[1])

    appendStickerTokens(parts, source.slice(cursor, start))
    if (parsedMarker.sticker) {
      parts.push({ type: 'sticker', sticker: parsedMarker.sticker })
    } else {
      appendTextPart(parts, `[${parsedMarker.fallbackLabel}]`)
    }
    cursor = start + marker.length
  }

  appendStickerTokens(parts, source.slice(cursor))
  return parts
}

/** 将存储内容恢复为输入框可见的文字与 `[标签]`。 */
export function deserializeStickerContent(content: string): { text: string; stickerIds: string[] } {
  const parts = parseStickerContent(content)
  return {
    text: parts.map((part) => part.type === 'text' ? part.text : `[${part.sticker.label}]`).join(''),
    stickerIds: parts.filter((part): part is Extract<StickerContentPart, { type: 'sticker' }> => part.type === 'sticker')
      .map((part) => part.sticker.id),
  }
}

export const editableStickerContent = (content: string): string => (
  deserializeStickerContent(content).text
)

/** 用于无图片能力的降级展示和可访问文本。 */
export function plainStickerContent(content: string): string {
  return parseStickerContent(content)
    .map((part) => part.type === 'text' ? part.text : `[${part.sticker.label}]`)
    .join('')
}
