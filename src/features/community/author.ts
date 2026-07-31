type CommunityAuthor = {
  author_id: number
  author_nickname?: string | null
  author_deleted?: boolean
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
