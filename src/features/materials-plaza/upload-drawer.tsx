import { Image, ScrollView, Text, View } from '@tarojs/components'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import type { MaterialsPlazaUploadFile, MaterialsPlazaUploadProps } from './view'
import './upload-drawer.scss'

const fileSourceIcon = require('../../assets/icons/material-source-file.svg')
const cloudSourceIcon = require('../../assets/icons/material-source-cloud.svg')
const clipboardIcon = require('../../assets/icons/material-clipboard.svg')
const lightningIcon = require('../../assets/icons/material-lightning.svg')
const searchIcon = require('../../assets/icons/material-search.svg')
const editIcon = require('../../assets/community/edit.svg')
const uploadIcon = require('../../assets/icons/arrow-up.svg')

export interface MaterialsPlazaUploadDrawerProps {
  /** upload 保存当前抽屉内容和所有交互回调。 */
  upload: MaterialsPlazaUploadProps
}

function getFileKind(file: MaterialsPlazaUploadFile): string {
  const extension = file.extensionLabel.toLowerCase().replace(/^\./, '')
  if (extension === 'pdf') return 'pdf'
  if (['ppt', 'pptx', 'key'].includes(extension)) return 'presentation'
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'spreadsheet'
  if (['zip', 'rar', '7z'].includes(extension)) return 'archive'
  if (['png', 'jpg', 'jpeg', 'gif'].includes(extension)) return 'image'
  return 'document'
}

function getFileBadge(file: MaterialsPlazaUploadFile): string {
  const extension = file.extensionLabel.toUpperCase().replace(/^\./, '')
  if (['PPTX', 'XLSX', 'DOCX', 'JPEG'].includes(extension)) return extension.slice(0, 3)
  return extension.slice(0, 4) || 'FILE'
}

function getFooterNote(upload: MaterialsPlazaUploadProps, fileCount: number): string {
  if (upload.source === 'cloud') return '请确认分享链接可访问；网盘资料不增加下载次数。'
  if (fileCount > 1) return '多文件由客户端打包 ZIP · 发布后可复制合辑下载地址'
  if (fileCount === 1) return '发布成功后可复制资料下载地址'
  return '选择多个文件后，客户端会自动打包为 ZIP 合辑'
}

