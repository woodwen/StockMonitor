export const APP_NAME = 'Stock Monitor'

export function formatVersionedAppTitle(version: string): string {
  const normalizedVersion = version.trim()
  return normalizedVersion ? `${APP_NAME} v${normalizedVersion}` : APP_NAME
}
