import Taro from '@tarojs/taro'
import {
  API_BASE_URL,
  ensureAccessToken,
  refreshAccessToken,
} from './auth'
import {
  ApiError,
  apiRequest,
  createIdempotencyKey,
  parseApiError,
} from './client'
import type { AcademicEducationLevel } from './academic-credential'
import type {
  AcademicProofChallenge,
  AcademicVerificationMaterial,
  AcademicVerificationRequest,
  AcademicVerificationStatus,
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
} from './types'

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

export const createAcademicProofChallenge = (
  studentNo: string,
  educationLevel: AcademicEducationLevel,
) => apiRequest<AcademicProofChallenge>({
  path: '/api/v1/academic-verification/local-proof/challenges',
  method: 'POST',
  data: {
    student_no: studentNo,
    provider: 'ouc',
    education_level: educationLevel,
  },
  skipAcademicVerificationGuard: true,
})

export const verifyAcademicLocalProof = (
  challengeId: string,
  proof: string,
) => apiRequest<AcademicVerificationRequest>({
  path: '/api/v1/academic-verification/local-proof',
  method: 'POST',
  data: {
    challenge_id: challengeId,
    proof,
  },
  idempotencyKey: createIdempotencyKey('academic-local-proof'),
  skipAcademicVerificationGuard: true,
})

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

const parseUploadBody = (
  statusCode: number,
  raw: string,
): ApiSuccessEnvelope<AcademicVerificationMaterial> | ApiErrorEnvelope => {
  try {
    return JSON.parse(raw) as ApiSuccessEnvelope<AcademicVerificationMaterial> | ApiErrorEnvelope
  } catch {
    throw new ApiError(statusCode, 'invalid_response', '校园服务返回了无效数据')
  }
}

const uploadMaterialOnce = async (filePath: string, token: string) => {
  const response = await Taro.uploadFile({
    url: `${API_BASE_URL}/api/v1/academic-verification/materials`,
    filePath,
    name: 'file',
    timeout: 60_000,
    header: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  const body = parseUploadBody(response.statusCode, response.data)
  return { statusCode: response.statusCode, body }
}

export const uploadAcademicVerificationMaterial = async (
  filePath: string,
): Promise<AcademicVerificationMaterial> => {
  let token = await ensureAccessToken()
  let result = await uploadMaterialOnce(filePath, token)
  if (result.statusCode === 401) {
    token = await refreshAccessToken()
    result = await uploadMaterialOnce(filePath, token)
  }
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw parseApiError(result.statusCode, result.body)
  }
  if (!('data' in result.body)) {
    throw new ApiError(result.statusCode, 'invalid_response', '校园服务返回了无效数据')
  }
  return result.body.data
}
