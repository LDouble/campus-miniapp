export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export type HttpHeaders = Record<string, string | string[]>

export interface SessionRequest {
  url: string
  method?: HttpMethod
  headers?: Record<string, string>
  body?: string | ArrayBuffer
  timeout?: number
}

export interface TransportRequest {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body?: string | ArrayBuffer
  timeout: number
}

export interface TransportResponse {
  statusCode: number
  headers: HttpHeaders
  cookies: string[]
  data: string
}

export interface HttpTransport {
  send: (request: TransportRequest) => Promise<TransportResponse>
}

export interface RedirectHistoryItem {
  url: string
  method: HttpMethod
  statusCode: number
  location: string
}

export interface SessionResponse extends TransportResponse {
  url: string
  history: RedirectHistoryItem[]
}

export type SessionErrorCode =
  | 'unsupported_redirect'
  | 'invalid_url'
  | 'blocked_redirect'
  | 'redirect_loop'
  | 'too_many_redirects'
  | 'storage_error'
  | 'network_error'
  | 'response_too_large'

export class SessionError extends Error {
  code: SessionErrorCode

  constructor(code: SessionErrorCode, message: string) {
    super(message)
    Object.setPrototypeOf(this, SessionError.prototype)
    this.name = 'SessionError'
    this.code = code
  }
}

