import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod,
} from '../../api/types'
import type {
  AcademicCredential,
  AcademicEducationLevel,
} from '../../api/academic-credential'
import { CookieJar } from '../../lib/http-session/cookie-jar'
import { HttpSession } from '../../lib/http-session/session'
import {
  clearAllTaroCookieStorage,
  clearTaroCookieStorageForUser,
  createTaroCookiePersistence,
} from '../../lib/http-session/taro-cookie-storage'
import { WxRequestTransport } from '../../lib/http-session/wx-request-transport'
import {
  ACADEMIC_DIRECT_ENDPOINTS,
  OUC_ALLOWED_HOSTS,
  OUC_CHROME_USER_AGENT,
} from './config'
import { AcademicDirectError } from './errors'
import {
  academicResponseRequiresAuthentication,
  authenticateAcademicSession,
} from './sso'
import { requestWithAuthenticationRetry } from './session-recovery'
import {
  parseUndergraduateCourses,
  parseUndergraduateExams,
  parseUndergraduateGrades,
  parseUndergraduateSelections,
  parseUndergraduatePeriods,
} from './parsers/undergraduate'
import {
  parseGraduateCourses,
  parseGraduateExams,
  parseGraduateGrades,
  parseGraduateSelections,
  parseGraduatePeriods,
} from './parsers/graduate'

type AcademicDirectOperation = 'periods' | 'courses' | 'grades' | 'exams' | 'selections'

interface AcademicDirectContext {
  platformUserId: number
  credential: AcademicCredential
}

type OperationResult = {
  periods: AcademicPeriod[]
  courses: AcademicCourse[]
  grades: AcademicGrade[]
  exams: AcademicExam[]
  selections: AcademicCourseSelection[]
}

const sessions = new Map<string, HttpSession>()
const pendingAuthentications = new Map<string, Promise<void>>()

const sessionKey = (platformUserId: number, educationLevel: AcademicEducationLevel) => (
  `${platformUserId}:${educationLevel}`
)

const createSession = (
  platformUserId: number,
  educationLevel: AcademicEducationLevel,
) => new HttpSession({
  jar: new CookieJar({
    scope: { platformUserId, educationLevel },
    persistence: createTaroCookiePersistence({ platformUserId, educationLevel }),
  }),
  transport: new WxRequestTransport(),
  allowedHosts: OUC_ALLOWED_HOSTS,
  defaultHeaders: {
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'User-Agent': OUC_CHROME_USER_AGENT,
  },
})

const getSession = (
  platformUserId: number,
  educationLevel: AcademicEducationLevel,
) => {
  const key = sessionKey(platformUserId, educationLevel)
  const existing = sessions.get(key)
  if (existing) return existing
  const created = createSession(platformUserId, educationLevel)
  sessions.set(key, created)
  return created
}

const clearLiveSession = (
  platformUserId: number,
  educationLevel: AcademicEducationLevel,
) => {
  const key = sessionKey(platformUserId, educationLevel)
  const current = sessions.get(key)
  sessions.delete(key)
  pendingAuthentications.delete(key)
  current?.clearCookies()
}

export const clearAcademicDirectSession = (platformUserId?: number) => {
  if (platformUserId && Number.isSafeInteger(platformUserId)) {
    ;(['undergraduate', 'graduate'] as AcademicEducationLevel[])
      .forEach((level) => {
        const key = sessionKey(platformUserId, level)
        const current = sessions.get(key)
        sessions.delete(key)
        pendingAuthentications.delete(key)
        current?.clearCookies()
      })
    clearTaroCookieStorageForUser(platformUserId)
    return
  }
  sessions.forEach((session) => session.clearCookies())
  sessions.clear()
  pendingAuthentications.clear()
  clearAllTaroCookieStorage()
}

const authenticate = (
  session: HttpSession,
  context: AcademicDirectContext,
  serviceUrl: string,
) => {
  const key = sessionKey(
    context.platformUserId,
    context.credential.educationLevel,
  )
  const pending = pendingAuthentications.get(key)
  if (pending) return pending
  const request = authenticateAcademicSession(
    session,
    context.credential.studentNo,
    context.credential.password,
    serviceUrl,
  ).finally(() => {
    if (pendingAuthentications.get(key) === request) {
      pendingAuthentications.delete(key)
    }
  })
  pendingAuthentications.set(key, request)
  return request
}

