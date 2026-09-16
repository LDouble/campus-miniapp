import { apiRequest, createIdempotencyKey } from './client'
import type {
  AcademicEducationLevel,
  PersonalTimetableItemList,
  PersonalTimetableItemView,
} from './types'

export const listPersonalTimetableItems = (
  educationLevel: AcademicEducationLevel,
  periodId: string,
) => apiRequest<PersonalTimetableItemList>({
  path: '/api/v1/me/timetable/items',
  method: 'GET',
  query: {
    education_level: educationLevel,
    period_id: periodId,
  },
})

export type AddPersonalTimetableItemInput = {
  educationLevel: AcademicEducationLevel
  periodId: string
  offeringId: string
  scheduleSlotIds: number[]
  dataVersion: string
}

export const addPersonalTimetableItem = (input: AddPersonalTimetableItemInput) => (
  apiRequest<PersonalTimetableItemView>({
    path: '/api/v1/me/timetable/items',
    method: 'POST',
    data: {
      education_level: input.educationLevel,
      period_id: input.periodId,
      offering_id: input.offeringId,
      schedule_slot_ids: input.scheduleSlotIds,
      data_version: input.dataVersion,
    },
    idempotencyKey: createIdempotencyKey('personal-timetable:add'),
  })
)

export const removePersonalTimetableItem = (itemId: number, expectedVersion: number) => (
  apiRequest<PersonalTimetableItemView>({
    path: `/api/v1/me/timetable/items/${itemId}`,
    method: 'DELETE',
    query: { expected_version: expectedVersion },
    idempotencyKey: createIdempotencyKey('personal-timetable:remove'),
  })
)

export const refreshPersonalTimetableItem = (itemId: number, expectedVersion: number) => (
  apiRequest<PersonalTimetableItemView>({
    path: `/api/v1/me/timetable/items/${itemId}/refresh`,
    method: 'POST',
    data: { expected_version: expectedVersion },
    idempotencyKey: createIdempotencyKey('personal-timetable:refresh'),
  })
)
