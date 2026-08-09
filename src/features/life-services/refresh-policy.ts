import type { LifeHubSection } from './business-theme'

export const LIFE_HUB_DATA_FRESH_MS = 90_000

type RefreshState = {
  revision: number
  freshRevision: number
  refreshedAt: number
}

const createState = (): RefreshState => ({
  revision: 0,
  freshRevision: -1,
  refreshedAt: 0,
})

const refreshStates: Record<LifeHubSection, RefreshState> = {
  community: createState(),
  errands: createState(),
  market: createState(),
  carpool: createState(),
}

export const getLifeHubRefreshRevision = (section: LifeHubSection) => (
  refreshStates[section].revision
)

export const markLifeHubSectionDirty = (section: LifeHubSection) => {
  refreshStates[section].revision += 1
}

export const markLifeHubSectionFresh = (
  section: LifeHubSection,
  refreshedAt = Date.now(),
) => {
  const state = refreshStates[section]
  state.freshRevision = state.revision
  state.refreshedAt = refreshedAt
}

export const isLifeHubSectionRefreshRequired = (
  section: LifeHubSection,
  now = Date.now(),
  freshMs = LIFE_HUB_DATA_FRESH_MS,
) => {
  const state = refreshStates[section]
  return (
    state.freshRevision !== state.revision
    || now - state.refreshedAt >= freshMs
  )
}

export const isLifeHubCacheReusable = (
  section: LifeHubSection,
  revision: number,
  refreshedAt: number,
  now = Date.now(),
  freshMs = LIFE_HUB_DATA_FRESH_MS,
) => (
  revision === getLifeHubRefreshRevision(section)
  && now - refreshedAt < freshMs
)

export const resetLifeHubRefreshPolicyForTests = () => {
  Object.values(refreshStates).forEach((state) => {
    state.revision = 0
    state.freshRevision = -1
    state.refreshedAt = 0
  })
}
