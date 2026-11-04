import { Image, Picker, ScrollView, Text, View } from '@tarojs/components'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { MaterialsPlazaUploadDrawer } from './upload-drawer'
import './view.scss'

export type MaterialsPlazaUploadSource = 'file' | 'cloud'

export interface MaterialsPlazaFilter {
  id: string
  label: string
  icon?: string
}

export interface MaterialsPlazaShortcut {
  id: string
  label: string
  keyword: string
  icon: string
  materialType?: string
}

export interface MaterialsPlazaItem {
  id: string
  title: string
  typeLabel: string
  formatLabel?: string
  sizeLabel?: string
  fileCount?: number
  isCollection?: boolean
  courseName?: string
  uploaderName?: string
  createdAtLabel?: string
  downloadCountLabel?: string
  sourceLabel?: string
  copyActionLabel?: string
  tags?: string[]
}

export interface MaterialsPlazaQuota {
  remaining: number
  total: number
  resetHint?: string
  adEntryLabel?: string
  adEntryHint?: string
}

export interface MaterialsPlazaUploadFile {
  id: string
  name: string
  sizeLabel: string
  extensionLabel: string
  statusLabel?: string
  progress?: number
}

export interface MaterialsPlazaCourse {
  id: string
  name: string
}

export interface MaterialsPlazaUploadProps {
  visible: boolean
  source: MaterialsPlazaUploadSource
  files: MaterialsPlazaUploadFile[]
  totalSizeLabel?: string
  maxFileCount?: number
  cloudLink: string
  parsedCloudLinkLabel?: string
  title: string
  typeOptions: MaterialsPlazaFilter[]
  selectedTypeId?: string
  selectedCourses: MaterialsPlazaCourse[]
  suggestedCourses: MaterialsPlazaCourse[]
  rewardCount?: number
  canSubmit: boolean
  submitting?: boolean
  submitLabel?: string
  phaseLabel?: string
  onClose: () => void
  onSourceChange: (source: MaterialsPlazaUploadSource) => void
  onChooseFiles: () => void
  onRemoveFile: (fileId: string) => void
  onClearFiles?: () => void
  onCloudLinkChange: (value: string) => void
  onParseCloudLink: () => void
  onTitleChange: (value: string) => void
  onTypeSelect: (typeId: string) => void
  onCourseToggle: (courseId: string) => void
  onOpenCourseSearch: () => void
  onSubmit: () => void
}

export interface MaterialsPlazaViewProps {
  searchValue: string
  searchPlaceholder?: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  filters?: MaterialsPlazaFilter[]
  selectedFilterId?: string
  onFilterSelect?: (filterId: string) => void
  shortcuts?: MaterialsPlazaShortcut[]
  onShortcutSelect?: (shortcut: MaterialsPlazaShortcut) => void
  sourceFilters?: MaterialsPlazaFilter[]
  selectedSourceFilterId?: string
  onSourceFilterSelect?: (filterId: string) => void
  courseFilterLabel?: string
  onCourseFilterClick?: () => void
  listTitle?: string
  totalCountLabel?: string
  items: MaterialsPlazaItem[]
  quota?: MaterialsPlazaQuota
  quotaLoading?: boolean
  loading?: boolean
  errorMessage?: string
  emptyTitle?: string
  emptyDescription?: string
  upload: MaterialsPlazaUploadProps
  onOpenMine?: () => void
  onRewardEntry?: () => void
  onQuotaRetry?: () => void
  onMaterialOpen?: (item: MaterialsPlazaItem) => void
  onCopyDownloadAddress?: (item: MaterialsPlazaItem) => void
  onOpenUpload: () => void
  onRetry?: () => void
}

const icons = {
  search: require('../../assets/icons/material-search.svg'),
  plus: require('../../assets/icons/material-upload.svg'),
  plazaMark: require('../../assets/icons/material-plaza-mark.svg'),
  lightning: require('../../assets/icons/material-lightning.svg'),
}

