export type UserAvatarTone = 0 | 1 | 2 | 3

export const userAvatarTone = (userId?: number | null): UserAvatarTone => {
  if (typeof userId !== 'number' || !Number.isFinite(userId)) return 0
  return (Math.abs(Math.trunc(userId)) % 4) as UserAvatarTone
}
