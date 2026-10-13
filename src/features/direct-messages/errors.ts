/** privateMessageErrorMessage 转换私信错误并保持拉黑拦截文案稳定。 */
export const privateMessageErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code === 'private_message_blocked' ? '对方暂不接收你的私信' : error.message
  }
  return error instanceof Error ? error.message : fallback
}
