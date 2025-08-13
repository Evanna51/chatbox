import platform from '@/platform'

export const featureFlags = {
  mcp: platform.type === 'desktop',
  knowledgeBase: platform.type === 'desktop' || platform.type === 'mobile', // 使用简单的移动端知识库
}
