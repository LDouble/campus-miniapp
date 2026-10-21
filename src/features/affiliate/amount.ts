/** normalizeAffiliateAmount 统一数字金额的等价表示，空值保持缺失，非法字符串不伪装成数字。 */
export const normalizeAffiliateAmount = (value: string | null | undefined) => {
  if (value == null || value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? String(amount) : value.trim()
}

/** compareAffiliateAmounts 仅对非负且有限的金额进行大小比较；无效金额返回 null。 */
export const compareAffiliateAmounts = (
  left: string | null | undefined,
  right: string | null | undefined,
): -1 | 0 | 1 | null => {
  const normalizedLeft = normalizeAffiliateAmount(left)
  const normalizedRight = normalizeAffiliateAmount(right)
  if (normalizedLeft == null || normalizedRight == null) return null

  const leftAmount = Number(normalizedLeft)
  const rightAmount = Number(normalizedRight)
  if (!Number.isFinite(leftAmount) || !Number.isFinite(rightAmount) || leftAmount < 0 || rightAmount < 0) return null
  if (leftAmount < rightAmount) return -1
  if (leftAmount > rightAmount) return 1
  return 0
}
