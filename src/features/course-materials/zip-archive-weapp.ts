import Taro from '@tarojs/taro'
import {
  createZipArchive,
  type ZipArchiveFileSystem,
  type ZipArchiveInputFile,
  type ZipArchiveProgress,
} from './zip-archive'

const zipFileSystem: ZipArchiveFileSystem = {
  readFile: (filePath, position, length) => new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      position,
      length,
      success: ({ data }) => {
        if (!(data instanceof ArrayBuffer)) {
          reject(new Error('读取文件内容失败'))
          return
        }
        resolve(data)
      },
      fail: ({ errMsg }) => reject(new Error(errMsg || '读取文件内容失败')),
    })
  }),
  writeFile: (filePath, data) => new Promise((resolve, reject) => {
    Taro.getFileSystemManager().writeFile({
      filePath,
      data,
      success: () => resolve(),
      fail: ({ errMsg }) => reject(new Error(errMsg || '写入 ZIP 文件失败')),
    })
  }),
  appendFile: (filePath, data) => new Promise((resolve, reject) => {
    Taro.getFileSystemManager().appendFile({
      filePath,
      data,
      success: () => resolve(),
      fail: ({ errMsg }) => reject(new Error(errMsg || '写入 ZIP 文件失败')),
    })
  }),
  removeFile: (filePath) => new Promise((resolve) => {
    Taro.getFileSystemManager().unlink({
      filePath,
      success: () => resolve(),
      fail: () => resolve(),
    })
  }),
}

/** createWeappZipArchive 使用小程序私有目录生成单个本地 ZIP 文件。 */
export const createWeappZipArchive = (
  files: ZipArchiveInputFile[],
  onProgress: (progress: ZipArchiveProgress) => void = () => undefined,
) => {
  const outputPath = `${Taro.env.USER_DATA_PATH}/materials-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.zip`
  return createZipArchive(files, zipFileSystem, outputPath, onProgress).then((archive) => ({
    ...archive,
    filename: '资料合辑.zip',
  }))
}

/** removeZipArchive 删除本地生成的临时合辑文件。 */
export const removeZipArchive = async (filePath?: string) => {
  if (filePath) await zipFileSystem.removeFile(filePath)
}

/** zipArchiveExists 检查重试所需的本地合辑是否仍在小程序文件系统中。 */
export const zipArchiveExists = async (filePath?: string) => {
  if (!filePath) return false
  try {
    await new Promise<void>((resolve, reject) => {
      Taro.getFileSystemManager().getFileInfo({
        filePath,
        success: () => resolve(),
        fail: () => reject(new Error('ZIP 临时文件已失效')),
      })
    })
    return true
  } catch {
    return false
  }
}
