import type { components } from './generated/schema'

export type TokenPair = components['schemas']['TokenPair']
export type User = components['schemas']['User']
export type CurrentUser = components['schemas']['CurrentUser']
export type AccountCancellationPreflight = components['schemas']['AccountCancellationPreflight']
export type AccountCancellationResult = components['schemas']['AccountCancellationResult']
export type AcademicIdentity = components['schemas']['AcademicIdentity']
export type AcademicVerificationRequest = components['schemas']['AcademicVerificationRequest']
export type AcademicVerificationStatus = components['schemas']['AcademicVerificationStatus']
export type AcademicVerificationMaterial = components['schemas']['AcademicVerificationMaterial']
export type AcademicVerificationUploadTarget = components['schemas']['AcademicVerificationUploadTarget']
export type AcademicPeriod = components['schemas']['AcademicPeriod']
export type AcademicCalendar = components['schemas']['AcademicCalendar']
export type AcademicCalendarEvent = components['schemas']['AcademicCalendarEvent']
export type AcademicCalendarTerm = components['schemas']['AcademicCalendarTerm']
export type AcademicEducationLevel = components['schemas']['AcademicEducationLevel']
export type CalendarReminderView = components['schemas']['CalendarReminderView']
export type CalendarReminderList = components['schemas']['CalendarReminderList']
export type AcademicCourse = components['schemas']['AcademicCourse']
export type AcademicGrade = components['schemas']['AcademicGrade']
export type AcademicExam = components['schemas']['AcademicExam']
export type AcademicCourseSelection = components['schemas']['AcademicCourseSelection']
export type AcademicCoursePassRatePage = components['schemas']['AcademicCoursePassRatePage']
export type AcademicInstructorPassRatePage = components['schemas']['AcademicInstructorPassRatePage']
export type AcademicPassRateTrend = components['schemas']['AcademicPassRateTrend']

export type ErrandView = components['schemas']['ErrandView']
export type ErrandViewPage = components['schemas']['ErrandViewPage']
export type ErrandOrderResult = components['schemas']['ErrandOrderResult']
export type ErrandOptionalOrderResult = components['schemas']['ErrandOptionalOrderResult']

export type MarketplaceListingView = components['schemas']['MarketplaceListingView']
export type MarketplaceListingViewPage = components['schemas']['MarketplaceListingViewPage']
export type MarketplaceTradeOrder = components['schemas']['MarketplaceTradeOrder']
export type TradeOrderView = components['schemas']['TradeOrderView']
export type TradeOrderViewPage = components['schemas']['TradeOrderViewPage']

export type CarpoolTripView = components['schemas']['CarpoolTripView']
export type CarpoolTripViewPage = components['schemas']['CarpoolTripViewPage']

export type CampusCircleSectionView = components['schemas']['CampusCircleSectionView']
export type CampusCirclePostView = components['schemas']['CampusCirclePostView']
export type CampusCirclePostViewPage = components['schemas']['CampusCirclePostPage']
export type CampusCircleHome = components['schemas']['CampusCircleHome']
export type CampusCircleTopicView = components['schemas']['CampusCircleTopicView']
export type CampusCircleTopicPage = components['schemas']['CampusCircleTopicPage']

export type HomeFeedItemView = components['schemas']['HomeFeedItemView']
export type HomeFeedPage = components['schemas']['HomeFeedPage']
export type HomeFeedSourceType = components['schemas']['HomeFeedSourceType']
export type PublicCommentPreview = components['schemas']['PublicCommentPreview']

export type CommentView = components['schemas']['CommentView']
export type CommentViewPage = components['schemas']['CommentPage']
export type ContentReportView = components['schemas']['ContentReportView']
export type CommentThread = components['schemas']['CommentThread']
export type ReactionResourceType = components['schemas']['ReactionResourceType']
export type ReactionState = components['schemas']['ReactionState']
export type UserLevelSummary = components['schemas']['UserLevelSummary']
export type UserExperienceLedgerView = components['schemas']['UserExperienceLedgerView']
export type UserExperienceLedgerPage = components['schemas']['UserExperienceLedgerPage']
export type UserLevelTask = components['schemas']['UserLevelTask']
export type UserLevelTaskList = components['schemas']['UserLevelTaskList']
export type DailyCheckinStatus = components['schemas']['DailyCheckinStatus']
export type DailyCheckinResult = components['schemas']['DailyCheckinResult']
export type DailyCheckinHistory = components['schemas']['DailyCheckinHistory']
export type DailyCheckinHistoryItem = components['schemas']['DailyCheckinHistoryItem']

export type PublicUserProfile = components['schemas']['UserProfile']

export type Notice = components['schemas']['Notice']
export type NoticePage = components['schemas']['NoticePage']

export type MaterialCourseView = components['schemas']['MaterialCourseView']
export type MaterialCoursePage = components['schemas']['MaterialCoursePage']
export type CourseMaterialView = components['schemas']['CourseMaterialView']
export type CourseMaterialPage = components['schemas']['CourseMaterialPage']
export type MaterialUploadFileInput = components['schemas']['MaterialUploadFileInput']
export type MaterialUploadSessionView = components['schemas']['MaterialUploadSessionView']
export type MaterialUploadTarget = components['schemas']['MaterialUploadTarget']
export type CompleteMaterialUploadFile = components['schemas']['CompleteMaterialUploadFile']
export type MaterialDownloadView = components['schemas']['MaterialDownloadView']
export type MaterialFileView = components['schemas']['MaterialFileView']
export type MaterialFeedbackCategory = components['schemas']['MaterialFeedbackCategory']
export type MaterialFeedbackStatus = components['schemas']['MaterialFeedbackStatus']
export type MaterialFeedbackView = components['schemas']['MaterialFeedbackView']
export type MaterialFeedbackPage = components['schemas']['MaterialFeedbackPage']

export type AcademicCacheMetadata = components['schemas']['AcademicQueryCache']

export type ApiSuccessEnvelope<T> = {
  data: T
  request_id: string
  cache?: AcademicCacheMetadata | null
}

export type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
  }
  request_id: string
}
