import { useState } from 'react'
import Taro, {
  useDidShow,
  useLoad,
  usePullDownRefresh,
} from '@tarojs/taro'
import {
  Image,
  Text,
  View,
} from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  KeyboardSafeInput,
  useKeyboardInset,
} from '../../components/keyboard-safe-input'
import { getCurrentIdentity } from '../../api/account'
import {
  loadAcademicCredential,
  saveAcademicCredential,
} from '../../api/academic-credential'
import type { AcademicEducationLevel } from '../../api/academic-credential'
import {
  getAcademicVerificationStatus,
  submitStudentCardVerification,
  uploadAcademicVerificationMaterial,
  verifyAcademicCredentials,
} from '../../api/academic-verification'
import { isApiError } from '../../api/client'
import type {
  AcademicVerificationMaterial,
  AcademicVerificationStatus,
} from '../../api/types'
import { finishAcademicVerification } from '../../features/academic-verification/guard'
import {
  academicChallengeRemainingMinutes,
  academicChallengeRetryAt,
} from '../../features/academic-verification/challenge-cooldown'
import {
  isRepeatedRejectedCredential,
  rejectedCredentialHint,
} from '../../features/academic-verification/credential-rejection'
import type {
  CredentialRejectionReason,
  RejectedAcademicCredential,
} from '../../features/academic-verification/credential-rejection'
import {
  convertAcademicPasswordToEnglishSymbols,
  hasConvertibleAcademicPasswordSymbols,
} from '../../features/academic-verification/password-symbols'
import { apiDateTimeCampusParts } from '../../utils/date-time'
import { getSelectedTempFiles } from '../../utils/file-selection'
import './index.scss'

type VerificationMethod = 'credentials' | 'student_card'
type VerificationState = 'unverified' | 'pending' | 'verified' | 'rejected' | 'revoked'

