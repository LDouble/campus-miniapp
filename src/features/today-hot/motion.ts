/** 微信 getSystemSetting 同步返回；同时兼容其他端的异步适配。 */
export async function readReducedMotion(
  getSettings: (() => unknown) | undefined,
  fallback: () => boolean,
): Promise<boolean> {
  try {
    const settings = await getSettings?.() as { reduceMotion?: boolean; reduce_motion?: boolean } | undefined
    return Boolean(settings?.reduceMotion || settings?.reduce_motion) || fallback()
  } catch {
    return fallback()
  }
}
