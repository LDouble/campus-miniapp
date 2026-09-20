import { useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import type { Course } from '../../pages/academic/types'
import type { CoursePreviewItem } from './data'
import { getClassDiscussionContext } from '../class-discussion/context'
import locationIcon from '../../assets/icons/home-course-location.svg'
import discussionIcon from '../../assets/icons/home-course-discussion.svg'
import './course-carousel.scss'

type Props = {
  items: CoursePreviewItem[]
  openingCourseId: string
  onViewSchedule: () => void
  onDiscussion: (course: Course) => void
}

export default function HomeCourseCarousel({
  items, openingCourseId, onViewSchedule, onDiscussion,
}: Props) {
  const [current, setCurrent] = useState(0)
  const firstUpcoming = items.findIndex((item) => item.status === 'upcoming')

  return (
    <View className='home-course-carousel'>
      <Swiper
        className='home-course-carousel__swiper'
        current={current}
        nextMargin={items.length > 1 ? '96rpx' : '0rpx'}
        duration={200}
        onChange={(event) => setCurrent(event.detail.current)}
      >
        {items.map((item, index) => {
          const available = Boolean(getClassDiscussionContext(item.course))
          const ongoing = item.status === 'ongoing'
          const status = ongoing ? '进行中' : index === firstUpcoming ? '下一节' : '待开始'
          return (
            <SwiperItem key={`${item.course.id}-${item.startsAt.getTime()}`}>
              <View className={`home-course-card${current === index ? ' home-course-card--selected' : ''}`}>
                <Text className='home-course-card__number'>{String(index + 1).padStart(2, '0')}</Text>
                <View
                  className='home-course-card__main'
                  ariaRole='button'
                  ariaLabel={`查看${item.course.name}课表详情`}
                  onClick={onViewSchedule}
                >
                  <View className='home-course-card__heading'>
                    <Text className={`home-course-card__status${ongoing ? ' home-course-card__status--ongoing' : ''}`}>
                      {ongoing ? '● ' : ''}{status}
                    </Text>
                    <Text className='home-course-card__name'>{item.course.name}</Text>
                  </View>
                  <View className='home-course-card__meta'>
                    <Text className='home-course-card__section'>
                      第{item.course.startSection === item.course.endSection
                        ? item.course.startSection
                        : `${item.course.startSection}–${item.course.endSection}`}节
                    </Text>
                    <View className='home-course-card__location'>
                      <Image src={locationIcon} mode='aspectFit' />
                      <Text>{item.course.location || '地点待定'}</Text>
                    </View>
                  </View>
                </View>
                <View className='home-course-card__footer'>
                  <View className='home-course-card__activity'>
                    <View className='home-course-card__avatars'>
                      {[
                        { name: '张', background: '#BFDBFE', color: '#1E3A8A' },
                        { name: '李', background: '#FDE68A', color: '#78350F' },
                        { name: '陈', background: '#A7F3D0', color: '#064E3B' },
                      ].map((avatar) => (
                        <View key={avatar.name} className='home-course-card__avatar' style={{ backgroundColor: avatar.background, color: avatar.color }}>
                          <Text>{avatar.name}</Text>
                        </View>
                      ))}
                    </View>
                    <Text className='home-course-card__activity-label'>大家正在聊…</Text>
                  </View>
                  <View className='home-course-card__actions'>
                    <View
                      className={`home-course-card__discussion${openingCourseId || !available ? ' home-course-card__action--disabled' : ''}`}
                      ariaRole='button'
                      ariaLabel={available ? `进入${item.course.name}课堂讨论` : '缺少选课号或学期，暂不能进入讨论'}
                      onClick={() => { if (!openingCourseId) onDiscussion(item.course) }}
                    >
                      <View className='home-course-card__discussion-label'>
                        <Text>{openingCourseId === item.course.id ? '打开中…' : available ? '进讨论组' : '暂不可用'}</Text>
                        <Image src={discussionIcon} mode='aspectFit' />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </SwiperItem>
          )
        })}
      </Swiper>
      {items.length > 1 && (
        <View className='home-course-carousel__pagination' ariaLabel={`第 ${current + 1} 门，共 ${items.length} 门课程，左右滑动切换`}>
          {items.map((item, index) => (
            <View key={item.course.id} className={`home-course-carousel__dot${current === index ? ' home-course-carousel__dot--active' : ''}`} />
          ))}
        </View>
      )}
    </View>
  )
}
