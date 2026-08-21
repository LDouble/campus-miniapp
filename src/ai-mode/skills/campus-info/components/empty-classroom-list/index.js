const atomicApi = 'findEmptyClassrooms'
const componentName = 'empty-classroom-list'
const { getCampusTheme, subscribeCampusTheme } = require('../../utils/theme')

const normalizeText = (value) => typeof value === 'string' ? value.trim() : ''

const normalizeRooms = (groups) => {
  const rooms = []
  for (const group of Array.isArray(groups) ? groups : []) {
    const building = normalizeText(group && group.building)
    const classrooms = Array.isArray(group && group.classrooms) ? group.classrooms : []
    for (const classroom of classrooms) {
      if (rooms.length >= 3) return rooms
      const displayName = normalizeText(classroom && classroom.displayName)
        || normalizeText(classroom && classroom.room)
        || '未命名教室'
      const roomType = normalizeText(classroom && classroom.roomType)
      const capacity = Number(classroom && classroom.capacity)
      const metaParts = []
      if (roomType) metaParts.push(roomType)
      if (Number.isFinite(capacity) && capacity > 0) metaParts.push(`${capacity} 座`)
      const facilities = Array.isArray(classroom && classroom.facilities)
        ? classroom.facilities.map(normalizeText).filter(Boolean).slice(0, 2)
        : []
      rooms.push({
        key: String((classroom && classroom.id) || `${building}-${rooms.length}`),
        building: building || '教学楼',
        displayName,
        meta: metaParts.join(' · '),
        facilities: facilities.join(' / '),
      })
    }
  }
  return rooms
}

Component({
  data: {
    darkMode: getCampusTheme() === 'dark',
    campus: '',
    serviceDate: '',
    sectionText: '',
    total: 0,
    visibleRooms: [],
    hasItems: false,
    hasOmitted: false,
    omittedCount: 0,
    dataSourceNotice: '',
  },
  lifetimes: {
    created() {
      console.info(`[ai-mode] ${componentName} created api=${atomicApi}`)
      const { NotificationType } = wx.modelContext
      const modelCtx = wx.modelContext.getContext(this)
      const viewCtx = wx.modelContext.getViewContext(this)
      modelCtx.on(NotificationType.Result, (data) => {
        const result = data && data.result
        const structuredContent = result && result.structuredContent
        console.info(`[ai-mode] ${componentName} 收到 Result`)
        if (!structuredContent) return

        const visibleRooms = normalizeRooms(result.structuredContent.groups)
        const total = Math.max(0, Number(result.structuredContent.total) || 0)
        const startSection = Number(result.structuredContent.startSection) || 0
        const endSection = Number(result.structuredContent.endSection) || 0
        const omittedCount = Math.max(0, total - visibleRooms.length)
        this.setData({
          campus: normalizeText(result.structuredContent.campus) || '当前校区',
          serviceDate: normalizeText(result.structuredContent.serviceDate),
          sectionText: startSection && endSection ? `第 ${startSection}—${endSection} 节` : '',
          total,
          visibleRooms,
          hasItems: visibleRooms.length > 0,
          hasOmitted: omittedCount > 0,
          omittedCount,
          dataSourceNotice: normalizeText(result.structuredContent.dataSourceNotice),
        })
        const fallbackQuery = 'campus=' + encodeURIComponent(normalizeText(result.structuredContent.campus))
          + '&date=' + encodeURIComponent(normalizeText(result.structuredContent.serviceDate))
          + '&startSection=' + encodeURIComponent(String(startSection || ''))
          + '&endSection=' + encodeURIComponent(String(endSection || ''))
        const relatedPageQuery = result._meta && typeof result._meta.relatedPageQuery === 'string'
          ? result._meta.relatedPageQuery
          : fallbackQuery
        viewCtx.setRelatedPage({
          path: '/pages/empty-classroom/index',
          query: relatedPageQuery,
        })
        console.info(`[ai-mode] ${componentName} relatedPage query=${relatedPageQuery}`)
        console.info(
          `[ai-mode] ${componentName} setData total=${total} visible=${visibleRooms.length} omitted=${omittedCount}`,
        )
      })

      const { minHeight, maxHeight, width } = viewCtx.getDimensions()
      console.info(
        `[ai-mode] ${componentName} dimensions width=${width} minHeight=${minHeight} maxHeight=${maxHeight}`,
      )
      viewCtx.on(NotificationType.Overflow, (data) => {
        const overflowed = !!(data && data.overflowHeight > 0)
        console.info(
          `[ai-mode] ${componentName} overflow overflowed=${overflowed} data=${JSON.stringify(data)}`,
        )
      })
      console.info(`[ai-mode] ${componentName} overflow monitor=on`)
    },
    attached() {
      console.info(`[ai-mode] ${componentName} attached`)
      this.unsubscribeCampusTheme = subscribeCampusTheme((theme) => {
        this.setData({ darkMode: theme === 'dark' })
      })
    },
    detached() {
      if (this.unsubscribeCampusTheme) this.unsubscribeCampusTheme()
    },
  },
})
