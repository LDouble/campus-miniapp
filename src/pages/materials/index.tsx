import { useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
  materials: require('../../assets/icons/materials.svg'),
}
type MaterialKind = '课件' | '笔记' | '真题' | '复习资料'
type Material = {
  id: string
  title: string
  course: string
  kind: MaterialKind
  fileName: string
  fileSize: string
  owner: string
  time: string
  downloads: number
  description: string
}
const courses = ['全部课程', '用户体验设计基础', '海洋科学导论', '数据可视化', '大学英语（四）']
const kinds: Array<'全部类型' | MaterialKind> = ['全部类型', '课件', '笔记', '真题', '复习资料']
const materialKindClass: Record<MaterialKind, string> = {
  课件: 'slides',
  笔记: 'notes',
  真题: 'exam',
  复习资料: 'review',
}
const initialMaterials: Material[] = [
  { id: 'm-ux-notes', title: '用户体验设计基础期中复习笔记', course: '用户体验设计基础', kind: '笔记', fileName: 'UXD-期中复习笔记.pdf', fileSize: '2.8 MB', owner: '海盐同学', time: '今天 10:24', downloads: 126, description: '整理了用户研究、信息架构和可用性测试的核心考点。' },
  { id: 'm-ocean-slides', title: '海洋科学导论第 1—8 章课件', course: '海洋科学导论', kind: '课件', fileName: '海洋科学导论-课件合集.zip', fileSize: '18.6 MB', owner: '林深同学', time: '昨天', downloads: 89, description: '课堂课件整理，按章节命名，适合期中回顾。' },
  { id: 'm-data-exam', title: '数据可视化往年期末题（含解析）', course: '数据可视化', kind: '真题', fileName: '数据可视化-历年真题.pdf', fileSize: '5.1 MB', owner: '小岚', time: '6 月 18 日', downloads: 205, description: '包含两套往年试题与手写解析，仅供学习交流。' },
  { id: 'm-english', title: '大学英语（四）写作模板与词组', course: '大学英语（四）', kind: '复习资料', fileName: 'CET4-写作整理.docx', fileSize: '760 KB', owner: '晨光', time: '6 月 16 日', downloads: 63, description: '议论文、图表作文常用结构及替换表达。' },
]
type Sheet = 'filter' | 'upload' | 'detail' | null

