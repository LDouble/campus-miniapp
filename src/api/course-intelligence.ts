import { createIdempotencyKey, apiRequest } from './client'
import type {
  CourseIntelligenceContributionInput,
  CourseIntelligenceContributionView,
  CourseIntelligenceOverview,
  CourseIntelligenceReviewPage,
} from './types'

const coursePath = (courseCode: string) => encodeURIComponent(courseCode.trim())

export const getCourseIntelligenceOverview = (
  courseCode: string,
  options: { teacherId?: number; teacherName?: string; term?: string } = {},
) => apiRequest<CourseIntelligenceOverview>({
  path: `/api/v1/course-intelligence/courses/${coursePath(courseCode)}`,
  method: 'GET',
  query: {
    ...(options.teacherId ? { teacher_id: options.teacherId } : {}),
    ...(!options.teacherId && options.teacherName?.trim() ? { teacher_name: options.teacherName.trim() } : {}),
    ...(options.term?.trim() ? { term: options.term.trim() } : {}),
  },
})

export const listCourseIntelligenceReviews = (
  courseCode: string,
  options: { teacherId?: number; teacherName?: string; dimension?: string; page?: number; pageSize?: number } = {},
) => apiRequest<CourseIntelligenceReviewPage>({
  path: `/api/v1/course-intelligence/courses/${coursePath(courseCode)}/reviews`,
  method: 'GET',
  query: {
    ...(options.teacherId ? { teacher_id: options.teacherId } : {}),
    ...(!options.teacherId && options.teacherName?.trim() ? { teacher_name: options.teacherName.trim() } : {}),
    ...(options.dimension ? { dimension: options.dimension } : {}),
    page: options.page || 1,
    page_size: options.pageSize || 20,
  },
})

export const createCourseIntelligenceContribution = (input: CourseIntelligenceContributionInput) => (
  apiRequest<CourseIntelligenceContributionView>({
    path: '/api/v1/course-intelligence/contributions',
    method: 'POST',
    data: input,
    idempotencyKey: createIdempotencyKey('course-intelligence-contribution'),
  })
)

export const addCourseIntelligenceReaction = (
  reviewId: number,
  reactionType: 'useful' | 'not_useful',
) => apiRequest<{ accepted: boolean }>({
  path: `/api/v1/course-intelligence/reviews/${reviewId}/reactions`,
  method: 'POST',
  data: { reaction_type: reactionType },
  idempotencyKey: createIdempotencyKey('course-intelligence-reaction'),
})

export const reportCourseIntelligenceReview = (
  reviewId: number,
  reason: 'privacy' | 'defamation' | 'duplicate' | 'inaccurate' | 'other',
  description?: string,
) => apiRequest<{ accepted: boolean }>({
  path: `/api/v1/course-intelligence/reviews/${reviewId}/reports`,
  method: 'POST',
  data: { reason, ...(description?.trim() ? { description: description.trim() } : {}) },
  idempotencyKey: createIdempotencyKey('course-intelligence-report'),
})
