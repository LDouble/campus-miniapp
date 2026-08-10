declare namespace Taro {
  interface AppConfig {
    agent?: {
      skills: Array<{
        name: string
        description: string
        path: string
      }>
      pageMetadata?: string
    }
  }
}
