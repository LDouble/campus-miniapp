import type { DetailFooterAction } from './components/detail-comments'

type DetailActionOptions = {
  availableActions: readonly string[]
  labels: Record<string, string>
  priority: readonly string[]
  dangerActions?: readonly string[]
  busy?: boolean
  onAction: (action: string) => void
}

/**
 * available_actions 是服务端给出的可执行能力，也是底栏展示的唯一依据。
 * priority 只负责稳定排序，不参与权限或状态判断。
 */
export const buildDetailFooterActions = ({
  availableActions,
  labels,
  priority,
  dangerActions = [],
  busy = false,
  onAction,
}: DetailActionOptions): DetailFooterAction[] => {
  const order = new Map(priority.map((action, index) => [action, index]))
  const danger = new Set(dangerActions)
  const sortedActions = [...new Set(availableActions)]
    .filter((action) => Boolean(labels[action]))
    .sort((left, right) => (
      (order.get(left) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(right) ?? Number.MAX_SAFE_INTEGER)
    ))

  const primaryAction = sortedActions.find((action) => !danger.has(action))
  const actions = primaryAction
    ? [...sortedActions.filter((action) => action !== primaryAction), primaryAction]
    : sortedActions

  return actions.map((action) => ({
    key: action,
    label: labels[action],
    busy,
    emphasis: danger.has(action)
      ? 'danger'
      : action === primaryAction
        ? 'primary'
        : 'secondary',
    onClick: () => onAction(action),
  }))
}

export const splitDetailActions = (
  actions: DetailFooterAction[],
  overflowKeys: readonly string[],
) => {
  const overflow = new Set(overflowKeys)
  return {
    inlineActions: actions.filter((action) => !overflow.has(action.key)),
    overflowActions: actions.filter((action) => overflow.has(action.key)),
  }
}
