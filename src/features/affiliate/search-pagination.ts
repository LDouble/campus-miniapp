/** 上游会过滤无效商品，按总量与当前页边界判断是否还有后页。 */
export const shouldContinueAffiliateSearch = (
  page: number,
  pageSize: number,
  total: number,
) => (
  page > 0
  && pageSize > 0
  && page * pageSize < total
)
