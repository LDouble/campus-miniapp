export const USERNAME_MAX_LENGTH = 32

const usernamePattern = /^[A-Za-z0-9._\-\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+$/

export const normalizeUsername = (value: string) => value.trim()

export const validateUsername = (value: string) => {
  const username = normalizeUsername(value)
  if (username.length < 2 || username.length > USERNAME_MAX_LENGTH) {
    return '昵称需要 2–32 个字符'
  }
  if (!usernamePattern.test(username)) {
    return '仅支持中文、字母、数字、点、下划线和短横线'
  }
  return ''
}
