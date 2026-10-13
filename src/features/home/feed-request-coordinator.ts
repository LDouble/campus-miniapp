/** createHomeFeedRequestCoordinator 协调首页 Feed 与配置的独立请求代次。 */
export const createHomeFeedRequestCoordinator = () => {
  let feedGeneration = 0
  let configGeneration = 0

  return {
    beginFeed: () => ++feedGeneration,
    invalidateFeed: () => ++feedGeneration,
    isFeedCurrent: (generation: number) => generation === feedGeneration,
    beginConfig: () => ++configGeneration,
    isConfigCurrent: (generation: number) => generation === configGeneration,
  }
}
