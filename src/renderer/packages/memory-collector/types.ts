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
}

export interface MessageBatch {
  messages: Message[]
  totalLength: number
  startIndex: number
  endIndex: number
}

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
}