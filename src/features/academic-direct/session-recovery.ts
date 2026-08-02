interface SessionRecoveryOptions<T> {
  request: () => Promise<T>
  authenticate: () => Promise<void>
  isRejected: (response: T) => boolean
}

/**
 * 与 requests.Session 的使用方式一致：先复用现有 Cookie 请求业务接口，
 * 仅在服务端明确返回登录页或拒绝页时认证一次并重放原请求。
 */
export const requestWithAuthenticationRetry = async <T>({
  request,
  authenticate,
  isRejected,
}: SessionRecoveryOptions<T>) => {
  const initial = await request()
  if (!isRejected(initial)) return initial
  await authenticate()
  return request()
}
