import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import type { components } from '../../../api/generated/schema'
import { isApiError } from '../../../api/client'
import CustomNavbar from '../../../components/custom-navbar'
import { KeyboardSafeTextarea } from '../../../components/keyboard-safe-input'
import type { ReportableResourceType } from '../../../features/content-report'
import { lifeServicesRepository } from '../../../features/life-services/repository'
import './index.scss'

type Category = components['schemas']['ContentReportCategory']

const categories: Array<{ value: Category; label: string }> = [
  { value: 'spam', label: '违规广告' },
  { value: 'fraud', label: '欺诈或骗局' },
  { value: 'harassment', label: '骚扰或人身攻击' },
  { value: 'pornography', label: '色情低俗' },
  { value: 'illegal', label: '违法违规' },
  { value: 'privacy', label: '泄露隐私' },
  { value: 'misinformation', label: '虚假信息' },
  { value: 'copyright', label: '侵权内容' },
  { value: 'other', label: '其他问题' },
]

export default function ContentReportPage() {
  const [resourceType, setResourceType] = useState<ReportableResourceType | null>(null)
  const [resourceId, setResourceId] = useState(0)
  const [resourceVersion, setResourceVersion] = useState(0)
  const [category, setCategory] = useState<Category | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useLoad((options) => {
    const id = Number(options.resource_id)
    const version = Number(options.resource_version)
    const type = String(options.resource_type || '') as ReportableResourceType
    if (!id || !version || ![
      'campus_circle_post',
      'comment',
      'marketplace_listing',
      'errand',
      'carpool',
    ].includes(type)) {
      Taro.showToast({ title: '举报对象无效', icon: 'none' })
      void Taro.navigateBack()
      return
    }
    setResourceType(type)
    setResourceId(id)
    setResourceVersion(version)
  })

  const canSubmit = useMemo(() => (
    !!category
    && !!resourceType
    && !submitting
    && (category !== 'other' || !!description.trim())
  ), [category, description, resourceType, submitting])

  const submit = async () => {
    if (!canSubmit || !resourceType || !category) {
      Taro.showToast({
        title: category === 'other' ? '请简要说明问题' : '请选择举报原因',
        icon: 'none',
      })
      return
    }
    setSubmitting(true)
    try {
      await lifeServicesRepository.createContentReport({
        resource_type: resourceType,
        resource_id: resourceId,
        resource_version: resourceVersion,
        category,
        description: description.trim() || undefined,
      })
      await Taro.showToast({ title: '已收到举报', icon: 'success' })
      setTimeout(() => {
        void Taro.navigateBack()
      }, 500)
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '举报提交失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='content-report'>
      <CustomNavbar title='举报内容' showBack />
      <View className='content-report__body'>
        <View className='content-report__section'>
          <Text className='content-report__title'>请选择原因</Text>
          <View className='content-report__options'>
            {categories.map((item) => (
              <View
                key={item.value}
                className={
                  category === item.value
                    ? 'content-report__option content-report__option--active'
                    : 'content-report__option'
                }
                hoverClass='content-report__option--pressed'
                onClick={() => setCategory(item.value)}
              >
                <Text>{item.label}</Text>
                <View className='content-report__radio'>
                  {category === item.value && <View />}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className='content-report__section'>
          <View className='content-report__field-head'>
            <Text className='content-report__title'>
              补充说明{category === 'other' ? '（必填）' : '（选填）'}
            </Text>
            <Text>{description.length}/300</Text>
          </View>
          <KeyboardSafeTextarea
            className='content-report__textarea'
            value={description}
            maxlength={300}
            autoHeight={false}
            cursorSpacing={24}
            placeholder='请描述具体问题，内容仅管理员可见'
            onInput={(event) => setDescription(event.detail.value)}
          />
        </View>

        <Text className='content-report__hint'>
          我们会保护你的举报信息，请勿重复提交。
        </Text>
      </View>
      <View className='content-report__footer'>
        <View
          className={
            canSubmit
              ? 'content-report__submit'
              : 'content-report__submit content-report__submit--disabled'
          }
          hoverClass={canSubmit ? 'content-report__submit--pressed' : 'none'}
          onClick={() => void submit()}
        >
          {submitting ? '正在提交' : '提交举报'}
        </View>
      </View>
    </View>
  )
}
