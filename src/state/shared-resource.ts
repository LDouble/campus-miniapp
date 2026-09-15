export type SharedResourceReadOptions = {
  force?: boolean
  maxAgeMs?: number
}

export type SharedResourceInvalidateOptions = {
  clearData?: boolean
}

export type SharedResourceSnapshot<T> = {
  data: T | null
  updatedAt: number
  loading: boolean
}

type SharedResourceConfig<T> = {
  maxAgeMs: number | ((data: T) => number)
  group?: string
  now?: () => number
}

type PendingRequest<T> = {
  generation: number
  promise: Promise<T>
}

export type SharedResource<T> = {
  ensure: (loader: () => Promise<T>, options?: SharedResourceReadOptions) => Promise<T>
  peek: () => T | null
  snapshot: () => SharedResourceSnapshot<T>
  seed: (data: T, updatedAt?: number) => void
  invalidate: (options?: SharedResourceInvalidateOptions) => void
}

const groupInvalidators = new Map<string, Set<(options?: SharedResourceInvalidateOptions) => void>>()

const registerGroupInvalidator = (
  group: string | undefined,
  invalidate: (options?: SharedResourceInvalidateOptions) => void,
) => {
  if (!group) return
  const invalidators = groupInvalidators.get(group) || new Set()
  invalidators.add(invalidate)
  groupInvalidators.set(group, invalidators)
}

export const invalidateSharedResourceGroup = (
  group: string,
  options: SharedResourceInvalidateOptions = { clearData: true },
) => {
  groupInvalidators.get(group)?.forEach((invalidate) => invalidate(options))
}

export const createSharedResource = <T,>(
  config: SharedResourceConfig<T>,
): SharedResource<T> => {
  const now = config.now || Date.now
  let data: T | null = null
  let hasData = false
  let fresh = false
  let updatedAt = 0
  let generation = 0
  let pending: PendingRequest<T> | null = null

  const maxAgeFor = (value: T, override?: number) => (
    override ?? (
      typeof config.maxAgeMs === 'function'
        ? config.maxAgeMs(value)
        : config.maxAgeMs
    )
  )

  const isFresh = (override?: number) => {
    if (!hasData || !fresh) return false
    const maxAgeMs = maxAgeFor(data as T, override)
    const age = now() - updatedAt
    return age >= 0 && age < maxAgeMs
  }

  const invalidate = (options: SharedResourceInvalidateOptions = {}) => {
    generation += 1
    pending = null
    fresh = false
    updatedAt = 0
    if (options.clearData) {
      data = null
      hasData = false
    }
  }

  const seed = (value: T, timestamp = now()) => {
    generation += 1
    pending = null
    data = value
    hasData = true
    fresh = true
    updatedAt = timestamp
  }

  const ensure = (
    loader: () => Promise<T>,
    options: SharedResourceReadOptions = {},
  ) => {
    if (pending && pending.generation === generation) return pending.promise
    if (!options.force && isFresh(options.maxAgeMs)) {
      return Promise.resolve(data as T)
    }

    const requestGeneration = generation
    let tracked: Promise<T>
    tracked = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (generation === requestGeneration) {
          data = value
          hasData = true
          fresh = true
          updatedAt = now()
        }
        return value
      })
      .finally(() => {
        if (pending?.promise === tracked) pending = null
      })
    pending = { generation: requestGeneration, promise: tracked }
    return tracked
  }

  const resource: SharedResource<T> = {
    ensure,
    peek: () => hasData ? data : null,
    snapshot: () => ({
      data: hasData ? data : null,
      updatedAt,
      loading: !!pending && pending.generation === generation,
    }),
    seed,
    invalidate,
  }
  registerGroupInvalidator(config.group, invalidate)
  return resource
}
