import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatarImage from '../../components/user-avatar-image'
import { KeyboardSafeInput, useKeyboardInset } from '../../components/keyboard-safe-input'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { isApiError } from '../../api/client'
import { openAcademicVerification } from '../../features/academic-verification/guard'
import {
  studyRoomsRepository,
  type StudyRoomDetail,
  type StudyRoomMember,
  type StudyRoomMessage,
} from '../../features/study-rooms/repository'
import {
  elapsedStudySeconds,
  formatStudyDuration,
  STUDY_ROOM_MEMBER_PREVIEW_LIMIT,
} from '../../features/study-rooms/time'
import { useCampusShare } from '../../features/share'
import { studyRoomsPreviewEnabled } from '../../features/study-rooms/preview'
import './room.scss'

const cooldowns = [0, 30, 60, 120, 300, 600]
const cooldownLabel = (seconds: number) => seconds === 0 ? '不限制' : seconds < 60 ? `${seconds} 秒` : `${seconds / 60} 分钟`
const avatarFallback = (name: string) => (name.trim()[0] || '海').toUpperCase()

const mergeMessages = (current: StudyRoomMessage[], incoming: StudyRoomMessage[]) => {
  const merged = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
    .filter((item) => item.moderation_status === 'approved')
    .sort((left, right) => left.id - right.id)
}