const validatePeriodId = (
  educationLevel: AcademicEducationLevel,
  operation: AcademicDirectOperation,
  periodId: string,
) => {
  if (operation === 'grades' && !periodId) return
  if (operation === 'periods') return
  const valid = educationLevel === 'undergraduate'
    ? /^\d{4}-\d{4}-[123]$/.test(periodId)
    : /^\d{4}:(?:11|12)$/.test(periodId)
  if (!valid) throw new AcademicDirectError('provider_unavailable', '学期参数无效')
}

const parseOperation = <T extends AcademicDirectOperation>(
  educationLevel: AcademicEducationLevel,
  operation: T,
  body: string,
  encoding: 'html' | 'json',
  periodId: string,
): OperationResult[T] => {
  if (educationLevel === 'undergraduate') {
    switch (operation) {
      case 'periods':
        return parseUndergraduatePeriods(body) as OperationResult[T]
      case 'courses':
        return parseUndergraduateCourses(body, periodId) as OperationResult[T]
      case 'grades':
        return parseUndergraduateGrades(body, encoding, periodId) as OperationResult[T]
      case 'exams':
        return parseUndergraduateExams(body, encoding, periodId) as OperationResult[T]
      case 'selections':
        return parseUndergraduateSelections(body, encoding, periodId) as OperationResult[T]
      default:
        throw new AcademicDirectError('provider_unavailable', '不支持的教务查询')
    }
  }
  switch (operation) {
    case 'periods':
      return parseGraduatePeriods(body) as OperationResult[T]
    case 'courses':
      return parseGraduateCourses(body, encoding, periodId) as OperationResult[T]
    case 'grades':
      return parseGraduateGrades(body, encoding, periodId) as OperationResult[T]
    case 'exams':
      return parseGraduateExams(body, encoding, periodId) as OperationResult[T]
    case 'selections':
      return parseGraduateSelections(body, encoding, periodId) as OperationResult[T]
    default:
      throw new AcademicDirectError('provider_unavailable', '不支持的教务查询')
  }
}

const query = async <T extends AcademicDirectOperation>(
  context: AcademicDirectContext,
  operation: T,
  periodId = '',
): Promise<OperationResult[T]> => {
  const { educationLevel } = context.credential
  validatePeriodId(educationLevel, operation, periodId)
  const endpoint = ACADEMIC_DIRECT_ENDPOINTS[educationLevel]
  const session = getSession(context.platformUserId, educationLevel)

  try {
    const requestOperation = () => session.get(endpoint[operation](periodId))
    const response = await requestWithAuthenticationRetry({
      request: requestOperation,
      authenticate: () => authenticate(session, context, endpoint.serviceUrl),
      isRejected: (result) => academicResponseRequiresAuthentication(
        result.statusCode,
        result.url,
        result.data,
      ),
    })
    if (academicResponseRequiresAuthentication(
      response.statusCode,
      response.url,
      response.data,
    )) {
      clearLiveSession(context.platformUserId, educationLevel)
      throw new AcademicDirectError('invalid_credentials', '教务登录状态已失效，请重新绑定')
    }
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new AcademicDirectError(
        'provider_unavailable',
        `教务系统返回 HTTP ${response.statusCode}`,
      )
    }
    return parseOperation(
      educationLevel,
      operation,
      response.data,
      endpoint.encoding[operation],
      periodId,
    )
  } catch (error) {
    if (
      error instanceof AcademicDirectError
      && ['invalid_credentials', 'password_expired', 'challenge_required', 'identity_mismatch']
        .includes(error.code)
    ) {
      clearLiveSession(context.platformUserId, educationLevel)
    }
    throw error
  }
}

export const academicDirectProvider = {
  listPeriods: (context: AcademicDirectContext) => query(context, 'periods'),
  listCourses: (context: AcademicDirectContext, periodId: string) => (
    query(context, 'courses', periodId)
  ),
  listGrades: (context: AcademicDirectContext) => query(context, 'grades'),
  listExams: (context: AcademicDirectContext, periodId: string) => (
    query(context, 'exams', periodId)
  ),
  listSelections: (context: AcademicDirectContext, periodId: string) => (
    query(context, 'selections', periodId)
  ),
}
