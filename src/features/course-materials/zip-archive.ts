import { Zip, ZipDeflate } from 'fflate'

export interface ZipArchiveInputFile {
  name: string
  path: string
  size: number
}

export interface ZipArchiveProgress {
  progress: number
}

export interface ZipArchiveFileSystem {
  readFile: (filePath: string, position: number, length: number) => Promise<ArrayBuffer>
  writeFile: (filePath: string, data: ArrayBuffer) => Promise<void>
  appendFile: (filePath: string, data: ArrayBuffer) => Promise<void>
  removeFile: (filePath: string) => Promise<void>
}

const CHUNK_SIZE = 256 * 1024
const ZIP_LIMIT = 50 * 1024 * 1024

const encodeUtf8 = (value: string) => {
  const encoded = encodeURIComponent(value)
  const bytes: number[] = []
  for (let index = 0; index < encoded.length; index++) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16))
      index += 2
    } else {
      bytes.push(encoded.charCodeAt(index))
    }
  }
  return Uint8Array.from(bytes)
}

const normalizeFilename = (filename: string) => {
  const basename = filename.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, '_').trim() || '资料文件'
  return basename === '.' || basename === '..' ? `_${basename.replace(/\./g, '')}` : basename
}

const uniqueFilenames = (files: ZipArchiveInputFile[]) => {
  const used = new Set<string>()
  return files.map((file) => {
    const original = normalizeFilename(file.name)
    const dot = original.lastIndexOf('.')
    const stem = dot > 0 ? original.slice(0, dot) : original
    const extension = dot > 0 ? original.slice(dot) : ''
    let candidate = original
    let suffix = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${stem} (${suffix})${extension}`
      suffix += 1
    }
    used.add(candidate.toLowerCase())
    return candidate
  })
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

const checksumBytes = (bytes: Uint8Array) => {
  let checksum = 0xffffffff
  for (let index = 0; index < bytes.length; index++) {
    checksum = CRC_TABLE[(checksum ^ bytes[index]) & 0xff] ^ (checksum >>> 8)
  }
  return (checksum ^ 0xffffffff) >>> 0
}

const createUnicodePathExtra = (filenameBytes: Uint8Array) => {
  const payload = new Uint8Array(5 + filenameBytes.length)
  const view = new DataView(payload.buffer)
  view.setUint8(0, 1)
  view.setUint32(1, checksumBytes(filenameBytes), true)
  payload.set(filenameBytes, 5)
  return payload
}

/** 使用 fflate 分块压缩并写入 UTF-8 ZIP，避免把整份合辑载入内存。 */
export const createZipArchive = async (
  files: ZipArchiveInputFile[],
  fileSystem: ZipArchiveFileSystem,
  outputPath: string,
  onProgress: (progress: ZipArchiveProgress) => void = () => undefined,
) => {
  if (!files.length) throw new Error('请先选择资料文件')
  if (files.some((file) => !Number.isSafeInteger(file.size) || file.size <= 0)) {
    throw new Error('文件大小无效，请重新选择资料')
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  if (totalBytes + files.length * 128 + 22 > ZIP_LIMIT) {
    throw new Error('合辑 ZIP 超过 50MB，请减少文件后重试')
  }

  const names = uniqueFilenames(files)
  const filenameBytes = names.map(encodeUtf8)
  if (filenameBytes.some((name) => name.length > 0xffff)) throw new Error('文件名过长，无法打包 ZIP')

  let outputSize = 0
  let outputError: Error | undefined
  let processedBytes = 0
  let outputChunks: ArrayBuffer[] = []
  let zip: Zip

  zip = new Zip((error, chunk) => {
    if (error) {
      outputError = error
      return
    }
    if (!chunk || outputError) return
    outputSize += chunk.byteLength
    if (outputSize > ZIP_LIMIT) {
      outputError = new Error('合辑 ZIP 超过 50MB，请减少文件后重试')
      return
    }
    // fflate 可复用输出缓冲区；复制到独立 ArrayBuffer 后再交给文件系统。
    const data = new ArrayBuffer(chunk.byteLength)
    new Uint8Array(data).set(chunk)
    outputChunks.push(data)
  })

  const flushOutput = async () => {
    while (outputChunks.length) {
      if (outputError) throw outputError
      const chunk = outputChunks.shift()!
      await fileSystem.appendFile(outputPath, chunk)
    }
    if (outputError) throw outputError
  }

  try {
    await fileSystem.writeFile(outputPath, new ArrayBuffer(0))
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      const stream = new ZipDeflate(names[index], { level: 6 })
      stream.extra = { 0x7075: createUnicodePathExtra(filenameBytes[index]) }
      zip.add(stream)

      for (let position = 0; position < file.size; position += CHUNK_SIZE) {
        const length = Math.min(CHUNK_SIZE, file.size - position)
        const bytes = new Uint8Array(await fileSystem.readFile(file.path, position, length))
        if (bytes.byteLength !== length) throw new Error(`${file.name} 读取不完整，请重新选择`)
        const isLastChunk = position + length >= file.size
        stream.push(bytes, isLastChunk)
        await flushOutput()
        processedBytes += bytes.byteLength
        onProgress({ progress: Math.min(99, Math.round(processedBytes / Math.max(totalBytes, 1) * 99)) })
      }
    }

    zip.end()
    await flushOutput()
    onProgress({ progress: 100 })
    return {
      filePath: outputPath,
      filename: '资料合辑.zip',
      size: outputSize,
    }
  } catch (error) {
    zip.terminate()
    await fileSystem.removeFile(outputPath).catch(() => undefined)
    throw error
  }
}
