import { Session, CopilotDetail, Settings } from '../../../shared/types'
import { MemoryAnalyzer } from './analyzer'
import { MemoryCollection, AnalysisConfig } from './types'

export * from './types'
export * from './analyzer'

/**
 * 检查会话是否是Character类型的AI搭档对话
 */
export function isCharacterCopilotSession(session: Session, copilots: CopilotDetail[]): boolean {
  if (!session.copilotId) {
    return false
  }

  const copilot = copilots.find(c => c.id === session.copilotId)
  return copilot?.category === 'Character'
}

/**
 * 获取所有Character类型的会话
 */
export function getCharacterCopilotSessions(sessions: Session[], copilots: CopilotDetail[]): Session[] {
  return sessions.filter(session => isCharacterCopilotSession(session, copilots))
}

/**
 * 分析单个Character类型会话的记忆和事件
 */
export async function analyzeCharacterSession(
  session: Session,
  config?: Partial<AnalysisConfig>,
  settings?: Settings
): Promise<MemoryCollection> {
  const analyzer = new MemoryAnalyzer(config, settings)
  return analyzer.analyzeSession(session)
}

/**
 * 批量分析多个Character类型会话
 */
export async function analyzeCharacterSessions(
  sessions: Session[],
  copilots: CopilotDetail[],
  config?: Partial<AnalysisConfig>,
  settings?: Settings
): Promise<MemoryCollection[]> {
  const characterSessions = getCharacterCopilotSessions(sessions, copilots)
  const results: MemoryCollection[] = []

  for (const session of characterSessions) {
    try {
      const collection = await analyzeCharacterSession(session, config, settings)
      results.push(collection)
    } catch (error) {
      console.error(`Failed to analyze session ${session.id}:`, error)
    }
  }

  return results
}

/**
 * 导出为JSON格式
 */
export function exportMemoryCollectionAsJSON(collection: MemoryCollection): string {
  return JSON.stringify(collection, null, 2)
}

/**
 * 导出多个收集结果为JSON格式
 */
export function exportMemoryCollectionsAsJSON(collections: MemoryCollection[]): string {
  return JSON.stringify({
    exportedAt: Date.now(),
    totalSessions: collections.length,
    collections,
  }, null, 2)
}

/**
 * 从JSON恢复记忆收集结果
 */
export function importMemoryCollectionFromJSON(jsonString: string): MemoryCollection | MemoryCollection[] {
  const data = JSON.parse(jsonString)
  
  if (Array.isArray(data)) {
    return data
  }
  
  if (data.collections && Array.isArray(data.collections)) {
    return data.collections
  }
  
  return data
}