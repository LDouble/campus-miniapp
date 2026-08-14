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
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { getCurrentIdentity } from '../../api/account'
import {
  isAcademicEducationLevel,
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
    eyebrow: 'GUEST · 待认证',
    title: '完成校园身份认证',
    description: '认证后即可发布、接单、交易和参与校园服务。',
  },
  pending: {
    eyebrow: 'UNDER REVIEW · 审核中',
    title: '校园身份认证中',
    description: '学生证申请已提交人工审核，结果会通过消息通知。',
  },
  verified: {
    eyebrow: 'VERIFIED · 已认证',
    title: '校园身份已通过',
    description: '你的账号已获得海大校园成员权限。',
  },
  rejected: {
    eyebrow: 'NEEDS UPDATE · 需补充',
    title: '认证申请未通过',
    description: '请根据审核说明更新信息或重新上传学生证。',
  },
  revoked: {
    eyebrow: 'EXPIRED · 已失效',
    title: '校园身份需要重新认证',
    description: '原校园身份已失效，完成认证后可恢复成员权限。',
  },
}

const credentialErrorMessage = (error: unknown) => {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : '教务认证失败，请稍后重试'
  }
  if (error.code === 'invalid_academic_credentials') return '学号或密码不正确'
  if (error.code === 'academic_password_expired') return '统一身份认证密码已过期，请修改密码后重试'
  if (error.code === 'academic_credentials_limited') return '尝试次数过多，请稍后再试'
  if (error.code === 'academic_provider_unavailable') return '教务认证服务暂不可用'
  if (error.code === 'invalid_education_level') return '请选择本科生或研究生'
  if (error.code === 'academic_identity_type_mismatch') return '所选学生类型与教务系统不匹配，请确认后重试'
  if (error.code === 'academic_challenge_required') return '校方要求验证码或设备确认，请稍后重试'
  return error.message
}

