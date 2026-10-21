/** MEMBER_AD_INTERVAL_MS 是两次实际展示之间的连续三天间隔。 */
export const MEMBER_AD_INTERVAL_MS = 72 * 60 * 60 * 1000

/** canShowMemberAd 只允许未被排除的 member 在冷却到期后准备广告。 */
export const canShowMemberAd = (
  userId: number,
  roles: readonly string[],
  lastShownAt: unknown = undefined,
  now = Date.now(),
  studentNo?: string | null,
) => Number.isSafeInteger(userId) && userId > 0 && roles.includes('member')
  && studentNo?.trim() !== '13020031080'
  && Number.isFinite(now) && now > 0
  && (lastShownAt === undefined || lastShownAt === null || lastShownAt === ''
    || (typeof lastShownAt === 'number' && Number.isFinite(lastShownAt)
      && lastShownAt > 0 && now - lastShownAt >= MEMBER_AD_INTERVAL_MS))