type SelectedMaterial = {
  path: string
  size: number
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

const MAX_MATERIAL_BYTES = 5 * 1024 * 1024
const educationIcons: Record<AcademicEducationLevel, string> = {
  undergraduate: require('../../assets/icons/study.svg'),
  graduate: require('../../assets/icons/academic.svg'),
}
const verificationMethodIcons: Record<VerificationMethod, string> = {
  credentials: require('../../assets/icons/academic.svg'),
  student_card: require('../../assets/icons/profile.svg'),
}
const securityIcon = require('../../assets/icons/result.svg')
const passwordVisibleIcon = require('../../assets/icons/eye.svg')
const passwordHiddenIcon = require('../../assets/icons/eye-off.svg')

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const parts = apiDateTimeCampusParts(value)
  if (!parts) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`
}

const maskStudentNo = (value?: string | null) => {
  if (!value) return '暂未绑定'
  if (value.length <= 4) return `${value.slice(0, 1)}***`
  return `${value.slice(0, 2)}****${value.slice(-2)}`
}

const resolveVerificationState = (
  status: AcademicVerificationStatus | null,
): VerificationState => {
  const identityStatus = status && status.identity ? status.identity.status : null
  const requestStatus = status && status.latest_request ? status.latest_request.status : null

  // Re-authentication requests are still active while an old identity may be
  // revoked. Let the current request drive the page state in that case.
  if (identityStatus !== 'verified' && requestStatus === 'pending') return 'pending'
  if (identityStatus !== 'verified' && requestStatus === 'rejected') return 'rejected'
  if (identityStatus === 'verified') return 'verified'
  if (identityStatus === 'revoked') return 'revoked'
  if (requestStatus === 'revoked') return 'revoked'
  return 'unverified'
}

const stateCopy: Record<VerificationState, {
  eyebrow: string
  title: string
  description: string
}> = {
  unverified: {
    eyebrow: '校园身份认证',
    title: '绑定校园身份',
    description: '绑定后即可查询课表、成绩、考试和选课。',
  },
  pending: {
    eyebrow: '认证审核',
    title: '材料审核中',
    description: '认证材料已提交人工审核，结果会通过消息通知。',
  },
  verified: {
    eyebrow: '认证成功',
    title: '校园身份已通过',
    description: '你的账号已获得OUSea成员权限。',
  },
  rejected: {
    eyebrow: '需要补充',
    title: '认证申请未通过',
    description: '请根据审核说明更新信息或重新上传认证材料。',
  },
  revoked: {
    eyebrow: '认证已失效',
    title: '重新完成认证',
    description: '原校园身份已失效，完成认证后可恢复成员权限。',
  },
}

const credentialErrorMessage = (error: unknown) => {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : '信息门户认证失败，请稍后重试'
  }
  if (error.code === 'invalid_academic_credentials') return '请访问信息门户确认或修改密码'
  if (error.code === 'academic_password_expired') return '请访问信息门户修改已过期密码'
  if (error.code === 'academic_account_restricted') return '请访问信息门户处理账号状态和密码'
  if (error.code === 'academic_credentials_limited') return '尝试次数过多，请稍后再试'
  if (error.code === 'academic_retryable') return '教务暂时繁忙，请重启小程序重试绑定。'
  if (error.code === 'academic_provider_unavailable') return '信息门户认证服务暂不可用'
  if (error.code === 'invalid_education_level') return '请选择本科生或研究生'
  if (error.code === 'academic_identity_type_mismatch') return '所选身份与信息门户要求不匹配，请确认后重试'
  if (error.code === 'academic_challenge_required') return '校方要求验证码或设备确认，请等待 30 分钟后重试'
  return error.message
}

export default function AcademicVerificationPage() {
  const {
    keyboardHeight,
    onKeyboardVisibilityChange,
  } = useKeyboardInset()
  const [replacedCurrentPage, setReplacedCurrentPage] = useState(false)
  const [forceCredentialBinding, setForceCredentialBinding] = useState(false)
  const [method, setMethod] = useState<VerificationMethod>('credentials')
  const [status, setStatus] = useState<AcademicVerificationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [rejectedCredential, setRejectedCredential] = useState<RejectedAcademicCredential | null>(null)
  const [credentialError, setCredentialError] = useState('')
  const [passwordCoachMarkDismissed, setPasswordCoachMarkDismissed] = useState(false)
  const [educationLevel, setEducationLevel] = useState<AcademicEducationLevel | null>(null)
  const [realName, setRealName] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<SelectedMaterial | null>(null)
  const [uploadedMaterial, setUploadedMaterial] = useState<AcademicVerificationMaterial | null>(null)
  const [working, setWorking] = useState(false)
  const [workingText, setWorkingText] = useState('')
  const [challengeRetryAt, setChallengeRetryAt] = useState(0)
  const currentCredentialRejected = rejectedCredential !== null
    && educationLevel !== null
    && isRepeatedRejectedCredential(rejectedCredential, {
      studentNo: studentNo.trim(),
      password,
      educationLevel,
    })
  const credentialFeedbackMessage = credentialError
    || (rejectedCredential
      ? currentCredentialRejected
        ? rejectedCredentialHint(rejectedCredential.reason)
        : '账号、密码或学生类型已修改，可以重新验证。'
      : '')
  const credentialFeedbackKind = credentialError || currentCredentialRejected ? 'error' : 'ready'
  const showPasswordCoachMark = currentCredentialRejected && !passwordCoachMarkDismissed

  const loadStatus = async (silent = false, force = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const nextStatus = await getAcademicVerificationStatus({ force })
      setStatus(nextStatus)
      const request = nextStatus.latest_request
      const identity = nextStatus.identity
      if (!studentNo) setStudentNo(identity?.student_no || request?.student_no || '')
      if (!realName) setRealName(identity?.real_name || request?.real_name || '')
      if (request?.method === 'student_card' && request.status !== 'approved') {
        setMethod('student_card')
      }
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '认证状态加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }

  useLoad((options) => {
    setReplacedCurrentPage(options.replaced === '1')
    if (options.rebind === '1') {
      setForceCredentialBinding(true)
      setMethod('credentials')
    }
  })
  useDidShow(() => {
    void loadStatus()
    void getCurrentIdentity()
      .then((currentUser) => {
        const credential = loadAcademicCredential(currentUser.user_id)
        setStudentNo((current) => current || credential.studentNo)
      })
      .catch(() => {
        // 未绑定或旧版本凭据由页面正常引导重新填写。
      })
  })
  usePullDownRefresh(() => {
    void loadStatus(true, true)
  })

  const chooseMaterial = async () => {
    if (working) return
    try {
      const result = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      const file = getSelectedTempFiles(result)[0]
      if (!file) return
      if (file.size > MAX_MATERIAL_BYTES) {
        Taro.showToast({ title: '图片不能超过 5 MiB', icon: 'none' })
        return
      }
	  const imageInfo = await Taro.getImageInfo({ src: file.tempFilePath })
	  const imageType = imageInfo.type?.toLowerCase()
	  const mimeType = imageType === 'png'
	    ? 'image/png'
	    : imageType === 'webp'
	      ? 'image/webp'
	      : imageType === 'jpg' || imageType === 'jpeg'
	        ? 'image/jpeg'
	        : null
	  if (!mimeType) {
	    Taro.showToast({ title: '仅支持 JPEG、PNG 或 WebP 图片', icon: 'none' })
	    return
	  }
      setSelectedMaterial({
        path: file.tempFilePath,
        size: file.size,
		mimeType,
      })
      setUploadedMaterial(null)
    } catch (chooseError) {
      const message = chooseError instanceof Error ? chooseError.message : String(chooseError)
      if (!message.toLowerCase().includes('cancel')) {
        Taro.showToast({ title: '无法选择图片，请重试', icon: 'none' })
      }
    }
  }

  const completeSuccess = async () => {
    await Taro.showModal({
      title: '认证成功',
      content: '校园成员权限已经生效，现在可以继续刚才的操作。',
      showCancel: false,
      confirmText: '返回继续',
      confirmColor: '#5a9d88',
    })
    await finishAcademicVerification(replacedCurrentPage, true)
  }

  const submitCredentials = async () => {
    const normalizedStudentNo = studentNo.trim()
    if (!educationLevel) {
      Taro.showToast({ title: '请选择本科生或研究生', icon: 'none' })
      return
    }
    if (!normalizedStudentNo || !password) {
      Taro.showToast({ title: '请填写信息门户账号和密码', icon: 'none' })
      return
    }
    if (working) return
    const challengeRemainingMinutes = academicChallengeRemainingMinutes(challengeRetryAt)
    if (challengeRemainingMinutes > 0) {
      await Taro.showModal({
        title: '请稍后再试',
        content: `校方仍处于验证码或设备确认冷却期，请等待约 ${challengeRemainingMinutes} 分钟后再次尝试。`,
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#5a9d88',
      })
      return
    }
    const attempt = {
      studentNo: normalizedStudentNo,
      password,
      educationLevel,
    }
    if (rejectedCredential && isRepeatedRejectedCredential(rejectedCredential, attempt)) {
      return
    }

    const completeCredentialAttempt = async (candidatePassword: string) => {
      await verifyAcademicCredentials(
        normalizedStudentNo,
        candidatePassword,
        educationLevel,
      )
      const currentUser = await getCurrentIdentity()
      saveAcademicCredential(currentUser.user_id, {
        studentNo: normalizedStudentNo,
        password: candidatePassword,
        educationLevel,
      })
      setPassword('')
      setPasswordVisible(false)
      setRejectedCredential(null)
      setCredentialError('')
      setPasswordCoachMarkDismissed(false)
      setForceCredentialBinding(false)
      await loadStatus(true, true)
      await completeSuccess()
    }

    setWorking(true)
    setWorkingText('正在连接信息门户')
    try {
      await completeCredentialAttempt(password)
    } catch (initialSubmitError) {
      let submittedPassword = password
      let submitError: unknown = initialSubmitError

      if (
        isApiError(initialSubmitError)
        && initialSubmitError.code === 'invalid_academic_credentials'
        && hasConvertibleAcademicPasswordSymbols(password)
      ) {
        let shouldRetryWithEnglishSymbols = false
        try {
          const decision = await Taro.showModal({
            title: '密码符号可能输错了',
            content: '检测到密码中含有中文输入法符号，可能与实际密码不一致。是否仅转换为对应的英文半角符号，并重新验证？',
            confirmText: '转换重试',
            cancelText: '保持原样',
            confirmColor: '#5a9d88',
          })
          shouldRetryWithEnglishSymbols = decision.confirm
        } catch {
          // 旧版微信取消弹窗可能进入 fail，按保持原密码处理。
        }

        if (!shouldRetryWithEnglishSymbols) {
          return
        }

        submittedPassword = convertAcademicPasswordToEnglishSymbols(password)
        setPassword(submittedPassword)
        setCredentialError('')
        setWorkingText('已转换为英文符号，正在重新验证')
        try {
          await completeCredentialAttempt(submittedPassword)
          return
        } catch (retryError) {
          submitError = retryError
        }
      }

      const submittedAttempt = { ...attempt, password: submittedPassword }
      if (isApiError(submitError)) {
        let rejectionReason: CredentialRejectionReason | null = null
        if (submitError.code === 'invalid_academic_credentials') {
          rejectionReason = 'invalid_credentials'
        } else if (submitError.code === 'academic_password_expired') {
          rejectionReason = 'password_expired'
        } else if (submitError.code === 'academic_account_restricted') {
          rejectionReason = 'account_restricted'
        } else if (submitError.code === 'academic_challenge_required') {
          const retryAt = academicChallengeRetryAt()
          setChallengeRetryAt(retryAt)
          await Taro.showModal({
            title: '请等待 30 分钟',
            content: '校方触发了验证码或设备确认。请等待 30 分钟后再次尝试，期间请不要反复提交。',
            showCancel: false,
            confirmText: '我知道了',
            confirmColor: '#5a9d88',
          })
          return
        }
        if (rejectionReason) {
          setCredentialError('')
          setRejectedCredential({ ...submittedAttempt, reason: rejectionReason })
          setPasswordCoachMarkDismissed(false)
          return
        }
      }
      setRejectedCredential(null)
      setCredentialError(credentialErrorMessage(submitError))
    } finally {
      setWorking(false)
      setWorkingText('')
    }
  }

  const submitStudentCard = async () => {
    const normalizedRealName = realName.trim()
    const normalizedStudentNo = studentNo.trim()
    if (!normalizedRealName || !normalizedStudentNo) {
      Taro.showToast({ title: '请填写姓名和学号', icon: 'none' })
      return
    }
    if (!selectedMaterial && !uploadedMaterial) {
      Taro.showToast({ title: '请上传认证材料', icon: 'none' })
      return
    }
    if (working) return
    setWorking(true)
    try {
      let material = uploadedMaterial
      if (!material && selectedMaterial) {
        setWorkingText('正在安全上传材料')
        material = await uploadAcademicVerificationMaterial(
		  selectedMaterial.path,
		  selectedMaterial.mimeType,
		  selectedMaterial.size,
		)
        setUploadedMaterial(material)
      }
      if (!material) throw new Error('material unavailable')
      setWorkingText('正在提交人工审核')
      await submitStudentCardVerification(
        normalizedRealName,
        normalizedStudentNo,
        material.material_id,
      )
      await loadStatus(true, true)
      Taro.showToast({ title: '已提交审核', icon: 'success' })
    } catch (submitError) {
      Taro.showToast({
        title: isApiError(submitError) || submitError instanceof Error
          ? submitError.message
          : '提交失败，请重试',
        icon: 'none',
        duration: 2600,
      })
    } finally {
      setWorking(false)
      setWorkingText('')
    }
  }

  const verificationState = resolveVerificationState(status)
  const copy = stateCopy[verificationState]
  const identity = status?.identity
  const request = status?.latest_request
  const pendingStudentCard = (
    verificationState === 'pending'
    && request?.method === 'student_card'
  )

  return (
    <View className='verification-page'>
      <CustomNavbar
        title=''
        showBack
      />

      <View
        className='verification-page__content'
        style={keyboardHeight > 0
          ? `padding-bottom: calc(56rpx + env(safe-area-inset-bottom) + ${keyboardHeight}px)`
          : undefined}
      >
        {loading && !status && (
          <View className='verification-loading'>
            <View />
            <View />
            <View />
            <Text>正在读取校园身份</Text>
          </View>
        )}

        {!loading && error && !status && (
          <View className='verification-error'>
            <View className='verification-error__icon'>!</View>
            <Text>认证状态暂时无法加载</Text>
            <Text>{error}</Text>
            <View onClick={() => void loadStatus()}>重新加载</View>
          </View>
        )}

        {status && (
          <>
            <View className={`verification-hero verification-hero--${verificationState}`}>
              <View className='verification-hero__orb'>
                <View>{verificationState === 'verified' ? '✓' : verificationState === 'pending' ? '…' : '海'}</View>
              </View>
              <View className='verification-hero__content'>
                <Text className='verification-hero__eyebrow'>{copy.eyebrow}</Text>
                <Text className='verification-hero__title'>{copy.title}</Text>
                <Text className='verification-hero__description'>{copy.description}</Text>
              </View>
              {refreshing && <Text className='verification-hero__refreshing'>刷新中</Text>}
            </View>

            {verificationState === 'verified' && identity && !forceCredentialBinding && (
              <>
                <View className='verification-profile'>
                  <View className='verification-profile__avatar'>海</View>
                  <View className='verification-profile__main'>
                    <Text>{identity.real_name}</Text>
                    <Text>{maskStudentNo(identity.student_no)}</Text>
                  </View>
                  <View className='verification-profile__badge'>已认证</View>
                  <View className='verification-profile__facts'>
                    <View>
                      <Text>认证方式</Text>
                        <Text>{identity.method === 'credentials' ? '信息门户认证' : '材料审核'}</Text>
                    </View>
                    <View>
                      <Text>认证时间</Text>
                      <Text>{formatDateTime(identity.verified_at)}</Text>
                    </View>
                    <View>
                      <Text>教务身份</Text>
                      <Text>
                        {identity.education_level === 'graduate'
                          ? '研究生'
                          : identity.education_level === 'undergraduate'
                            ? '本科生'
                            : '人工认证'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View
                  className='verification-credential-action'
                  ariaRole='button'
                  ariaLabel='更新信息门户认证'
                  onClick={() => {
                    setMethod('credentials')
                    setForceCredentialBinding(true)
                  }}
                >
                  更新信息门户认证
                </View>
                <View
                  className='verification-primary'
                  ariaRole='button'
                  ariaLabel='返回继续使用'
                  onClick={() => void finishAcademicVerification(replacedCurrentPage)}
                >
                  返回继续使用
                </View>
              </>
            )}

            {(verificationState !== 'verified' || forceCredentialBinding) && (
              <>
                {verificationState === 'rejected' && request?.review_reason && (
                  <View className='verification-review-note'>
                    <Text>审核说明</Text>
                    <Text>{request.review_reason}</Text>
                  </View>
                )}

                {!forceCredentialBinding && (
                  <View className='verification-methods-block'>
                    <View className='verification-methods'>
                      {([
                        {
                          value: 'credentials',
                          label: '信息门户认证',
                          description: '可登录信息门户',
                          recommended: true,
                        },
                        {
                          value: 'student_card',
                          label: '材料认证',
                          description: '无法登录信息门户',
                          recommended: false,
                        },
                      ] as const).map((item) => (
                        <View
                          key={item.value}
                          id={`academic-verification-method-${item.value}`}
                          className={method === item.value
                            ? 'verification-method verification-method--active'
                            : 'verification-method'}
                          ariaRole='button'
                          ariaLabel={`${item.label}${item.recommended ? '，推荐方式' : ''}，${item.description}`}
                          onClick={() => setMethod(item.value)}
                        >
                          <View className='verification-method__icon'>
                            <Image src={verificationMethodIcons[item.value]} mode='aspectFit' />
                          </View>
                          <View className='verification-method__copy'>
                            <Text>{item.label}</Text>
                            {item.recommended && <View className='verification-method__tag'>推荐</View>}
                            <Text>{item.description}</Text>
                          </View>
                          <View className='verification-method__check'>
                            {method === item.value ? '✓' : ''}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {method === 'credentials' && (
                  <View className='verification-form verification-form--credentials'>
                    <View className='verification-education'>
                      <View className='verification-education__heading'>
                        <Text>学历</Text>
                        <Text>请选择你的身份</Text>
                      </View>
                      <View className='verification-education__options'>
                        {([
                          {
                            value: 'undergraduate',
                            label: '本科生',
                          },
                          {
                            value: 'graduate',
                            label: '研究生',
                          },
                        ] as const).map((item) => (
                          <View
                            key={item.value}
                            id={`academic-verification-education-${item.value}`}
                            ariaRole='button'
                            ariaLabel={`${item.label}身份`}
                            className={[
                              'verification-education-option',
                              `verification-education-option--${item.value}`,
                              educationLevel === item.value
                                ? 'verification-education-option--active'
                                : '',
                              working ? 'verification-education-option--disabled' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => {
                              if (!working) {
                                setEducationLevel(item.value)
                                setCredentialError('')
                              }
                            }}
                          >
                            <View className='verification-education-option__icon'>
                              <Image src={educationIcons[item.value]} mode='aspectFit' />
                            </View>
                            <View className='verification-education-option__copy'>
                              <Text>{item.label}</Text>
                            </View>
                            <View className='verification-education-option__check'>
                              {educationLevel === item.value ? '✓' : ''}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View className='verification-field-group'>
                      <View className='verification-field'>
                        <Text>学号</Text>
                        <KeyboardSafeInput
                          id='academic-verification-student-no'
                          className='verification-field__input'
                          value={studentNo}
                          maxlength={64}
                          placeholder='请输入学号或账号'
                          placeholderClass='verification-placeholder'
                          disabled={working}
                          onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                          onInput={(event) => {
                            setStudentNo(event.detail.value)
                            setCredentialError('')
                          }}
                        />
                      </View>
                      <View className='verification-field'>
                        <Text>密码</Text>
                        <View className='verification-password-control'>
                          <KeyboardSafeInput
                            id='academic-verification-password'
                            className='verification-password-control__input'
                            password={!passwordVisible}
                            value={password}
                            holdKeyboard
                            alwaysEmbed
                            cursorColor='#2b7fff'
                            ariaLabel='信息门户密码'
                            maxlength={256}
                            placeholder='请输入信息门户密码'
                            placeholderClass='verification-placeholder'
                            disabled={working}
                            onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                            onInput={(event) => {
                              setPassword(event.detail.value)
                              setCredentialError('')
                            }}
                          />
                          <View
                            className='verification-password-control__toggle'
                            ariaRole='button'
                            ariaLabel={passwordVisible ? '隐藏密码' : '显示密码'}
                            onClick={() => setPasswordVisible((visible) => !visible)}
                          >
                            <Image
                              className='verification-password-control__toggle-icon'
                              src={passwordVisible ? passwordVisibleIcon : passwordHiddenIcon}
                              mode='aspectFit'
                            />
                          </View>
                        </View>
                      </View>
                      {(rejectedCredential || credentialError) && (
                        <View
                          className={`verification-field__feedback verification-field__feedback--${credentialFeedbackKind}`}
                          ariaRole='alert'
                        >
                          <Text className='verification-field__feedback-mark'>
                            {credentialFeedbackKind === 'error' ? '!' : '✓'}
                          </Text>
                          <Text className='verification-field__feedback-text'>
                            {credentialFeedbackMessage}
                          </Text>
                        </View>
                      )}
                    </View>
                    {showPasswordCoachMark && (
                      <View
                        className='verification-password-coach-mark'
                        ariaRole='status'
                        ariaLabel='密码错误处理说明'
                      >
                        <View className='verification-password-coach-mark__content'>
                          <Text className='verification-password-coach-mark__title'>
                            密码有问题？先看这里
                          </Text>
                          <Text className='verification-password-coach-mark__copy'>
                            请按下面的说明检查大小写、全角/半角，并从信息门户复制最新密码。
                          </Text>
                        </View>
                        <View
                          className='verification-password-coach-mark__dismiss'
                          ariaRole='button'
                          ariaLabel='关闭密码说明'
                          onClick={() => setPasswordCoachMarkDismissed(true)}
                        >
                          知道了
                        </View>
                        <View className='verification-password-coach-mark__arrow' />
                      </View>
                    )}
                    <View className='verification-credential-guide'>
                      <View className='verification-credential-guide__header'>
                        <Text className='verification-credential-guide__title'>密码说明</Text>
                      </View>
                      <View className='verification-credential-guide__items'>
                        <View className='verification-credential-guide__item'>
                          <Text className='verification-credential-guide__index'>1</Text>
                          <Text className='verification-credential-guide__text'>
                            密码为信息门户密码。
                          </Text>
                        </View>
                        <View className='verification-credential-guide__item'>
                          <Text className='verification-credential-guide__index'>2</Text>
                          <Text className='verification-credential-guide__text'>
                            提示密码错误即表示密码错误，请确认大小写及字符的全角/半角。建议先登录信息门户，再复制密码到这里。
                          </Text>
                        </View>
                        <View className='verification-credential-guide__item'>
                          <Text className='verification-credential-guide__index'>3</Text>
                          <Text className='verification-credential-guide__text'>
                            如果仍无法登录，请添加 xmxjouc 联系。
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View
                      className={`verification-primary ${working || !educationLevel ? 'verification-primary--disabled' : ''}`}
                      ariaRole='button'
                      ariaLabel='验证并绑定信息门户'
                      onClick={() => void submitCredentials()}
                    >
                      {working && method === 'credentials' ? workingText : '验证并绑定'}
                    </View>
                    <Text className='verification-form__footnote'>
                      凭据仅保存在本机，查询时通过 HTTPS 提交；解绑后清除。
                    </Text>
                  </View>
                )}

                {!forceCredentialBinding && method === 'student_card' && pendingStudentCard ? (
                  <View className='verification-pending'>
                    <View className='verification-pending__icon'>
                      <View />
                      <View />
                      <View />
                    </View>
                    <Text>认证申请已提交</Text>
                    <Text>
                      认证材料已进入人工审核，提交于 {formatDateTime(request?.created_at)}。
                      审核结果会通过消息通知。
                    </Text>
                    <View onClick={() => setMethod('credentials')}>我可以登录信息门户</View>
                  </View>
                ) : !forceCredentialBinding && method === 'student_card' && (
                  <View className='verification-form verification-form--material'>
                    <View className='verification-form__heading'>
                      <View>
                        <Text>材料认证</Text>
                        <Text>适合无法登录信息门户的同学</Text>
                      </View>
                      <View className='verification-form__tag verification-form__tag--warm'>人工审核</View>
                    </View>
                    <View className='verification-field-group'>
                      <View className='verification-field'>
                        <Text>真实姓名</Text>
                        <KeyboardSafeInput
                          id='academic-verification-real-name'
                          value={realName}
                          maxlength={100}
                          placeholder='请输入材料上的姓名'
                          placeholderClass='verification-placeholder'
                          onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                          onInput={(event) => setRealName(event.detail.value)}
                        />
                      </View>
                      <View className='verification-field'>
                        <Text>学号</Text>
                        <KeyboardSafeInput
                          id='academic-verification-card-student-no'
                          value={studentNo}
                          maxlength={64}
                          placeholder='请输入材料上的学号'
                          placeholderClass='verification-placeholder'
                          onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                          onInput={(event) => setStudentNo(event.detail.value)}
                        />
                      </View>
                    </View>
                    <View
                      className={`verification-upload ${selectedMaterial ? 'verification-upload--selected' : ''}`}
                      ariaRole='button'
                      ariaLabel={selectedMaterial ? '更换认证材料' : '上传认证材料'}
                      onClick={() => void chooseMaterial()}
                    >
                      {selectedMaterial ? (
                        <>
                          <Image src={selectedMaterial.path} mode='aspectFit' />
                          <View className='verification-upload__mask'>
                            <Text>{uploadedMaterial ? '已安全上传' : '已选择认证材料'}</Text>
                            <Text>{(selectedMaterial.size / 1024 / 1024).toFixed(2)} MiB · 点击更换</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View className='verification-upload__icon'>＋</View>
                          <Text>上传认证材料</Text>
                          <Text>学生证、录取通知书或毕业证，支持 JPEG、PNG、WebP</Text>
                        </>
                      )}
                    </View>
                    <View
                      className={`verification-primary verification-primary--warm ${working ? 'verification-primary--disabled' : ''}`}
                      ariaRole='button'
                      ariaLabel='提交认证材料人工审核'
                      onClick={() => void submitStudentCard()}
                    >
                      {working && method === 'student_card' ? workingText : '提交人工审核'}
                    </View>
                  </View>
                )}

                <View className='verification-security'>
                  <View className='verification-security__icon'>
                    <Image src={securityIcon} mode='aspectFit' />
                  </View>
                  <View>
                    <Text>隐私材料受保护</Text>
                    <Text>认证材料仅审核人员可见，并按策略自动清理。</Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </View>
    </View>
  )
}
