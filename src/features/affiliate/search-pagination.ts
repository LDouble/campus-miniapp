/** 上游页码查询可能有重复商品，以原始响应数量和总量共同判断是否继续请求。 */
export const shouldContinueAffiliateSearch = (
  page: number,
  pageSize: number,
  total: number,
  receivedCount: number,
) => (
  page > 0
  && pageSize > 0
  && receivedCount >= pageSize
  && page * pageSize < total
)
