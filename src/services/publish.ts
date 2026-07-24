import {
  createActivity,
  createCampusCirclePost,
  createCarpoolTrip,
  createErrand,
  createMarketplaceListing,
  listCampusCircleSections,
  submitActivityReview,
  submitMarketplaceListing
} from '../api/generated/client'
import type {
  CreateActivityBody,
  CreateCampusCirclePostBody,
  CreateCarpoolTripBody,
  CreateErrandBody,
  CreateMarketplaceListingBody,
  CampusCircleSectionView
} from '../api/generated/models'

export type PublishType = 'activity' | 'campus-circle' | 'marketplace' | 'errand' | 'carpool'

export type ActivityForm = Omit<CreateActivityBody, 'capacity'> & { capacity: string }
export type CampusCircleForm = Omit<CreateCampusCirclePostBody, 'section_id'> & { section_id: number | null }
export type MarketplaceForm = Omit<CreateMarketplaceListingBody, 'price_cents' | 'image_urls'> & { price: string }
export type ErrandForm = Omit<CreateErrandBody, 'reward_cents'> & { reward: string }
export type CarpoolForm = Omit<CreateCarpoolTripBody, 'total_seats'> & { total_seats: string }

export type PublishDraft =
  | { type: 'activity'; form: ActivityForm }
  | { type: 'campus-circle'; form: CampusCircleForm }
  | { type: 'marketplace'; form: MarketplaceForm }
  | { type: 'errand'; form: ErrandForm }
  | { type: 'carpool'; form: CarpoolForm }

export interface PublishResult {
  id: number
  type: PublishType
  version: number
}

export const publishTypeLabels: Record<PublishType, string> = {
  activity: '活动',
  'campus-circle': '校园圈',
  marketplace: '二手',
  errand: '跑腿',
  carpool: '拼车'
}

export const emptyForms: { [K in PublishType]: Extract<PublishDraft, { type: K }>['form'] } = {
  activity: {
    title: '',
    summary: '',
    body: '',
    location: '',
    signup_start_at: '',
    signup_end_at: '',
    start_at: '',
    end_at: '',
    capacity: '',
    contact_type: 'wechat',
    contact: ''
  },
  'campus-circle': { section_id: null, title: '', content: '', image_urls: [] },
  marketplace: { title: '', description: '', price: '', contact_type: 'wechat', contact: '' },
  errand: {
    title: '',
    description: '',
    reward: '',
    pickup_location: '',
    dropoff_location: '',
    deadline: '',
    contact_type: 'wechat',
    contact: ''
  },
  carpool: {
    title: '',
    origin: '',
    destination: '',
    departure_at: '',
    total_seats: '',
    contact_type: 'wechat',
    contact: ''
  }
}

export function yuanToCents (value: string) {
  return Math.round(Number(value) * 100)
}

export function localTimeToISO (value: string) {
  return new Date(`${value.replace(' ', 'T')}:00+08:00`).toISOString()
}

export async function loadCampusCircleSections (): Promise<CampusCircleSectionView[]> {
  const response = await listCampusCircleSections()
  const flatten = (items: CampusCircleSectionView[]): CampusCircleSectionView[] => items.flatMap(item => [item, ...flatten(item.children || [])])
  return flatten(response.data.items).filter(item => item.parent_id !== null && item.status === 'active' && (!item.children || item.children.length === 0))
}

export async function submitPublish (draft: PublishDraft): Promise<PublishResult> {
  if (draft.type === 'campus-circle') {
    const created = await createCampusCirclePost({
      ...draft.form,
      section_id: Number(draft.form.section_id),
      image_urls: []
    })
    return { id: created.data.id, type: draft.type, version: created.data.version }
  }
  if (draft.type === 'activity') {
    const created = await createActivity({
      ...draft.form,
      capacity: Number(draft.form.capacity),
      signup_start_at: localTimeToISO(draft.form.signup_start_at),
      signup_end_at: localTimeToISO(draft.form.signup_end_at),
      start_at: localTimeToISO(draft.form.start_at),
      end_at: localTimeToISO(draft.form.end_at)
    })
    const submitted = await submitActivityReview(created.data.id, { expected_version: created.data.version })
    return { id: submitted.data.id, type: draft.type, version: submitted.data.version }
  }
  if (draft.type === 'marketplace') {
    const created = await createMarketplaceListing({
      title: draft.form.title,
      description: draft.form.description,
      price_cents: yuanToCents(draft.form.price),
      contact_type: draft.form.contact_type,
      contact: draft.form.contact,
      image_urls: []
    })
    await submitMarketplaceListing(created.data.id, { expected_version: created.data.version })
    return { id: created.data.id, type: draft.type, version: created.data.version + 1 }
  }
  if (draft.type === 'errand') {
    const created = await createErrand({
      ...draft.form,
      reward_cents: yuanToCents(draft.form.reward),
      deadline: localTimeToISO(draft.form.deadline)
    })
    return { id: created.data.id, type: draft.type, version: created.data.version }
  }
  const created = await createCarpoolTrip({
    ...draft.form,
    total_seats: Number(draft.form.total_seats),
    departure_at: localTimeToISO(draft.form.departure_at)
  })
  return { id: created.data.id, type: draft.type, version: created.data.version }
}
