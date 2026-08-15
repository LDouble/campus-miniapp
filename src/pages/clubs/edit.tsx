import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Image, Picker, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  KeyboardSafeInput,
  KeyboardSafeTextarea,
} from '../../components/keyboard-safe-input'
import { isApiError } from '../../api/client'
import { ensureClubEditorAccess } from '../../features/clubs/access'
import { chooseClubImages, serverImageDraft } from '../../features/clubs/images'
import {
  MAX_CLUB_GALLERY_IMAGES,
  moveGalleryImage,
  normalizeGalleryOrder,
  validateClubDraft,
} from '../../features/clubs/model'
import { clubsRepository } from '../../features/clubs/repository'
import type {
  ClubCategory,
  ClubDraftForm,
  ClubEditorialView,
  ClubImageDraft,
  ClubMediaPurpose,
} from '../../features/clubs/types'
import './edit.scss'

const validClubId = (value?: string) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

export default function ClubEditorPage() {
  const [clubId, setClubId] = useState(0)
  const [editor, setEditor] = useState<ClubEditorialView | null>(null)
  const [categories, setCategories] = useState<ClubCategory[]>([])
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(0)
  const [shortName, setShortName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [foundedYear, setFoundedYear] = useState('')
  const [supervisingUnit, setSupervisingUnit] = useState('')
  const [logo, setLogo] = useState<ClubImageDraft | null>(null)
  const [cover, setCover] = useState<ClubImageDraft | null>(null)
  const [gallery, setGallery] = useState<ClubImageDraft[]>([])

  const fillEditor = (view: ClubEditorialView) => {
    const revision = view.working_revision || view.published_revision
    setEditor(view)
    setName(view.name)
    if (!revision) return
    setCategoryId(revision.category.id)
    setShortName(revision.short_name || '')
    setSlogan(revision.slogan || '')
    setSummary(revision.summary)
    setDescription(revision.description)
    setFoundedYear(revision.founded_year ? String(revision.founded_year) : '')
    setSupervisingUnit(revision.supervising_unit || '')
    setLogo(revision.logo ? serverImageDraft(revision.logo, 'logo') : null)
    setCover(revision.cover ? serverImageDraft(revision.cover, 'cover') : null)
    setGallery(normalizeGalleryOrder(
      revision.gallery.map((image) => serverImageDraft(image, 'gallery')),
    ))
  }

  const load = async (id: number) => {
    setLoading(true)
    setError('')
    try {
      const canEdit = await ensureClubEditorAccess()
      setAllowed(canEdit)
      if (!canEdit) return
      const categoryPromise = clubsRepository.listCategories()
      const editorPromise = id ? clubsRepository.getEditor(id) : Promise.resolve(null)
      const [categoryItems, editorView] = await Promise.all([categoryPromise, editorPromise])
      const activeCategories = categoryItems.filter((category) => category.status === 'active')
      setCategories(activeCategories)
      if (!editorView && activeCategories.length === 1) {
        setCategoryId(activeCategories[0].id)
      }
      if (editorView) fillEditor(editorView)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '社团资料加载失败')
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    const id = validClubId(options.id)
    setClubId(id)
    void load(id)
  })

  const updateImage = (
    key: string,
    updater: (image: ClubImageDraft) => ClubImageDraft,
  ) => {
    setLogo((current) => current?.key === key ? updater(current) : current)
    setCover((current) => current?.key === key ? updater(current) : current)
    setGallery((current) => current.map((image) => image.key === key ? updater(image) : image))
  }

  const uploadImage = async (image: ClubImageDraft) => {
    if (!image.local_path) {
      updateImage(image.key, (current) => ({
        ...current,
        status: 'failed',
        error: '本地临时图片已失效，请删除后重新选择',
      }))
      return
    }
    updateImage(image.key, (current) => ({ ...current, status: 'uploading', progress: 0, error: '' }))
    try {
      const uploaded = await clubsRepository.uploadImage({
        filePath: image.local_path,
        mimeType: image.mime_type,
        sizeBytes: image.size_bytes,
        width: image.width,
        height: image.height,
        purpose: image.purpose,
        onProgress: (progress) => updateImage(image.key, (current) => ({ ...current, progress })),
      })
      updateImage(image.key, (current) => ({
        ...current,
        media_id: uploaded.id,
        preview_url: current.local_path || uploaded.url,
        width: uploaded.width || current.width,
        height: uploaded.height || current.height,
        status: 'uploaded',
        progress: 100,
        error: '',
      }))
    } catch (uploadError) {
      updateImage(image.key, (current) => ({
        ...current,
        status: 'failed',
        error: isApiError(uploadError) ? uploadError.message : uploadError instanceof Error ? uploadError.message : '上传失败',
      }))
    }
  }

  const chooseSingleImage = async (purpose: Exclude<ClubMediaPurpose, 'gallery'>) => {
    try {
      const items = await chooseClubImages(purpose, 1)
      const image = items[0]
      if (!image) return
      if (purpose === 'logo') setLogo(image)
      else setCover(image)
      void uploadImage(image)
    } catch (chooseError) {
      Taro.showToast({ title: chooseError instanceof Error ? chooseError.message : '图片选择失败', icon: 'none' })
    }
  }

  const chooseGallery = async () => {
    const remaining = MAX_CLUB_GALLERY_IMAGES - gallery.length
    if (remaining <= 0) {
      Taro.showToast({ title: '宣传图片最多 9 张', icon: 'none' })
      return
    }
    try {
      const items = normalizeGalleryOrder(await chooseClubImages('gallery', remaining))
      if (!items.length) return
      setGallery((current) => normalizeGalleryOrder([...current, ...items]))
      items.forEach((image) => void uploadImage(image))
    } catch (chooseError) {
      Taro.showToast({ title: chooseError instanceof Error ? chooseError.message : '图片选择失败', icon: 'none' })
    }
  }

  const input = (): ClubDraftForm => ({
    name: name.trim(),
    category_id: categoryId,
    short_name: shortName.trim(),
    slogan: slogan.trim(),
    summary: summary.trim(),
    description: description.trim(),
    founded_year: foundedYear ? Number(foundedYear) : null,
    supervising_unit: supervisingUnit.trim(),
    logo_media_id: logo?.media_id || 0,
    cover_media_id: cover?.media_id || null,
    gallery: gallery.map((image, index) => ({
      media_id: image.media_id || 0,
      caption: image.caption.trim(),
      sort_order: index,
    })),
  })

  const saveDraft = async (showSuccess = true) => {
    const draft = input()
    const imageDrafts = [logo, cover, ...gallery].filter((image): image is ClubImageDraft => !!image)
    const validationError = validateClubDraft(draft, imageDrafts)
    if (validationError) {
      Taro.showToast({ title: validationError, icon: 'none', duration: 2200 })
      return null
    }
    setSaving(true)
    try {
      const updated = clubId
        ? await clubsRepository.updateDraft(clubId, {
          category_id: draft.category_id,
          summary: draft.summary,
          description: draft.description,
          logo_media_id: draft.logo_media_id,
          gallery: draft.gallery,
          ...(draft.short_name ? { short_name: draft.short_name } : {}),
          ...(draft.slogan ? { slogan: draft.slogan } : {}),
          ...(draft.founded_year ? { founded_year: draft.founded_year } : {}),
          ...(draft.supervising_unit ? { supervising_unit: draft.supervising_unit } : {}),
          ...(draft.cover_media_id ? { cover_media_id: draft.cover_media_id } : {}),
          ...(!editor?.published_revision ? { name: draft.name } : {}),
        }, editor?.version || 0)
        : await clubsRepository.create({
          name: draft.name,
          category_id: draft.category_id,
          summary: draft.summary,
          description: draft.description,
          logo_media_id: draft.logo_media_id,
          gallery: draft.gallery,
          ...(draft.short_name ? { short_name: draft.short_name } : {}),
          ...(draft.slogan ? { slogan: draft.slogan } : {}),
          ...(draft.founded_year ? { founded_year: draft.founded_year } : {}),
          ...(draft.supervising_unit ? { supervising_unit: draft.supervising_unit } : {}),
          ...(draft.cover_media_id ? { cover_media_id: draft.cover_media_id } : {}),
        })
      setClubId(updated.id)
      fillEditor(updated)
      if (showSuccess) Taro.showToast({ title: '草稿已保存', icon: 'success' })
      return updated
    } catch (saveError) {
      Taro.showToast({ title: isApiError(saveError) ? saveError.message : '草稿保存失败', icon: 'none' })
      return null
    } finally {
      setSaving(false)
    }
  }

  const submitReview = async () => {
    if (saving || submitting) return
    const modal = await Taro.showModal({
      title: '提交审核',
      content: editor?.published_revision
        ? '保存并提交后，公开主页在审核期间仍展示当前版本。'
        : '提交后资料将暂时不可编辑，审核通过后正式公开。',
      confirmText: '确认提交',
      confirmColor: '#4f907e',
    })
    if (!modal.confirm) return
    setSubmitting(true)
    try {
      const saved = await saveDraft(false)
      if (!saved) return
      await clubsRepository.submitReview(saved.id, saved.version)
      await Taro.showModal({
        title: '已提交审核',
        content: '审核结果会通过消息通知，你也可以在“我的社团资料”查看进度。',
        showCancel: false,
        confirmText: '查看状态',
        confirmColor: '#4f907e',
      })
      await Taro.redirectTo({ url: '/pages/clubs/mine' })
    } catch (submitError) {
      Taro.showToast({ title: isApiError(submitError) ? submitError.message : '提交审核失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const currentCategory = categories.find((category) => category.id === categoryId)
  const nameFrozen = !!editor?.published_revision
  const workingStatus = editor?.working_revision?.status
  const formLocked = workingStatus === 'pending_review'
  const requiredItems = [
    { label: '名称', done: name.trim().length >= 2 },
    { label: '分类', done: categoryId > 0 },
    { label: '简介', done: summary.trim().length >= 20 },
    { label: '详细介绍', done: description.trim().length >= 50 },
    { label: 'Logo', done: logo?.status === 'uploaded' && !!logo.media_id },
  ]
  const requiredCompleted = requiredItems.filter((item) => item.done).length
  const missingRequired = requiredItems.filter((item) => !item.done).map((item) => item.label)
  const scrollToSection = (selector: string) => {
    void Taro.pageScrollTo({ selector, duration: 220 })
  }

  return (
    <View className='club-editor-page'>
      <CustomNavbar title={clubId ? '编辑社团主页' : '创建社团主页'} subtitle='资料将经过平台审核' showBack />

      {loading && <View className='club-editor-loading'>正在加载编辑资料</View>}
      {!loading && error && (
        <View className='club-editor-state'>
          <Text className='club-editor-state__title'>无法打开编辑器</Text>
          <Text className='club-editor-state__text'>{error}</Text>
          <View className='club-editor-state__action' onClick={() => void load(clubId)}>重新加载</View>
        </View>
      )}
      {!loading && allowed === false && !error && (
        <View className='club-editor-state'>
          <Text className='club-editor-state__title'>完成校园认证后即可创建</Text>
          <Text className='club-editor-state__text'>认证成功后返回这里，已填写内容不会被自动提交。</Text>
          <View className='club-editor-state__action' onClick={() => void load(clubId)}>我已完成认证</View>
        </View>
      )}
      {!loading && allowed && !error && formLocked && (
        <View className='club-editor-state'>
          <Text className='club-editor-state__title'>资料正在审核中</Text>
          <Text className='club-editor-state__text'>提交后的版本不可编辑；审核完成后可继续维护。</Text>
          <View className='club-editor-state__action' onClick={() => Taro.redirectTo({ url: '/pages/clubs/mine' })}>查看审核状态</View>
        </View>
      )}

      {!loading && allowed && !error && !formLocked && (
        <View className='club-editor-form'>
          {editor?.working_revision?.status === 'rejected' && (
            <View className='club-editor-rejection'>
              <Text>审核说明</Text>
              <Text>{editor.working_revision.rejection_reason || '请完善资料后重新提交'}</Text>
            </View>
          )}

          <View className='club-editor-progress'>
            <View className='club-editor-progress__head'>
              <View>
                <Text>主页完成度</Text>
                <Text>{requiredCompleted === requiredItems.length ? '必填资料已完成，可以提交审核' : `还需完成：${missingRequired.join('、')}`}</Text>
              </View>
              <Text>{requiredCompleted}/{requiredItems.length}</Text>
            </View>
            <View className='club-editor-progress__track'>
              <View style={{ width: `${requiredCompleted / requiredItems.length * 100}%` }} />
            </View>
            <View className='club-editor-progress__nav'>
              <View hoverClass='club-editor-progress__nav--pressed' ariaRole='button' ariaLabel='跳转到基础资料' onClick={() => scrollToSection('#club-section-basic')}>基础</View>
              <View hoverClass='club-editor-progress__nav--pressed' ariaRole='button' ariaLabel='跳转到视觉形象' onClick={() => scrollToSection('#club-section-visual')}>形象</View>
              <View hoverClass='club-editor-progress__nav--pressed' ariaRole='button' ariaLabel='跳转到宣传图集' onClick={() => scrollToSection('#club-section-gallery')}>图集</View>
              <View hoverClass='club-editor-progress__nav--pressed' ariaRole='button' ariaLabel='跳转到文字介绍' onClick={() => scrollToSection('#club-section-copy')}>介绍</View>
            </View>
          </View>

          <View id='club-section-basic' className='club-form-section'>
            <View className='club-form-section__head'><Text>基础资料</Text><Text>带 * 为必填</Text></View>
            <View className='club-field'>
              <Text className='club-field__label'>社团名称 *</Text>
              <KeyboardSafeInput id='club-name' className='club-field__input' value={name} maxlength={60} disabled={nameFrozen} placeholder='2–60 个字' onInput={(event) => setName(event.detail.value)} />
              <Text className='club-field__hint'>{nameFrozen ? '首次发布后名称不可自行修改' : `${name.trim().length}/60`}</Text>
            </View>
            <View className='club-field'>
              <Text className='club-field__label'>社团分类 *</Text>
              <Picker id='club-category-picker' range={categories} rangeKey='name' value={Math.max(0, categories.findIndex((item) => item.id === categoryId))} onChange={(event) => setCategoryId(categories[Number(event.detail.value)]?.id || 0)}>
                <View className={`club-field__picker ${currentCategory ? '' : 'club-field__picker--placeholder'}`}>{currentCategory?.name || '请选择启用中的分类'}<Text>›</Text></View>
              </Picker>
            </View>
            <View className='club-field-grid'>
              <View className='club-field'>
                <Text className='club-field__label'>社团简称</Text>
                <KeyboardSafeInput className='club-field__input' value={shortName} maxlength={20} placeholder='最多 20 字' onInput={(event) => setShortName(event.detail.value)} />
              </View>
              <View className='club-field'>
                <Text className='club-field__label'>成立年份</Text>
                <KeyboardSafeInput className='club-field__input' value={foundedYear} type='number' maxlength={4} placeholder={`1900–${new Date().getFullYear()}`} onInput={(event) => setFoundedYear(event.detail.value.replace(/\D/g, '').slice(0, 4))} />
              </View>
            </View>
            <View className='club-field'>
              <Text className='club-field__label'>宣传口号</Text>
              <KeyboardSafeInput className='club-field__input' value={slogan} maxlength={80} placeholder='一句话表达社团特色' onInput={(event) => setSlogan(event.detail.value)} />
            </View>
            <View className='club-field'>
              <Text className='club-field__label'>指导 / 挂靠单位</Text>
              <KeyboardSafeInput className='club-field__input' value={supervisingUnit} maxlength={100} placeholder='选填，最多 100 个字' onInput={(event) => setSupervisingUnit(event.detail.value)} />
            </View>
          </View>

          <View id='club-section-visual' className='club-form-section'>
            <View className='club-form-section__head'><Text>视觉形象</Text><Text>JPEG / PNG / WebP，单张≤5MiB</Text></View>
            <View className='club-image-fields'>
              <View className='club-image-field'>
                <Text className='club-field__label'>Logo *</Text>
                <View id='club-logo-picker' className='club-image-field__single club-image-field__single--logo' hoverClass='club-image-field__single--pressed' ariaRole='button' ariaLabel={logo ? '重新选择社团 Logo' : '选择社团 Logo'} onClick={() => void chooseSingleImage('logo')}>
                  {logo ? <Image id={logo.media_id ? `club-logo-media-${logo.media_id}` : undefined} src={logo.preview_url} mode='aspectFill' ariaLabel='社团 Logo 预览' /> : <View><Image src={require('../../assets/icons/plus.svg')} mode='aspectFit' /><Text>选择 Logo</Text></View>}
                  {logo?.status === 'uploading' && <View className='club-image-field__progress'><View style={{ width: `${logo.progress}%` }} /></View>}
                </View>
                {logo?.status === 'failed' && <View className='club-image-field__error' onClick={() => void uploadImage(logo)}>{logo.error}，点击重试</View>}
                <Text className='club-field__hint'>选择图片后进入 1:1 裁剪</Text>
              </View>
              <View className='club-image-field'>
                <Text className='club-field__label'>封面</Text>
                <View className='club-image-field__single club-image-field__single--cover' hoverClass='club-image-field__single--pressed' ariaRole='button' ariaLabel={cover ? '重新选择社团封面' : '选择社团封面'} onClick={() => void chooseSingleImage('cover')}>
                  {cover ? <Image src={cover.preview_url} mode='aspectFill' ariaLabel='社团封面预览' /> : <View><Image src={require('../../assets/icons/plus.svg')} mode='aspectFit' /><Text>选择 16:9 封面</Text></View>}
                  {cover?.status === 'uploading' && <View className='club-image-field__progress'><View style={{ width: `${cover.progress}%` }} /></View>}
                </View>
                {cover && <View className='club-image-field__remove' ariaRole='button' ariaLabel='移除社团封面' onClick={() => setCover(null)}>移除封面</View>}
                {cover?.status === 'failed' && <View className='club-image-field__error' onClick={() => void uploadImage(cover)}>{cover.error}，点击重试</View>}
              </View>
            </View>
          </View>

          <View id='club-section-gallery' className='club-form-section'>
            <View className='club-form-section__head'><Text>宣传图集</Text><Text>{gallery.length}/{MAX_CLUB_GALLERY_IMAGES}</Text></View>
            <Text className='club-form-section__description'>可一次选择多张。图片按当前顺序展示，每张可填写最多 60 个字的说明。</Text>
            <View className='club-gallery-editor'>
              {gallery.map((image, index) => (
                <View key={image.key} id={image.media_id ? `club-gallery-draft-${image.media_id}` : undefined} className='club-gallery-draft'>
                  <View className='club-gallery-draft__preview' ariaRole='button' ariaLabel={`预览第 ${index + 1} 张宣传图片`} onClick={() => Taro.previewImage({ current: image.preview_url, urls: gallery.map((item) => item.preview_url) })}>
                    <Image src={image.preview_url} mode='aspectFill' ariaLabel={`第 ${index + 1} 张宣传图片`} />
                    <View className='club-gallery-draft__order'>{index + 1}</View>
                    {image.status === 'uploading' && <View className='club-gallery-draft__progress'><View style={{ width: `${image.progress}%` }} /></View>}
                  </View>
                  <View className='club-gallery-draft__body'>
                    <KeyboardSafeInput value={image.caption} maxlength={60} placeholder='图片说明（可选）' onInput={(event) => updateImage(image.key, (current) => ({ ...current, caption: event.detail.value }))} />
                    <View className='club-gallery-draft__actions'>
                      <View ariaRole='button' ariaLabel={`将第 ${index + 1} 张图片前移`} className={index === 0 ? 'is-disabled' : ''} onClick={() => setGallery((current) => moveGalleryImage(current, index, -1))}>前移</View>
                      <View ariaRole='button' ariaLabel={`将第 ${index + 1} 张图片后移`} className={index === gallery.length - 1 ? 'is-disabled' : ''} onClick={() => setGallery((current) => moveGalleryImage(current, index, 1))}>后移</View>
                      {image.status === 'failed' && <View className='club-gallery-draft__retry' ariaRole='button' ariaLabel={`重试上传第 ${index + 1} 张图片`} onClick={() => void uploadImage(image)}>重试</View>}
                      <View ariaRole='button' ariaLabel={`删除第 ${index + 1} 张宣传图片`} className='is-danger club-gallery-draft__delete' onClick={() => setGallery((current) => normalizeGalleryOrder(current.filter((item) => item.key !== image.key)))}>删除</View>
                    </View>
                    {image.status === 'failed' && <Text className='club-gallery-draft__error'>{image.error}</Text>}
                  </View>
                </View>
              ))}
              {gallery.length < MAX_CLUB_GALLERY_IMAGES && <View id='club-gallery-add' className='club-gallery-add' hoverClass='club-gallery-add--pressed' ariaRole='button' ariaLabel={`添加宣传图片，还可选择 ${MAX_CLUB_GALLERY_IMAGES - gallery.length} 张`} onClick={() => void chooseGallery()}><Image src={require('../../assets/icons/plus.svg')} mode='aspectFit' /><Text>添加宣传图片</Text><Text>还可选择 {MAX_CLUB_GALLERY_IMAGES - gallery.length} 张</Text></View>}
            </View>
          </View>

          <View id='club-section-copy' className='club-form-section'>
            <View className='club-form-section__head'><Text>文字介绍</Text><Text>使用纯文本分段</Text></View>
            <View className='club-field'>
              <Text className='club-field__label'>社团简介 *</Text>
              <KeyboardSafeTextarea id='club-summary' className='club-field__textarea club-field__textarea--short' value={summary} maxlength={200} placeholder='20–200 个字，用于列表和详情摘要' onInput={(event) => setSummary(event.detail.value)} />
              <Text className='club-field__hint'>{summary.trim().length}/200</Text>
            </View>
            <View className='club-field'>
              <Text className='club-field__label'>详细介绍 *</Text>
              <KeyboardSafeTextarea id='club-description' className='club-field__textarea' value={description} maxlength={5000} placeholder='50–5000 个字，可用换行分段介绍社团文化、特色和日常活动' onInput={(event) => setDescription(event.detail.value)} />
              <Text className='club-field__hint'>{description.trim().length}/5000</Text>
            </View>
          </View>

          <View className='club-editor-notice'>公开主页不展示私人手机号、微信号、QQ 等联系方式，请勿在介绍或图片说明中填写。</View>
          <View className='club-editor-actions'>
            <Text className={`club-editor-actions__status ${requiredCompleted === requiredItems.length ? 'club-editor-actions__status--ready' : ''}`}>
              {requiredCompleted === requiredItems.length ? '必填资料已完成' : `必填完成 ${requiredCompleted}/${requiredItems.length}`}
            </Text>
            <View className='club-editor-actions__buttons'>
              <View id='club-save-draft' className='club-editor-actions__secondary' ariaRole='button' ariaLabel='保存社团资料草稿' onClick={() => saving || submitting ? undefined : void saveDraft()}>{saving ? '保存中…' : '保存草稿'}</View>
              <View id='club-submit-review' className='club-editor-actions__primary' ariaRole='button' ariaLabel='提交社团资料审核' onClick={() => saving || submitting ? undefined : void submitReview()}>{submitting ? '提交中…' : '提交审核'}</View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
