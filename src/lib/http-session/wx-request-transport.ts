import Taro from '@tarojs/taro'
import { mergeHeaders } from './headers'
import {
  HttpTransport,
  SessionError,
  TransportRequest,
  TransportResponse,
} from './types'

type WechatRequestOption = Taro.request.Option<string, string | ArrayBuffer> & {
  redirect: 'manual'
}

interface WechatHeadersReceivedResult {
  header?: Record<string, unknown>
  statusCode?: number
  cookies?: string[]
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])

const responseText = (data: unknown) => {
  if (typeof data === 'string') return data
  if (data === undefined || data === null) return ''
  if (data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(data)
    let encoded = ''
    bytes.forEach((byte) => {
      encoded += `%${byte.toString(16).padStart(2, '0')}`
    })
    try {
      return decodeURIComponent(encoded)
    } catch {
      return String.fromCharCode(...bytes)
    }
  }
  return JSON.stringify(data)
}

export class WxRequestTransport implements HttpTransport {
  send = (request: TransportRequest) => new Promise<TransportResponse>((resolve, reject) => {
    if (!Taro.canIUse('request.object.redirect')) {
      reject(new SessionError('unsupported_redirect', '当前微信基础库不支持教务直连'))
      return
    }

    let earlyHeaders: Record<string, unknown> = {}
    let earlyCookies: string[] = []
    let settled = false
    const resolveOnce = (response: TransportResponse) => {
      if (settled) return
      settled = true
      resolve(response)
    }
    const option: WechatRequestOption = {
      url: request.url,
      method: request.method,
      header: request.headers,
      data: request.body,
      timeout: request.timeout,
      dataType: 'text',
      responseType: 'text',
      redirect: 'manual',
      useHighPerformanceMode: false,
      success: (result) => {
        const resultHeaders = mergeHeaders(result.header || {})
        console.log('[academic-http] transport-success', {
          url: request.url,
          statusCode: result.statusCode,
          location: resultHeaders.location || '',
          headerNames: Object.keys(resultHeaders),
          cookieCount: (result.cookies || []).length,
        })
        resolveOnce({
          statusCode: result.statusCode,
          headers: mergeHeaders(earlyHeaders, resultHeaders),
          cookies: [...new Set([
            ...earlyCookies,
            ...(result.cookies || []),
          ])],
          data: responseText(result.data),
        })
      },
      fail: () => {
        if (settled) return
        settled = true
        reject(new SessionError('network_error', '教务网络请求失败'))
      },
    }
    const task = Taro.request(option)
    task.onHeadersReceived((rawResult) => {
      const result = rawResult as WechatHeadersReceivedResult
      const receivedHeaders = mergeHeaders(result.header || {})
      console.log('[academic-http] headers-received', {
        url: request.url,
        statusCode: Number(result.statusCode) || 0,
        location: receivedHeaders.location || '',
        headerNames: Object.keys(receivedHeaders),
        cookieCount: (result.cookies || []).length,
      })
      earlyHeaders = mergeHeaders(earlyHeaders, receivedHeaders)
      earlyCookies = [...new Set([
        ...earlyCookies,
        ...(result.cookies || []),
      ])]
      const headers = mergeHeaders(earlyHeaders)
      const location = headers.location
      if (!location) return
      const reportedStatus = Number(result.statusCode)
      const statusCode = REDIRECT_STATUS.has(reportedStatus)
        ? reportedStatus
        // 部分基础库不返回 onHeadersReceived.statusCode；学校链路
        // 的跳转响应为 302，因此看到 Location 后按 302 交给会话处理。
        : 302
      resolveOnce({
        statusCode,
        headers,
        cookies: earlyCookies,
        data: '',
      })
      task.abort()
    })
  })
}
