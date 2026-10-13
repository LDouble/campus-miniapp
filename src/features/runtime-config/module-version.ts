/** isMiniappModuleDisabledForVersion 仅在已填写的版本精确命中配置时关闭模块。 */
export const isMiniappModuleDisabledForVersion = (
  disabledVersions: readonly string[] | undefined,
  miniappVersion: string,
) => Boolean(miniappVersion && disabledVersions?.includes(miniappVersion))
