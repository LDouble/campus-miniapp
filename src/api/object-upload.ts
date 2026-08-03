import Taro from '@tarojs/taro'

export interface ObjectUploadTarget {
  upload_url: string
  file_field: string
  form_fields: Record<string, string>
  headers: Record<string, string>
  temporary_credentials?: {
    secret_id: string
    secret_key: string
    session_token: string
    start_time: number
    expired_time: number
  } | null
}

const uploadErrorMessage = (error: unknown) => {
  const message = error && typeof error === 'object' && 'errMsg' in error
    ? String(error.errMsg || '')
    : error instanceof Error
      ? error.message
      : String(error || '')
  if (message.includes('url not in domain list')) {
    return 'COS 上传域名未加入微信 uploadFile 合法域名'
  }
  if (message.includes('timeout')) return '文件上传超时，请检查网络后重试'
  return message || '文件上传失败'
}

const uploadHost = (uploadUrl: string) => (
  uploadUrl.replace(/^https?:\/\//, '').split('/')[0]
)

export const uploadFileToObjectStorage = (
  target: ObjectUploadTarget,
  filePath: string,
  onProgress?: (progress: number) => void,
) => {
  if (target.upload_url.includes('.myqcloud.com') && !target.temporary_credentials) {
    throw new Error('COS 临时上传凭证缺失，请重新上传')
  }
  console.info('[COS直传] 开始上传', {
    host: uploadHost(target.upload_url),
    fileField: target.file_field,
    temporaryCredential: !!target.temporary_credentials,
  })
  const task = Taro.uploadFile({
    url: target.upload_url,
    filePath,
    name: target.file_field,
    formData: target.form_fields,
    header: target.headers,
    timeout: 120_000,
  })
  if (onProgress) task.progress((event) => onProgress(event.progress))
  return task.then((result) => {
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`COS 文件上传失败（HTTP ${result.statusCode}）`)
    }
    console.info('[COS直传] 上传完成', {
      host: uploadHost(target.upload_url),
      statusCode: result.statusCode,
    })
  }).catch((error: unknown) => {
    const message = uploadErrorMessage(error)
    console.error('[COS直传] 上传失败', {
      host: uploadHost(target.upload_url),
      message,
    })
    throw new Error(message)
  })
}
