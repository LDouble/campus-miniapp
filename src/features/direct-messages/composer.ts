export type DirectMessageSendPayload = {
  kind: 'text'
  content: string
} | {
  kind: 'image'
  mediaId: number
}

export type PendingDirectMessageSend = {
  payload: DirectMessageSendPayload
  fingerprint: string
  idempotencyKey: string
}

export const resolvePendingDirectMessageSend = (
  input: {
    draft: string
    mediaId?: number
    pending: PendingDirectMessageSend | null
    pendingFingerprint: string
    createKey: () => string
  },
): PendingDirectMessageSend | null => {
  const mediaId = Number(input.mediaId)
  const payload: DirectMessageSendPayload | null = mediaId > 0
    ? { kind: 'image', mediaId }
    : input.draft.trim()
      ? { kind: 'text', content: input.draft.trim() }
      : null
  if (!payload) return null

  const fingerprint = payload.kind === 'image'
    ? `image:${payload.mediaId}`
    : `text:${input.draft}`
  if (input.pending && input.pendingFingerprint === fingerprint) return input.pending
  return { payload, fingerprint, idempotencyKey: input.createKey() }
}
