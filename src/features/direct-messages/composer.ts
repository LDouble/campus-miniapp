export type PendingDirectMessageSend = {
  content: string
  idempotencyKey: string
}

export const resolvePendingDirectMessageSend = (
  draft: string,
  pending: PendingDirectMessageSend | null,
  pendingDraft: string,
  createKey: () => string,
): PendingDirectMessageSend | null => {
  const content = draft.trim()
  if (!content) return null
  if (pending && pendingDraft === draft) return pending
  return { content, idempotencyKey: createKey() }
}
