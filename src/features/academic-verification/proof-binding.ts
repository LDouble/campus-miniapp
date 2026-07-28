export type AcademicProofBindingPhase =
  | 'idle'
  | 'requesting_nonce'
  | 'creating_proof'
  | 'exchanging_proof'
  | 'refreshing_status'
  | 'succeeded'
  | 'failed'

export type AcademicProofBindingState = {
  phase: AcademicProofBindingPhase
  message: string
}

export type AcademicProofBindingEvent =
  | { type: 'start' }
  | { type: 'nonce_received' }
  | { type: 'proof_created' }
  | { type: 'proof_exchanged' }
  | { type: 'status_verified' }
  | { type: 'fail'; message: string }
  | { type: 'reset' }

export const initialAcademicProofBindingState: AcademicProofBindingState = {
  phase: 'idle',
  message: '',
}

const phaseMessage: Record<AcademicProofBindingPhase, string> = {
  idle: '',
  requesting_nonce: '正在申请一次性认证凭证',
  creating_proof: '正在本机验证教务身份',
  exchanging_proof: '正在提交短时认证证明',
  refreshing_status: '正在确认校园身份状态',
  succeeded: '校园身份认证成功',
  failed: '认证未完成',
}

export const reduceAcademicProofBinding = (
  state: AcademicProofBindingState,
  event: AcademicProofBindingEvent,
): AcademicProofBindingState => {
  switch (event.type) {
    case 'start':
      return {
        phase: 'requesting_nonce',
        message: phaseMessage.requesting_nonce,
      }
    case 'nonce_received':
      if (state.phase !== 'requesting_nonce') return state
      return {
        phase: 'creating_proof',
        message: phaseMessage.creating_proof,
      }
    case 'proof_created':
      if (state.phase !== 'creating_proof') return state
      return {
        phase: 'exchanging_proof',
        message: phaseMessage.exchanging_proof,
      }
    case 'proof_exchanged':
      if (state.phase !== 'exchanging_proof') return state
      return {
        phase: 'refreshing_status',
        message: phaseMessage.refreshing_status,
      }
    case 'status_verified':
      if (state.phase !== 'refreshing_status') return state
      return {
        phase: 'succeeded',
        message: phaseMessage.succeeded,
      }
    case 'fail':
      return {
        phase: 'failed',
        message: event.message || phaseMessage.failed,
      }
    case 'reset':
      return initialAcademicProofBindingState
    default:
      return state
  }
}

export const isAcademicProofBindingWorking = (
  phase: AcademicProofBindingPhase,
) => (
  phase === 'requesting_nonce'
  || phase === 'creating_proof'
  || phase === 'exchanging_proof'
  || phase === 'refreshing_status'
)

export const academicProofBindingErrorMessage = (code: string, fallback: string) => {
  if ([
    'ACADEMIC_PROOF_EXPIRED',
    'academic_proof_expired',
    'academic_nonce_expired',
  ].includes(code)) return '认证证明已过期，请重新验证'
  if ([
    'ACADEMIC_PROOF_ALREADY_USED',
    'academic_proof_used',
  ].includes(code)) return '认证证明已使用，请重新发起认证'
  if ([
    'ACADEMIC_PROOF_INVALID',
    'academic_proof_invalid',
  ].includes(code)) return '认证证明无效，请重新验证'
  if ([
    'ACADEMIC_IDENTITY_CONFLICT',
    'academic_binding_conflict',
  ].includes(code)) return '该教务身份已绑定其他账号'
  if (code === 'ACADEMIC_PROOF_SECONDARY_VERIFICATION_FAILED') {
    return '教务身份二次校验未通过，请确认信息后重试'
  }
  if ([
    'ACADEMIC_VERIFICATION_RATE_LIMITED',
    'academic_credentials_limited',
  ].includes(code)) return '认证尝试次数过多，请稍后重试'
  if ([
    'ACADEMIC_PROOF_NETWORK_OR_PROVIDER_FAILURE',
    'academic_provider_unavailable',
  ].includes(code)) return '教务认证服务暂不可用，请稍后重试'
  return fallback
}
