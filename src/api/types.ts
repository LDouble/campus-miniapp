import type { components } from './generated/schema'

export type TokenPair = components['schemas']['TokenPair']
export type CurrentUser = components['schemas']['CurrentUser']
export type AcademicIdentity = components['schemas']['AcademicIdentity']
export type AcademicVerificationRequest = components['schemas']['AcademicVerificationRequest']
export type AcademicVerificationStatus = components['schemas']['AcademicVerificationStatus']
export type AcademicVerificationMaterial = components['schemas']['AcademicVerificationMaterial']
export type AcademicPeriod = components['schemas']['AcademicPeriod']
export type AcademicCourse = components['schemas']['AcademicCourse']
export type AcademicGrade = components['schemas']['AcademicGrade']
export type AcademicExam = components['schemas']['AcademicExam']
export type AcademicCourseSelection = components['schemas']['AcademicCourseSelection']

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

export type CommentView = components['schemas']['CommentView']
export type CommentViewPage = components['schemas']['CommentPage']
export type CommentThread = components['schemas']['CommentThread']

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

export type ApiSuccessEnvelope<T> = {
  data: T
  request_id: string
}

export type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
  }
  request_id: string
}
