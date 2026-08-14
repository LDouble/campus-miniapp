import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../utils/date-time'

export const formatMoney = (cents: number) => {
  const amount = cents / 100
  return Number.isInteger(amount) ? `¥${amount}` : `¥${amount.toFixed(2)}`
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return '时间待确认'
  const parts = apiDateTimeCampusParts(value)
  if (!parts) return value
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  const hour = String(parts.hour).padStart(2, '0')
  const minute = String(parts.minute).padStart(2, '0')
  return `${month}月${day}日 ${hour}:${minute}`
}

export const relativeDeadline = (value?: string | null, now = Date.now()) => {
  if (!value) return '截止时间待确认'
  const timestamp = apiDateTimeTimestamp(value)
  if (Number.isNaN(timestamp)) return formatDateTime(value)
  const diff = timestamp - now
  if (diff <= 0) return '已截止'
  const minutes = Math.ceil(diff / 60_000)
  if (minutes < 60) return `${minutes} 分钟后截止`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `${hours} 小时后截止`
  return `${Math.ceil(hours / 24)} 天后截止`
}

const reviewLabels: Record<string, string> = {
  draft: '草稿',
  pending_review: '审核中',
  approved: '校内可见',
  rejected: '审核未通过',
}

const lifecycleLabels: Record<string, string> = {
  open: '进行中',
  full: '已满员',
  accepted: '已接单',
  picked_up: '已取件',
  delivered: '待确认',
  completed: '已完成',
  cancelled: '已取消',
  published: '在售',
  reserved: '已预留',
  sold: '已售出',
  withdrawn: '已撤回',
  removed: '已下架',
}

export const formatStatus = (status: string, reviewStatus?: string) => {
  if (reviewStatus && reviewStatus !== 'approved') {
    return reviewLabels[reviewStatus] || reviewStatus
  }
  return lifecycleLabels[status] || reviewLabels[status] || status
}

const orderStatusLabels: Record<string, string> = {
  confirmed: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  expired: '已过期',
  not_started: '待履约',
  in_progress: '履约中',
  delivered: '待确认',
}

export const formatOrderStatus = (tradeStatus: string, fulfillmentStatus: string) => {
  if (tradeStatus !== 'confirmed') return orderStatusLabels[tradeStatus] || tradeStatus
  return orderStatusLabels[fulfillmentStatus] || orderStatusLabels[tradeStatus] || tradeStatus
}

export const remainingSeats = (total: number, occupied: number) => (
  Math.max(0, total - occupied)
)
