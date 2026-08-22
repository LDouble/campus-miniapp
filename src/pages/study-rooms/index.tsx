import { useCallback, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Picker, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { isApiError } from '../../api/client'
import { openAcademicVerification } from '../../features/academic-verification/guard'
import {
  studyRoomsRepository,
  type StudyRoomSummary,
  type StudyRoomVisibility,
} from '../../features/study-rooms/repository'
import { useCampusShare } from '../../features/share'
import { studyRoomsPreviewEnabled } from '../../features/study-rooms/preview'
import './index.scss'

const capacities = [2, 4, 6, 8, 12, 16, 20]
const cooldowns = [0, 30, 60, 120, 300, 600]
const cooldownLabel = (seconds: number) => seconds === 0 ? '不限制' : seconds < 60 ? `${seconds} 秒` : `${seconds / 60} 分钟`

export default function StudyRoomsPage() {
  useCampusShare(() => ({ title: '一起自习｜海大校园', path: '/pages/study-rooms/index' }))

  const [rooms, setRooms] = useState<StudyRoomSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [capacity, setCapacity] = useState(8)
  const [visibility, setVisibility] = useState<StudyRoomVisibility>('public')
  const [cooldown, setCooldown] = useState(60)
  const [submitting, setSubmitting] = useState(false)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const result = await studyRoomsRepository.list()
      setRooms(Array.isArray(result.items) ? result.items : [])
    } catch (error) {
      if (!isApiError(error) || error.code !== 'academic_verification_required') {
        Taro.showToast({ title: isApiError(error) ? error.message : '自习室加载失败', icon: 'none' })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    if (studyRoomsPreviewEnabled) {
      setVerified(true)
      void loadRooms()
      return
    }
    void getAcademicVerificationStatus({ force: true }).then((status) => {
      const allowed = status.identity?.status === 'verified'
      setVerified(allowed)
      if (allowed) {
        void loadRooms()
        return
      }
      setLoading(false)
      void openAcademicVerification()
    }).catch(() => {
      setLoading(false)
      Taro.showToast({ title: '认证状态加载失败', icon: 'none' })
    })
  })

  usePullDownRefresh(async () => {
    try { if (verified) await loadRooms() } finally { Taro.stopPullDownRefresh() }
  })

  const openRoom = (id: number) => Taro.navigateTo({ url: `/pages/study-rooms/room?id=${id}` })

  const createRoom = async () => {
    if (submitting) return
    const normalizedTitle = title.replace(/\s+/g, ' ').trim()
    if (normalizedTitle.length < 2 || normalizedTitle.length > 30) {
      Taro.showToast({ title: '标题请输入 2—30 个字', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const room = await studyRoomsRepository.create({
        title: normalizedTitle,
        capacity,
        visibility,
        messageCooldownSeconds: cooldown,
      })
      setFormOpen(false)
      setTitle('')
      Taro.showToast({
        title: room.moderation_status === 'approved' ? '自习室已创建' : '标题已提交审核',
        icon: 'success',
      })
      await Taro.navigateTo({ url: `/pages/study-rooms/room?id=${room.id}` })
    } catch (error) {
      if (!isApiError(error) || error.code !== 'academic_verification_required') {
        Taro.showToast({ title: isApiError(error) ? error.message : '创建失败，请稍后重试', icon: 'none' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='study-lobby'>
      <CustomNavbar title='一起自习' subtitle='专注此刻 · 彼此陪伴' showBack />
      <View className='study-lobby__content'>
        <View className='study-lobby__heading'>
          <View><Text>公开自习室</Text><Text>{rooms.length} 间可加入</Text></View>
          {verified && <View className='study-lobby__create' role='button' ariaLabel='新建自习室' onClick={() => setFormOpen(true)}>新建</View>}
        </View>

        {loading && <View className='study-lobby__state'>加载中</View>}
        {!loading && verified && rooms.length === 0 && <View className='study-lobby__state'>暂无公开自习室</View>}
        {!loading && !verified && (
          <View className='study-lobby__verify'>
            <Text>仅认证用户可以使用一起自习</Text>
            <View role='button' ariaLabel='前往校园身份认证' onClick={() => void openAcademicVerification()}>去认证</View>
          </View>
        )}
        {rooms.map((room) => (
          <View key={room.id} className='study-room-card' hoverClass='study-room-card--pressed' onClick={() => void openRoom(room.id)}>
            <View className='study-room-card__top'>
              <Text className='study-room-card__title'>{room.title}</Text>
              <Text>{room.member_count}/{room.capacity}</Text>
            </View>
            <View className='study-room-card__meta'>
              <Text>{room.owner.username}</Text>
              <Text>{room.visibility === 'private' ? '私密' : '公开'}</Text>
            </View>
          </View>
        ))}
      </View>

      {formOpen && (
        <View className='study-create-mask' onClick={() => !submitting && setFormOpen(false)}>
          <View className='study-create-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='study-create-sheet__handle' />
            <View className='study-create-sheet__head'><Text>新建自习室</Text><Text onClick={() => !submitting && setFormOpen(false)}>取消</Text></View>
            <View className='study-create-sheet__field'>
              <Text>标题</Text>
              <KeyboardSafeInput
                className='study-create-sheet__input'
                value={title}
                maxlength={30}
                placeholder='输入自习室标题'
                placeholderClass='study-create-sheet__placeholder'
                onInput={(event) => setTitle(event.detail.value)}
              />
            </View>
            <View className='study-create-sheet__field-row'>
              <View><Text>人数</Text><Picker mode='selector' range={capacities.map((item) => `${item} 人`)} value={capacities.indexOf(capacity)} onChange={(event) => setCapacity(capacities[Number(event.detail.value)] || 8)}><View className='study-create-sheet__picker'>{capacity} 人<Text>›</Text></View></Picker></View>
              <View><Text>发言间隔</Text><Picker mode='selector' range={cooldowns.map(cooldownLabel)} value={cooldowns.indexOf(cooldown)} onChange={(event) => setCooldown(cooldowns[Number(event.detail.value)] ?? 60)}><View className='study-create-sheet__picker'>{cooldownLabel(cooldown)}<Text>›</Text></View></Picker></View>
            </View>
            <View className='study-create-sheet__field'>
              <Text>加入方式</Text>
              <View className='study-create-sheet__visibility'>
                {([['public', '公开'], ['private', '私密邀请']] as const).map(([value, label]) => <View key={value} className={visibility === value ? 'study-create-sheet__visibility-item study-create-sheet__visibility-item--active' : 'study-create-sheet__visibility-item'} onClick={() => setVisibility(value)}>{label}</View>)}
              </View>
            </View>
            <View className={`study-create-sheet__submit ${submitting ? 'study-create-sheet__submit--disabled' : ''}`} onClick={() => void createRoom()}>{submitting ? '创建中' : '创建自习室'}</View>
          </View>
        </View>
      )}
    </View>
  )
}
