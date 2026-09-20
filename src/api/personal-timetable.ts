import { apiRequest, createIdempotencyKey } from './client'
import type {
  AcademicEducationLevel,
  PersonalTimetableItemList,
  PersonalTimetableItemView,
} from './types'
import { createSharedResource } from '../state/shared-resource'

const PERSONAL_TIMETABLE_FRESH_MS = 30_000

const createPersonalTimetableResource = () => createSharedResource<PersonalTimetableItemList>({
  maxAgeMs: PERSONAL_TIMETABLE_FRESH_MS,
  group: 'session',
})

const personalTimetableResources = new Map<string, ReturnType<typeof createPersonalTimetableResource>>()

const personalTimetableResource = (
  educationLevel: AcademicEducationLevel,
  periodId: string,
) => {
  const key = `${educationLevel}:${periodId.trim()}`
  const existing = personalTimetableResources.get(key)
  if (existing) return existing
  const created = createPersonalTimetableResource()
  personalTimetableResources.set(key, created)
  return created
}

export const invalidatePersonalTimetableItems = () => {
  personalTimetableResources.forEach((resource) => resource.invalidate({ clearData: true }))
  personalTimetableResources.clear()
}

export const listPersonalTimetableItems = (
  educationLevel: AcademicEducationLevel,
  periodId: string,
  options: { force?: boolean } = {},
) => personalTimetableResource(educationLevel, periodId).ensure(
  () => apiRequest<PersonalTimetableItemList>({
    path: '/api/v1/me/timetable/items',
    method: 'GET',
    query: {
      education_level: educationLevel,
      period_id: periodId,
    },
  }),
  options,
)

export type AddPersonalTimetableItemInput = {
  educationLevel: AcademicEducationLevel
  periodId: string
  offeringId: string
  scheduleSlotIds: number[]
  dataVersion: string
}

export const addPersonalTimetableItem = async (input: AddPersonalTimetableItemInput) => {
  const item = await apiRequest<PersonalTimetableItemView>({
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
  invalidatePersonalTimetableItems()
  return item
}

export const removePersonalTimetableItem = async (itemId: number, expectedVersion: number) => {
  const item = await apiRequest<PersonalTimetableItemView>({
    path: `/api/v1/me/timetable/items/${itemId}`,
    method: 'DELETE',
    query: { expected_version: expectedVersion },
    idempotencyKey: createIdempotencyKey('personal-timetable:remove'),
  })
  invalidatePersonalTimetableItems()
  return item
}

export const refreshPersonalTimetableItem = async (itemId: number, expectedVersion: number) => {
  const item = await apiRequest<PersonalTimetableItemView>({
    path: `/api/v1/me/timetable/items/${itemId}/refresh`,
    method: 'POST',
    data: { expected_version: expectedVersion },
    idempotencyKey: createIdempotencyKey('personal-timetable:refresh'),
  })
  invalidatePersonalTimetableItems()
  return item
}
