type CommunityAuthor = {
  author_id: number
  author_nickname?: string | null
  author_deleted?: boolean
  // 由社区 Feed 接口返回；旧接口未返回时仍回退到昵称首字母。
  author_avatar_url?: string | null
}

export const communityAuthorName = (author: CommunityAuthor) => (
  author.author_deleted ? '已注销用户' : author.author_nickname?.trim() || '校园同学'
)

export const communityAuthorInitial = (author: CommunityAuthor) => {
  if (author.author_deleted) return '同'
  const [initial] = Array.from(communityAuthorName(author))
  return initial || '同'
}

export const communityAuthorTone = (author: CommunityAuthor) => (
  author.author_deleted ? 0 : Math.abs(author.author_id) % 4
)

export const communityAuthorAvatarUrl = (author: CommunityAuthor) => {
  if (author.author_deleted) return ''
  return author.author_avatar_url?.trim() || ''
}
