// 记忆和事件收集器的类型定义
import { Message } from '../../../shared/types'

export interface MemoryItem {
  id: string
  type: 'personal' | 'preference' | 'skill' | 'relationship' | 'other'
  content: string
  source: string // 来源消息ID
  timestamp: number
  confidence: number // 0-1 置信度
  tags: string[]
}

export interface EventItem {
  id: string
  type: 'conversation' | 'decision' | 'achievement' | 'problem' | 'other'
  title: string
  description: string
  participants: string[]
  source: string // 来源消息ID
  timestamp: number
  context: string
  outcome?: string
  tags: string[]
}

// 对话总结分析结果
export interface ConversationSummary {
  mainTopics: string[] // 主要话题
  keyInformation: string[] // 关键信息点
  emotionalTone: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed'
    details: string // 情绪详细描述
  }
  participantMoods: {
    user: string // user情绪状态
    assistant: string // assistant情绪状态
  }
  conversationFlow: string // 对话流程总结
  conclusions: string[] // 对话结论
  // 下面字段为增强项，用于与“自动总结对话”风格对齐（可选）
  summary?: string // 总览性总结（更短）
  keyPoints?: string[] // 关键要点
  userHighlights?: string[] // 用户的目标/决策/约束等要点
  timestamp?: number // 生成时间戳
  timeline?: Array<{
    index: number // 原始消息序号（从1开始）
    role: 'user' | 'assistant' | 'system' | 'tool'
    time?: string | number // ISO或数字时间戳
    brief: string // 单行摘要（压缩且高信息密度）
    type?: 'user_intent' | 'ai_answer' | 'clarification' | 'decision' | 'other'
  }>
}

// 小说大纲分析结果
export interface NovelOutline {
  genre: string // 小说类型/题材
  setting: {
    time: string // 时间背景
    place: string // 地点背景
    worldBuilding: string // 世界观设定
  }
  characters: {
    name: string
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
    description: string
    traits: string[]
  }[]
  plotStructure: {
    setup: string // 开端
    incitingIncident: string // 起始事件
    risingAction: string[] // 发展
    climax: string // 高潮
    fallingAction: string // 下降
    resolution: string // 结局
  }
  themes: string[] // 主题
  conflicts: {
    type: 'internal' | 'external' | 'interpersonal' | 'societal'
    description: string
  }[]
  keyScenes: {
    title: string
    description: string
    importance: string
  }[]
}

export interface MemoryCollection {
  sessionId: string
  copilotId: string
  copilotName: string
  collectedAt: number
  memories: MemoryItem[]
  events: EventItem[]
  summary: string
  totalMessages: number
  analyzedMessages: number
  // 新增的分析结果
  conversationSummary?: ConversationSummary
  novelOutline?: NovelOutline
}

export interface MessageBatch {
  messages: Message[]
  totalLength: number
  startIndex: number
  endIndex: number
}

export type AnalysisMode = 'default' | 'conversation_summary' | 'novel_outline'

export interface AnalysisConfig {
  includeSystemMessages: boolean
  minConfidence: number
  maxMemoriesPerSession: number
  maxEventsPerSession: number
  enabledMemoryTypes: MemoryItem['type'][]
  enabledEventTypes: EventItem['type'][]
  useAIAnalysis: boolean // 是否使用AI智能分析
  maxBatchTokens: number // 批处理的最大token数量
  estimatedTokensPerChar: number // 每个字符的估计token数（用于粗略计算）
  analysisMode: AnalysisMode // 分析模式
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  includeSystemMessages: false,
  minConfidence: 0.6,
  maxMemoriesPerSession: 50,
  maxEventsPerSession: 20,
  enabledMemoryTypes: ['personal', 'preference', 'skill', 'relationship', 'other'],
  enabledEventTypes: ['conversation', 'decision', 'achievement', 'problem', 'other'],
  useAIAnalysis: true,
  maxBatchTokens: 64000, // 默认64K tokens
  estimatedTokensPerChar: 0.75, // 中文大约每个字符0.75个token
  analysisMode: 'default', // 默认分析模式
}