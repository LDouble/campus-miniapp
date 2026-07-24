import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const source = resolve(process.argv[2] || '../backend_demo/api/openapi.yaml')
const destinationDirectory = resolve('contracts/backend')
const destination = resolve(destinationDirectory, 'openapi.yaml')
await mkdir(destinationDirectory, { recursive: true })
await copyFile(source, destination)
const content = await readFile(destination)
await writeFile(resolve(destinationDirectory, 'source.json'), `${JSON.stringify({ backend_repository: 'LDouble/backend_demo', source_file: 'api/openapi.yaml', sha256: createHash('sha256').update(content).digest('hex') }, null, 2)}\n`)
