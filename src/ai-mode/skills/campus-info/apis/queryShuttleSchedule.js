const { get } = require('../utils/request.js')
const { failure, success } = require('../utils/result.js')

const SERVICE_TYPES = new Set(['campus_loop', 'intercampus'])

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  const year = parsed.getFullYear()
  const normalized = `${year}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  return normalized === value && year >= 2020 && year <= 2100
}

const optionalDate = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  if (!isValidDate(value)) throw new Error('date 必须为有效的 YYYY-MM-DD 日期')
  return value
}

async function queryShuttleSchedule({ campus, date, serviceType } = {}) {
  try {
    const normalizedCampus = typeof campus === 'string' ? campus.trim() : undefined
    if (normalizedCampus && normalizedCampus.length > 40) throw new Error('campus 参数过长')
    const normalizedDate = optionalDate(date)
    if (serviceType && !SERVICE_TYPES.has(serviceType)) throw new Error('serviceType 参数无效')
    const data = await get('/api/v1/shuttle/routes', {
      campus: normalizedCampus,
      date: normalizedDate,
      service_type: serviceType,
      page: 1,
      page_size: 10,
    })
    const items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      id: item.id,
      name: item.name,
      serviceType: item.service_type,
      origin: item.origin,
      destination: item.destination,
      campuses: item.campuses,
      referenceDurationMinutes: item.reference_duration_minutes,
      notice: item.notice || null,
      resolvedSchedule: item.resolved_schedule ? {
        serviceDate: item.resolved_schedule.service_date,
        dayType: item.resolved_schedule.day_type,
        suspended: item.resolved_schedule.suspended,
        departureTimes: item.resolved_schedule.departure_times,
        note: item.resolved_schedule.note || null,
        nextDepartureAt: item.resolved_schedule.next_departure_at || null,
      } : null,
    }))
    const relatedPageQuery = 'campus=' + encodeURIComponent(normalizedCampus || '')
      + '&date=' + encodeURIComponent(normalizedDate || '')
      + '&serviceType=' + encodeURIComponent(serviceType || '')
    return {
      ...success({
        text: items.length
          ? `已查询到 ${data.total} 条已发布校车线路，可通过卡片入口进入小程序查看完整线路和班次。`
          : '所选条件下没有已发布校车线路，可通过卡片入口进入小程序调整查询条件。',
        structuredContent: { items, total: Number(data.total || 0), hasMore: Number(data.total || 0) > items.length },
      }),
      _meta: { relatedPageQuery },
      handoff: {
        query: 'campus=' + encodeURIComponent(normalizedCampus || '')
          + '&date=' + encodeURIComponent(normalizedDate || '')
          + '&serviceType=' + encodeURIComponent(serviceType || ''),
        card: { title: '查看校车安排' },
      },
    }
  } catch (error) {
    return failure('查询校车安排失败，请检查校区、日期或线路类型后稍后重试。')
  }
}

module.exports = queryShuttleSchedule
