import type { MaterialCourseSuggestion, MaterialKind } from './types'
import { mergeCourseSuggestions } from './validation'
import type { MaterialCourseView } from '../../api/types'

const extensionPattern = /\.[^./\\]+$/
const separatorsPattern = /[_—–-]+/g
const whitespacePattern = /\s+/g

const kindRules: Array<{ kind: MaterialKind; pattern: RegExp }> = [
  { kind: 'exam', pattern: /(真题|试卷|期中|期末|考试|答案|解析)/i },
  { kind: 'slides', pattern: /(课件|讲义|ppt|slide|第\s*\d+\s*[章节讲])/i },
  { kind: 'notes', pattern: /(笔记|课堂记录|错题|手写)/i },
  { kind: 'homework', pattern: /(作业|习题|练习|assignment|homework)/i },
  { kind: 'review', pattern: /(复习|重点|总结|提纲|知识点|考点)/i },
]

export const normalizeMaterialTitle = (fileName: string) => {
  const withoutExtension = fileName.replace(extensionPattern, '')
  return withoutExtension
    .replace(separatorsPattern, ' ')
    .replace(whitespacePattern, ' ')
    .trim()
}

export const inferMaterialKind = (fileName: string): MaterialKind => (
  kindRules.find((rule) => rule.pattern.test(fileName))?.kind || 'other'
)

const normalizeCourseMatchText = (value: string) => (
  value.toLowerCase().replace(/[\s()（）_\-—–·.]/g, '')
)

export const inferCourseSuggestion = (
  fileName: string,
  courses: MaterialCourseSuggestion[],
  fallback?: MaterialCourseSuggestion,
) => {
  if (fallback?.name) return fallback
  const target = normalizeCourseMatchText(fileName)
  return [...courses]
    .filter((course) => course.name.trim())
    .sort((left, right) => right.name.length - left.name.length)
    .find((course) => target.includes(normalizeCourseMatchText(course.name)))
}

export const buildCourseSuggestions = (
  courses: MaterialCourseView[],
  cached: MaterialCourseSuggestion[],
) => mergeCourseSuggestions(courses, cached)
