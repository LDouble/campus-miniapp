import { describe, expect, it } from 'vitest'
import { getCoursesForDay, gradeItems, summarizeGrades } from './academic-display'

describe('academic display helpers', () => {
  it('groups timetable courses by weekday', () => {
    expect(getCoursesForDay(1).map(course => course.name)).toEqual(['高等数学 AⅡ', '大学英语Ⅱ'])
    expect(getCoursesForDay(7)).toEqual([])
  })

  it('excludes pending grades from the summary', () => {
    const summary = summarizeGrades(gradeItems)

    expect(summary.credits).toBe(17)
    expect(summary.passed).toBe(5)
    expect(summary.average).toBeCloseTo(87.06, 2)
    expect(summary.gradePoint).toBeCloseTo(3.71, 2)
  })
})
