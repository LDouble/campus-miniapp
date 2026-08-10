const { get } = require('../utils/request.js')
const { failure, success } = require('../utils/result.js')

const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  const year = parsed.getFullYear()
  const normalized = `${year}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  return normalized === value && year >= 2020 && year <= 2100
}
const validSection = (value) => Number.isInteger(value) && value >= 1 && value <= 12

async function findEmptyClassrooms({ campus, date, startSection, endSection } = {}) {
  try {
    const normalizedCampus = typeof campus === 'string' ? campus.trim() : ''
    if (!normalizedCampus || normalizedCampus.length > 40) throw new Error('campus 参数无效')
    if (!validDate(date)) throw new Error('date 必须为 YYYY-MM-DD')
    if (!validSection(startSection) || !validSection(endSection) || endSection < startSection) {
      throw new Error('startSection 和 endSection 必须为 1 至 12 的有效节次')
    }
    const data = await get('/api/v1/classrooms/available', {
      campus: normalizedCampus,
      date,
      start_section: startSection,
      end_section: endSection,
    })
    const groups = (Array.isArray(data.groups) ? data.groups : []).map((group) => ({
      building: group.building,
      classrooms: (Array.isArray(group.classrooms) ? group.classrooms : []).map((item) => ({
        id: item.classroom && item.classroom.id,
        displayName: item.classroom && item.classroom.display_name,
        room: item.classroom && item.classroom.room,
        capacity: item.classroom && item.classroom.capacity,
        roomType: item.classroom && item.classroom.room_type,
        facilities: (item.classroom && item.classroom.facilities) || [],
        confidence: item.confidence,
      })),
    }))
    const total = groups.reduce((count, group) => count + group.classrooms.length, 0)
    const relatedPageQuery = 'campus=' + encodeURIComponent(normalizedCampus)
      + '&date=' + encodeURIComponent(date)
      + '&startSection=' + encodeURIComponent(String(startSection))
      + '&endSection=' + encodeURIComponent(String(endSection))
    return {
      ...success({
        text: total
          ? `已找到 ${total} 间可用教室，结果基于课表和已确认占用，不代表实时状态；可通过卡片入口进入小程序查看完整列表。`
          : '该校区、日期和节次下暂未找到可用教室，可通过卡片入口进入小程序调整查询条件。',
        structuredContent: {
          campus: data.campus,
          serviceDate: data.service_date,
          startSection: data.start_section,
          endSection: data.end_section,
          teachingWeek: data.teaching_week,
          dataSourceNotice: data.data_source_notice,
          refreshedAt: data.refreshed_at,
          groups,
          total,
        },
      }),
      _meta: { relatedPageQuery },
      handoff: {
        query: 'campus=' + encodeURIComponent(normalizedCampus)
          + '&date=' + encodeURIComponent(date)
          + '&startSection=' + encodeURIComponent(String(startSection))
          + '&endSection=' + encodeURIComponent(String(endSection)),
        card: { title: '查看空教室' },
      },
    }
  } catch (error) {
    return failure('查询空教室失败，请检查校区、日期和节次后稍后重试。')
  }
}

module.exports = findEmptyClassrooms