export default function MaterialsPage() {
  const [keyword, setKeyword] = useState('')
  const [course, setCourse] = useState('全部课程')
  const [kind, setKind] = useState<'全部类型' | MaterialKind>('全部类型')
  const [materials, setMaterials] = useState(initialMaterials)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCourse, setUploadCourse] = useState(courses[1])
  const [uploadKind, setUploadKind] = useState<MaterialKind>('笔记')
  const [uploadFile, setUploadFile] = useState('')
  const [uploadFileSize, setUploadFileSize] = useState('1.2 MB')

  const filtered = useMemo(() => materials.filter((item) => {
    const search = keyword.trim().toLowerCase()
    return (!search || `${item.title}${item.course}${item.fileName}`.toLowerCase().includes(search))
      && (course === '全部课程' || item.course === course)
      && (kind === '全部类型' || item.kind === kind)
  }), [course, kind, keyword, materials])
  const filtersActive = course !== '全部课程' || kind !== '全部类型'

  const chooseFile = async () => {
    try {
      const result = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip'],
      })
      const file = result.tempFiles[0]
      if (!file) return
      setUploadFile(file.name)
      setUploadFileSize(file.size >= 1024 * 1024
        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`)
      Taro.showToast({ title: '已选择资料文件', icon: 'success' })
    } catch {
      // 用户主动取消文件选择时保持当前表单，不显示错误。
    }
  }
  const submitUpload = () => {
    if (!uploadTitle.trim() || !uploadFile) {
      Taro.showToast({ title: '请填写标题并选择文件', icon: 'none' })
      return
    }
    setMaterials((current) => [{
      id: `material-${Date.now()}`,
      title: uploadTitle.trim(), course: uploadCourse, kind: uploadKind,
      fileName: uploadFile, fileSize: uploadFileSize, owner: '我', time: '刚刚', downloads: 0,
      description: '由你分享的课程资料，已发布到同学资料库。',
    }, ...current])
    setUploadTitle(''); setUploadFile(''); setUploadFileSize('1.2 MB'); setSheet(null)
    Taro.showToast({ title: '资料已分享', icon: 'success' })
  }

  return <View className={`materials-page ${sheet ? 'materials-page--locked' : ''}`}>
    <CustomNavbar title='课程资料' subtitle='中国海洋大学' showBack />
    <View className='materials-page__content'>
      <View className='materials-search'>
        <Image src={icons.search} mode='aspectFit' />
        <KeyboardSafeInput value={keyword} onInput={(event) => setKeyword(event.detail.value)} confirmType='search' placeholder='搜索课程、资料名称或文件' placeholderClass='materials-search__placeholder' />
        {!!keyword && <Text onClick={() => setKeyword('')}>×</Text>}
      </View>
      <View className='materials-hero'>
        <View><Text className='materials-hero__eyebrow'>海大同学资料库</Text><Text className='materials-hero__title'>把好资料，传给下一位同学</Text><Text className='materials-hero__copy'>已收录 {materials.length + 1268} 份学习资料</Text></View>
        <Image src={icons.materials} mode='aspectFit' />
      </View>
      <View className='materials-actions'>
        <View className={`materials-filter-button ${filtersActive ? 'materials-filter-button--active' : ''}`} onClick={() => setSheet('filter')}><Text>筛选</Text>{filtersActive && <View />}</View>
        <ScrollView scrollX showScrollbar={false} className='materials-course-scroll'><View className='materials-course-list'>{courses.slice(0, 3).map((item) => <View key={item} className={`materials-course-chip ${course === item ? 'materials-course-chip--active' : ''}`} onClick={() => setCourse(item)}>{item}</View>)}</View></ScrollView>
        <View className='materials-upload-button' onClick={() => setSheet('upload')}>分享资料</View>
      </View>
      <View className='materials-heading'><View><Text>资料推荐</Text><Text>{filtersActive || keyword ? '为你筛选的内容' : '本周热门资料'}</Text></View><Text>{filtered.length} 份</Text></View>
      <View className='materials-list'>{filtered.map((item) => <View key={item.id} className='material-card' hoverClass='material-card--pressed' onClick={() => { setActiveMaterial(item); setSheet('detail') }}><View className={`material-card__file material-card__file--${materialKindClass[item.kind]}`}><Text>{item.kind === '课件' ? 'PPT' : item.kind === '真题' ? 'PDF' : 'DOC'}</Text></View><View className='material-card__main'><Text className='material-card__title'>{item.title}</Text><Text className='material-card__course'>{item.course} · {item.kind}</Text><Text className='material-card__meta'>{item.owner} · {item.time} · {item.downloads} 次下载</Text></View><Text className='material-card__arrow'>›</Text></View>)}</View>
      {!filtered.length && <View className='materials-empty'><View /><Text>没有找到相关资料</Text><Text>试试更换关键词或筛选条件</Text></View>}
    </View>
    {sheet && <View className='materials-overlay' onClick={() => setSheet(null)}><View className={`materials-sheet materials-sheet--${sheet}`} onClick={(event) => event.stopPropagation()}><View className='materials-sheet__handle' /><View className='materials-sheet__close' onClick={() => setSheet(null)}>×</View>
      {sheet === 'filter' && <View className='materials-sheet__body'><Text className='materials-sheet__title'>筛选资料</Text><Text className='materials-sheet__label'>课程</Text><View className='materials-option-grid'>{courses.map((item) => <View key={item} className={course === item ? 'materials-option--active' : ''} onClick={() => setCourse(item)}>{item}</View>)}</View><Text className='materials-sheet__label'>资料类型</Text><View className='materials-option-grid'>{kinds.map((item) => <View key={item} className={kind === item ? 'materials-option--active' : ''} onClick={() => setKind(item)}>{item}</View>)}</View><View className='materials-primary' onClick={() => setSheet(null)}>查看资料</View><View className='materials-secondary' onClick={() => { setCourse('全部课程'); setKind('全部类型') }}>清除筛选</View></View>}
      {sheet === 'upload' && <View className='materials-sheet__body'><Text className='materials-sheet__title'>分享课程资料</Text><Text className='materials-sheet__subtitle'>仅分享学习资料，请勿上传涉及版权或隐私的内容</Text><Text className='materials-sheet__label'>资料标题</Text><KeyboardSafeInput value={uploadTitle} onInput={(event) => setUploadTitle(event.detail.value)} className='materials-input' placeholder='例如：期中重点整理' placeholderClass='materials-input__placeholder' /><Text className='materials-sheet__label'>关联课程</Text><ScrollView scrollX showScrollbar={false}><View className='materials-inline-options'>{courses.slice(1).map((item) => <View key={item} className={uploadCourse === item ? 'materials-option--active' : ''} onClick={() => setUploadCourse(item)}>{item}</View>)}</View></ScrollView><Text className='materials-sheet__label'>资料类型</Text><View className='materials-inline-options'>{kinds.slice(1).map((item) => <View key={item} className={uploadKind === item ? 'materials-option--active' : ''} onClick={() => setUploadKind(item as MaterialKind)}>{item}</View>)}</View><View className={`materials-file-pick ${uploadFile ? 'materials-file-pick--ready' : ''}`} onClick={chooseFile}><Text>{uploadFile || '选择资料文件'}</Text><Text>{uploadFile ? '已就绪' : '支持 PDF、Word、PPT'}</Text></View><View className='materials-primary' onClick={submitUpload}>确认分享</View></View>}
      {sheet === 'detail' && activeMaterial && <View className='materials-sheet__body'><View className={`materials-detail-file material-card__file--${materialKindClass[activeMaterial.kind]}`}>{activeMaterial.kind === '课件' ? 'PPT' : activeMaterial.kind === '真题' ? 'PDF' : 'DOC'}</View><Text className='materials-sheet__title'>{activeMaterial.title}</Text><Text className='materials-sheet__subtitle'>{activeMaterial.course} · {activeMaterial.kind}</Text><View className='materials-detail-list'><View><Text>文件名称</Text><Text>{activeMaterial.fileName}</Text></View><View><Text>文件大小</Text><Text>{activeMaterial.fileSize}</Text></View><View><Text>分享同学</Text><Text>{activeMaterial.owner}</Text></View><View><Text>下载次数</Text><Text>{activeMaterial.downloads} 次</Text></View></View><View className='materials-note'><Text>资料说明</Text><Text>{activeMaterial.description}</Text></View><View className='materials-primary' onClick={() => Taro.showToast({ title: '已加入下载队列', icon: 'success' })}>下载资料</View></View>}
    </View></View>}
  </View>
}
