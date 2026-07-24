import type { PublishDraft } from './publish'

export type ValidationErrors = Record<string, string>

const required = (errors: ValidationErrors, field: string, value: unknown, label: string) => {
  if (!String(value || '').trim()) errors[field] = `请填写${label}`
}

const contact = (errors: ValidationErrors, value: string) => {
  required(errors, 'contact', value, '联系方式')
  if (value.trim() && !/^[\w+\-@.:（）()一-龥\s]{3,200}$/.test(value.trim())) errors.contact = '联系方式格式不正确'
}

const time = (value: string) => new Date(`${value.replace(' ', 'T')}:00+08:00`).getTime()

export function validatePublish (draft: PublishDraft): ValidationErrors {
  const errors: ValidationErrors = {}
  if (draft.type === 'campus-circle') {
    const form = draft.form
    if (!form.section_id) errors.section_id = '请选择子模块'
    required(errors, 'title', form.title, '标题')
    required(errors, 'content', form.content, '正文')
    return errors
  }

  required(errors, 'title', draft.form.title, '标题')
  contact(errors, draft.form.contact)

  if (draft.type === 'activity') {
    const form = draft.form
    required(errors, 'summary', form.summary, '简介')
    required(errors, 'body', form.body, '正文')
    required(errors, 'location', form.location, '地点')
    required(errors, 'capacity', form.capacity, '人数')
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) errors.capacity = '人数至少为 1'
    const fields = ['signup_start_at', 'signup_end_at', 'start_at', 'end_at'] as const
    fields.forEach(field => required(errors, field, form[field], '时间'))
    if (form.signup_start_at && form.signup_end_at && time(form.signup_start_at) >= time(form.signup_end_at)) errors.signup_end_at = '报名结束时间须晚于开始时间'
    if (form.start_at && form.end_at && time(form.start_at) >= time(form.end_at)) errors.end_at = '活动结束时间须晚于开始时间'
    if (form.signup_end_at && form.start_at && time(form.signup_end_at) > time(form.start_at)) errors.start_at = '活动开始时间不能早于报名结束时间'
  } else if (draft.type === 'marketplace') {
    const form = draft.form
    required(errors, 'description', form.description, '描述')
    required(errors, 'price', form.price, '价格')
    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) errors.price = '价格必须大于 0'
  } else if (draft.type === 'errand') {
    const form = draft.form
    required(errors, 'description', form.description, '描述')
    required(errors, 'reward', form.reward, '赏金')
    if (!Number.isFinite(Number(form.reward)) || Number(form.reward) <= 0) errors.reward = '赏金必须大于 0'
    required(errors, 'pickup_location', form.pickup_location, '取件地点')
    required(errors, 'dropoff_location', form.dropoff_location, '送达地点')
    required(errors, 'deadline', form.deadline, '截止时间')
  } else {
    const form = draft.form
    required(errors, 'origin', form.origin, '起点')
    required(errors, 'destination', form.destination, '终点')
    required(errors, 'departure_at', form.departure_at, '出发时间')
    required(errors, 'total_seats', form.total_seats, '座位数')
    if (!Number.isInteger(Number(form.total_seats)) || Number(form.total_seats) < 1) errors.total_seats = '座位数至少为 1'
  }
  return errors
}