export default function AcademicVerificationPage() {
  const [replacedCurrentPage, setReplacedCurrentPage] = useState(false)
  const [forceCredentialBinding, setForceCredentialBinding] = useState(false)
  const [method, setMethod] = useState<VerificationMethod>('credentials')
  const [status, setStatus] = useState<AcademicVerificationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [password, setPassword] = useState('')
  const [educationLevel, setEducationLevel] = useState<AcademicEducationLevel | null>(null)
  const [realName, setRealName] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<SelectedMaterial | null>(null)
  const [uploadedMaterial, setUploadedMaterial] = useState<AcademicVerificationMaterial | null>(null)
  const [working, setWorking] = useState(false)
  const [workingText, setWorkingText] = useState('')

  const loadStatus = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const nextStatus = await getAcademicVerificationStatus()
      setStatus(nextStatus)
      const request = nextStatus.latest_request
      const identity = nextStatus.identity
      if (!studentNo) setStudentNo(identity?.student_no || request?.student_no || '')
      if (!realName) setRealName(identity?.real_name || request?.real_name || '')
      const identityEducationLevel = identity?.education_level
      if (isAcademicEducationLevel(identityEducationLevel)) {
        setEducationLevel((current) => current || identityEducationLevel)
      }
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
        setEducationLevel((current) => current || credential.educationLevel)
      })
      .catch(() => {
        // 未绑定或旧版本凭据由页面正常引导重新填写。
      })
  })
  usePullDownRefresh(() => {
    void loadStatus(true)
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
    await finishAcademicVerification(replacedCurrentPage)
  }

  const submitCredentials = async () => {
    const normalizedStudentNo = studentNo.trim()
    if (!educationLevel) {
      Taro.showToast({ title: '请选择本科生或研究生', icon: 'none' })
      return
    }
    if (!normalizedStudentNo || !password) {
      Taro.showToast({ title: '请填写学号和教务密码', icon: 'none' })
      return
    }
    if (working) return
    setWorking(true)
    setWorkingText('正在连接教务系统')
    try {
      await verifyAcademicCredentials(normalizedStudentNo, password, educationLevel)
      const currentUser = await getCurrentIdentity()
      saveAcademicCredential(currentUser.user_id, {
        studentNo: normalizedStudentNo,
        password,
        educationLevel,
      })
      setPassword('')
      setForceCredentialBinding(false)
      await loadStatus(true)
      await completeSuccess()
    } catch (submitError) {
      Taro.showToast({
        title: credentialErrorMessage(submitError),
        icon: 'none',
        duration: 2600,
      })
    } finally {
      setWorking(false)
      setWorkingText('')
    }
  }

  const submitStudentCard = async () => {
    const normalizedRealName = realName.trim()
    const normalizedStudentNo = studentNo.trim()
    if (!normalizedRealName || !normalizedStudentNo) {
      Taro.showToast({ title: '请填写姓名和学生证上的学号', icon: 'none' })
      return
    }
    if (!selectedMaterial && !uploadedMaterial) {
      Taro.showToast({ title: '请上传学生证图片', icon: 'none' })
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
      await loadStatus(true)
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
        title='校园身份认证'
        subtitle='中国海洋大学'
        showBack
      />

      <View className='verification-page__content'>
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
                      <Text>{identity.method === 'credentials' ? '教务账号' : '学生证审核'}</Text>
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
                  onClick={() => {
                    setMethod('credentials')
                    setForceCredentialBinding(true)
                  }}
                >
                  更新教务账号
                </View>
                <View
                  className='verification-primary'
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

                {!forceCredentialBinding && <View className='verification-methods'>
                  <View
                    className={method === 'credentials' ? 'verification-method verification-method--active' : 'verification-method'}
                    onClick={() => setMethod('credentials')}
                  >
                    <View className='verification-method__icon'>校</View>
                    <View>
                      <Text>教务账号</Text>
                      <Text>在线验证，立即生效</Text>
                    </View>
                  </View>
                  <View
                    className={method === 'student_card' ? 'verification-method verification-method--active' : 'verification-method'}
                    onClick={() => setMethod('student_card')}
                  >
                    <View className='verification-method__icon'>证</View>
                    <View>
                      <Text>学生证认证</Text>
                      <Text>没有可登录教务账号</Text>
                    </View>
                  </View>
                </View>}

                {method === 'credentials' && (
                  <View className='verification-form'>
                    <View className='verification-form__heading'>
                      <View>
                        <Text>教务账号验证</Text>
                        <Text>
                          {forceCredentialBinding
                            ? '验证成功后更新本机教务凭据'
                            : '验证成功后立即获得校园成员权限'}
                        </Text>
                      </View>
                      <View className='verification-form__tag'>推荐</View>
                    </View>
                    <View className='verification-education'>
                      <View className='verification-education__heading'>
                        <Text>学生类型</Text>
                        <Text>请选择你使用的教务系统</Text>
                      </View>
                      <View className='verification-education__options'>
                        {([
                          {
                            value: 'undergraduate',
                            label: '本科生',
                            description: '本科教务系统',
                          },
                          {
                            value: 'graduate',
                            label: '研究生',
                            description: '研究生教务系统',
                          },
                        ] as const).map((item) => (
                          <View
                            key={item.value}
                            hoverClass='verification-education-option--pressed'
                            className={[
                              'verification-education-option',
                              `verification-education-option--${item.value}`,
                              educationLevel === item.value
                                ? 'verification-education-option--active'
                                : '',
                              working ? 'verification-education-option--disabled' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => {
                              if (!working) setEducationLevel(item.value)
                            }}
                          >
                            <View className='verification-education-option__icon'>
                              <Image src={educationIcons[item.value]} mode='aspectFit' />
                            </View>
                            <View className='verification-education-option__copy'>
                              <Text>{item.label}</Text>
                              <Text>{item.description}</Text>
                            </View>
                            <View className='verification-education-option__check'>
                              {educationLevel === item.value ? '✓' : ''}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View className='verification-field'>
                      <Text>学号</Text>
                      <KeyboardSafeInput
                        value={studentNo}
                        maxlength={64}
                        placeholder='请输入教务系统学号'
                        placeholderClass='verification-placeholder'
                        disabled={working}
                        onInput={(event) => setStudentNo(event.detail.value)}
                      />
                    </View>
                    <View className='verification-field'>
                      <Text>教务密码</Text>
                      <KeyboardSafeInput
                        value={password}
                        password
                        maxlength={256}
                        placeholder='验证成功后仅保存在本机'
                        placeholderClass='verification-placeholder'
                        disabled={working}
                        onInput={(event) => setPassword(event.detail.value)}
                      />
                    </View>
                    <View
                      className={`verification-primary ${working || !educationLevel ? 'verification-primary--disabled' : ''}`}
                      onClick={() => void submitCredentials()}
                    >
                      {working && method === 'credentials' ? workingText : '验证并绑定'}
                    </View>
                    <Text className='verification-form__footnote'>
                      账号密码仅保存在本机小程序存储中，并随每次教务查询通过 HTTPS
                      提交；服务端不持久化。更新绑定或注销账号时会清除本机记录。
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
                      学生证材料已进入人工审核，提交于 {formatDateTime(request?.created_at)}。
                      审核结果会通过消息通知。
                    </Text>
                    <View onClick={() => setMethod('credentials')}>我可以使用教务账号验证</View>
                  </View>
                ) : !forceCredentialBinding && method === 'student_card' && (
                  <View className='verification-form'>
                    <View className='verification-form__heading'>
                      <View>
                        <Text>学生证人工认证</Text>
                        <Text>适用于暂无可登录教务账号的同学</Text>
                      </View>
                      <View className='verification-form__tag verification-form__tag--warm'>人工审核</View>
                    </View>
                    <View className='verification-field'>
                      <Text>真实姓名</Text>
                      <KeyboardSafeInput
                        value={realName}
                        maxlength={100}
                        placeholder='请输入学生证上的姓名'
                        placeholderClass='verification-placeholder'
                        onInput={(event) => setRealName(event.detail.value)}
                      />
                    </View>
                    <View className='verification-field'>
                      <Text>学号</Text>
                      <KeyboardSafeInput
                        value={studentNo}
                        maxlength={64}
                        placeholder='请输入学生证上的学号'
                        placeholderClass='verification-placeholder'
                        onInput={(event) => setStudentNo(event.detail.value)}
                      />
                    </View>
                    <View
                      className={`verification-upload ${selectedMaterial ? 'verification-upload--selected' : ''}`}
                      onClick={() => void chooseMaterial()}
                    >
                      {selectedMaterial ? (
                        <>
                          <Image src={selectedMaterial.path} mode='aspectFill' />
                          <View className='verification-upload__mask'>
                            <Text>{uploadedMaterial ? '已安全上传' : '已选择学生证'}</Text>
                            <Text>{(selectedMaterial.size / 1024 / 1024).toFixed(2)} MiB · 点击更换</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View className='verification-upload__icon'>＋</View>
                          <Text>上传学生证图片</Text>
                          <Text>支持 JPEG、PNG、WebP，最大 5 MiB</Text>
                        </>
                      )}
                    </View>
                    <View
                      className={`verification-primary verification-primary--warm ${working ? 'verification-primary--disabled' : ''}`}
                      onClick={() => void submitStudentCard()}
                    >
                      {working && method === 'student_card' ? workingText : '提交人工审核'}
                    </View>
                  </View>
                )}

                <View className='verification-security'>
                  <View className='verification-security__icon'>盾</View>
                  <View>
                    <Text>隐私材料受保护</Text>
                    <Text>学生证使用私有加密存储，仅授权审核人员可查看，并按保留策略自动清理。</Text>
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
