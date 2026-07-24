import { Button, Picker, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { CampusCircleSectionView } from '../../api/generated/models'
import { AmountField, ContactFields, DateTimeField, FieldInput, FieldTextarea } from '../../components/PublishFields'
import { DesignIcon } from '../../components/DesignIcon'
import { useNavigationMetrics } from '../../hooks/useNavigationMetrics'
import { ensurePublishAccess } from '../../services/api'
import {
  ActivityForm,
  CampusCircleForm,
  CarpoolForm,
  emptyForms,
  ErrandForm,
  loadCampusCircleSections,
  MarketplaceForm,
  PublishDraft,
  PublishType,
  publishTypeLabels,
  submitPublish
} from '../../services/publish'
import { validatePublish, ValidationErrors } from '../../services/publish-validation'
import './index.scss'

const routeTypes: Record<string, PublishType> = {
  activity: 'activity',
  'campus-circle': 'campus-circle',
  marketplace: 'marketplace',
  errand: 'errand',
  carpool: 'carpool',
  活动: 'activity',
  校园圈: 'campus-circle',
  动态: 'campus-circle',
  失物: 'campus-circle',
  闲置: 'marketplace',
  二手: 'marketplace',
  跑腿: 'errand',
  拼车: 'carpool'
}

export default function Publish () {
  const [draft, setDraft] = useState<PublishDraft>({ type: 'campus-circle', form: { ...emptyForms['campus-circle'] } })
  const [sections, setSections] = useState<CampusCircleSectionView[]>([])
  const [sectionHint, setSectionHint] = useState('')
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { statusBarHeight, rightInset } = useNavigationMetrics()

  const chooseType = (type: PublishType) => {
    setDraft({ type, form: { ...emptyForms[type] } } as PublishDraft)
    setErrors({})
    setMessage('')
  }

  useLoad(params => {
    const requested = decodeURIComponent(params.type || '')
    const type = routeTypes[requested] || 'campus-circle'
    setSectionHint(requested === '失物' ? '失物' : '')
    chooseType(type)
  })

  useEffect(() => {
    if (draft.type !== 'campus-circle' || sections.length) return
    let cancelled = false
    loadCampusCircleSections().then(items => {
      if (cancelled) return
      setSections(items)
      const matched = sectionHint && items.find(item => item.name.includes(sectionHint))
      if (matched) setDraft(current => current.type === 'campus-circle' ? { ...current, form: { ...current.form, section_id: matched.id } } : current)
    }).catch(error => setMessage((error as Error).message))
    return () => { cancelled = true }
  }, [draft.type, sectionHint, sections.length])

  const update = (field: string, value: string | number) => {
    setDraft(current => ({ ...current, form: { ...current.form, [field]: value } } as PublishDraft))
    setErrors(current => ({ ...current, [field]: '' }))
  }

  const submit = async () => {
    if (submitting) return
    setMessage('')
    const nextErrors = validatePublish(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setMessage('请检查表单中的必填项')
      return
    }
    setSubmitting(true)
    try {
      const access = await ensurePublishAccess()
      if (access === 'needs-verification') {
        Taro.showToast({ title: '请先完成教务认证', icon: 'none' })
        await Taro.navigateTo({ url: '/pages/verify/index' })
        return
      }
      const result = await submitPublish(draft)
      Taro.showToast({ title: '已提交审核', icon: 'success' })
      await Taro.redirectTo({ url: `/pages/detail/index?type=${result.type}&id=${result.id}&mine=1` })
    } catch (error) {
      setMessage((error as Error).message || '提交失败，请检查网络后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const activity = draft.type === 'activity' ? draft.form as ActivityForm : null
  const circle = draft.type === 'campus-circle' ? draft.form as CampusCircleForm : null
  const marketplace = draft.type === 'marketplace' ? draft.form as MarketplaceForm : null
  const errand = draft.type === 'errand' ? draft.form as ErrandForm : null
  const carpool = draft.type === 'carpool' ? draft.form as CarpoolForm : null
  const sectionIndex = circle ? Math.max(0, sections.findIndex(item => item.id === circle.section_id)) : 0

  return <View className='publish-page'>
    <View className='publish-header' style={{ paddingTop: `${statusBarHeight + 6}px`, paddingRight: `${rightInset}px` }}>
      <Text onClick={() => Taro.navigateBack()}>取消</Text>
      <Text className='publish-header-title'>发布{publishTypeLabels[draft.type]}</Text>
      <View />
    </View>
    <View className='publish-body'>
      <View className='publish-tabs'>
        {(Object.keys(publishTypeLabels) as PublishType[]).map(type => <View key={type} className={draft.type === type ? 'active' : ''} onClick={() => chooseType(type)}>{publishTypeLabels[type]}</View>)}
      </View>
      <View className='publish-editor'>
        {activity && <>
          <FieldInput label='标题' value={activity.title} onChange={value => update('title', value)} error={errors.title} />
          <FieldInput label='简介' value={activity.summary} onChange={value => update('summary', value)} error={errors.summary} />
          <FieldTextarea label='正文' value={activity.body} onChange={value => update('body', value)} error={errors.body} />
          <FieldInput label='地点' value={activity.location} onChange={value => update('location', value)} error={errors.location} />
          <DateTimeField label='报名开始' value={activity.signup_start_at} onChange={value => update('signup_start_at', value)} error={errors.signup_start_at} />
          <DateTimeField label='报名结束' value={activity.signup_end_at} onChange={value => update('signup_end_at', value)} error={errors.signup_end_at} />
          <DateTimeField label='活动开始' value={activity.start_at} onChange={value => update('start_at', value)} error={errors.start_at} />
          <DateTimeField label='活动结束' value={activity.end_at} onChange={value => update('end_at', value)} error={errors.end_at} />
          <FieldInput label='人数' value={activity.capacity} type='number' onChange={value => update('capacity', value)} error={errors.capacity} />
          <ContactFields contactType={activity.contact_type} contact={activity.contact} onTypeChange={value => update('contact_type', value)} onContactChange={value => update('contact', value)} error={errors.contact} />
        </>}
        {circle && <>
          <View className='form-field'>
            <Text className='field-label'>子模块</Text>
            <Picker mode='selector' range={sections.map(item => item.name)} value={sectionIndex} onChange={event => update('section_id', sections[Number(event.detail.value)].id)}>
              <View className={`picker-value ${circle.section_id ? '' : 'placeholder'}`}>{circle.section_id && sections[sectionIndex] ? sections[sectionIndex].name : '请选择子模块'}</View>
            </Picker>
            {errors.section_id && <Text className='field-error'>{errors.section_id}</Text>}
          </View>
          <FieldInput label='标题' value={circle.title || ''} onChange={value => update('title', value)} error={errors.title} />
          <FieldTextarea label='正文' value={circle.content || ''} onChange={value => update('content', value)} error={errors.content} />
        </>}
        {marketplace && <>
          <FieldInput label='标题' value={marketplace.title} onChange={value => update('title', value)} error={errors.title} />
          <FieldTextarea label='描述' value={marketplace.description} onChange={value => update('description', value)} error={errors.description} />
          <AmountField label='价格（元）' value={marketplace.price} onChange={value => update('price', value)} error={errors.price} />
          <ContactFields contactType={marketplace.contact_type} contact={marketplace.contact} onTypeChange={value => update('contact_type', value)} onContactChange={value => update('contact', value)} error={errors.contact} />
        </>}
        {errand && <>
          <FieldInput label='标题' value={errand.title} onChange={value => update('title', value)} error={errors.title} />
          <FieldTextarea label='描述' value={errand.description} onChange={value => update('description', value)} error={errors.description} />
          <AmountField label='赏金（元）' value={errand.reward} onChange={value => update('reward', value)} error={errors.reward} />
          <FieldInput label='取件地点' value={errand.pickup_location} onChange={value => update('pickup_location', value)} error={errors.pickup_location} />
          <FieldInput label='送达地点' value={errand.dropoff_location} onChange={value => update('dropoff_location', value)} error={errors.dropoff_location} />
          <DateTimeField label='截止时间' value={errand.deadline} onChange={value => update('deadline', value)} error={errors.deadline} />
          <ContactFields contactType={errand.contact_type} contact={errand.contact} onTypeChange={value => update('contact_type', value)} onContactChange={value => update('contact', value)} error={errors.contact} />
        </>}
        {carpool && <>
          <FieldInput label='标题' value={carpool.title} onChange={value => update('title', value)} error={errors.title} />
          <FieldInput label='起点' value={carpool.origin} onChange={value => update('origin', value)} error={errors.origin} />
          <FieldInput label='终点' value={carpool.destination} onChange={value => update('destination', value)} error={errors.destination} />
          <DateTimeField label='出发时间' value={carpool.departure_at} onChange={value => update('departure_at', value)} error={errors.departure_at} />
          <FieldInput label='座位数' value={carpool.total_seats} type='number' onChange={value => update('total_seats', value)} error={errors.total_seats} />
          <ContactFields contactType={carpool.contact_type} contact={carpool.contact} onTypeChange={value => update('contact_type', value)} onContactChange={value => update('contact', value)} error={errors.contact} />
        </>}
      </View>
      <View className='publish-tip'><DesignIcon name='check' /><View><Text>提交后将进入审核</Text><Text>审核中仅你自己可见，审核通过后公开</Text></View></View>
      {message && <Text className='submit-message'>{message}</Text>}
      <Button type='primary' loading={submitting} disabled={submitting} onClick={() => void submit()}>提交审核</Button>
    </View>
  </View>
}
