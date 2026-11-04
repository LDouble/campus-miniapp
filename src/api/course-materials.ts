import {
  apiRequest,
  createIdempotencyKey,
} from './client'
import type {
  CompleteMaterialUploadFile,
  CourseMaterialPage,
  CourseMaterialView,
  MaterialFeedbackCategory,
  MaterialFeedbackPage,
  MaterialFeedbackView,
  MaterialCoursePage,
  MaterialDownloadView,
  MaterialQuotaView,
  MaterialAdRewardSessionView,
  MaterialCloudShareView,
  CreateMaterialCloudShareRequest,
  MaterialUploadSessionView,
  MaterialUploadTarget,
} from './types'
import type { operations } from './generated/schema'
import { uploadFileToObjectStorage } from './object-upload'

type ListCourseMaterialsParameters = NonNullable<
operations['ListCourseMaterials']['parameters']['query']
>
export type UpdateMyCourseMaterialRequest = operations['UpdateMyCourseMaterial']['requestBody']['content']['application/json']
export type CreateMaterialUploadSessionRequest = operations['CreateMaterialUploadSession']['requestBody']['content']['application/json']
export type CreateMaterialAdRewardSessionResponse = MaterialAdRewardSessionView

export interface ListCourseMaterialsQuery {
  courseId?: ListCourseMaterialsParameters['course_id']
  materialType?: ListCourseMaterialsParameters['material_type']
  sourceType?: ListCourseMaterialsParameters['source_type']
  keyword?: ListCourseMaterialsParameters['keyword']
  periodId?: ListCourseMaterialsParameters['period_id']
  page?: ListCourseMaterialsParameters['page']
  pageSize?: ListCourseMaterialsParameters['page_size']
}

export const listMaterialCourses = (keyword = '', page = 1, pageSize = 100) => (
  apiRequest<MaterialCoursePage>({
    path: '/api/v1/material-courses',
    query: { keyword, page, page_size: pageSize },
  })
)

export const listAllMaterialCourses = async () => {
  const pageSize = 100
  let page = 1
  let result: MaterialCoursePage['items'] = []
  while (true) {
    const current = await listMaterialCourses('', page, pageSize)
    result = [...result, ...current.items]
    if (result.length >= current.total || current.items.length < pageSize) return result
    page += 1
  }
}

export const listCourseMaterials = (query: ListCourseMaterialsQuery = {}) => (
  apiRequest<CourseMaterialPage>({
    path: '/api/v1/course-materials',
    query: {
      course_id: query.courseId,
      material_type: query.materialType,
      source_type: query.sourceType,
      keyword: query.keyword,
      period_id: query.periodId,
      page: query.page || 1,
      page_size: query.pageSize || 20,
    },
  })
)

export const listMyCourseMaterials = (
  status?: CourseMaterialView['status'],
  page = 1,
  pageSize = 100,
) => apiRequest<CourseMaterialPage>({
  path: '/api/v1/course-materials/mine',
  query: { status, page, page_size: pageSize },
})

export const listAllMyCourseMaterials = async (
  status?: CourseMaterialView['status'],
) => {
  const pageSize = 100
  let page = 1
  let result: CourseMaterialPage['items'] = []
  while (true) {
    const current = await listMyCourseMaterials(status, page, pageSize)
    result = [...result, ...current.items]
    if (result.length >= current.total || current.items.length < pageSize) return result
    page += 1
  }
}

export const getCourseMaterial = (materialId: number) => (
  apiRequest<CourseMaterialView>({
    path: `/api/v1/course-materials/${materialId}`,
  })
)

export const createMaterialUploadSession = (
  data: CreateMaterialUploadSessionRequest,
  idempotencyKey: string,
) => (
  apiRequest<MaterialUploadSessionView>({
    path: '/api/v1/course-materials/upload-sessions',
    method: 'POST',
    data,
    idempotencyKey,
  })
)

export const completeMaterialUploadSession = (
  sessionId: number,
  expectedVersion: number,
  files: CompleteMaterialUploadFile[],
  idempotencyKey: string,
) => apiRequest<MaterialUploadSessionView>({
  path: `/api/v1/course-materials/upload-sessions/${sessionId}/complete`,
  method: 'POST',
  data: {
    expected_version: expectedVersion,
    files,
  },
  idempotencyKey,
})

export const uploadMaterialFile = (
  target: MaterialUploadTarget,
  filePath: string,
  onProgress: (progress: number) => void,
) => {
  return uploadFileToObjectStorage(target, filePath, onProgress)
}

export const getMaterialDownload = (materialId: number, fileId: number) => (
  apiRequest<MaterialDownloadView>({
    path: `/api/v1/course-materials/${materialId}/files/${fileId}/download`,
    method: 'POST',
  })
)

export const getCurrentMaterialQuota = () => apiRequest<MaterialQuotaView>({
  path: '/api/v1/course-materials/quota',
})

export const createMaterialAdRewardSession = (idempotencyKey: string) => (
  apiRequest<CreateMaterialAdRewardSessionResponse>({
    path: '/api/v1/course-materials/ad-reward-sessions',
    method: 'POST',
    idempotencyKey,
  })
)

export const claimMaterialAdReward = (
  sessionId: number,
  sessionToken: string,
  idempotencyKey: string,
) => apiRequest<MaterialQuotaView>({
  path: `/api/v1/course-materials/ad-reward-sessions/${sessionId}/claim`,
  method: 'POST',
  data: { session_token: sessionToken },
  idempotencyKey,
})

export const createMaterialCloudShare = (
  data: CreateMaterialCloudShareRequest,
  idempotencyKey: string,
) => apiRequest<CourseMaterialView>({
  path: '/api/v1/course-materials/cloud-shares',
  method: 'POST',
  data,
  idempotencyKey,
})

export const getCourseMaterialCloudShare = (materialId: number) => (
  apiRequest<MaterialCloudShareView>({
    path: `/api/v1/course-materials/${materialId}/cloud-share`,
    method: 'POST',
  })
)

export const createCourseMaterialFeedback = (
  materialId: number,
  data: {
    file_id?: number
    category: MaterialFeedbackCategory
    description?: string
  },
) => apiRequest<MaterialFeedbackView>({
  path: `/api/v1/course-materials/${materialId}/feedbacks`,
  method: 'POST',
  data,
  idempotencyKey: createIdempotencyKey(`material-feedback-${materialId}`),
})

export const listMyCourseMaterialFeedbacks = (
  status?: MaterialFeedbackView['status'],
  page = 1,
  pageSize = 100,
) => apiRequest<MaterialFeedbackPage>({
  path: '/api/v1/course-material-feedbacks/mine',
  query: { status, page, page_size: pageSize },
})

export const withdrawCourseMaterial = (materialId: number, expectedVersion: number) => (
  apiRequest<{ updated: boolean }>({
    path: `/api/v1/course-materials/${materialId}/withdraw`,
    method: 'POST',
    data: { expected_version: expectedVersion },
    idempotencyKey: createIdempotencyKey(`material-withdraw-${materialId}`),
  })
)

export const updateMyCourseMaterial = (
  materialId: number,
  data: UpdateMyCourseMaterialRequest,
) => apiRequest<CourseMaterialView>({
  path: `/api/v1/course-materials/${materialId}`,
  method: 'PATCH',
  data,
  idempotencyKey: createIdempotencyKey(`material-update-${materialId}`),
})
