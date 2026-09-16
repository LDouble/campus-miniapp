// 返回列表时只更新已有卡片，不因服务端排序变化插入、删除或重排卡片。
// 完整结果集和顺序由主动刷新、筛选和搜索同步。
export const mergeVisibleCats = <T extends { id: number | string }>(
  current: T[],
  refreshed: T[],
): T[] => {
  const byId = new Map(refreshed.map((item) => [item.id, item]))
  return current.map((item) => byId.get(item.id) || item)
}
