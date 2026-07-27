import Taro from '@tarojs/taro'
import {
  AcademicPreferences,
  Course,
  GradeSimulation,
} from './types'

const CUSTOM_COURSES_KEY = 'academic.customCourses.v1'
const PREFERENCES_KEY = 'academic.preferences.v1'
const GRADE_SIMULATION_KEY = 'academic.gradeSimulation.v1'

const safeRead = <T>(key: string, fallback: T): T => {
  try {
    return Taro.getStorageSync<T>(key) || fallback
  } catch (error) {
    return fallback
  }
}

const safeWrite = <T>(key: string, value: T) => {
  try {
    Taro.setStorageSync(key, value)
  } catch (error) {
    Taro.showToast({ title: '本地保存失败，请稍后重试', icon: 'none' })
  }
}

export const academicStorage = {
  getCustomCourses: () => safeRead<Course[]>(CUSTOM_COURSES_KEY, []),
  setCustomCourses: (courses: Course[]) => safeWrite(CUSTOM_COURSES_KEY, courses),
  getPreferences: (fallback: AcademicPreferences) => (
    safeRead<AcademicPreferences>(PREFERENCES_KEY, fallback)
  ),
  setPreferences: (preferences: AcademicPreferences) => (
    safeWrite(PREFERENCES_KEY, preferences)
  ),
  getGradeSimulations: () => (
    safeRead<Record<string, GradeSimulation>>(GRADE_SIMULATION_KEY, {})
  ),
  setGradeSimulations: (simulations: Record<string, GradeSimulation>) => (
    safeWrite(GRADE_SIMULATION_KEY, simulations)
  ),
}
