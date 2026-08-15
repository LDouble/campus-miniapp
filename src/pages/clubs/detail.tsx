import { useState } from 'react'
import { useLoad } from '@tarojs/taro'
import { Button, Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import CustomNavbar, { getNavbarMetrics } from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import { publicShareImage } from '../../features/clubs/model'
import { clubsRepository } from '../../features/clubs/repository'
import type { ClubDetail } from '../../features/clubs/types'
import { useCampusShare } from '../../features/share'
import './detail.scss'

const validClubId = (value?: string) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

export default function ClubDetailPage() {
  const viewerNavbarMetrics = getNavbarMetrics()
  const [clubId, setClubId] = useState(0)
  const [club, setClub] = useState<ClubDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const load = async (id: number) => {
    setLoading(true)
    setError('')
    try {
      setClub(await clubsRepository.getPublic(id))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '社团详情加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    const id = validClubId(options.id)
    setClubId(id)
    if (!id) {
      setLoading(false)
      setError('社团参数无效')
      return
    }
    void load(id)
  })

  useCampusShare(() => {
    const imageUrl = club ? publicShareImage(club) : ''
    return {
      title: club ? `${club.name}｜海大社团` : '海大社团广场',
      path: club ? '/pages/clubs/detail' : '/pages/clubs/index',
      query: club ? { id: club.id } : undefined,
      imageUrl: imageUrl || require('../../assets/tabbar/community.png'),
    }
  })

  const previewGallery = (index: number) => {
    if (!club?.gallery.length) return
    setViewerIndex(index)
  }

  const markImageFailed = (key: string) => {
    setFailedImages((current) => ({ ...current, [key]: true }))
  }

  return (
    <View className='club-detail-page'>
      <CustomNavbar title={club?.name || '社团详情'} subtitle={club?.category.name} showBack />

      {loading && (
        <View className='club-detail-skeleton'>
          <View className='club-detail-skeleton__cover' />
          <View className='club-detail-skeleton__card'>
            <View /><View /><View />
          </View>
          <View className='club-detail-skeleton__section' />
        </View>
      )}

      {!loading && error && (
        <View className='club-detail-state'>
          <View className='club-detail-state__icon'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' /></View>
          <Text className='club-detail-state__title'>暂时无法查看这个社团</Text>
          <Text className='club-detail-state__text'>{error}</Text>
          {!!clubId && <View className='club-detail-state__action' hoverClass='club-detail-state__action--pressed' ariaRole='button' ariaLabel='重新加载社团详情' onClick={() => void load(clubId)}>重新加载</View>}
        </View>
      )}

      {!loading && club && (
        <View className='club-detail'>
          <View className='club-detail__cover'>
            {club.cover?.url && !failedImages.cover
              ? <Image src={club.cover.url} mode='aspectFill' onError={() => markImageFailed('cover')} />
              : <View className='club-detail__cover-placeholder'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' /></View>}
            <View className='club-detail__cover-shade' />
          </View>

          <View className='club-detail__identity'>
            <View className='club-detail__logo'>
              {club.logo?.url && !failedImages.logo
                ? <Image src={club.logo.url} mode='aspectFill' onError={() => markImageFailed('logo')} />
                : <Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' />}
            </View>
            <View className='club-detail__headline'>
              <View className='club-detail__category'>{club.category.name}</View>
              <Text className='club-detail__name'>{club.name}</Text>
              {!!club.slogan && <Text className='club-detail__slogan'>{club.slogan}</Text>}
            </View>
          </View>

          <View className='club-detail__share-row'>
            <Text>把喜欢的社团分享给同学</Text>
            <Button className='club-detail__share' openType='share'>分享主页</Button>
          </View>

          <View className='club-detail-section club-detail-section--intro'>
            <View className='club-detail-section__head'>
              <Text className='club-detail-section__eyebrow'>ABOUT US</Text>
              <Text className='club-detail-section__title'>社团简介</Text>
            </View>
            <Text className='club-detail-section__body'>{club.summary}</Text>
            {(club.founded_year || club.supervising_unit) && (
              <View className='club-detail-facts'>
                {!!club.founded_year && <View><Text>成立年份</Text><Text>{club.founded_year}</Text></View>}
                {!!club.supervising_unit && <View><Text>指导单位</Text><Text>{club.supervising_unit}</Text></View>}
              </View>
            )}
          </View>

          {!!club.gallery.length && (
            <View className='club-detail-section'>
              <View className='club-detail-section__head club-detail-section__head--row'>
                <View>
                  <Text className='club-detail-section__eyebrow'>GALLERY</Text>
                  <Text className='club-detail-section__title'>精彩瞬间</Text>
                </View>
                <Text className='club-detail-section__count'>{club.gallery.length} 张</Text>
              </View>
              <View className='club-gallery'>
                {club.gallery.map((image, index) => (
                  <View
                    key={image.media_id}
                    id={`club-gallery-image-${image.media_id}`}
                    className='club-gallery__item'
                    ariaRole='button'
                    ariaLabel={`预览第 ${index + 1} 张宣传图${image.caption ? `，${image.caption}` : ''}`}
                    hoverClass='club-gallery__item--pressed'
                    onClick={() => previewGallery(index)}
                  >
                    {!failedImages[`gallery-${image.media_id}`]
                      ? <Image src={image.url} mode='aspectFill' lazyLoad onError={() => markImageFailed(`gallery-${image.media_id}`)} />
                      : <View className='club-gallery__fallback'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' /><Text>图片暂不可用</Text></View>}
                    <View className='club-gallery__index'>{index + 1}/{club.gallery.length}</View>
                    {!!image.caption && <Text className='club-gallery__caption'>{image.caption}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className='club-detail-section'>
            <View className='club-detail-section__head'>
              <Text className='club-detail-section__eyebrow'>OUR STORY</Text>
              <Text className='club-detail-section__title'>详细介绍</Text>
            </View>
            {club.description.split(/\n+/).filter(Boolean).map((paragraph, index) => (
              <Text key={`${index}-${paragraph.slice(0, 12)}`} className='club-detail-section__paragraph'>{paragraph}</Text>
            ))}
          </View>
        </View>
      )}

      {club && viewerIndex !== null && (
        <View className='club-viewer'>
          <View
            className='club-viewer__top'
            style={{
              height: `${viewerNavbarMetrics.statusBarHeight + viewerNavbarMetrics.navigationBarHeight}px`,
              paddingTop: `${viewerNavbarMetrics.statusBarHeight}px`,
              gridTemplateColumns: `${viewerNavbarMetrics.sideWidth}px minmax(0, 1fr) ${viewerNavbarMetrics.sideWidth}px`,
            }}
          >
            <View
              id='club-viewer-close'
              className='club-viewer__close'
              ariaRole='button'
              ariaLabel='关闭图片预览'
              hoverClass='club-viewer__close--pressed'
              onClick={() => setViewerIndex(null)}
            ><View /><View /></View>
            <Text>{viewerIndex + 1} / {club.gallery.length}</Text>
            <View className='club-viewer__spacer' />
          </View>
          <Swiper
            className='club-viewer__swiper'
            current={viewerIndex}
            circular={false}
            onChange={(event) => setViewerIndex(event.detail.current)}
          >
            {club.gallery.map((image, index) => (
              <SwiperItem key={image.media_id}>
                <View className='club-viewer__slide'>
                  <Image src={image.url} mode='aspectFit' ariaLabel={`第 ${index + 1} 张宣传图片`} />
                </View>
              </SwiperItem>
            ))}
          </Swiper>
          <View className='club-viewer__caption'>
            <Text>{club.gallery[viewerIndex]?.caption || '社团宣传图片'}</Text>
            <Text>左右滑动查看其他图片</Text>
          </View>
        </View>
      )}
    </View>
  )
}
