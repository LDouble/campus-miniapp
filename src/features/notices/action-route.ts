const commentIdFromAction = (path: string) => {
  const match = path.match(/[?&]comment_id=(\d+)/)
  return match ? Number(match[1]) : 0
}

export const noticeActionRoute = (path: string) => {
  if (!path) return ''
  if (path.startsWith('/pages/')) return path
  const match = path.match(
    /^\/api\/v1\/(errands|marketplace\/listings|carpool\/trips|campus-circle\/posts)\/(\d+)/,
  )
  if (!match) return ''
  const id = match[2]
  if (match[1] === 'errands') return `/pages/errands/detail?id=${id}`
  if (match[1] === 'marketplace/listings') return `/pages/marketplace/detail?id=${id}`
  if (match[1] === 'carpool/trips') return `/pages/carpool/detail?id=${id}`
  const commentId = commentIdFromAction(path)
  return `/pages/community/detail?id=${id}&mode=post${
    commentId > 0 ? `&comment_id=${commentId}` : ''
  }`
}
