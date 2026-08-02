import { appendQuery } from '../../lib/http-session/url'
import type { AcademicEducationLevel } from '../../api/academic-credential'

export const OUC_ALLOWED_HOSTS = [
  'id.ouc.edu.cn',
  'my.ouc.edu.cn',
  'jwgl2024.ouc.edu.cn',
  'pgs.ouc.edu.cn',
]

export const OUC_CHROME_USER_AGENT = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/131.0.0.0 Safari/537.36',
].join(' ')

export const OUC_SSO_LOGIN_URL = 'https://id.ouc.edu.cn/sso/login'
export const OUC_PORTAL_SERVICE_URL = (
  'https://my.ouc.edu.cn/manage/common/cas_login/2'
  + '?redirect=https%3A%2F%2Fmy.ouc.edu.cn%2Fhome'
)

export interface AcademicDirectEndpoint {
  serviceUrl: string
  periods: () => string
  courses: (periodId: string) => string
  grades: (periodId: string) => string
  exams: (periodId: string) => string
  selections: (periodId: string) => string
  encoding: {
    periods: 'html' | 'json'
    courses: 'html' | 'json'
    grades: 'html' | 'json'
    exams: 'html' | 'json'
    selections: 'html' | 'json'
  }
}

const undergraduateBase = 'https://jwgl2024.ouc.edu.cn'
const graduateBase = 'https://pgs.ouc.edu.cn'

const splitGraduatePeriod = (periodId: string) => {
  const [academicYear = '', term = ''] = periodId.split(':', 2)
  return { academicYear, term }
}

export const ACADEMIC_DIRECT_ENDPOINTS: Record<
AcademicEducationLevel,
AcademicDirectEndpoint
> = {
  undergraduate: {
    serviceUrl: `${undergraduateBase}/`,
    periods: () => `${undergraduateBase}/jsxsd/xskb/xskb_list.do?viweType=0`,
    courses: (periodId) => appendQuery(
      `${undergraduateBase}/jsxsd/xskb/xskb_list.do?viweType=0`,
      [['xnxq01id', periodId]],
    ),
    grades: (periodId) => appendQuery(
      `${undergraduateBase}/jsxsd/kscj/cjcx_list`
      + '?pageNum=1&pageSize=200&kksj=&kcmc=&xsfs=all&sfxsbcxq=1',
      [['kksj', periodId]],
    ),
    exams: (periodId) => appendQuery(
      `${undergraduateBase}/jsxsd/xsks/xsksap_list?pageNum=1&pageSize=200&xqlb=`,
      [['xnxqid', periodId]],
    ),
    selections: (periodId) => appendQuery(
      `${undergraduateBase}/jsxsd/xkgl/loadXsxkjgList`
      + '?lx=xkrz&type=list&pageNum=1&pageSize=200',
      [['xnxqid', periodId]],
    ),
    encoding: {
      periods: 'html',
      courses: 'html',
      grades: 'json',
      exams: 'json',
      selections: 'json',
    },
  },
  graduate: {
    serviceUrl: `${graduateBase}/allogene/page/home.htm`,
    periods: () => `${graduateBase}/py/page/student/grkcgl.htm`,
    courses: (periodId) => {
      const period = splitGraduatePeriod(periodId)
      return appendQuery(
        `${graduateBase}/py/page/student/grkcb.htm?zc=-1`,
        [['xn', period.academicYear], ['xj', period.term]],
      )
    },
    grades: () => `${graduateBase}/py/page/student/grkcgl.htm`,
    exams: (periodId) => {
      const period = splitGraduatePeriod(periodId)
      return appendQuery(
        `${graduateBase}/py/page/student/grksap.htm`,
        [['xn', period.academicYear], ['xj', period.term]],
      )
    },
    selections: () => `${graduateBase}/py/page/student/grkcgl.htm`,
    encoding: {
      periods: 'html',
      courses: 'html',
      grades: 'html',
      exams: 'html',
      selections: 'html',
    },
  },
}

export const serviceLoginUrl = (serviceUrl: string) => (
  appendQuery(OUC_SSO_LOGIN_URL, [
    ['service', serviceUrl],
  ])
)
