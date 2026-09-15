import type { ShuttleRoute } from './repository'

type ShuttleTrip = ShuttleRoute['resolved_schedule']['trips'][number]

export type ShuttleJourneyTrip = {
  trip: ShuttleTrip
  fromIndex: number
  toIndex: number
  departureTime: string
  arrivalTime: string
}

export type ShuttleJourney = {
  route: ShuttleRoute
  trips: ShuttleJourneyTrip[]
  departureTimes: string[]
  nextDepartureAt?: string
  origin: string
  destination: string
  stopCount: number
  durationMinutes: number
}

const clockMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

const tripJourney = (
  trip: ShuttleTrip,
  origin?: string,
  destination?: string,
): ShuttleJourneyTrip | null => {
  const stopTimes = trip.stop_times || []
  if (!stopTimes.length) return null
  const fromIndex = origin
    ? stopTimes.findIndex((item) => item.stop_name === origin)
    : 0
  const toIndex = destination
    ? stopTimes.findIndex((item) => item.stop_name === destination)
    : stopTimes.length - 1
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= toIndex) return null
  return {
    trip,
    fromIndex,
    toIndex,
    departureTime: stopTimes[fromIndex].time,
    arrivalTime: stopTimes[toIndex].time,
  }
}

const departureAt = (serviceDate: string, time: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !/^\d{2}:\d{2}$/.test(time)) return null
  const timestamp = new Date(`${serviceDate}T${time}:00+08:00`).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const journeyDuration = (trip: ShuttleJourneyTrip) => {
  const departure = clockMinutes(trip.departureTime)
  const arrival = clockMinutes(trip.arrivalTime)
  if (departure === null || arrival === null) return 0
  return arrival >= departure ? arrival - departure : arrival + 24 * 60 - departure
}

export const shuttleOriginOptions = (routes: ShuttleRoute[]) => {
  const names = new Set<string>()
  routes.forEach((route) => {
    const trips = route.resolved_schedule.trips || []
    trips.forEach((trip) => {
      const stopTimes = trip.stop_times || []
      stopTimes.slice(0, -1).forEach((item) => names.add(item.stop_name))
    })
  })
  return Array.from(names)
}

export const shuttleDestinationOptions = (
  routes: ShuttleRoute[],
  origin?: string,
) => {
  const names = new Set<string>()
  routes.forEach((route) => {
    const trips = route.resolved_schedule.trips || []
    trips.forEach((trip) => {
      const stopTimes = trip.stop_times || []
      const start = origin
        ? stopTimes.findIndex((item) => item.stop_name === origin) + 1
        : 1
      if (start <= 0) return
      stopTimes.slice(start).forEach((item) => names.add(item.stop_name))
    })
  })
  return Array.from(names)
}

export const filterShuttleJourneys = (
  routes: ShuttleRoute[],
  serviceDate: string,
  origin?: string,
  destination?: string,
  now = Date.now(),
): ShuttleJourney[] => routes.flatMap((route) => {
  const filteringByStop = Boolean(origin || destination)
  if (!filteringByStop) {
    const trips = (route.resolved_schedule.trips || [])
      .map((trip) => tripJourney(trip))
      .filter((trip): trip is ShuttleJourneyTrip => Boolean(trip))
    return [{
      route,
      trips,
      departureTimes: route.resolved_schedule.departure_times || [],
      nextDepartureAt: route.resolved_schedule.next_departure_at || undefined,
      origin: route.origin,
      destination: route.destination,
      stopCount: route.stops.length,
      durationMinutes: route.reference_duration_minutes,
    }]
  }
  if (route.resolved_schedule.suspended) return []
  const trips = (route.resolved_schedule.trips || [])
    .map((trip) => tripJourney(trip, origin, destination))
    .filter((trip): trip is ShuttleJourneyTrip => Boolean(trip))
    .sort((left, right) => left.departureTime.localeCompare(right.departureTime))
  if (!trips.length) return []

  const departureTimes = Array.from(new Set(trips.map((trip) => trip.departureTime)))
  const nextTimestamp = trips
    .map((trip) => departureAt(serviceDate, trip.departureTime))
    .filter((timestamp): timestamp is number => timestamp !== null && timestamp >= now)
    .sort((left, right) => left - right)[0]
  const firstTrip = trips[0]
  const segment = firstTrip.trip.stop_times.slice(firstTrip.fromIndex, firstTrip.toIndex + 1)
  return [{
    route,
    trips,
    departureTimes,
    nextDepartureAt: nextTimestamp === undefined ? undefined : new Date(nextTimestamp).toISOString(),
    origin: origin || segment[0]?.stop_name || route.origin,
    destination: destination || segment[segment.length - 1]?.stop_name || route.destination,
    stopCount: segment.length,
    durationMinutes: journeyDuration(firstTrip) || route.reference_duration_minutes,
  }]
})
