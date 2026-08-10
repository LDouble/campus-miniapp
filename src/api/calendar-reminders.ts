import { apiRequest } from './client'
import type {
  AcademicEducationLevel,
  CalendarReminderList,
  CalendarReminderView,
} from './types'

export const listMyCalendarReminders = () => apiRequest<CalendarReminderList>({
  path: '/api/v1/academic/calendar/reminders',
})

export const putMyCalendarReminder = (input: {
  advance_days: 0 | 1 | 3 | 7
  education_level: AcademicEducationLevel
  event_id: string
}) => apiRequest<CalendarReminderView>({
  path: '/api/v1/academic/calendar/reminders',
  method: 'PUT',
  data: input,
})

export const deleteMyCalendarReminder = (id: number) => (
  apiRequest<CalendarReminderView>({
    path: `/api/v1/academic/calendar/reminders/${id}`,
    method: 'DELETE',
  })
)
