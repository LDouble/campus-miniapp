const API_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2})$/
const CAMPUS_OFFSET_MINUTES = 8 * 60

const utcTimestamp = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) => {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, millisecond)
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
    || date.getUTCSeconds() !== second
  ) return Number.NaN
  return date.getTime()
}

const timezoneOffsetMinutes = (value?: string) => {
  if (!value || value === 'Z') return 0
  const sign = value.startsWith('-') ? -1 : 1
  const digits = value.slice(1).replace(':', '')
  const hours = Number(digits.slice(0, 2))
  const minutes = Number(digits.slice(2, 4))
  if (hours > 23 || minutes > 59) return Number.NaN
  return sign * (hours * 60 + minutes)
}

// API date-time fields represent instants. Legacy values without an explicit
// offset are interpreted as UTC, matching the server's canonical storage.
export const apiDateTimeTimestamp = (value?: string | null) => {
  if (!value) return Number.NaN
  const match = API_DATE_TIME_PATTERN.exec(value.trim())
  if (!match) return Number.NaN
  const [, year, month, day, hour, minute, second = '0', fraction = '', zone] = match
  const timestamp = utcTimestamp(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number((fraction + '000').slice(0, 3)),
  )
  const offset = timezoneOffsetMinutes(zone)
  if (!Number.isFinite(timestamp) || !Number.isFinite(offset)) return Number.NaN
  return timestamp - offset * 60_000
}

export const parseApiDateTime = (value?: string | null) => {
  const timestamp = apiDateTimeTimestamp(value)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

const pad = (value: number) => String(value).padStart(2, '0')

export const apiDateTimeCampusParts = (value?: string | null) => {
  const timestamp = apiDateTimeTimestamp(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp + CAMPUS_OFFSET_MINUTES * 60_000)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  return {
    year,
    month,
    day,
    hour,
    minute,
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  }
}

export const campusDateTimeToISOString = (dateValue: string, timeValue: string) => {
  const dateMatch = LOCAL_DATE_PATTERN.exec(dateValue)
  const timeMatch = LOCAL_TIME_PATTERN.exec(timeValue)
  if (!dateMatch || !timeMatch) return ''
  const [, year, month, day] = dateMatch
  const [, hour, minute] = timeMatch
  const campusTimestamp = utcTimestamp(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  )
  if (!Number.isFinite(campusTimestamp)) return ''
  return new Date(campusTimestamp - CAMPUS_OFFSET_MINUTES * 60_000).toISOString()
}
