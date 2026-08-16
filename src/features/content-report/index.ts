import Taro from '@tarojs/taro'
import type { components } from '../../api/generated/schema'

export type ReportableResourceType =
  components['schemas']['ContentReportResourceType']

export type ReportableTarget = {
  resourceType: ReportableResourceType
  resourceId: number
  resourceVersion: number
}

export const openContentReport = (target: ReportableTarget) => (
  Taro.navigateTo({
    url: `/packages/social/content-report/index?resource_type=${target.resourceType}&resource_id=${target.resourceId}&resource_version=${target.resourceVersion}`,
  })
)
