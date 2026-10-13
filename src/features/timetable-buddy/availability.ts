import type { TimetableBuddyScheduleSide, TimetableBuddySlot, TimetableBuddyVisibleCourse } from './model'

const slotKey = (weekday: number, section: number) => `${weekday}:${section}`

export const slotsForWeek = (
  side: Pick<TimetableBuddyScheduleSide, 'courses' | 'busySlots'>,
  week: number,
): TimetableBuddySlot[] => {
  const fromCourses = (side.courses || []).flatMap((course: TimetableBuddyVisibleCourse) => (
    course.weeks.includes(week)
      ? course.sections.map((section) => ({ weekday: course.weekday, section, weeks: [week] }))
      : []
  ))
  const source = fromCourses.length ? fromCourses : (side.busySlots || []).filter((slot) => slot.weeks.includes(week))
  return [...new Map(source.map((slot) => [slotKey(slot.weekday, slot.section), slot])).values()]
}

/** 任一方课表未就绪时不把未知节次推断为空闲。 */
export const commonFreeSlotsForWeek = (
  me: TimetableBuddyScheduleSide,
  buddy: TimetableBuddyScheduleSide,
  week: number,
  sectionsPerDay = 12,
): TimetableBuddySlot[] | null => {
  const isReady = (side: TimetableBuddyScheduleSide) => (
    side.dataStatus === 'ready'
    && side.customCoursesReady
    && Boolean(side.syncedAt)
    && Boolean(side.customCoursesSyncedAt)
  )
  if (me.paused || buddy.paused || !isReady(me) || !isReady(buddy)) return null
  const busy = new Set([...slotsForWeek(me, week), ...slotsForWeek(buddy, week)]
    .map((slot) => slotKey(slot.weekday, slot.section)))
  const free: TimetableBuddySlot[] = []
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    for (let section = 1; section <= sectionsPerDay; section += 1) {
      if (!busy.has(slotKey(weekday, section))) free.push({ weekday, section, weeks: [week] })
    }
  }
  return free
}

export const hasBusySlot = (slots: TimetableBuddySlot[], weekday: number, section: number) => (
  slots.some((slot) => slot.weekday === weekday && slot.section === section)
)
