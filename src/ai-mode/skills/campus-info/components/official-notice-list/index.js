const { getCampusTheme, subscribeCampusTheme } = require('../../utils/theme')

Component({
  data: {
    darkMode: getCampusTheme() === 'dark',
    visibleItems: [],
    totalCount: 0,
    omittedCount: 0,
    hasItems: false
  },

  lifetimes: {
    created() {
      console.info('[ai-mode] official-notice-list created')

      const { NotificationType } = wx.modelContext
      const modelCtx = wx.modelContext.getContext(this)
      const viewCtx = wx.modelContext.getViewContext(this)
      const dimensions = viewCtx.getDimensions()
      console.info(
        `[ai-mode] official-notice-list dimensions width=${dimensions.width} minHeight=${dimensions.minHeight} maxHeight=${dimensions.maxHeight}`
      )

      modelCtx.on(NotificationType.Result, (data) => {
        const result = data && data.result ? data.result : {}
        const structuredContent = result.structuredContent || {}
        const sourceItems = Array.isArray(structuredContent.items)
          ? structuredContent.items
          : []

        console.info(
          `[ai-mode] official-notice-list received Result items=${sourceItems.length} total=${Number(structuredContent.total) || 0}`
        )

        const visibleItems = sourceItems.slice(0, 3).map((item, index) => ({
          id: item && item.id !== undefined && item.id !== null ? String(item.id) : String(index),
          title: item && item.title ? String(item.title) : '未命名通知',
          summary: item && item.summary ? String(item.summary) : '',
          source: item && item.source ? String(item.source) : '',
          category: item && item.category ? String(item.category) : '',
          publisher: item && item.publisher ? String(item.publisher) : '',
          priority: item && item.priority ? String(item.priority) : '',
          sourcePublishedAt: item && item.sourcePublishedAt
            ? String(item.sourcePublishedAt).slice(0, 10)
            : ''
        }))
        const totalCount = Math.max(0, Number(structuredContent.total) || sourceItems.length)
        const omittedCount = Math.max(0, totalCount - visibleItems.length)

        this.setData({
          visibleItems,
          totalCount,
          omittedCount,
          hasItems: visibleItems.length > 0
        })
        const relatedPageQuery = result._meta && typeof result._meta.relatedPageQuery === 'string'
          ? result._meta.relatedPageQuery
          : ''
        viewCtx.setRelatedPage({
          path: '/pages/official-notices/index',
          query: relatedPageQuery,
        })
        console.info(`[ai-mode] official-notice-list relatedPage query=${relatedPageQuery}`)
        console.info(
          `[ai-mode] official-notice-list setData total=${totalCount} visible=${visibleItems.length} omitted=${omittedCount}`
        )
      })

      viewCtx.on(NotificationType.Overflow, (data) => {
        const overflowed = !!(data && data.overflowHeight > 0)
        console.info(
          `[ai-mode] official-notice-list overflow overflowed=${overflowed} data=${JSON.stringify(data)}`
        )
      })
      console.info('[ai-mode] official-notice-list overflow monitor=on')
    },

    attached() {
      console.info('[ai-mode] official-notice-list attached')
      this.unsubscribeCampusTheme = subscribeCampusTheme((theme) => {
        this.setData({ darkMode: theme === 'dark' })
      })
    },
    detached() {
      if (this.unsubscribeCampusTheme) this.unsubscribeCampusTheme()
    }
  }
})