export default function StudyRoomPage() {
  const [roomId, setRoomId] = useState(0)
  const [invite, setInvite] = useState('')
  const [room, setRoom] = useState<StudyRoomDetail | null>(null)
  const [members, setMembers] = useState<StudyRoomMember[]>([])
  const [messages, setMessages] = useState<StudyRoomMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [sending, setSending] = useState(false)
  const [content, setContent] = useState('')
  const [membersOpen, setMembersOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [verified, setVerified] = useState(false)
  const [showRevision, setShowRevision] = useState(0)
  const { keyboardHeight, onKeyboardVisibilityChange } = useKeyboardInset()
  const latestMessageId = useRef(0)

  useLoad((options) => {
    const id = Number(options.id)
    setRoomId(Number.isInteger(id) && id > 0 ? id : 0)
    setInvite(typeof options.invite === 'string' ? options.invite.slice(0, 160) : '')
  })

  useCampusShare(() => ({
    title: room?.title ? `${room.title}｜一起自习` : '邀请你一起自习',
    path: '/pages/study-rooms/room',
    query: {
      id: roomId,
      invite: room?.visibility === 'private' ? room.invite_code || undefined : undefined,
    },
  }))

  const applyRoom = useCallback((value: StudyRoomDetail) => {
    setRoom(value)
    setMembers(Array.isArray(value.members) ? value.members : [])
    const approved = (Array.isArray(value.messages) ? value.messages : [])
      .filter((item) => item.moderation_status === 'approved')
    setMessages(approved)
    latestMessageId.current = Math.max(0, ...approved.map((item) => item.id))
  }, [])

  const loadRoom = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    try {
      applyRoom(await studyRoomsRepository.get(roomId, invite || undefined))
    } catch (error) {
      if (!isApiError(error) || error.code !== 'academic_verification_required') {
        Taro.showToast({ title: isApiError(error) ? error.message : '自习室加载失败', icon: 'none' })
      }
    } finally {
      setLoading(false)
    }
  }, [applyRoom, invite, roomId])

  useDidShow(() => setShowRevision((current) => current + 1))

  useEffect(() => {
    if (!roomId) return
    if (studyRoomsPreviewEnabled) {
      setVerified(true)
      void loadRoom()
      return
    }
    void getAcademicVerificationStatus({ force: true }).then((status) => {
      const allowed = status.identity?.status === 'verified'
      setVerified(allowed)
      if (allowed) {
        void loadRoom()
        return
      }
      setLoading(false)
      void openAcademicVerification()
    }).catch(() => setLoading(false))
  }, [loadRoom, roomId, showRevision])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!roomId || !room?.viewer_joined || room.moderation_status !== 'approved') return undefined
    const poll = async () => {
      try {
        const [memberResult, messageResult] = await Promise.all([
          studyRoomsRepository.listMembers(roomId),
          studyRoomsRepository.listMessages(roomId, latestMessageId.current || undefined),
        ])
        setMembers(Array.isArray(memberResult.items) ? memberResult.items : [])
        const incoming = Array.isArray(messageResult.items) ? messageResult.items : []
        if (incoming.length) {
          latestMessageId.current = Math.max(latestMessageId.current, ...incoming.map((item) => item.id))
          setMessages((current) => mergeMessages(current, incoming))
        }
      } catch {
        // 轮询失败保留当前内容，下一个周期自动重试。
      }
    }
    const timer = setInterval(() => void poll(), 5000)
    return () => clearInterval(timer)
  }, [room?.moderation_status, room?.viewer_joined, roomId])

  const viewer = useMemo(
    () => members.find((item) => item.user_id === room?.viewer_user_id),
    [members, room?.viewer_user_id],
  )
  const viewerSeconds = viewer ? elapsedStudySeconds(viewer.accumulated_seconds, viewer.active_since, now) : 0
  const nextMessageAt = room?.next_message_at ? new Date(room.next_message_at).getTime() : 0
  const waitSeconds = Math.max(0, Math.ceil((nextMessageAt - now) / 1000))
  const previewMembers = members.slice(0, STUDY_ROOM_MEMBER_PREVIEW_LIMIT)

  const join = async () => {
    if (!roomId || joining) return
    setJoining(true)
    try {
      applyRoom(await studyRoomsRepository.join(roomId, invite || undefined))
      Taro.showToast({ title: '已加入自习室', icon: 'success' })
    } catch (error) {
      if (!isApiError(error) || error.code !== 'academic_verification_required') {
        Taro.showToast({ title: isApiError(error) ? error.message : '加入失败', icon: 'none' })
      }
    } finally { setJoining(false) }
  }

  const leave = async () => {
    if (!roomId) return
    const result = await Taro.showModal({ title: '离开自习室', content: '确认结束本次自习并离开？', confirmText: '离开' })
    if (!result.confirm) return
    try {
      await studyRoomsRepository.leave(roomId)
      await Taro.navigateBack()
    } catch (error) {
      Taro.showToast({ title: isApiError(error) ? error.message : '离开失败', icon: 'none' })
    }
  }

  const send = async () => {
    const value = content.trim()
    if (!roomId || sending || waitSeconds > 0) return
    if (!value) {
      Taro.showToast({ title: '请输入消息', icon: 'none' })
      return
    }
    setSending(true)
    try {
      const created = await studyRoomsRepository.sendMessage(roomId, value)
      setContent('')
      Taro.showToast({ title: created.moderation_status === 'approved' ? '已发送' : '消息已提交审核', icon: 'success' })
      if (created.moderation_status === 'approved') {
        latestMessageId.current = Math.max(latestMessageId.current, created.id)
        setMessages((current) => mergeMessages(current, [created]))
      }
      await loadRoom()
    } catch (error) {
      if (!isApiError(error) || error.code !== 'academic_verification_required') {
        Taro.showToast({ title: isApiError(error) ? error.message : '发送失败', icon: 'none' })
      }
    } finally { setSending(false) }
  }

  const changeCooldown = async (seconds: number) => {
    if (!roomId || !room?.viewer_is_owner) return
    try {
      applyRoom(await studyRoomsRepository.updateMessageCooldown(roomId, seconds))
      Taro.showToast({ title: '发言间隔已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: isApiError(error) ? error.message : '设置失败', icon: 'none' })
    }
  }

  if (!roomId) return <View className='study-room'><CustomNavbar title='一起自习' showBack /><View className='study-room__state'>自习室链接无效</View></View>

  return (
    <View className='study-room'>
      <CustomNavbar title={room?.title || '一起自习'} subtitle={room?.visibility === 'private' ? '私密自习室' : '公开自习室'} showBack />
      <View className='study-room__content'>
        {loading && <View className='study-room__state'>加载中</View>}
        {!loading && !verified && <View className='study-room__state'>完成校园身份认证后即可使用</View>}
        {!loading && room && (
          <>
            {room.moderation_status !== 'approved' && <View className='study-room__moderation'>{room.moderation_status === 'pending' ? '标题审核中' : '标题未通过审核'}</View>}
            {!room.viewer_joined ? (
              <View className='study-room-join'>
                <Text>{room.title}</Text><Text>{room.member_count}/{room.capacity} 人正在自习</Text>
                <View className={joining ? 'study-room-join__button study-room-join__button--disabled' : 'study-room-join__button'} onClick={() => void join()}>{joining ? '加入中' : '加入自习室'}</View>
              </View>
            ) : (
              <>
                <View className='study-timer'><Text>本次自习</Text><Text>{formatStudyDuration(viewerSeconds)}</Text></View>
                <View className='study-members'>
                  <View className='study-members__head'>
                    <View className='study-members__title'><Text>一起专注</Text><Text>{members.length}/{room.capacity}</Text></View>
                    {members.length > 0 && <View className='study-members__list-entry' role='button' ariaLabel='查看成员列表' onClick={() => setMembersOpen(true)}>成员列表</View>}
                  </View>
                  <View className='study-members__grid'>
                    {previewMembers.map((member) => (
                      <View key={member.user_id} className='study-member-preview'>
                        <View className='study-member-preview__avatar'><UserAvatarImage className='study-member-preview__image' src={member.avatar_url} fallback={avatarFallback(member.username)} /></View>
                        <Text>{member.username}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className='study-chat'>
                  <View className='study-chat__head'><Text>自习室消息</Text>{room.viewer_is_owner && <Picker mode='selector' range={cooldowns.map(cooldownLabel)} value={Math.max(0, cooldowns.indexOf(room.message_cooldown_seconds))} onChange={(event) => void changeCooldown(cooldowns[Number(event.detail.value)] ?? 60)}><View>发言间隔 · {cooldownLabel(room.message_cooldown_seconds)}</View></Picker>}</View>
                  {messages.length === 0 && <View className='study-chat__empty'>暂无消息</View>}
                  {messages.map((message) => <View key={message.id} className='study-message'><View className='study-message__avatar'><UserAvatarImage className='study-message__image' src={message.avatar_url} fallback={avatarFallback(message.username)} /></View><View><Text>{message.username}</Text><Text>{message.content}</Text></View></View>)}
                </View>

                <View className='study-room__actions'>
                  {room.visibility === 'private' && room.viewer_is_owner && <Button className='study-room__invite' openType='share'>邀请朋友</Button>}
                  <View className='study-room__leave' onClick={() => void leave()}>离开自习室</View>
                </View>
              </>
            )}
          </>
        )}
      </View>

      {room?.viewer_joined && room.moderation_status === 'approved' && (
        <View className='study-composer' style={{ bottom: `${keyboardHeight}px` }}>
          <KeyboardSafeInput className='study-composer__input' value={content} maxlength={200} placeholder={waitSeconds > 0 ? `${waitSeconds} 秒后可发言` : '说点什么'} disabled={waitSeconds > 0} onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(event) => setContent(event.detail.value)} />
          <View className={`study-composer__send ${sending || waitSeconds > 0 ? 'study-composer__send--disabled' : ''}`} onClick={() => void send()}>{sending ? '发送中' : '发送'}</View>
        </View>
      )}

      {membersOpen && <View className='study-member-mask' onClick={() => setMembersOpen(false)}><View className='study-member-sheet' onClick={(event) => event.stopPropagation()}><View className='study-member-sheet__head'><Text>成员列表</Text><Text onClick={() => setMembersOpen(false)}>关闭</Text></View><ScrollView className='study-member-sheet__list' scrollY>{members.map((member) => <View key={member.user_id} className='study-member-row'><View><View className='study-member-row__avatar'><UserAvatarImage className='study-member-row__image' src={member.avatar_url} fallback={avatarFallback(member.username)} /></View><Text>{member.username}{member.is_owner ? ' · 房主' : ''}</Text></View><Text>{formatStudyDuration(elapsedStudySeconds(member.accumulated_seconds, member.active_since, now))}</Text></View>)}</ScrollView></View></View>}
    </View>
  )
}
