import { apiRequest, createIdempotencyKey } from '../../api/client'

export type BlueBikeFaultType = 'brake' | 'throttle' | 'steering' | 'light' | 'other'

export type BlueBikeFault = {
  id: number
  bike_number: string
  fault_types: BlueBikeFaultType[]
  description: string
  latitude: number
  longitude: number
  status: 'active' | 'resolved'
  created_at: string
  resolved_at?: string | null
}

type Page<T> = {
  items: T[]
  total: number
}

export const campusCrowdRepository = {
  listBikeFaults: () => apiRequest<Page<BlueBikeFault>>({
    path: '/api/v1/blue-bike-faults',
    query: { status: 'active' },
  }),

  createBikeFault: (input: {
    bikeNumber: string
    faultTypes: BlueBikeFaultType[]
    description?: string
    latitude: number
    longitude: number
  }) => apiRequest<BlueBikeFault>({
    path: '/api/v1/blue-bike-faults',
    method: 'POST',
    idempotencyKey: createIdempotencyKey('blue-bike-fault'),
    data: {
      bike_number: input.bikeNumber,
      fault_types: input.faultTypes,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  }),

  resolveBikeFault: (id: number) => apiRequest<BlueBikeFault>({
    path: `/api/v1/blue-bike-faults/${id}/resolve`,
    method: 'POST',
    idempotencyKey: createIdempotencyKey(`blue-bike-fault:${id}:resolve`),
  }),
}
