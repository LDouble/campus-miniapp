import { isAffiliateShortcutActive, type AffiliateShortcutItem } from './config'

/** createAffiliateShortcutPageSession 管理口令页加载、复制和页面可见状态。 */
export const createAffiliateShortcutPageSession = () => {
  let active = false
  let loadRevision = 0
  let copyRevision = 0
  let copyInFlight = false

  return {
    activate() {
      active = true
    },
    deactivate() {
      active = false
      loadRevision += 1
      copyRevision += 1
      copyInFlight = false
    },
    beginLoad() {
      if (!active) return null
      loadRevision += 1
      copyRevision += 1
      copyInFlight = false
      return loadRevision
    },
    isLoadCurrent(revision: number) {
      return active && loadRevision === revision
    },
    beginCopy() {
      if (!active || copyInFlight) return null
      copyInFlight = true
      copyRevision += 1
      return copyRevision
    },
    isCopyCurrent(revision: number) {
      return active && copyInFlight && copyRevision === revision
    },
    finishCopy(revision: number) {
      if (!active || !copyInFlight || copyRevision !== revision) return false
      copyInFlight = false
      return true
    },
  }
}

type AffiliateShortcutCopySession = ReturnType<typeof createAffiliateShortcutPageSession>

type CopyShortcutDependencies = {
  session: AffiliateShortcutCopySession
  revision: number
  loadCurrent: () => Promise<AffiliateShortcutItem | null>
  writeClipboard: (content: string) => Promise<unknown>
  now?: () => number
  onUnavailable: () => void
  onValidated: (item: AffiliateShortcutItem) => void
  onCopied: (successText: string) => void
  onError: () => void
  onFinish: () => void
}

/** runAffiliateShortcutCopy 每次等待后都核对页面会话，防止离页后复制或更新界面。 */
export const runAffiliateShortcutCopy = async ({
  session,
  revision,
  loadCurrent,
  writeClipboard,
  now = Date.now,
  onUnavailable,
  onValidated,
  onCopied,
  onError,
  onFinish,
}: CopyShortcutDependencies) => {
  try {
    const current = await loadCurrent()
    if (!session.isCopyCurrent(revision)) return
    if (
      !current
      || current.action.type !== 'copy_token'
      || !isAffiliateShortcutActive(current, now())
    ) {
      onUnavailable()
      return
    }
    onValidated(current)
    await writeClipboard(current.action.copy.content)
    if (!session.isCopyCurrent(revision)) return
    onCopied(current.action.copy.success_text)
  } catch {
    if (session.isCopyCurrent(revision)) onError()
  } finally {
    if (session.finishCopy(revision)) onFinish()
  }
}
