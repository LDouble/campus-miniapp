const CHINESE_IME_SEQUENCE_REPLACEMENTS = [
  ['……', '^'],
  ['——', '_'],
] as const

const CHINESE_SYMBOL_REPLACEMENTS: Readonly<Record<string, string>> = {
  '。': '.',
  '，': ',',
  '、': '\\',
  '；': ';',
  '：': ':',
  '？': '?',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '（': '(',
  '）': ')',
  '【': '[',
  '】': ']',
  '《': '<',
  '》': '>',
  '￥': '$',
  '·': '`',
}

const toHalfWidthCharacter = (character: string) => {
  const codePoint = character.codePointAt(0)
  if (codePoint === 0x3000) return ' '
  if (codePoint !== undefined && codePoint >= 0xff01 && codePoint <= 0xff5e) {
    return String.fromCodePoint(codePoint - 0xfee0)
  }
  return CHINESE_SYMBOL_REPLACEMENTS[character] || character
}

export const convertAcademicPasswordToEnglishSymbols = (password: string) => {
  let converted = password
  CHINESE_IME_SEQUENCE_REPLACEMENTS.forEach(([source, target]) => {
    converted = converted.split(source).join(target)
  })
  return Array.from(converted, toHalfWidthCharacter).join('')
}

export const hasConvertibleAcademicPasswordSymbols = (password: string) => (
  convertAcademicPasswordToEnglishSymbols(password) !== password
)