/** MaterialsPlazaHeader 展示资料中心标识，并由导航栏预留微信胶囊空间。 */
export function MaterialsPlazaHeader({ campusName, contextLabel, onCampusSelect }: { campusName: string; contextLabel?: string; onCampusSelect: () => void }) {
  return (
    <View className='materials-plaza-view__header'>
      <View className='materials-plaza-view__avatar'><Image src={icons.plazaMark} mode='aspectFit' /></View>
      <View className='materials-plaza-view__heading'>
        <Text className='materials-plaza-view__eyebrow'>{contextLabel || '资料广场'}</Text>
        <View className='materials-plaza-view__campus-selector' ariaRole='button' ariaLabel={`切换校区，当前为${campusName}`} onClick={onCampusSelect}>
          <Text className='materials-plaza-view__title'>{campusName}</Text><Text className='materials-plaza-view__campus-arrow'>⌄</Text>
        </View>
      </View>
    </View>
  )
}

function MaterialsPlazaCard({
  item,
  onOpen,
  onCopy,
}: {
  item: MaterialsPlazaItem
  onOpen?: (item: MaterialsPlazaItem) => void
  onCopy?: (item: MaterialsPlazaItem) => void
}) {
  const metadata = [item.downloadCountLabel, item.courseName, item.uploaderName, item.createdAtLabel]
    .filter((value): value is string => Boolean(value))
  return (
    <View
      className={`materials-plaza-card${onOpen ? ' materials-plaza-card--interactive' : ''}`}
      ariaRole={onOpen ? 'button' : undefined}
      ariaLabel={onOpen ? `查看资料：${item.title}` : undefined}
      onClick={() => onOpen?.(item)}
    >
      <View className='materials-plaza-card__topline'>
        <View className='materials-plaza-card__badges'>
          <Text className='materials-plaza-card__type'>{item.typeLabel}</Text>
          {item.isCollection && <Text className='materials-plaza-card__collection'>资料合辑</Text>}
        </View>
        {item.formatLabel && (
          <View className={`materials-plaza-card__format ${/PDF/i.test(item.formatLabel) ? 'materials-plaza-card__format--pdf' : /ZIP/i.test(item.formatLabel) ? 'materials-plaza-card__format--zip' : ''}`}>
            <View className='materials-plaza-card__format-icon' />
            <Text>{item.formatLabel}{item.sizeLabel ? ` · ${item.sizeLabel}` : ''}</Text>
          </View>
        )}
      </View>

      <Text className='materials-plaza-card__title'>{item.title}</Text>

      {item.tags?.length ? (
        <View className='materials-plaza-card__tags'>
          {item.tags.map((tag) => <Text key={tag}>{tag}</Text>)}
        </View>
      ) : null}

      {metadata.length > 0 && (
        <View className='materials-plaza-card__meta'>
          {metadata.map((value, index) => <Text key={`${index}-${value}`}>{index > 0 ? '· ' : ''}{value}</Text>)}
        </View>
      )}

      {onCopy && (
        <View className='materials-plaza-card__actions'>
          <Text className='materials-plaza-card__action-note'>{item.isCollection ? `资料合辑${item.fileCount ? ` · ${item.fileCount} 个文件` : ''}` : item.sourceLabel || '查看资料详情'}</Text>
          <View
            className='materials-plaza-card__copy-action'
            ariaRole='button'
            ariaLabel={item.copyActionLabel || '复制下载地址'}
            onClick={(event) => {
              event.stopPropagation()
              onCopy(item)
            }}
          >
            <Text>{item.copyActionLabel || '复制下载地址'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export default function MaterialsPlazaView({
  searchValue,
  searchPlaceholder = '搜索课程、真题、笔记…',
  onSearchChange,
  onSearch,
  filters = [],
  selectedFilterId,
  onFilterSelect,
  shortcuts = [],
  onShortcutSelect,
  sourceFilters = [],
  selectedSourceFilterId,
  onSourceFilterSelect,
  courseFilterLabel,
  onCourseFilterClick,
  listTitle = '资料广场',
  totalCountLabel,
  items,
  quota,
  quotaLoading = false,
  loading = false,
  errorMessage,
  emptyTitle = '还没有找到资料',
  emptyDescription = '换个关键词搜索，或上传一份资料和同学分享。',
  upload,
  onOpenMine,
  onRewardEntry,
  onQuotaRetry,
  onMaterialOpen,
  onCopyDownloadAddress,
  onOpenUpload,
  onRetry,
}: MaterialsPlazaViewProps) {
  const hasNoResults = !loading && !errorMessage && items.length === 0
  const typeIndex = Math.max(0, filters.findIndex((filter) => filter.id === selectedFilterId))
  const sourceIndex = Math.max(0, sourceFilters.findIndex((filter) => filter.id === selectedSourceFilterId))

  return (
    <View className='materials-plaza-view'>
      <View className='materials-plaza-view__content'>
        <View className='materials-plaza-search'>
          <Image className='materials-plaza-search__icon' src={icons.search} mode='aspectFit' />
          <KeyboardSafeInput
            className='materials-plaza-search__input'
            value={searchValue}
            placeholder={searchPlaceholder}
            confirmType='search'
            maxlength={100}
            onInput={(event) => onSearchChange(event.detail.value)}
            onConfirm={onSearch}
          />
          {searchValue && (
            <View
              className='materials-plaza-search__clear'
              ariaRole='button'
              ariaLabel='清空搜索内容'
              onClick={() => onSearchChange('')}
            >
              <Text>×</Text>
            </View>
          )}
          <View
            className='materials-plaza-search__submit'
            ariaRole='button'
            ariaLabel='搜索资料'
            onClick={onSearch}
          >
            <Text>搜资料</Text>
          </View>
        </View>

        {shortcuts.length > 0 && (
          <View className='materials-plaza-shortcuts'>
            {shortcuts.map((shortcut) => (
              <View
                key={shortcut.id}
                className='materials-plaza-shortcut'
                ariaRole='button'
                ariaLabel={`搜索${shortcut.label}`}
                onClick={() => onShortcutSelect?.(shortcut)}
              >
                <View className={`materials-plaza-shortcut__icon-wrap materials-plaza-shortcut__icon-wrap--${shortcut.id}`}>
                  <Image className='materials-plaza-shortcut__icon' src={shortcut.icon} mode='aspectFit' />
                </View>
                <Text className='materials-plaza-shortcut__label'>{shortcut.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View className='materials-plaza-quota'>
          <View className='materials-plaza-quota__icon-wrap'>
            <Image className='materials-plaza-quota__icon' src={icons.lightning} mode='aspectFit' />
          </View>
          <View className='materials-plaza-quota__copy'>
            <Text className='materials-plaza-quota__title'>
              {quota ? '今日下载额度：' : '今日下载额度'}
              {quota && <Text className='materials-plaza-quota__count'>{quota.remaining}/{quota.total}次</Text>}
            </Text>
            <Text className='materials-plaza-quota__hint'>
              {quota?.resetHint || (quotaLoading ? '正在获取额度…' : quota ? '下载额度每日刷新' : '暂时未能获取额度，请重试')}
            </Text>
          </View>
          {quota?.adEntryLabel && onRewardEntry && (
            <View
              className='materials-plaza-quota__reward-action'
              ariaRole='button'
              ariaLabel={quota.adEntryLabel}
              onClick={onRewardEntry}
            >
              <Text>{quota.adEntryLabel}</Text>
              {quota.adEntryHint && <Text className='materials-plaza-quota__reward-hint'>{quota.adEntryHint}</Text>}
            </View>
          )}
          {!quota && !quotaLoading && onQuotaRetry && <View className='materials-plaza-quota__retry' ariaRole='button' ariaLabel='重新获取下载额度' onClick={onQuotaRetry}>重试</View>}
        </View>

        <View className='materials-plaza-list-heading'>
          <View className='materials-plaza-list-heading__title-wrap'>
            <View className='materials-plaza-list-heading__marker' />
            <Text className='materials-plaza-list-heading__title'>{listTitle}</Text>
          </View>
          <View className='materials-plaza-list-heading__right'>
            {totalCountLabel && <Text className='materials-plaza-list-heading__count'>{totalCountLabel}</Text>}
            {onOpenMine && <View className='materials-plaza-view__mine-action' ariaRole='button' ariaLabel='打开我的资料' onClick={onOpenMine}>我的资料</View>}
          </View>
        </View>

        <ScrollView className='materials-plaza-filters' scrollX enhanced showScrollbar={false}>
          <View className='materials-plaza-filters__row'>
            {onCourseFilterClick && (
              <View
                className={`materials-plaza-course-filter${courseFilterLabel && courseFilterLabel !== '全部课程' ? ' materials-plaza-course-filter--active' : ''}`}
                ariaRole='button'
                ariaLabel={`按课程筛选：${courseFilterLabel || '全部课程'}`}
                onClick={onCourseFilterClick}
              >
                <Text>{courseFilterLabel || '全部课程'}</Text>
                <Text>⌄</Text>
              </View>
            )}
            {sourceFilters.length > 0 && (
              <Picker
                className='materials-plaza-filters__picker materials-plaza-filters__picker--source'
                mode='selector'
                range={sourceFilters.map((filter) => filter.label)}
                value={sourceIndex}
                onChange={(event) => {
                  const selected = sourceFilters[Number(event.detail.value)]
                  if (selected) onSourceFilterSelect?.(selected.id)
                }}
              >
                <View className='materials-plaza-filter' ariaRole='button' ariaLabel={`按来源筛选：${sourceFilters[sourceIndex].label}`}>
                  <Text>{sourceFilters[sourceIndex].label}</Text><Text className='materials-plaza-filter__arrow'>⌄</Text>
                </View>
              </Picker>
            )}
            {filters.length > 0 && (
              <Picker
                className='materials-plaza-filters__picker materials-plaza-filters__picker--type'
                mode='selector'
                range={filters.map((filter) => filter.label)}
                value={typeIndex}
                onChange={(event) => {
                  const selected = filters[Number(event.detail.value)]
                  if (selected) onFilterSelect?.(selected.id)
                }}
              >
                <View className='materials-plaza-filter' ariaRole='button' ariaLabel={`按类型筛选：${filters[typeIndex].label}`}>
                  <Text>{filters[typeIndex].label}</Text><Text className='materials-plaza-filter__arrow'>⌄</Text>
                </View>
              </Picker>
            )}
          </View>
        </ScrollView>

        <View className='materials-plaza-list'>
          {loading && (
            <View className='materials-plaza-state' ariaRole='status'>
              <Text>正在加载资料…</Text>
            </View>
          )}
          {!loading && errorMessage && (
            <View className='materials-plaza-state materials-plaza-state--error' ariaRole='status'>
              <Text className='materials-plaza-state__title'>{errorMessage}</Text>
              {onRetry && (
                <View className='materials-plaza-state__retry' ariaRole='button' ariaLabel='重新加载资料' onClick={onRetry}>
                  <Text>重试</Text>
                </View>
              )}
            </View>
          )}
          {hasNoResults && (
            <View className='materials-plaza-state'>
              <Text className='materials-plaza-state__title'>{emptyTitle}</Text>
              <Text className='materials-plaza-state__description'>{emptyDescription}</Text>
            </View>
          )}
          {!loading && !errorMessage && items.map((item) => (
            <MaterialsPlazaCard
              key={item.id}
              item={item}
              onOpen={onMaterialOpen}
              onCopy={onCopyDownloadAddress}
            />
          ))}
        </View>
      </View>

      <View
        className='materials-plaza-floating-upload'
        ariaRole='button'
        ariaLabel='上传资料'
        onClick={onOpenUpload}
      >
        <Image src={icons.plus} mode='aspectFit' />
        <Text>投喂资料</Text>
      </View>

      <MaterialsPlazaUploadDrawer upload={upload} />
    </View>
  )
}
