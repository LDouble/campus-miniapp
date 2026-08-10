const MAX_VISIBLE_ITEMS = 3
const atomicApi = 'queryShuttleSchedule'

const asText = (value) => (typeof value === 'string' ? value.trim() : '')

const departureTime = (value) => {
  const text = asText(value)
  const match = text.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : text
}

const serviceTypeLabel = (value) => (
  value === 'campus_loop' ? '校内循环' : value === 'intercampus' ? '校区间' : '校车线路'
)

const normalizeRoute = (item) => {
  const schedule = item && item.resolvedSchedule && typeof item.resolvedSchedule === 'object'
    ? item.resolvedSchedule
    : {}
  const departureTimes = Array.isArray(schedule.departureTimes)
    ? schedule.departureTimes.map(asText).filter(Boolean).slice(0, 3)
    : []
  const origin = asText(item && item.origin)
  const destination = asText(item && item.destination)
  const routeDirection = origin && destination ? `${origin} → ${destination}` : origin || destination || '暂无站点信息'

  return {
    id: item && item.id !== undefined && item.id !== null ? String(item.id) : '',
    name: asText(item && item.name) || '未命名校车线路',
    serviceTypeLabel: serviceTypeLabel(item && item.serviceType),
    routeDirection,
    serviceDate: asText(schedule.serviceDate),
    nextDeparture: departureTime(schedule.nextDepartureAt),
    departureTimes: departureTimes.join(' · '),
    scheduleNote: asText(schedule.note),
    suspended: !!schedule.suspended,
  }
}

Component({
  data: {
    visibleItems: [],
    totalCount: 0,
    omittedCount: 0,
    hasResults: false,
  },
  lifetimes: {
    created() {
      console.info(`[ai-mode] shuttle-route-list created api=${atomicApi}`)
      const { NotificationType } = wx.modelContext
      const modelCtx = wx.modelContext.getContext(this)
      const viewCtx = wx.modelContext.getViewContext(this)
      const { minHeight, maxHeight, width } = viewCtx.getDimensions()
      console.info(`[ai-mode] shuttle-route-list dimensions width=${width} minHeight=${minHeight} maxHeight=${maxHeight}`)

      modelCtx.on(NotificationType.Result, (data) => {
        const result = data && data.result
        const structuredContent = result && result.structuredContent
        console.info('[ai-mode] shuttle-route-list 收到 Result:', structuredContent)
        if (!structuredContent) return

        const allItems = Array.isArray(structuredContent.items)
          ? structuredContent.items.map(normalizeRoute)
          : []
        const visibleItems = allItems.slice(0, MAX_VISIBLE_ITEMS)
        const declaredTotal = Number(structuredContent.total)
        const totalCount = Number.isFinite(declaredTotal) && declaredTotal >= 0
          ? declaredTotal
          : allItems.length
        const omittedCount = Math.max(totalCount - visibleItems.length, allItems.length - visibleItems.length, 0)

        this.setData({
          visibleItems,
          totalCount,
          omittedCount,
          hasResults: visibleItems.length > 0,
        })
        const relatedPageQuery = result._meta && typeof result._meta.relatedPageQuery === 'string'
          ? result._meta.relatedPageQuery
          : 'date=' + encodeURIComponent(visibleItems[0] ? visibleItems[0].serviceDate : '')
        viewCtx.setRelatedPage({
          path: '/pages/shuttle/index',
          query: relatedPageQuery,
        })
        console.info(`[ai-mode] shuttle-route-list relatedPage query=${relatedPageQuery}`)
        console.info(`[ai-mode] shuttle-route-list setData total=${totalCount} visible=${visibleItems.length} omitted=${omittedCount}`)
      })

      viewCtx.on(NotificationType.Overflow, (data) => {
        const overflowed = !!(data && data.overflowHeight > 0)
        console.info(`[ai-mode] shuttle-route-list overflow overflowed=${overflowed} data=${JSON.stringify(data)}`)
      })
      console.info('[ai-mode] shuttle-route-list overflow monitor=on')
    },
    attached() {
      console.info('[ai-mode] shuttle-route-list attached')
    },
  },
})
