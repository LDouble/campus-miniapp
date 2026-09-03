import { isApiError } from '../../api/client'

// 收藏接口的 404 表示目标资源当前不可公开访问（例如审核中或已取消）。
// 这属于详情页上的正常业务状态，不应打断用户；其他错误仍需提示。
export const isUnavailableFavoriteError = (error: unknown) => (
  isApiError(error) && error.statusCode === 404
)
