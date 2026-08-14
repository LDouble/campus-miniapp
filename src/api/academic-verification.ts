import {
  apiRequest,
  createIdempotencyKey,
} from './client'
import { uploadFileToObjectStorage } from './object-upload'
import type { AcademicEducationLevel } from './academic-credential'
import type {
  AcademicVerificationMaterial,
  AcademicVerificationRequest,
  AcademicVerificationStatus,
  AcademicVerificationUploadTarget,
} from './types'
import type { operations } from './generated/schema'

type InitiateUploadRequest = operations['InitiateAcademicVerificationMaterialUpload']['requestBody']['content']['application/json']
type CompleteUploadRequest = operations['CompleteAcademicVerificationMaterialUpload']['requestBody']['content']['application/json']

export const getAcademicVerificationStatus = () => apiRequest<AcademicVerificationStatus>({
  path: '/api/v1/academic-verification',
  skipAcademicVerificationGuard: true,
})

export const verifyAcademicCredentials = (
  studentNo: string,
  password: string,
  educationLevel: AcademicEducationLevel,
) => (
  apiRequest<AcademicVerificationRequest>({
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
)

export const submitStudentCardVerification = (
  realName: string,
  studentNo: string,
  materialId: number,
) => apiRequest<AcademicVerificationRequest>({
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
