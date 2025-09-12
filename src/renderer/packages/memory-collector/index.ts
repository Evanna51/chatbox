import { Session, CopilotDetail, Settings } from '../../../shared/types'
import { MemoryAnalyzer } from './analyzer'
import { MemoryCollection, AnalysisConfig } from './types'

export * from './types'
export * from './analyzer'

/**
 * 检查会话是否是Character类型的AI搭档对话（保留用于兼容性）
 */
export function isCharacterCopilotSession(session: Session, copilots: CopilotDetail[]): boolean {
  if (!session.copilotId) {
    return false
  }

  const copilot = copilots.find(c => c.id === session.copilotId)
  return copilot?.category === 'Character'
}

/**
 * 分析单个会话的记忆和事件
 */
export async function analyzeSession(
  session: Session,
  config?: Partial<AnalysisConfig>,
  settings?: Settings
): Promise<MemoryCollection> {
  const analyzer = new MemoryAnalyzer(config, settings)
  return analyzer.analyzeSession(session)
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
 * 导出对话总结为JSON格式
 */
export function exportConversationSummaryAsJSON(collection: MemoryCollection): string {
  if (!collection.conversationSummary) {
    throw new Error('该收集结果不包含对话总结数据')
  }
  
  return JSON.stringify({
    sessionId: collection.sessionId,
    copilotName: collection.copilotName,
    exportedAt: Date.now(),
    analysisType: 'conversation_summary',
    summary: collection.conversationSummary,
    metadata: {
      totalMessages: collection.totalMessages,
      analyzedMessages: collection.analyzedMessages,
      collectedAt: collection.collectedAt,
    }
  }, null, 2)
}

/**
 * 导出小说大纲为JSON格式
 */
export function exportNovelOutlineAsJSON(collection: MemoryCollection): string {
  if (!collection.novelOutline) {
    throw new Error('该收集结果不包含小说大纲数据')
  }
  
  return JSON.stringify({
    sessionId: collection.sessionId,
    copilotName: collection.copilotName,
    exportedAt: Date.now(),
    analysisType: 'novel_outline',
    outline: collection.novelOutline,
    metadata: {
      totalMessages: collection.totalMessages,
      analyzedMessages: collection.analyzedMessages,
      collectedAt: collection.collectedAt,
    }
  }, null, 2)
}

/**
 * 导出对话总结为Markdown格式
 */
export function exportConversationSummaryAsMarkdown(collection: MemoryCollection): string {
  if (!collection.conversationSummary) {
    throw new Error('该收集结果不包含对话总结数据')
  }
  
  const summary = collection.conversationSummary
  const lines: string[] = []
  
  lines.push(`# 对话总结分析`)
  lines.push(``)
  lines.push(`**会话名称：** ${collection.copilotName}`)
  lines.push(`**分析时间：** ${new Date(collection.collectedAt).toLocaleString()}`)
  lines.push(`**消息数量：** ${collection.totalMessages} 条（已分析 ${collection.analyzedMessages} 条）`)
  lines.push(``)
  
  lines.push(`## 主要话题`)
  summary.mainTopics.forEach(topic => {
    lines.push(`- ${topic}`)
  })
  lines.push(``)
  
  lines.push(`## 关键信息`)
  summary.keyInformation.forEach(info => {
    lines.push(`- ${info}`)
  })
  lines.push(``)
  
  lines.push(`## 情绪分析`)
  lines.push(`**整体情绪：** ${summary.emotionalTone.overall}`)
  lines.push(`**情绪详情：** ${summary.emotionalTone.details}`)
  lines.push(``)
  lines.push(`**user情绪：** ${summary.participantMoods.user}`)
  lines.push(`**assistant情绪：** ${summary.participantMoods.assistant}`)
  lines.push(``)
  
  lines.push(`## 对话流程`)
  lines.push(summary.conversationFlow)
  lines.push(``)
  
  lines.push(`## 主要结论`)
  summary.conclusions.forEach(conclusion => {
    lines.push(`- ${conclusion}`)
  })
  
  return lines.join('\n')
}

/**
 * 导出小说大纲为Markdown格式
 */
export function exportNovelOutlineAsMarkdown(collection: MemoryCollection): string {
  if (!collection.novelOutline) {
    throw new Error('该收集结果不包含小说大纲数据')
  }
  
  const outline = collection.novelOutline
  const lines: string[] = []
  
  lines.push(`# 小说大纲`)
  lines.push(``)
  lines.push(`**会话名称：** ${collection.copilotName}`)
  lines.push(`**分析时间：** ${new Date(collection.collectedAt).toLocaleString()}`)
  lines.push(`**消息数量：** ${collection.totalMessages} 条（已分析 ${collection.analyzedMessages} 条）`)
  lines.push(``)
  
  lines.push(`## 基本信息`)
  lines.push(`**类型：** ${outline.genre}`)
  lines.push(`**时间背景：** ${outline.setting.time}`)
  lines.push(`**地点背景：** ${outline.setting.place}`)
  lines.push(`**世界观：** ${outline.setting.worldBuilding}`)
  lines.push(``)
  
  lines.push(`## 角色设定`)
  outline.characters.forEach(character => {
    lines.push(`### ${character.name} (${character.role})`)
    lines.push(character.description)
    lines.push(`**特征：** ${character.traits.join('、')}`)
    lines.push(``)
  })
  
  lines.push(`## 情节结构`)
  lines.push(`**开端：** ${outline.plotStructure.setup}`)
  lines.push(`**起始事件：** ${outline.plotStructure.incitingIncident}`)
  lines.push(`**发展：**`)
  outline.plotStructure.risingAction.forEach(action => {
    lines.push(`- ${action}`)
  })
  lines.push(`**高潮：** ${outline.plotStructure.climax}`)
  lines.push(`**下降：** ${outline.plotStructure.fallingAction}`)
  lines.push(`**结局：** ${outline.plotStructure.resolution}`)
  lines.push(``)
  
  lines.push(`## 主题`)
  outline.themes.forEach(theme => {
    lines.push(`- ${theme}`)
  })
  lines.push(``)
  
  lines.push(`## 冲突`)
  outline.conflicts.forEach(conflict => {
    lines.push(`### ${conflict.type} 冲突`)
    lines.push(conflict.description)
    lines.push(``)
  })
  
  lines.push(`## 关键场景`)
  outline.keyScenes.forEach(scene => {
    lines.push(`### ${scene.title}`)
    lines.push(scene.description)
    lines.push(`**重要性：** ${scene.importance}`)
    lines.push(``)
  })
  
  return lines.join('\n')
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