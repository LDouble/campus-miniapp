import {
  apiRequest,
  createIdempotencyKey,
  isApiError,
} from './client'
import { uploadFileToObjectStorage } from './object-upload'
import { createSharedResource } from '../state/shared-resource'
import type { AcademicEducationLevel } from './academic-credential'
import type {
  AcademicVerificationMaterial,
  AcademicVerificationRequest,
  AcademicVerificationStatus,
  AcademicVerificationUploadTarget,
} from './types'
import type { operations } from './generated/schema'
import {
  emptyAcademicVerificationStatus,
  isMissingAcademicVerificationStatus,
} from '../features/academic-verification/missing-status'

type InitiateUploadRequest = operations['InitiateAcademicVerificationMaterialUpload']['requestBody']['content']['application/json']
type CompleteUploadRequest = operations['CompleteAcademicVerificationMaterialUpload']['requestBody']['content']['application/json']

const PENDING_VERIFICATION_MAX_AGE_MS = 30 * 1000
const VERIFICATION_MAX_AGE_MS = 60 * 1000

export type AcademicVerificationRequestOptions = {
  force?: boolean
}

const verificationMaxAgeMs = (status: AcademicVerificationStatus | undefined) => (
  status?.latest_request?.status === 'pending'
    ? PENDING_VERIFICATION_MAX_AGE_MS
    : VERIFICATION_MAX_AGE_MS
)

const academicVerificationResource = createSharedResource<AcademicVerificationStatus>({
  maxAgeMs: verificationMaxAgeMs,
  group: 'verification',
})

const requestAcademicVerificationStatus = async () => {
  try {
    return await apiRequest<AcademicVerificationStatus>({
      path: '/api/v1/academic-verification',
      skipAcademicVerificationGuard: true,
    })
  } catch (error) {
    if (
      isApiError(error)
      && isMissingAcademicVerificationStatus(error.statusCode, error.code)
    ) {
      return emptyAcademicVerificationStatus()
    }
    throw error
  }
}

export const getAcademicVerificationStatus = (
  options: AcademicVerificationRequestOptions = {},
) => academicVerificationResource.ensure(requestAcademicVerificationStatus, options)

export const invalidateAcademicVerificationStatus = () => academicVerificationResource.invalidate()

export const seedAcademicVerificationStatus = (status: AcademicVerificationStatus) => (
  academicVerificationResource.seed(status)
)

export const verifyAcademicCredentials = async (
  studentNo: string,
  password: string,
  educationLevel: AcademicEducationLevel,
) => {
  const request = await apiRequest<AcademicVerificationRequest>({
    path: '/api/v1/academic-verification/credentials',
    method: 'POST',
    data: {
      student_no: studentNo,
      password,
      education_level: educationLevel,
    },
    idempotencyKey: createIdempotencyKey('academic-credentials'),
    skipAcademicVerificationGuard: true,
  })
  invalidateAcademicVerificationStatus()
  return request
}

export const submitStudentCardVerification = async (
  realName: string,
  studentNo: string,
  materialId: number,
) => {
  const request = await apiRequest<AcademicVerificationRequest>({
    path: '/api/v1/academic-verification/student-card',
    method: 'POST',
    data: {
      real_name: realName,
      student_no: studentNo,
      material_id: materialId,
    },
    idempotencyKey: createIdempotencyKey('academic-student-card'),
    skipAcademicVerificationGuard: true,
  })
  invalidateAcademicVerificationStatus()
  return request
}

export const uploadAcademicVerificationMaterial = async (
  filePath: string,
  mimeType: InitiateUploadRequest['mime_type'],
  sizeBytes: number,
): Promise<AcademicVerificationMaterial> => {
  const target = await apiRequest<AcademicVerificationUploadTarget>({
    path: '/api/v1/academic-verification/materials/upload-target',
    method: 'POST',
    data: { mime_type: mimeType, size_bytes: sizeBytes } satisfies InitiateUploadRequest,
    skipAcademicVerificationGuard: true,
  })
  await uploadFileToObjectStorage(target, filePath)
  console.info('[对象存储直传] 开始完成确认')
  const material = await apiRequest<AcademicVerificationMaterial>({
    path: '/api/v1/academic-verification/materials/complete',
    method: 'POST',
    data: {
      storage_key: target.storage_key,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    } satisfies CompleteUploadRequest,
    skipAcademicVerificationGuard: true,
  })
  console.info('[对象存储直传] 完成确认成功')
  return material
}
