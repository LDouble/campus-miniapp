export type ContactCommentStatus = 'none' | 'created' | 'failed'

type ModalOptions = {
  title: string
  content: string
  showCancel?: boolean
  confirmText?: string
  cancelText?: string
  confirmColor?: string
}

type ContactRevealPlatform = {
  showModal(options: ModalOptions): Promise<{ confirm?: boolean }>
  setClipboardData(options: { data: string }): Promise<unknown>
  showToast(options: { title: string; icon: 'none' }): Promise<unknown>
}

type ParticipationContact = {
  successTitle: string
  contactType?: string | null
  contact?: string | null
  commentStatus?: ContactCommentStatus
  confirmColor?: string
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  phone: '手机号',
  qq: 'QQ',
  wechat: '微信',
}

export const revealedContactValue = (contact?: string | null) => {
  const value = String(contact || '').trim()
  return value && !value.includes('*') ? value : ''
}

export const contactTypeLabel = (contactType?: string | null) => {
  const normalized = String(contactType || '').trim().toLowerCase()
  return CONTACT_TYPE_LABELS[normalized] || String(contactType || '').trim() || '联系方式'
}

const commentNote = (status: ContactCommentStatus) => {
  if (status === 'created') return '\n\n已自动留言给对方。'
  if (status === 'failed') return '\n\n自动留言未成功，可在评论区手动联系。'
  return ''
}

export const showParticipationContact = async (
  platform: ContactRevealPlatform,
  input: ParticipationContact,
) => {
  const contact = revealedContactValue(input.contact)
  if (!contact) {
    await platform.showModal({
      title: input.successTitle,
      content: '操作已成功，但联系方式暂未同步，请下拉刷新后重试。',
      showCancel: false,
      confirmText: '知道了',
    })
    return false
  }

  const result = await platform.showModal({
    title: '联系方式已解锁',
    content: `${input.successTitle}\n${contactTypeLabel(input.contactType)}：${contact}${commentNote(input.commentStatus || 'none')}`,
    confirmText: '复制',
    cancelText: '关闭',
    confirmColor: input.confirmColor,
  })
  if (!result.confirm) return true

  try {
    await platform.setClipboardData({ data: contact })
  } catch {
    await platform.showToast({ title: '复制失败，请重试', icon: 'none' })
  }
  return true
}
