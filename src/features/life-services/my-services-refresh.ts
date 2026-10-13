/** resolveMyServicesDidShowRefresh 决定我的服务页恢复前台后的单次刷新动作。 */
export const resolveMyServicesDidShowRefresh = (
  firstDidShow: boolean,
  modulesChanged: boolean,
  viewChanged: boolean,
) => {
  if (modulesChanged) return viewChanged ? 'normalize' : 'reload'
  return firstDidShow ? 'skip' : 'reload'
}
