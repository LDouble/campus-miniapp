export const ACADEMIC_CHALLENGE_COOLDOWN_MS = 30 * 60 * 1000

export const academicChallengeRetryAt = (now = Date.now()) => (
  now + ACADEMIC_CHALLENGE_COOLDOWN_MS
)

export const academicChallengeRemainingMinutes = (
  retryAt: number,
  now = Date.now(),
) => Math.max(0, Math.ceil((retryAt - now) / (60 * 1000)))
