import { useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import { ensureClubEditorAccess } from '../../features/clubs/access'
import {
  activeRevision,
  clubStatusMeta,
  editableClub,
} from '../../features/clubs/model'
import { clubsRepository } from '../../features/clubs/repository'
import type { ClubEditorialView } from '../../features/clubs/types'
import './mine.scss'

export default function MyClubsPage() {
  const [clubs, setClubs] = useState<ClubEditorialView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submittingId, setSubmittingId] = useState(0)
  const pendingCount = clubs.filter((club) => club.working_revision?.status === 'pending_review').length

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setClubs((await clubsRepository.listMine()).items)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '我的社团资料加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useDidShow(() => {
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  const createClub = async () => {
    if (!await ensureClubEditorAccess()) return
    await Taro.navigateTo({ url: '/pages/clubs/edit' })
  }

  const editClub = async (club: ClubEditorialView) => {
    if (!await ensureClubEditorAccess()) return
    await Taro.navigateTo({ url: `/pages/clubs/edit?id=${club.id}` })
  }

  const submitReview = async (club: ClubEditorialView) => {
    const revision = club.working_revision
    if (!revision || revision.status !== 'draft') return
    const result = await Taro.showModal({
      title: '提交审核',
      content: club.published_revision
        ? '审核期间公开主页会继续展示当前已发布版本。确认提交本次修改吗？'
        : '提交后资料将暂时不可编辑，通过审核后公开展示。确认提交吗？',
      confirmText: '提交审核',
      confirmColor: '#4f907e',
    })
    if (!result.confirm) return
    setSubmittingId(club.id)
    try {
      await clubsRepository.submitReview(club.id, club.version)
      Taro.showToast({ title: '已提交审核', icon: 'success' })
      await load()
    } catch (submitError) {
      Taro.showToast({
        title: isApiError(submitError) ? submitError.message : '提交失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setSubmittingId(0)
    }
  }

  return (
    <View className='my-clubs-page'>
      <CustomNavbar title='我的社团资料' subtitle='草稿、审核与公开状态' showBack />
      <View className='my-clubs-intro'>
        <View>
          <Text className='my-clubs-intro__title'>把社团故事认真讲好</Text>
          <Text className='my-clubs-intro__text'>资料修改需重新审核，审核期间已发布主页保持不变。</Text>
          {!loading && !error && (
            <Text className='my-clubs-intro__meta'>共 {clubs.length} 个主页{pendingCount ? ` · ${pendingCount} 个审核中` : ''}</Text>
          )}
        </View>
        <View
          className='my-clubs-intro__action'
          ariaRole='button'
          ariaLabel='创建社团主页'
          onClick={() => void createClub()}
        ><Text>＋</Text> 创建</View>
      </View>

      <View className='my-clubs-list'>
        {loading && Array.from({ length: 2 }, (_, index) => (
          <View key={index} className='my-club-card my-club-card--skeleton'>
            <View /><View /><View />
          </View>
        ))}

        {!loading && error && (
          <View className='my-clubs-state'>
            <Text className='my-clubs-state__title'>资料加载失败</Text>
            <Text className='my-clubs-state__text'>{error}</Text>
            <View className='my-clubs-state__action' onClick={() => void load()}>重新加载</View>
          </View>
        )}

        {!loading && !error && clubs.length === 0 && (
          <View className='my-clubs-state'>
            <View className='my-clubs-state__icon'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' /></View>
            <Text className='my-clubs-state__title'>还没有社团主页</Text>
            <Text className='my-clubs-state__text'>准备好 Logo、简介和社团照片，就可以开始创建。</Text>
            <View className='my-clubs-state__action' onClick={() => void createClub()}>创建社团主页</View>
          </View>
        )}

        {!loading && !error && clubs.map((club) => {
          const revision = activeRevision(club)
          const revisionMeta = revision ? clubStatusMeta[revision.status] : null
          const visibilityMeta = clubStatusMeta[club.visibility_status]
          const keepsPublishedVersion = !!club.published_revision && revision?.status !== 'approved'
          const progressLabel = revision?.status === 'draft' && club.published_revision
            ? '有未提交修改'
            : revisionMeta?.label || '未创建资料'
          const progressDescription = keepsPublishedVersion
            ? `${revisionMeta?.description || '资料正在维护'}，公开主页仍展示上一版本`
            : revisionMeta?.description || visibilityMeta.description
          return (
            <View key={club.id} id={`my-club-${club.id}`} className='my-club-card'>
              <View className='my-club-card__head'>
                <View className='my-club-card__logo'>
                  {revision?.logo.url
                    ? <Image src={revision.logo.url} mode='aspectFill' />
                    : <Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' />}
                </View>
                <View className='my-club-card__identity'>
                  <Text className='my-club-card__name'>{club.name}</Text>
                  <Text className='my-club-card__category'>{revision?.category.name || '暂未选择分类'}</Text>
                </View>
                <View className={`my-club-card__status my-club-card__status--${visibilityMeta.tone}`}>
                  {visibilityMeta.label}
                </View>
              </View>

              <View className={`my-club-card__progress my-club-card__progress--${revisionMeta?.tone || visibilityMeta.tone}`}>
                <View className='my-club-card__progress-mark' />
                <View className='my-club-card__progress-copy'>
                  <Text id={`my-club-${club.id}-revision-status`}>{progressLabel}</Text>
                  <Text>{progressDescription}</Text>
                </View>
              </View>

              {revision?.status === 'rejected' && !!revision.rejection_reason && (
                <View className='my-club-card__reason'>
                  <Text>审核说明</Text>
                  <Text>{revision.rejection_reason}</Text>
                </View>
              )}

              <View className='my-club-card__actions'>
                {club.visibility_status === 'published' && (
                  <View
                    ariaRole='button'
                    ariaLabel={`查看${club.name}公开主页`}
                    onClick={() => Taro.navigateTo({ url: `/pages/clubs/detail?id=${club.id}` })}
                  >查看主页</View>
                )}
                {editableClub(club) && (
                  <View
                    ariaRole='button'
                    ariaLabel={`${revision?.status === 'rejected' ? '修改' : '继续编辑'}${club.name}资料`}
                    onClick={() => void editClub(club)}
                  >{revision?.status === 'rejected' ? '修改资料' : '继续编辑'}</View>
                )}
                {club.available_actions.includes('submit_review') && revision?.status === 'draft' && (
                  <View
                    className={`my-club-card__primary ${submittingId ? 'my-club-card__primary--disabled' : ''}`}
                    ariaRole='button'
                    ariaLabel={`提交${club.name}资料审核`}
                    onClick={() => submittingId ? undefined : void submitReview(club)}
                  >{submittingId === club.id ? '提交中…' : '提交审核'}</View>
                )}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}
