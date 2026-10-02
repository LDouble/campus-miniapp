/** normalizeMiniappVersion 规范化微信后台提供的小程序版本字符串。 */
export const normalizeMiniappVersion = (value: unknown) => (
  typeof value === 'string' ? value.trim() : ''
)
