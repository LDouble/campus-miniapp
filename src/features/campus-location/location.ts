export const LAOSHAN_CAMPUS = '崂山校区'
export const WEST_COAST_CAMPUS = '西海岸校区'

export type CampusLocation = {
  latitude: number
  longitude: number
  accuracy: number
  horizontalAccuracy?: number
}

// 高德 POI 的 GCJ-02 坐标，与 getLocation(type: 'gcj02') 保持一致。
// 崂山：https://ditu.amap.com/place/B021407PWR
// 西海岸：https://www.amap.com/place/B0FFKKS5GT
// 仅判断校区附近，不将整个行政区或“离该校区更近”视为到校。
const CAMPUS_AREAS = [
  { name: LAOSHAN_CAMPUS, latitude: 36.161293, longitude: 120.499037 },
  { name: WEST_COAST_CAMPUS, latitude: 35.775004, longitude: 120.030367 },
]
const CAMPUS_RADIUS_METERS = 10000
const MAX_ACCURACY_METERS = 200

export const identifyCampus = (location: CampusLocation): string | null => {
  const { latitude, longitude, accuracy, horizontalAccuracy } = location
  if (
    !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isFinite(accuracy) || accuracy <= 0
  ) return null
  // 部分设备不返回水平精度或返回 0；若两种精度均可用，取较保守的值。
  const uncertainty = Number.isFinite(horizontalAccuracy) && Number(horizontalAccuracy) > 0
    ? Math.max(accuracy, Number(horizontalAccuracy))
    : accuracy
  if (uncertainty > MAX_ACCURACY_METERS) return null

  const radians = (value: number) => value * Math.PI / 180
  const campus = CAMPUS_AREAS.find((area) => {
    const latDelta = radians(latitude - area.latitude)
    const lngDelta = radians(longitude - area.longitude)
    const haversine = Math.sin(latDelta / 2) ** 2
      + Math.cos(radians(latitude)) * Math.cos(radians(area.latitude)) * Math.sin(lngDelta / 2) ** 2
    const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)))
    return distance + uncertainty <= CAMPUS_RADIUS_METERS
  })
  return campus?.name || null
}
