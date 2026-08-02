import type { HttpSession } from '../../lib/http-session/session'
import { parseHttpUrl, resolveHttpUrl } from '../../lib/http-session/url'
import {
  attribute,
  children,
  detectInteractiveChallenge,
  elementIsHidden,
  findAll,
  findFirst,
  isChallengeControlName,
  isElement,
  parseHTML,
} from './html'
import { AcademicDirectError } from './errors'
import {
  OUC_SSO_LOGIN_URL,
  serviceLoginUrl,
} from './config'
import { encryptSM2Password } from './sm2'

const invalidLoginText = [
  '用户名或密码错误',
  '账号或密码错误',
  '用户名或密码不正确',
  '认证失败',
  '密码错误',
]
const rejectedAppText = [
  '无权访问',
  '没有权限',
  '未授权',
  '用户不存在',
  '不在本系统',
  '非本系统用户',
]

const containsAny = (body: string, candidates: string[]) => {
  const value = body.toLowerCase()
  return candidates.some((candidate) => value.includes(candidate.toLowerCase()))
}

const isCentralSSOPage = (body: string) => (
  body.includes('var ssoConfig =')
  || /name\s*=\s*["']flowId["']/i.test(body)
)

const decodeMarkerValue = <T>(body: string, marker: string): T | undefined => {
  const index = body.indexOf(marker)
  if (index < 0) return undefined
  const source = body.slice(index + marker.length).trimStart()
  const opening = source[0]
  if (!opening) throw new Error(`教务登录元数据 ${marker.trim()} 无效`)
  let end = -1
  if (opening === '{' || opening === '[') {
    const closing = opening === '{' ? '}' : ']'
    let depth = 0
    let quoted = false
    let escaped = false
    for (let position = 0; position < source.length; position += 1) {
      const character = source[position]
      if (quoted) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') quoted = false
        continue
      }
      if (character === '"') quoted = true
      else if (character === opening) depth += 1
      else if (character === closing) {
        depth -= 1
        if (depth === 0) {
          end = position + 1
          break
        }
      }
    }
  } else if (opening === '"') {
    let escaped = false
    for (let position = 1; position < source.length; position += 1) {
      const character = source[position]
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') {
        end = position + 1
        break
      }
    }
  } else {
    const matched = /^(?:null|true|false|-?\d+(?:\.\d+)?)/.exec(source)
    end = matched?.[0].length || -1
  }
  if (end < 0) throw new Error(`教务登录元数据 ${marker.trim()} 无效`)
  return JSON.parse(source.slice(0, end)) as T
}

interface LoginForm {
  action: string
  values: Record<string, string>
  hasChallenge: boolean
}

const parseLoginForm = (body: string, baseUrl: string): LoginForm => {
  const root = parseHTML(body)
  const selected = findFirst(root, (node) => isElement(node, 'form'))
  if (!selected) throw new Error('未找到教务登录表单')
  const form: LoginForm = {
    action: attribute(selected, 'action').trim() || baseUrl,
    values: {},
    hasChallenge: false,
  }
  const collect = (node: any, ancestorHidden: boolean) => {
    const hidden = ancestorHidden || elementIsHidden(node)
    if (isElement(node, 'input')) {
      const name = attribute(node, 'name')
      if (name) {
        form.values[name] = attribute(node, 'value')
        const inputType = attribute(node, 'type').toLowerCase()
        if (!hidden && inputType !== 'hidden' && isChallengeControlName(name)) {
          form.hasChallenge = true
        }
      }
    }
    children(node).forEach((child) => collect(child, hidden))
  }
  collect(selected, false)
  if (!form.values.flowId) throw new Error('教务登录 flowId 缺失')
  return form
}

interface LoginSecurityConfig {
  sm2?: {
    enabled?: boolean
    publicKey?: string
  }
}

const parseLoginSecurityConfig = (body: string) => {
  const config = decodeMarkerValue<LoginSecurityConfig>(body, 'var ssoConfig =')
  if (!config) throw new Error('教务登录安全配置缺失')
  if (config.sm2?.enabled && !String(config.sm2.publicKey || '').trim()) {
    throw new Error('教务登录 SM2 公钥缺失')
  }
  return config
}

interface LoginResponseError {
  code: number
  msg?: string
}

const parseLoginResponseError = (body: string) => (
  decodeMarkerValue<LoginResponseError | null>(body, 'var error =')
)

const formEncode = (values: Record<string, string>) => Object.entries(values)
  .map(([name, value]) => (
    `${encodeURIComponent(name).replace(/%20/g, '+')}=${encodeURIComponent(value).replace(/%20/g, '+')}`
  ))
  .join('&')

