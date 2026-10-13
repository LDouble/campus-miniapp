import { academicStorage } from '../../pages/academic/storage'
import { buildTimetableBuddyCustomCourses } from './custom-courses'
import type { TimetableBuddyCustomCourse } from './model'

/** readTimetableBuddyCustomCoursesForSharing 严格读取本人课程并投影当前学期，缺少可信本机记录时拒绝上传。 */
export const readTimetableBuddyCustomCoursesForSharing = (
  platformUserId: number,
  periodId: string,
): TimetableBuddyCustomCourse[] => {
  const result = academicStorage.readCustomCoursesForSharing(platformUserId)
  if (result.status === 'missing_scoped') {
    throw new Error('还没有可确认的自定义课程记录，请先打开本人课表后再刷新共享课表')
  }
  if (result.status === 'legacy_unowned') {
    if (result.reason === 'owner_mismatch') {
      throw new Error('旧版自定义课程属于其他账号，当前账号不会继承；如需查看，请切回原账号核对课程归属')
    }
    throw new Error('旧版自定义课程归属无法确认，原数据已保留；请切回曾保存课程的账号核对归属后重试')
  }
  return buildTimetableBuddyCustomCourses(result.courses, periodId)
}