/** MaterialsPlazaUploadDrawer 展示资料广场上传抽屉并保持现有上传交互。 */
export function MaterialsPlazaUploadDrawer({ upload }: MaterialsPlazaUploadDrawerProps) {
  if (!upload.visible) return null

  const fileCount = upload.files.length
  const selectedCourseIds = new Set(upload.selectedCourses.map((course) => course.id))
  const footerNote = getFooterNote(upload, fileCount)
  const clearFiles = upload.onClearFiles
  const submitLabel = upload.submitting
    ? '正在提交…'
    : upload.submitLabel || (fileCount > 1
      ? `一键打包并发布 ${fileCount} 个文件${upload.totalSizeLabel ? `（共 ${upload.totalSizeLabel}）` : ''}`
      : fileCount === 1 ? '确认发布资料' : '请先添加微信文件')

  return (
    <View className='materials-plaza-upload-drawer__layer' onClick={upload.onClose}>
      <View
        className='materials-plaza-upload-drawer'
        ariaRole='dialog'
        ariaLabel='极速投喂资料'
        onClick={(event) => event.stopPropagation()}
      >
        <View className='materials-plaza-upload-drawer__handle' />

        <View className='materials-plaza-upload-drawer__header'>
          <View className='materials-plaza-upload-drawer__heading'>
            <Text className='materials-plaza-upload-drawer__title'>极速投喂资料</Text>
            {upload.source === 'file' && upload.rewardCount !== undefined && (
              <View className='materials-plaza-upload-drawer__reward'>
                <Image src={lightningIcon} mode='aspectFit' />
                <Text>+{upload.rewardCount} 次下载额度 / 份</Text>
              </View>
            )}
            {upload.source === 'file' && upload.rewardCount === undefined && (
              <View className='materials-plaza-upload-drawer__local-badge'><Text>本机打包</Text></View>
            )}
          </View>
          <View
            className='materials-plaza-upload-drawer__close'
            ariaRole='button'
            ariaLabel='关闭上传资料抽屉'
            onClick={upload.onClose}
          >
            <Text>×</Text>
          </View>
        </View>
        <Text className='materials-plaza-upload-drawer__subtitle'>
          {upload.source === 'file' ? '支持批量微信文件，发布前自动打包 ZIP' : '粘贴网盘分享链接，确认后发布'}
        </Text>

        <ScrollView className='materials-plaza-upload-drawer__body' scrollY enhanced showScrollbar={false}>
          <View className='materials-plaza-upload-drawer__source-panel'>
            <View className='materials-plaza-upload-drawer__source-grid'>
              <View
                className={`materials-plaza-upload-drawer__source materials-plaza-upload-drawer__source--file${upload.source === 'file' ? ' materials-plaza-upload-drawer__source--selected' : ''}${upload.submitting ? ' materials-plaza-upload-drawer__source--disabled' : ''}`}
                ariaRole='button'
                ariaLabel='选择微信文件上传'
                onClick={() => { if (!upload.submitting) upload.onSourceChange('file') }}
              >
                <View className='materials-plaza-upload-drawer__source-main'>
                  <View className='materials-plaza-upload-drawer__source-icon materials-plaza-upload-drawer__source-icon--file'>
                    <Image src={fileSourceIcon} mode='aspectFit' />
                  </View>
                  <View className='materials-plaza-upload-drawer__source-copy'>
                    <Text className='materials-plaza-upload-drawer__source-name'>微信文件</Text>
                  </View>
                </View>
                <Text className='materials-plaza-upload-drawer__source-note'>多选打包 · ZIP 合辑</Text>
                <Text className='materials-plaza-upload-drawer__source-help'>群聊或传输助手中直接选择</Text>
                {upload.source === 'file' && <View className='materials-plaza-upload-drawer__selected-dot' />}
              </View>

              <View
                className={`materials-plaza-upload-drawer__source materials-plaza-upload-drawer__source--cloud${upload.source === 'cloud' ? ' materials-plaza-upload-drawer__source--selected' : ''}${upload.submitting ? ' materials-plaza-upload-drawer__source--disabled' : ''}`}
                ariaRole='button'
                ariaLabel='选择网盘链接导入'
                onClick={() => { if (!upload.submitting) upload.onSourceChange('cloud') }}
              >
                <View className='materials-plaza-upload-drawer__source-main'>
                  <View className='materials-plaza-upload-drawer__source-icon materials-plaza-upload-drawer__source-icon--cloud'>
                    <Image src={cloudSourceIcon} mode='aspectFit' />
                  </View>
                  <View className='materials-plaza-upload-drawer__source-copy'>
                    <Text className='materials-plaza-upload-drawer__source-name'>网盘导入</Text>
                  </View>
                </View>
                <Text className='materials-plaza-upload-drawer__source-note materials-plaza-upload-drawer__source-note--cloud'>百度 / 夸克 / 阿里</Text>
                <Text className='materials-plaza-upload-drawer__source-help'>手动粘贴链接后解析</Text>
                {upload.source === 'cloud' && <View className='materials-plaza-upload-drawer__selected-dot materials-plaza-upload-drawer__selected-dot--cloud' />}
              </View>
            </View>

            {upload.source === 'cloud' && <View className='materials-plaza-upload-drawer__paste-tip'>
              <Image src={clipboardIcon} mode='aspectFit' />
              <Text>网盘链接需由你主动粘贴；不会自动读取剪贴板</Text>
            </View>}
          </View>

          {upload.source === 'file' ? (
            <View className='materials-plaza-upload-drawer__queue'>
              <View className='materials-plaza-upload-drawer__queue-heading'>
                <View className='materials-plaza-upload-drawer__queue-title'>
                  <View className='materials-plaza-upload-drawer__queue-dot' />
                  <Text>
                    已选 {fileCount} 个文件
                    {fileCount > 0 && upload.totalSizeLabel ? <Text className='materials-plaza-upload-drawer__queue-size'>（文件共 {upload.totalSizeLabel}）</Text> : null}
                  </Text>
                </View>
                <View className='materials-plaza-upload-drawer__zip-badge'><Text>ZIP 合辑</Text></View>
              </View>

              {fileCount > 0 ? (
                <ScrollView
                  className='materials-plaza-upload-drawer__file-scroll'
                  scrollY
                  enhanced
                  showScrollbar={false}
                  style={{ height: `${Math.min(fileCount * 90, 560)}rpx` }}
                >
                  <View className='materials-plaza-upload-drawer__file-list'>
                    {upload.files.map((file) => (
                      <View key={file.id} className='materials-plaza-upload-drawer__file'>
                        <View className={`materials-plaza-upload-drawer__file-icon materials-plaza-upload-drawer__file-icon--${getFileKind(file)}`}>
                          <Text>{getFileBadge(file)}</Text>
                        </View>
                        <View className='materials-plaza-upload-drawer__file-info'>
                          <Text className='materials-plaza-upload-drawer__file-name'>{file.name}</Text>
                          <Text className={`materials-plaza-upload-drawer__file-meta${file.statusLabel && file.statusLabel !== '待上传' ? ' materials-plaza-upload-drawer__file-meta--status' : ''}`}>
                            {file.statusLabel && file.statusLabel !== '待上传' ? `${file.statusLabel} · ` : ''}{file.sizeLabel}
                          </Text>
                          {file.progress !== undefined && (
                            <View className='materials-plaza-upload-drawer__progress-track'>
                              <View
                                className='materials-plaza-upload-drawer__progress-value'
                                style={{ width: `${Math.max(0, Math.min(file.progress, 100))}%` }}
                              />
                            </View>
                          )}
                        </View>
                        <View className='materials-plaza-upload-drawer__file-trailing'>
                          <View className={`materials-plaza-upload-drawer__remove${upload.submitting ? ' materials-plaza-upload-drawer__remove--disabled' : ''}`}
                            ariaRole='button'
                            ariaLabel={`移除文件 ${file.name}`}
                            onClick={() => { if (!upload.submitting) upload.onRemoveFile(file.id) }}
                          ><Text>×</Text></View>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View className='materials-plaza-upload-drawer__empty'>
                  <View className='materials-plaza-upload-drawer__empty-icon'><Image src={fileSourceIcon} mode='aspectFit' /></View>
                  <Text className='materials-plaza-upload-drawer__empty-title'>暂未添加微信文件</Text>
                  <Text className='materials-plaza-upload-drawer__empty-description'>支持从微信聊天、文件传输助手批量勾选课件与资料，将在本机打包为合辑。</Text>
                  <View className='materials-plaza-upload-drawer__empty-choose' ariaRole='button' ariaLabel='去微信聊天或文件传输助手选择文件' onClick={() => { if (!upload.submitting) upload.onChooseFiles() }}>
                    <Text className='materials-plaza-upload-drawer__empty-plus'>＋</Text>
                    <Text>去微信聊天 / 文件传输助手选择文件</Text>
                  </View>
                </View>
              )}

              {fileCount > 0 ? <View className='materials-plaza-upload-drawer__queue-actions'>
                <View
                  className='materials-plaza-upload-drawer__choose-files'
                  ariaRole='button'
                  ariaLabel='继续从微信添加文件'
                  onClick={() => { if (!upload.submitting) upload.onChooseFiles() }}
                >
                  <Text>＋ {fileCount > 0 ? '继续添加' : '选择文件'}</Text>
                </View>
                {clearFiles && <View className={`materials-plaza-upload-drawer__clear-files${upload.submitting ? ' materials-plaza-upload-drawer__clear-files--disabled' : ''}`} ariaRole='button' ariaLabel='清空全部已选文件' onClick={() => { if (!upload.submitting) clearFiles() }}><Text>清空全部</Text></View>}
              </View> : null}
              <Text className='materials-plaza-upload-drawer__file-limit'>单次最多选择 {upload.maxFileCount ?? 100} 个文件 · 将在本机自动打包为 ZIP</Text>
              {upload.phaseLabel && <Text className='materials-plaza-upload-drawer__phase'>{upload.phaseLabel}</Text>}
            </View>
          ) : (
            <View className='materials-plaza-upload-drawer__cloud'>
              <View className='materials-plaza-upload-drawer__cloud-heading'>
                <Text className='materials-plaza-upload-drawer__section-title'>粘贴网盘分享链接</Text>
                <Text className='materials-plaza-upload-drawer__cloud-caption'>请手动粘贴链接和提取码</Text>
              </View>
              <KeyboardSafeTextarea
                className='materials-plaza-upload-drawer__cloud-input'
                value={upload.cloudLink}
                placeholder='长按输入框，粘贴网盘分享链接'
                maxlength={1000}
                autoHeight
                onInput={(event) => upload.onCloudLinkChange(event.detail.value)}
              />
              <View className='materials-plaza-upload-drawer__cloud-footer'>
                {upload.parsedCloudLinkLabel
                  ? <Text className='materials-plaza-upload-drawer__parsed-link'>{upload.parsedCloudLinkLabel}</Text>
                  : <Text className='materials-plaza-upload-drawer__cloud-hint'>粘贴后点击解析，不会自动读取剪贴板</Text>}
                <View
                  className='materials-plaza-upload-drawer__parse-action'
                  ariaRole='button'
                  ariaLabel='解析网盘链接'
                  onClick={upload.onParseCloudLink}
                >
                  <Text>{upload.parsedCloudLinkLabel ? '重新解析' : '解析链接'}</Text>
                </View>
              </View>
            </View>
          )}

          <View className='materials-plaza-upload-drawer__metadata'>
            <View className='materials-plaza-upload-drawer__metadata-heading'>
              <View>
                <Text className='materials-plaza-upload-drawer__section-title'>完善资料档案</Text>
              </View>
            </View>

            <View className='materials-plaza-upload-drawer__title-label-row'>
              <Text className='materials-plaza-upload-drawer__field-label'>资料标题 <Text className='materials-plaza-upload-drawer__required'>*</Text></Text>
              <Text className='materials-plaza-upload-drawer__title-count'>{upload.title.length}/80 字</Text>
            </View>
            <View className='materials-plaza-upload-drawer__title-card'>
              <View className='materials-plaza-upload-drawer__title-copy'>
                <KeyboardSafeInput
                  className='materials-plaza-upload-drawer__title-input'
                  value={upload.title}
                  placeholder='给这份资料起个清晰易懂的标题'
                  maxlength={80}
                  onInput={(event) => upload.onTitleChange(event.detail.value)}
                />
              </View>
              <Image className='materials-plaza-upload-drawer__edit-icon' src={editIcon} mode='aspectFit' />
            </View>

            <View className='materials-plaza-upload-drawer__association'>
              <View className='materials-plaza-upload-drawer__association-heading'>
                <View className='materials-plaza-upload-drawer__association-copy'>
                  <Text className='materials-plaza-upload-drawer__field-label'>关联课程与分类</Text>
                  <Text className='materials-plaza-upload-drawer__association-caption'>选填 · 关联课程后更容易被同学找到</Text>
                </View>
                <View
                  className='materials-plaza-upload-drawer__course-search'
                  ariaRole='button'
                  ariaLabel='搜索课程'
                  onClick={upload.onOpenCourseSearch}
                >
                  <Image src={searchIcon} mode='aspectFit' />
                  <Text>搜索课程</Text>
                </View>
              </View>

              {(upload.selectedCourses.length > 0 || upload.suggestedCourses.length > 0) ? (
                  <View className='materials-plaza-upload-drawer__course-list'>
                    {upload.selectedCourses.map((course) => (
                      <View
                        key={`selected-${course.id}`}
                        className='materials-plaza-upload-drawer__course-chip materials-plaza-upload-drawer__course-chip--selected'
                        ariaRole='button'
                        ariaLabel={`取消关联${course.name}`}
                        onClick={() => upload.onCourseToggle(course.id)}
                      >
                        <Text>{course.name}</Text>
                        <Text className='materials-plaza-upload-drawer__course-check'>✓</Text>
                      </View>
                    ))}
                    {upload.suggestedCourses.filter((course) => !selectedCourseIds.has(course.id)).map((course) => (
                      <View
                        key={`suggested-${course.id}`}
                        className='materials-plaza-upload-drawer__course-chip'
                        ariaRole='button'
                        ariaLabel={`关联课程${course.name}`}
                        onClick={() => upload.onCourseToggle(course.id)}
                      >
                        <Text>{course.name}</Text>
                      </View>
                    ))}
                  </View>
              ) : (
                <Text className='materials-plaza-upload-drawer__empty-courses'>暂无课程建议，可通过搜索关联</Text>
              )}
            </View>

            {upload.typeOptions.length > 0 && (
              <View className='materials-plaza-upload-drawer__types'>
                <Text className='materials-plaza-upload-drawer__field-label'>资料类型</Text>
                  <View className='materials-plaza-upload-drawer__type-list'>
                    {upload.typeOptions.map((type) => (
                      <View
                        key={type.id}
                        className={upload.selectedTypeId === type.id
                          ? 'materials-plaza-upload-drawer__type-chip materials-plaza-upload-drawer__type-chip--selected'
                          : 'materials-plaza-upload-drawer__type-chip'}
                        ariaRole='button'
                        ariaLabel={`资料类型：${type.label}`}
                        onClick={() => upload.onTypeSelect(type.id)}
                      >
                        <Text>{type.label}</Text>
                      </View>
                    ))}
                  </View>
              </View>
            )}
          </View>

          <View className='materials-plaza-upload-drawer__copyright'>
            <Text>请确保上传的课件与笔记符合版权规范，勿上传带有商业排他水印或保密试卷文件。</Text>
          </View>

        </ScrollView>

        <View className='materials-plaza-upload-drawer__footer'>
          <View
            className={`materials-plaza-upload-drawer__submit${upload.canSubmit && !upload.submitting ? ' materials-plaza-upload-drawer__submit--ready' : ' materials-plaza-upload-drawer__submit--disabled'}`}
            ariaRole='button'
            ariaLabel={submitLabel}
            onClick={() => {
              if (upload.canSubmit && !upload.submitting) upload.onSubmit()
            }}
          >
            <Image className='materials-plaza-upload-drawer__submit-icon' src={uploadIcon} mode='aspectFit' />
            <Text>{submitLabel}</Text>
          </View>
          <Text className='materials-plaza-upload-drawer__footer-note'>{footerNote}</Text>
        </View>
      </View>
    </View>
  )
}

export default MaterialsPlazaUploadDrawer
