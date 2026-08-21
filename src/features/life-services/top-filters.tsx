import { View } from '@tarojs/components'
import type { CampusName } from './campus'
import type { LifeHubSection } from './business-theme'
import CampusSelector from './components/campus-selector'
import CarpoolFilters, {
  type CarpoolFilterValue,
} from './components/carpool-filters'
import MarketplaceFilters, {
  type MarketplaceFilterValue,
} from './components/marketplace-filters'
import './top-filters.scss'

export type LifeServiceFilterSection = Exclude<LifeHubSection, 'community'>

type Props = {
  section: LifeServiceFilterSection
  campus: CampusName | ''
  marketFilters: MarketplaceFilterValue
  carpoolFilters: CarpoolFilterValue
  onCampusChange: (value: CampusName | '') => void
  onMarketFiltersChange: (value: MarketplaceFilterValue) => void
  onCarpoolFiltersChange: (value: CarpoolFilterValue) => void
}

const campusControl = (
  campus: CampusName | '',
  onCampusChange: (value: CampusName | '') => void,
) => (
  <CampusSelector
    value={campus}
    allowAll
    label='筛选校区'
    topbar
    onChange={onCampusChange}
  />
)

export default function LifeServiceTopFilters({
  section,
  campus,
  marketFilters,
  carpoolFilters,
  onCampusChange,
  onMarketFiltersChange,
  onCarpoolFiltersChange,
}: Props) {
  if (section === 'market') {
    return (
      <MarketplaceFilters
        value={marketFilters}
        campusControl={campusControl(campus, onCampusChange)}
        onChange={onMarketFiltersChange}
      />
    )
  }

  if (section === 'carpool') {
    return (
      <CarpoolFilters
        value={carpoolFilters}
        campusControl={campusControl(campus, onCampusChange)}
        onChange={onCarpoolFiltersChange}
      />
    )
  }

  return (
    <View className='errand-filter-toolbar life-service-filter-toolbar'>
      {campusControl(campus, onCampusChange)}
      <View className='life-service-filter-toolbar__divider' />
      <CampusSelector
        value={campus}
        allowAll
        label='筛选校区'
        topbar
        iconOnly
        onChange={onCampusChange}
      />
    </View>
  )
}
