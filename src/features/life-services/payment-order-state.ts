type PaymentStatus = 'none' | 'pending' | 'succeeded' | 'cancelled' | 'refunding' | 'refunded'

/** Returns the actionable state shown while the server is processing a cancellation. */
export const cancellationProgressCopy = (
  cancellationStatus: string | null | undefined,
  paymentStatus: PaymentStatus | string | null | undefined,
) => {
  if (cancellationStatus !== 'processing') return ''
  return paymentStatus === 'refunding' ? '退款处理中' : '取消处理中'
}

/** The API is the source of truth for actions. Keep a card to one primary action. */
export const primaryOrderAction = (availableActions: readonly string[]) => (
  ['pay', 'pickup', 'deliver', 'complete'].find((action) => availableActions.includes(action)) || null
)

export const usesServerOrderSearch = (section: string) => section === 'orders'