const validateLoginAction = (baseUrl: string, action: string) => {
  const resolved = resolveHttpUrl(baseUrl, action)
  const parsed = parseHttpUrl(resolved)
  if (parsed.scheme !== 'https' || parsed.hostname !== 'id.ouc.edu.cn' || parsed.port) {
    throw new Error('教务登录表单地址无效')
  }
  return resolved
}

const ensureSuccessfulResponse = (statusCode: number) => {
  if (statusCode < 200 || statusCode >= 400) {
    throw new AcademicDirectError('provider_unavailable', `教务系统返回 HTTP ${statusCode}`)
  }
}

const continuePasswordExpiryWarning = async (
  session: HttpSession,
  currentUrl: string,
  body: string,
) => {
  const pageName = decodeMarkerValue<string>(body, 'var pageName =')
  if (pageName !== 'resetWarn') return null
  const form = parseLoginForm(body, currentUrl)
  form.values.username = ''
  form.values.password = ''
  form.values.loginType = ''
  form.values.continue = '1'
  const response = await session.post(
    validateLoginAction(currentUrl, form.action),
    formEncode(form.values),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  ensureSuccessfulResponse(response.statusCode)
  return response
}

export const authenticateAcademicSession = async (
  session: HttpSession,
  studentNo: string,
  password: string,
  serviceUrl: string,
) => {
  const initial = await session.get(serviceLoginUrl(serviceUrl))
  ensureSuccessfulResponse(initial.statusCode)
  if (parseHttpUrl(initial.url).hostname !== 'id.ouc.edu.cn') return
  if (!isCentralSSOPage(initial.data)) return

  const form = parseLoginForm(initial.data, initial.url)
  const security = parseLoginSecurityConfig(initial.data)
  if (form.hasChallenge) {
    throw new AcademicDirectError('challenge_required', '教务登录需要完成验证码，请稍后重试')
  }
  let submittedPassword = password
  if (security.sm2?.enabled) {
    submittedPassword = await encryptSM2Password(
      password,
      String(security.sm2.publicKey),
    )
  }
  form.values.username = studentNo
  form.values.password = submittedPassword
  if (!form.values.loginType) form.values.loginType = 'username_password'

  let response = await session.post(
    validateLoginAction(initial.url, form.action),
    formEncode(form.values),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  form.values.password = ''
  ensureSuccessfulResponse(response.statusCode)

  let responseError = parseLoginResponseError(response.data)
  if (responseError?.code === 40605) {
    const continued = await continuePasswordExpiryWarning(
      session,
      response.url,
      response.data,
    )
    if (!continued) {
      throw new AcademicDirectError('password_expired', '教务密码已过期，请先在统一身份认证中修改')
    }
    response = continued
    responseError = parseLoginResponseError(response.data)
    if (responseError?.code === 40605) {
      throw new AcademicDirectError('password_expired', '教务密码已过期，请先在统一身份认证中修改')
    }
  }
  if (containsAny(response.data, invalidLoginText)) {
    throw new AcademicDirectError('invalid_credentials', '教务账号或密码错误')
  }
  if (
    parseHttpUrl(response.url).hostname === 'id.ouc.edu.cn'
    && isCentralSSOPage(response.data)
  ) {
    if (detectInteractiveChallenge(response.data)) {
      throw new AcademicDirectError('challenge_required', '教务登录需要完成验证码，请稍后重试')
    }
    throw new AcademicDirectError('invalid_credentials', '教务账号或密码错误')
  }
  if (containsAny(response.data, rejectedAppText)) {
    throw new AcademicDirectError('identity_mismatch', '当前账号无法访问所选教务系统')
  }
}

export const isAcademicLoginPage = (body: string) => {
  const root = parseHTML(body)
  return findAll(root, (node) => {
    if (!isElement(node, 'form')) return false
    const identity = [attribute(node, 'id'), attribute(node, 'name')]
      .some((value) => value.toLowerCase() === 'loginform')
    const action = attribute(node, 'action').trim()
    const loginAction = /\/jsxsd\/xk\/LoginToXk(?:[?#]|$)/i.test(action)
    const hasPassword = findAll(node, (item) => (
      isElement(item, 'input')
      && attribute(item, 'type').toLowerCase() === 'password'
    )).length > 0
    return loginAction || (identity && hasPassword)
  }).length > 0
}

export const academicResponseRejected = (url: string, body: string) => (
  (
    parseHttpUrl(url).hostname === parseHttpUrl(OUC_SSO_LOGIN_URL).hostname
    && isCentralSSOPage(body)
  )
  || isAcademicLoginPage(body)
  || containsAny(body, rejectedAppText)
)

export const academicResponseRequiresAuthentication = (
  statusCode: number,
  url: string,
  body: string,
) => (
  statusCode === 401
  || statusCode === 403
  || academicResponseRejected(url, body)
)
