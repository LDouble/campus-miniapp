import Taro from '@tarojs/taro'
import {
  apiRequest,
  createIdempotencyKey,
} from './client'
import type {
  CompleteMaterialUploadFile,
  CourseMaterialPage,
  CourseMaterialView,
  MaterialCoursePage,
  MaterialDownloadView,
  MaterialUploadFileInput,
  MaterialUploadSessionView,
  MaterialUploadTarget,
} from './types'
import type { operations } from './generated/schema'

type ListCourseMaterialsParameters = NonNullable<
operations['ListCourseMaterials']['parameters']['query']
>
export type UpdateMyCourseMaterialRequest = operations['UpdateMyCourseMaterial']['requestBody']['content']['application/json']

export interface ListCourseMaterialsQuery {
  courseId?: ListCourseMaterialsParameters['course_id']
  materialType?: ListCourseMaterialsParameters['material_type']
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

export const createMaterialUploadSession = (
  files: MaterialUploadFileInput[],
  idempotencyKey: string,
) => (
  apiRequest<MaterialUploadSessionView>({
    path: '/api/v1/course-materials/upload-sessions',
    method: 'POST',
    data: { files },
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
  const task = Taro.uploadFile({
    url: target.upload_url,
    filePath,
    name: target.file_field,
    formData: target.form_fields,
    header: target.headers,
    timeout: 120_000,
  })
  task.progress((event) => onProgress(event.progress))
  return task.then((result) => {
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error('文件上传失败')
    }
  })
}

export const getMaterialDownload = (materialId: number) => (
  apiRequest<MaterialDownloadView>({
    path: `/api/v1/course-materials/${materialId}/download`,
    method: 'POST',
  })
)

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

export const downloadAndOpenMaterial = async (materialId: number) => {
  const target = await getMaterialDownload(materialId)
  const result = await Taro.downloadFile({ url: target.url })
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error('资料下载失败')
  }
  const extension = target.filename.split('.').pop()?.toLowerCase()
  const fileType = (
    extension && ['doc', 'xls', 'ppt', 'pdf', 'docx', 'xlsx', 'pptx'].includes(extension)
      ? extension
      : undefined
  ) as 'doc' | 'xls' | 'ppt' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | undefined
  await Taro.openDocument({
    filePath: result.tempFilePath,
    fileType,
    showMenu: true,
  })
}
