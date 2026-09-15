import { strict as assert } from 'node:assert'
import {
  filterDayViewBuilding,
  formatAvailableSectionRanges,
  normalizeAvailableSections,
  normalizeDayAvailabilityGroups,
  type DayViewBuildingGroup,
} from '../src/features/empty-classroom/day-view'

const groups: DayViewBuildingGroup<{ id: number }>[] = [
  {
    building: '行远楼',
    classrooms: [{ classroom: { id: 1 }, building: '行远楼', available_sections: [1, 2, 5] }],
  },
  {
    building: '教学楼',
    classrooms: [{ classroom: { id: 2 }, building: '教学楼', available_sections: [3, 4] }],
  },
]

assert.deepEqual(normalizeAvailableSections([5, 2, 2, 1, 0, 13, 1.5]), [1, 2, 5])
assert.deepEqual(normalizeAvailableSections([1, 3], 2), [1])
assert.deepEqual(normalizeAvailableSections([1], 0), [])
assert.equal(formatAvailableSectionRanges([1, 2, 5, 7, 8]), '1—2节、5节、7—8节')
assert.equal(formatAvailableSectionRanges([], 12), '暂无空闲时段')
assert.deepEqual(filterDayViewBuilding(groups, '行远楼'), [groups[0]])
assert.deepEqual(filterDayViewBuilding(groups, ' all '), groups)
assert.deepEqual(filterDayViewBuilding(groups), groups)
assert.deepEqual(
  normalizeDayAvailabilityGroups([
    { building: '行远楼', classrooms: [{ available_sections: null }] },
  ])[0].classrooms[0].available_sections,
  [],
)
assert.deepEqual(normalizeDayAvailabilityGroups({} as never), [])
assert.deepEqual(
  normalizeDayAvailabilityGroups([{ building: '行远楼', classrooms: {} as never }]),
  [{ building: '行远楼', classrooms: [] }],
)
assert.deepEqual(normalizeAvailableSections({} as never), [])

console.log('empty classroom day view rules: ok')
