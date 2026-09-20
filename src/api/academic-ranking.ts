import { apiRequest, createIdempotencyKey } from './client'
import type { components } from './generated/schema'

export type AcademicRankingRule = components['schemas']['AcademicRankingRule']
export type AcademicRankingProfile = components['schemas']['AcademicRankingProfile']
export type AcademicRankingGroup = components['schemas']['AcademicRankingGroup']
export type AcademicRankingMember = components['schemas']['AcademicRankingGroupMember']
export type AcademicRankingGroupDetail = components['schemas']['AcademicRankingGroupDetail']
export type AcademicRankingBatch = components['schemas']['AcademicRankingBatch']
export type AcademicRankingRow = components['schemas']['AcademicRankingReportRow']
export type AcademicRankingReport = components['schemas']['AcademicRankingReport']
export type AcademicRankingGrant = components['schemas']['AcademicRankingGrant']

const base = '/api/v1/academic/rankings'

export const listAcademicRankingRules = async () => (await apiRequest<components['schemas']['AcademicRankingRuleList']>({ path: `${base}/rules` })).items
export const getAcademicRankingProfile = () => apiRequest<AcademicRankingProfile>({ path: `${base}/profile` })
export const syncAcademicRankingGrades = (password: string, periodIds: string[]) => apiRequest<{ event_id: string; observed_at: string }>({
  path: `${base}/sync`, method: 'POST', data: { password, period_ids: periodIds },
  idempotencyKey: createIdempotencyKey('academic-ranking-sync'),
})
export const listAcademicRankingGroups = async () => (await apiRequest<components['schemas']['AcademicRankingGroupPage']>({ path: `${base}/groups` })).items
export const createAcademicRankingGroup = (data: { name: string; education_level: string; period_ids: string[]; rule_key: string }) => apiRequest<AcademicRankingGroupDetail>({
  path: `${base}/groups`, method: 'POST', data, idempotencyKey: createIdempotencyKey('academic-ranking-group'),
})
export const getAcademicRankingGroup = (id: number) => apiRequest<AcademicRankingGroupDetail>({ path: `${base}/groups/${id}` })
export const joinAcademicRankingGroup = (invitationCode: string) => apiRequest<AcademicRankingGroupDetail>({
  path: `${base}/groups/join`, method: 'POST', data: { invitation_code: invitationCode }, idempotencyKey: createIdempotencyKey('academic-ranking-join'),
})
export const reviewAcademicRankingMember = (groupId: number, memberId: number, status: 'approved' | 'rejected') => apiRequest<AcademicRankingGroupDetail>({
  path: `${base}/groups/${groupId}/members`, method: 'PUT', data: { member_id: memberId, status }, idempotencyKey: createIdempotencyKey('academic-ranking-member'),
})
export const leaveAcademicRankingGroup = (groupId: number) => apiRequest<void>({ path: `${base}/groups/${groupId}/membership`, method: 'DELETE' })
export const publishAcademicRankingGroup = (groupId: number, allowPartial: boolean) => apiRequest<AcademicRankingBatch>({
  path: `${base}/groups/${groupId}/publish`, method: 'POST', data: { allow_partial: allowPartial }, idempotencyKey: createIdempotencyKey('academic-ranking-publish'),
})
export const listAcademicRankingReports = async () => (await apiRequest<components['schemas']['AcademicRankingBatchPage']>({ path: `${base}/reports` })).items
export const getAcademicRankingReport = (id: number, view: 'personal' | 'shared') => apiRequest<AcademicRankingReport>({ path: `${base}/reports/${id}`, query: { view } })
export const listAcademicRankingGrants = async (groupId: number) => (await apiRequest<components['schemas']['AcademicRankingGrantList']>({ path: `${base}/groups/${groupId}/grants` })).items
export const putAcademicRankingGrant = (groupId: number, data: { recipient_student_no: string; include_details: boolean; expires_in_days: number }) => {
  const expiresAt = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
  return apiRequest<AcademicRankingGrant>({
    path: `${base}/groups/${groupId}/grants`, method: 'PUT',
    data: { recipient_student_no: data.recipient_student_no, include_details: data.include_details, expires_at: expiresAt },
    idempotencyKey: createIdempotencyKey('academic-ranking-grant'),
  })
}
export const deleteAcademicRankingGrant = (id: number) => apiRequest<void>({ path: `${base}/grants/${id}`, method: 'DELETE' })
