type CommunityAuthor = {
  author_id: number
  author_nickname?: string | null
}

export const communityAuthorName = (author: CommunityAuthor) => (
  author.author_nickname?.trim() || '校园同学'
)

export const communityAuthorInitial = (author: CommunityAuthor) => {
  const [initial] = Array.from(communityAuthorName(author))
  return initial || '同'
}

export const communityAuthorTone = (author: CommunityAuthor) => (
  Math.abs(author.author_id) % 4
)
