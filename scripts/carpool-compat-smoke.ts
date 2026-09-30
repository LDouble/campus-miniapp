import { strict as assert } from 'node:assert'
import Module = require('node:module')

const originalLoad = (Module as any)._load
const calls: string[] = []
let groupStatus = 400
const trip = { id: 7, origin: '东门', destination: '高铁站', departure_at: '2030-01-01T12:00:00Z' }

;(Module as any)._load = function (request: string, parent: { filename?: string }, isMain: boolean) {
  if (request === '../../api/client' && parent?.filename?.endsWith('/life-services/repository.ts')) {
    return {
      apiRequest: async ({ path }: { path: string }) => {
        calls.push(path)
        if (path === '/api/v1/carpool/trips/groups') throw { statusCode: groupStatus, code: groupStatus === 400 ? 'invalid_parameter' : 'not_found' }
        if (path === '/api/v1/carpool/trips') return { items: [trip], page: 2, page_size: 1, total: 2 }
        if (path.endsWith('/nearby')) throw { statusCode: 404 }
        throw new Error(`unexpected request: ${path}`)
      },
      createIdempotencyKey: () => 'test',
      isApiError: (error: unknown) => typeof (error as { statusCode?: number })?.statusCode === 'number',
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

async function main() {
  try {
    const { lifeServicesRepository } = require('../src/features/life-services/repository')
    const groups = await lifeServicesRepository.listCarpoolGroups({ page: 2, pageSize: 1 })
    assert.deepEqual(calls, ['/api/v1/carpool/trips/groups', '/api/v1/carpool/trips'])
    assert.equal(groups.total, 2)
    assert.equal(groups.items[0].anchor_trip_id, 7)
    assert.equal(groups.items[0].trip_count, 1)
    assert.deepEqual(groups.items[0].trips, [trip])

    groupStatus = 404
    const groupsAfter404 = await lifeServicesRepository.listCarpoolGroups()
    assert.equal(groupsAfter404.items[0].anchor_trip_id, 7)

    const nearby = await lifeServicesRepository.listNearbyCarpoolTrips(7)
    assert.deepEqual(nearby, { items: [], page: 1, page_size: 10, total: 0 })

    groupStatus = 500
    await assert.rejects(lifeServicesRepository.listCarpoolGroups(), (error: { statusCode: number }) => error.statusCode === 500)
    console.log('carpool compatibility smoke: ok')
  } finally {
    ;(Module as any)._load = originalLoad
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
