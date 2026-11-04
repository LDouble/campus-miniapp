import { strict as assert } from 'node:assert'
import { unzipSync } from 'fflate'
import { createZipArchive, type ZipArchiveFileSystem } from '../src/features/course-materials/zip-archive'

const repeatedContent = (length: number, value: number) => {
  const content = new Uint8Array(length)
  content.fill(value)
  return content
}

const createMemoryFileSystem = (inputFiles: Record<string, Uint8Array>, truncatePath = '') => {
  let output = new Uint8Array(0)
  let removed = false
  const fileSystem: ZipArchiveFileSystem = {
    readFile: async (filePath, position, length) => {
      const input = inputFiles[filePath]
      const chunk = input.slice(position, position + length)
      return chunk.slice(0, filePath === truncatePath ? Math.max(0, chunk.length - 1) : chunk.length).buffer
    },
    writeFile: async (_filePath, data) => {
      output = new Uint8Array(data)
    },
    appendFile: async (_filePath, data) => {
      const chunk = new Uint8Array(data)
      const next = new Uint8Array(output.length + chunk.length)
      next.set(output)
      next.set(chunk, output.length)
      output = next
    },
    removeFile: async () => {
      removed = true
      output = new Uint8Array(0)
    },
  }
  return {
    fileSystem,
    getOutput: () => output,
    wasRemoved: () => removed,
  }
}

const verifyZipArchive = async () => {
  const firstContent = repeatedContent(700 * 1024, 65)
  const secondContent = repeatedContent(32 * 1024, 66)
  const memory = createMemoryFileSystem({
    '/复习资料.txt': firstContent,
    '/复习资料-2.txt': secondContent,
  })
  const progress: number[] = []
  const archive = await createZipArchive([
    { name: '复习资料.txt', path: '/复习资料.txt', size: firstContent.length },
    { name: '复习资料.txt', path: '/复习资料-2.txt', size: secondContent.length },
  ], memory.fileSystem, '/output.zip', ({ progress: value }) => progress.push(value))

  assert.equal(archive.filename, '资料合辑.zip')
  assert.ok(archive.size < firstContent.length + secondContent.length, 'DEFLATE 应压缩可压缩内容')
  assert.equal(progress[progress.length - 1], 100)
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]))

  const contents = unzipSync(memory.getOutput())
  assert.deepEqual(Buffer.from(contents['复习资料.txt']), Buffer.from(firstContent))
  assert.deepEqual(Buffer.from(contents['复习资料 (2).txt']), Buffer.from(secondContent))

  const broken = createMemoryFileSystem({ '/incomplete.txt': firstContent }, '/incomplete.txt')
  await assert.rejects(createZipArchive([
    { name: 'incomplete.txt', path: '/incomplete.txt', size: firstContent.length },
  ], broken.fileSystem, '/broken.zip'), /读取不完整/u)
  assert.equal(broken.wasRemoved(), true, '失败时应删除未完成的 ZIP 临时文件')

  const hundredFiles = Array.from({ length: 100 }, (_, index) => ({
    name: `资料-${index}.pdf`, path: `/batch-${index}.pdf`, size: 1024,
  }))
  const hundredInputs = Object.fromEntries(hundredFiles.map((file, index) => [file.path, repeatedContent(file.size, index)]))
  const hundredMemory = createMemoryFileSystem(hundredInputs)
  await createZipArchive(hundredFiles, hundredMemory.fileSystem, '/hundred.zip')
  const hundredContents = unzipSync(hundredMemory.getOutput())
  assert.equal(Object.keys(hundredContents).length, 100, '100 个文件必须完整进入同一个 ZIP')
  hundredFiles.forEach((file) => assert.deepEqual(hundredContents[file.name], hundredInputs[file.path]))
}

void verifyZipArchive().then(() => {
  process.stdout.write('course-materials ZIP compression smoke: ok\n')
}).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
