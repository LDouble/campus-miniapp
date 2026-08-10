const { get } = require('../utils/request.js')
const { failure, success } = require('../utils/result.js')

const SOURCES = new Set(['school', 'undergraduate', 'graduate', 'department'])
const CATEGORIES = new Set(['teaching', 'training', 'awards', 'campus', 'career', 'other'])

const optionalEnum = (value, allowed, name) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !allowed.has(value)) throw new Error(`${name} 参数无效`)
  return value
}

const DAYS = new Set([0, 7, 30, 90])

const publishedSinceFromDays = (days) => {
  if (days === undefined || days === null || days === 0) return undefined
  if (!Number.isInteger(days) || !DAYS.has(days)) throw new Error('days 参数无效')
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

async function searchOfficialNotices({ keyword, source, category, days } = {}) {
  try {
    const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() : undefined
    if (normalizedKeyword && normalizedKeyword.length > 128) throw new Error('keyword 参数过长')
    if (days !== undefined && days !== null && !DAYS.has(days)) throw new Error('days 参数无效')
    const data = await get('/api/v1/official-notices', {
      keyword: normalizedKeyword,
      source: optionalEnum(source, SOURCES, 'source'),
      category: optionalEnum(category, CATEGORIES, 'category'),
      published_since: publishedSinceFromDays(days),
      page: 1,
      page_size: 10,
    })
    const items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.source,
      publisher: item.publisher,
      category: item.category,
      priority: item.priority,
      sourcePublishedAt: item.source_published_at,
    }))
    const relatedPageQuery = 'keyword=' + encodeURIComponent(normalizedKeyword || '')
      + '&source=' + encodeURIComponent(source || '')
      + '&category=' + encodeURIComponent(category || '')
      + '&days=' + encodeURIComponent(days === undefined || days === null ? '' : String(days))
    return {
      ...success({
        text: items.length
          ? `已找到 ${data.total} 条已发布官方通知，可通过卡片入口进入小程序查看完整列表。`
          : '未找到符合条件的已发布官方通知，可通过卡片入口进入小程序调整筛选条件。',
        structuredContent: { items, total: Number(data.total || 0), hasMore: Number(data.total || 0) > items.length },
      }),
      _meta: { relatedPageQuery },
      handoff: {
        query: 'keyword=' + encodeURIComponent(normalizedKeyword || '')
          + '&source=' + encodeURIComponent(source || '')
          + '&category=' + encodeURIComponent(category || '')
          + '&days=' + encodeURIComponent(days === undefined || days === null ? '' : String(days)),
        card: { title: '查看官方通知' },
      },
    }
  } catch (error) {
    return failure('查询官方通知失败，请检查筛选条件后稍后重试。')
  }
}

module.exports = searchOfficialNotices
