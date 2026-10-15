/** createCustomTabBarVisibilityController 按 TabBar 实例管理页面状态与临时浮层租约。 */
export function createCustomTabBarVisibilityController<TOwner extends object>(
  getCurrentOwner: () => TOwner | undefined,
  applyHidden: (owner: TOwner, hidden: boolean) => void,
) {
  type OwnerState = { pageHidden: boolean; leaseCount: number }
  const states = new WeakMap<TOwner, OwnerState>()

  const stateFor = (owner: TOwner, create: boolean) => {
    const existing = states.get(owner)
    if (existing || !create) return existing
    const state = { pageHidden: false, leaseCount: 0 }
    states.set(owner, state)
    return state
  }
  const isHidden = (owner = getCurrentOwner()) => {
    if (!owner) return false
    const state = stateFor(owner, false)
    return Boolean(state && (state.pageHidden || state.leaseCount > 0))
  }
  const publish = (owner: TOwner, state: OwnerState) => {
    applyHidden(owner, state.pageHidden || state.leaseCount > 0)
  }

  return {
    isHidden,
    setPageHidden(hidden: boolean, owner = getCurrentOwner()) {
      if (!owner) return
      const state = stateFor(owner, true)
      if (!state) return
      state.pageHidden = hidden
      publish(owner, state)
    },
    resetPageHidden(owner = getCurrentOwner()) {
      if (!owner) return
      const state = stateFor(owner, true)
      if (!state) return
      state.pageHidden = false
      publish(owner, state)
    },
    acquire(owner = getCurrentOwner()) {
      if (!owner) return () => undefined
      const state = stateFor(owner, true)
      if (!state) return () => undefined
      state.leaseCount += 1
      publish(owner, state)
      let released = false
      return () => {
        if (released) return
        released = true
        state.leaseCount = Math.max(0, state.leaseCount - 1)
        publish(owner, state)
      }
    },
  }
}
