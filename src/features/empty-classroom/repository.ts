import { apiRequest, createIdempotencyKey } from '../../api/client'
import type { components } from '../../api/generated/schema'

export type EmptyClassroomAvailability = components['schemas']['EmptyClassroomAvailability']
export type ClassroomView = components['schemas']['ClassroomView']
export type ClassroomReportCategory = components['schemas']['ClassroomReportCategory']
export type ClassroomOccupancyReportView = components['schemas']['ClassroomOccupancyReportView']

export type EmptyClassroomQuery = {
  campus: string
  date: string
  startSection: number
  endSection: number
}

export type ClassroomReportInput = {
  classroomId: number
  serviceDate: string
  startSection: number
  endSection: number
  category: ClassroomReportCategory
  description?: string
}

export const loadAvailableClassrooms = (query: EmptyClassroomQuery) => (
  apiRequest<EmptyClassroomAvailability>({
    path: '/api/v1/classrooms/available',
    query: {
      campus: query.campus,
      date: query.date,
      start_section: query.startSection,
      end_section: query.endSection,
    },
  })
)

export const createClassroomOccupancyReport = (input: ClassroomReportInput) => (
  apiRequest<ClassroomOccupancyReportView>({
    path: '/api/v1/classrooms/reports',
    method: 'POST',
    idempotencyKey: createIdempotencyKey('classroom-report'),
    data: {
      classroom_id: input.classroomId,
      service_date: input.serviceDate,
      start_section: input.startSection,
      end_section: input.endSection,
      category: input.category,
      description: input.description,
    },
  })
)
