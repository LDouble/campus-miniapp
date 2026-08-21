const commentIdFromAction = (path: string) => {
  const match = path.match(/[?&]comment_id=(\d+)/)
  return match ? Number(match[1]) : 0
}

const directMessageActionPattern = /^\/packages\/social\/direct-messages\/chat\?id=([1-9]\d*)$/

export const isPrivateMessageNoticeAction = (path: string) => directMessageActionPattern.test(path)

export const noticeActionRoute = (
  path: string,
  options: { allowPrivateMessages?: boolean } = {},
) => {
  if (!path) return ''
  if (isPrivateMessageNoticeAction(path)) {
    return options.allowPrivateMessages === false ? '' : path
  }
  if (path.startsWith('/pages/')) return path
  const match = path.match(
    /^\/api\/v1\/(errands|marketplace\/listings|carpool\/trips|campus-circle\/posts)\/(\d+)/,
  )
  if (!match) return ''
  const id = match[2]
  if (match[1] === 'errands') return `/packages/social/errands/detail?id=${id}`
  if (match[1] === 'marketplace/listings') return `/packages/social/marketplace/detail?id=${id}`
  if (match[1] === 'carpool/trips') return `/packages/social/carpool/detail?id=${id}`
  const commentId = commentIdFromAction(path)
  return `/packages/social/community/detail?id=${id}&mode=post${
    commentId > 0 ? `&comment_id=${commentId}` : ''
  }`
}
