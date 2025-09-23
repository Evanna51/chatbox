import { generateText } from 'ai'
import { createMessage, Message } from '../../../shared/types'
import { createSummaryMessage, getMessageText } from '../../../shared/utils/message'
import { convertToCoreMessages } from './message-utils'
import type { ModelInterface } from '../../../shared/models/types'

/**
 * AI总结响应的JSON格式接口
 */
interface SummaryTimelineItem {
  index: number
  role: 'user' | 'assistant' | 'system' | 'tool'
  time?: number | string
  brief: string
  type?: 'user_intent' | 'ai_answer' | 'clarification' | 'decision' | 'other'
}

function sanitizeSummaryData(input: any, fallbackRange?: { startIndex: number; endIndex: number }): SummaryResponse {
  const toStringOrJson = (v: any): string =>
    typeof v === 'string' ? v : (v == null ? '' : JSON.stringify(v))

  const summary = toStringOrJson(input?.summary)
  const context = toStringOrJson(input?.context)
  const keyPoints: string[] = Array.isArray(input?.keyPoints)
    ? input.keyPoints.map((kp: any) => toStringOrJson(kp))
    : []

  let timeline: SummaryTimelineItem[] = []
  if (Array.isArray(input?.timeline)) {
    timeline = input.timeline.map((raw: any, i: number) => {
      const brief = toStringOrJson(raw?.brief)
      const idx = Number.isFinite(raw?.index) ? Number(raw.index) : (fallbackRange ? fallbackRange.startIndex + i : i)
      const roleRaw = raw?.role
      const role: any = roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' || roleRaw === 'tool'
        ? roleRaw
        : 'assistant'
      const time = typeof raw?.time === 'string' || typeof raw?.time === 'number' ? raw.time : undefined
      const type = raw?.type === 'user_intent' || raw?.type === 'ai_answer' || raw?.type === 'clarification' || raw?.type === 'decision' || raw?.type === 'other'
        ? raw.type
        : undefined
      return { index: idx, role, time, brief, type }
    })
  }

  const userHighlights: string[] = Array.isArray(input?.userHighlights)
    ? input.userHighlights.map((v: any) => toStringOrJson(v))
    : []

  const compressionStats = input?.compressionStats && typeof input.compressionStats === 'object'
    ? {
        aiTokensReduced: typeof input.compressionStats.aiTokensReduced === 'number' ? input.compressionStats.aiTokensReduced : undefined,
        messagesCollapsed: typeof input.compressionStats.messagesCollapsed === 'number' ? input.compressionStats.messagesCollapsed : undefined,
      }
    : undefined

  const timestamp = typeof input?.timestamp === 'number' ? input.timestamp : Date.now()
  const range = input?.range && typeof input.range === 'object' ? input.range : fallbackRange

  return { summary, keyPoints, context, timestamp, timeline, userHighlights, compressionStats, range }
}

function formatDisplayTime(time: number | string | undefined): string {
  if (time === undefined || time === null) return ''
  try {
    if (typeof time === 'number') {
      // 使用本地格式时间，天然不含毫秒
      return new Date(time).toLocaleString()
    }
    if (typeof time === 'string') {
      const d = new Date(time)
      if (!isNaN(d.getTime())) {
        return d.toLocaleString()
      }
      // 去掉毫秒部分
      return time.replace(/\.(\d{1,3})(?=Z|[+-]\d{2}:?\d{2}$)/, '')
    }
  } catch {}
  return ''
}

interface SummaryResponse {
  summary: string
  keyPoints: string[]
  context: string
  timestamp: number
  timeline?: SummaryTimelineItem[]
  userHighlights?: string[]
  compressionStats?: {
    aiTokensReduced?: number
    messagesCollapsed?: number
  }
  range?: { startIndex: number; endIndex: number }
}

/**
 * 使用AI对消息列表进行总结
 * @param model 用于总结的AI模型
 * @param messages 需要总结的消息列表
 * @param onProgress 进度回调函数
 * @returns 总结后的JSON格式内容
 */
export async function summarizeMessages(
  model: ModelInterface,
  messages: Message[],
  onProgress?: (progress: string) => void
): Promise<SummaryResponse> {
  // 构造总结的提示词（强调压缩 AI 输出、保留用户关键信息，并生成时间线）
  const historyForPrompt = messages.map((msg, index) => {
    const ts = (msg as any).timestamp ? new Date((msg as any).timestamp).toISOString() : 'NA'
    return `${index + 1}. [${ts}] ${msg.role}: ${getMessageText(msg)}`
  }).join('\n')

  const summaryPrompt = createMessage('user', `请对以下对话进行“压缩总结”，并仅用 JSON 返回结果：

目标：
1) 大幅压缩助手(assistant)的输出：删除赘述，只保留结论/答案/关键参数；
2) 完整记录用户(user)的“主动输出/意图/决策/约束条件”等关键信息；
3) 生成包含时间轴/时间线的事件列表，便于快速回溯；
4) 产物可直接作为后续上下文使用。

输出 JSON 字段要求：
- summary: 对话主线与结论的综述（字符串，尽量短小精悍）
- keyPoints: 关键要点列表（字符串数组，按重要性排序）
- context: 后续继续对话最需要保留的上下文（字符串）
- timestamp: 生成时间戳（数字）
- timeline: 事件时间线（数组，按时间顺序），每项包含：
  - index: 原始消息的序号（数字）
  - role: "user" | "assistant" | "system" | "tool"
  - time: 原始时间（ISO 或数字，若未知可省略）
  - brief: 该条消息的单行摘要（严格限制：user≤120字，assistant≤60字，保留信息密度）
  - type: 可选，"user_intent" | "ai_answer" | "clarification" | "decision" | "other"
- userHighlights: 用户的目标/决策/约束等要点（字符串数组）
- compressionStats: 可选，压缩统计，如 { aiTokensReduced, messagesCollapsed }

注意：
- 对 assistant 的长文本务必强力压缩，避免复述；
- 允许合并多段相近的 assistant 输出；
- 尽量以动词开头编写 keyPoints 与 userHighlights；
- 仅返回 JSON，不要任何多余文字或解释。

对话历史（含时间戳）：
${historyForPrompt}`)

  const coreMessages = await convertToCoreMessages([summaryPrompt], {
    modelSupportVision: model.isSupportVision(),
  })

  try {
    // 通知开始总结
    onProgress?.('分析对话内容...')
    
    let streamingContent = ''
    
    // 使用模型进行总结，支持流式响应
    const result = await model.chat(coreMessages, {
      
      onResultChange: (data) => {
        if (data.contentParts) {
          // 更新流式内容
          const newContent = data.contentParts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('')
          
          streamingContent = newContent
          
          // 尝试检测JSON完整性，提供更精确的进度信息
          const jsonMatch = streamingContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || [null, streamingContent]
          const jsonString = jsonMatch[1] || streamingContent.trim()
          
          try {
            // 尝试解析JSON来检测完整性
            JSON.parse(jsonString)
            onProgress?.('总结生成完成，正在处理...')
          } catch {
            // JSON不完整，继续等待
            if (streamingContent.length > 0) {
              onProgress?.(`Generating summary... (${streamingContent.length} chars)`)
            }
          }
        }
      }
    })
    
    // 通知正在处理结果
    onProgress?.('正在处理总结结果...')

    const responseText = result.contentParts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')

    // 尝试解析JSON响应
    let summaryData: SummaryResponse
    try {
      // 提取JSON部分（可能包含在代码块中）
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || [null, responseText]
      const jsonString = jsonMatch[1] || responseText.trim()
      
      summaryData = sanitizeSummaryData(JSON.parse(jsonString))
      
      // 验证必要字段
      if (!summaryData.summary || !summaryData.keyPoints || !summaryData.context) {
        throw new Error('Missing required fields in summary response')
      }
      
      // 设置时间戳
      summaryData.timestamp = Date.now()
      // 容错：确保可选字段存在
      if (!summaryData.timeline) summaryData.timeline = []
      if (!summaryData.userHighlights) summaryData.userHighlights = []
      
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', parseError)
      // 如果JSON解析失败，创建一个基本的总结
      summaryData = {
        summary: responseText.slice(0, 500) + (responseText.length > 500 ? '...' : ''),
        keyPoints: ['对话内容总结失败，保留原始回复'],
        context: '自动总结功能遇到问题，建议手动检查对话历史',
        timestamp: Date.now(),
        timeline: [],
        userHighlights: [],
      }
    }

    return summaryData
  } catch (error) {
    console.error('Failed to generate summary:', error)
    // 返回错误时的默认总结
    return {
      summary: `对话包含${messages.length}条消息，由于总结失败，请手动检查对话内容`,
      keyPoints: ['总结生成失败'],
      context: '自动总结功能暂时不可用',
      timestamp: Date.now(),
    }
  }
}

/**
 * 创建总结系统消息，显示给用户
 * @param summaryData 总结数据
 * @returns 格式化的总结系统消息
 */
export function createSummarySystemMessage(summaryData: SummaryResponse): Message {
  const timelineText = (summaryData.timeline && summaryData.timeline.length > 0)
    ? `\n**Timeline:**\n${summaryData.timeline.map((item) => {
      const timeStr = formatDisplayTime(item.time)
      const role = item.role || 'assistant'
      const tag = item.type ? ` [${item.type}]` : ''
      const timePrefix = timeStr ? `(${timeStr}) ` : ''
      return `${item.index ?? ''}. ${timePrefix}${role}${tag}: ${item.brief}`
    }).join('\n')}`
    : ''

  const userHighlightsText = (summaryData.userHighlights && summaryData.userHighlights.length > 0)
    ? `\n**User Highlights:**\n${summaryData.userHighlights.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : ''

  const summaryText = `📝 [AUTO SUMMARY] **Conversation summarized**

**Summary:**
${summaryData.summary}

**Key Points:**
${summaryData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}
${userHighlightsText}
${timelineText}
${summaryData.range ? `\n**Range:** ${summaryData.range.startIndex + 1}-${summaryData.range.endIndex + 1}` : ''}

**Context:**
${typeof summaryData.context === 'string' ? summaryData.context : JSON.stringify(summaryData.context)}
`.trim()
// *总结生成时间：${new Date(summaryData.timestamp).toLocaleString()}*
  return {
    id: `summary-system-${Date.now()}`,
    role: 'system',
    contentParts: [
      {
        type: 'text',
        text: summaryText,
      },
    ],
    timestamp: Date.now(),
  }
}

/**
 * 创建总结消息，用于注入到上下文中
 * @param summaryData 总结数据
 * @returns 格式化的总结消息
 */
export function createSummaryContextMessage(summaryData: SummaryResponse): Message {
  const summaryText = `
## Conversation Summary
Generated: ${new Date(summaryData.timestamp).toLocaleString()}

**Summary:**
${summaryData.summary}

**Key Points:**
${summaryData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

${summaryData.userHighlights && summaryData.userHighlights.length > 0 ? `**User Highlights:**\n${summaryData.userHighlights.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n` : ''}

${summaryData.timeline && summaryData.timeline.length > 0 ? `**Timeline:**\n${summaryData.timeline.map((item) => {
  const timeStr = formatDisplayTime(item.time)
  const role = item.role || 'assistant'
  const tag = item.type ? ` [${item.type}]` : ''
  const timePrefix = timeStr ? `(${timeStr}) ` : ''
  return `${item.index ?? ''}. ${timePrefix}${role}${tag}: ${item.brief}`
}).join('\n')}\n` : ''}

${summaryData.range ? `**Range:** ${summaryData.range.startIndex + 1}-${summaryData.range.endIndex + 1}\n` : ''}

**Context:**
${typeof summaryData.context === 'string' ? summaryData.context : JSON.stringify(summaryData.context)}

*Note: Auto-generated conversation summary for context optimization.*
`.trim()

  return createSummaryMessage(summaryText)
}

/**
 * 检查是否需要触发自动总结
 * @param summaryMetadata 总结元数据
 * @param settings 会话设置
 * @returns 是否需要总结
 */
export function shouldTriggerSummary(
  summaryMetadata: {
    messagesSinceLastSummary: number
    tokensSinceLastSummary: number
    lastSummaryTimestamp?: number
  },
  settings: {
    autoSummarize?: boolean
    autoSummarizeMessageThreshold?: number
    autoSummarizeTokenThreshold?: number
    maxContextMessageCount?: number
    autoSummarizeIdleMs?: number
  }
): boolean {
  if (!settings.autoSummarize) {
    return false
  }

  let messageThreshold = settings.autoSummarizeMessageThreshold || 16
  const tokenThreshold = settings.autoSummarizeTokenThreshold || 6*1000

  // 智能调整：确保总结阈值不超过上下文限制
  // 这样可以避免AI在总结之前就开始"忘记"对话内容
  if (settings.maxContextMessageCount) {
    // 将消息阈值钳制在上下文限制之下（减1），避免在达到限制前才总结
    const maxRecommendedThreshold = Math.max(1, settings.maxContextMessageCount)
    if (messageThreshold > maxRecommendedThreshold) {
      // 仅提示，不再覆盖用户的独立配置，让独立阈值生效
      console.warn(`自动总结阈值(${messageThreshold})大于建议值(${maxRecommendedThreshold})，可能在上下文接近上限时才触发总结。`)
    }
  }

  // 检查自上次总结以来的新消息数量（始终使用默认阈值）
  if (summaryMetadata.messagesSinceLastSummary >= messageThreshold) {
    return true
  }

  // 检查自上次总结以来的新token数量
  if (summaryMetadata.tokensSinceLastSummary >= tokenThreshold) {
    return true
  }

  // 基于时间的兜底触发：在空闲超过一定时间后也进行一次总结
  // const idleMs = settings.autoSummarizeIdleMs ?? 2*60*1000
  // const lastTs = summaryMetadata.lastSummaryTimestamp || 0
  // if (summaryMetadata.messagesSinceLastSummary > 0 && lastTs > 0 && Date.now() - lastTs >= idleMs) {
  //   return true
  // }

  return false
}

/**
 * 更新会话的总结元数据
 * @param session 会话对象
 * @param newMessages 新增的消息列表
 */
export function updateSummaryMetadata(
  session: any, // 使用any避免循环导入，实际类型是Session
  newMessages: Message[]
): void {
  if (!session.summaryMetadata) {
    session.summaryMetadata = {
      lastSummaryIndex: -1,
      messagesSinceLastSummary: 0,
      tokensSinceLastSummary: 0,
      lastSummaryTimestamp: 0,
    }
  }

  // 计算新增消息的token数量
  const newTokens = newMessages.reduce((sum, msg) => {
    return sum + (msg.tokenCount || 0)
  }, 0)

  // 更新元数据
  session.summaryMetadata.messagesSinceLastSummary += newMessages.length
  session.summaryMetadata.tokensSinceLastSummary += newTokens
}

/**
 * 重置总结元数据（在完成总结后调用）
 * @param session 会话对象
 * @param currentMessageIndex 当前消息索引
 */
export function resetSummaryMetadata(
  session: any, // 使用any避免循环导入，实际类型是Session
  currentMessageIndex: number
): void {
  if (!session.summaryMetadata) {
    session.summaryMetadata = {
      lastSummaryIndex: -1,
      messagesSinceLastSummary: 0,
      tokensSinceLastSummary: 0,
      lastSummaryTimestamp: 0,
    }
  }

  session.summaryMetadata.lastSummaryIndex = currentMessageIndex
  session.summaryMetadata.messagesSinceLastSummary = 0
  session.summaryMetadata.tokensSinceLastSummary = 0
  session.summaryMetadata.lastSummaryTimestamp = Date.now()
}

/**
 * 验证总结配置并提供建议
 * @param settings 会话设置
 * @returns 配置建议信息
 */
export function validateSummaryConfig(settings: {
  autoSummarize?: boolean
  autoSummarizeMessageThreshold?: number
  maxContextMessageCount?: number
}): {
  isValid: boolean
  suggestion?: string
  recommendedThreshold?: number
} {
  if (!settings.autoSummarize || !settings.maxContextMessageCount) {
    return { isValid: true }
  }

  const messageThreshold = settings.autoSummarizeMessageThreshold || 16
  const contextLimit = settings.maxContextMessageCount
  
  // 推荐阈值：上下文限制减1，最大化利用上下文空间
  const recommendedThreshold = Math.max(1, contextLimit - 1)
  
  if (messageThreshold > recommendedThreshold) {
    return {
      isValid: false,
      suggestion: `建议将自动总结阈值设置为${recommendedThreshold}，以确保AI在达到上下文限制前及时总结。当前设置(${messageThreshold})可能导致对话记忆丢失。`,
      recommendedThreshold
    }
  }
  
  return { isValid: true }
}

/**
 * 执行增量总结
 * @param model 用于总结的AI模型
 * @param previousSummary 上一次的总结内容（如果有）
 * @param newMessages 需要总结的新消息
 * @param onProgress 进度回调函数
 * @returns 新的总结结果
 */
export async function performIncrementalSummary(
  model: ModelInterface,
  previousSummary: string | null,
  newMessages: Message[],
  onProgress?: (progress: string) => void
): Promise<SummaryResponse> {
  // 构造增量总结的提示词
  const historyForPrompt = newMessages.map((msg, index) => {
    const ts = (msg as any).timestamp ? new Date((msg as any).timestamp).toISOString() : 'NA'
    return `${index + 1}. [${ts}] ${msg.role}: ${getMessageText(msg)}`
  }).join('\n')

  const summaryPrompt = createMessage('user', `请对以下新增对话进行“增量压缩总结”，并仅用 JSON 返回结果：

${previousSummary ? `**上次总结内容(供参考，可在此基础上更新)：**\n${previousSummary}\n\n` : ''}**新增对话内容（含时间戳）：**
${historyForPrompt}

要求与字段：同全量总结，需包含 summary、keyPoints、context、timestamp、timeline、userHighlights、compressionStats。
重点：
- 强力压缩 assistant 的长输出，仅保留结论与关键参数；
- 明确标注用户的意图/决策/约束为 userHighlights；
- timeline 按时间顺序列出事件，brief 遵守长度要求；
- 仅返回 JSON，无多余文字。`)

  const coreMessages = await convertToCoreMessages([summaryPrompt], {
    modelSupportVision: model.isSupportVision(),
  })

  try {
    // 通知开始总结
    onProgress?.('分析对话内容...')
    
    let streamingContent = ''
    
    // 使用模型进行总结，支持流式响应
    const result = await model.chat(coreMessages, {
      onResultChange: (data) => {
        if (data.contentParts) {
          // 更新流式内容
          const newContent = data.contentParts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('')
          
          streamingContent = newContent
          
          // 尝试检测JSON完整性，提供更精确的进度信息
          const jsonMatch = streamingContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || [null, streamingContent]
          const jsonString = jsonMatch[1] || streamingContent.trim()
          
          try {
            // 尝试解析JSON来检测完整性
            JSON.parse(jsonString)
            onProgress?.('总结生成完成，正在处理...')
          } catch {
            // JSON不完整，继续等待
            if (streamingContent.length > 0) {
              onProgress?.(`正在生成总结... (${streamingContent.length} 字符)`)
            }
          }
        }
      }
    })
    
    // 通知正在处理结果
    onProgress?.('处理总结结果...')

    const responseText = result.contentParts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')

    // 尝试解析JSON响应
    let summaryData: SummaryResponse
    try {
      // 提取JSON部分（可能包含在代码块中）
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || [null, responseText]
      const jsonString = jsonMatch[1] || responseText.trim()
      
      summaryData = sanitizeSummaryData(JSON.parse(jsonString))
      
      // 验证必要字段
      if (!summaryData.summary || !summaryData.keyPoints || !summaryData.context) {
        throw new Error('Missing required fields in summary response')
      }
      
      // 设置时间戳
      summaryData.timestamp = Date.now()
      // 容错：确保可选字段存在
      if (!summaryData.timeline) summaryData.timeline = []
      if (!summaryData.userHighlights) summaryData.userHighlights = []
      
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', parseError)
      // 如果JSON解析失败，创建一个基本的总结
      summaryData = {
        summary: responseText.slice(0, 500) + (responseText.length > 500 ? '...' : ''),
        keyPoints: ['Summary generation failed, preserved original response'],
        context: 'Auto-summary encountered an issue, manual review recommended',
        timestamp: Date.now(),
        timeline: [],
        userHighlights: [],
      }
    }

    return summaryData
  } catch (error) {
    console.error('Failed to generate incremental summary:', error)
    // 返回错误时的默认总结
    return {
      summary: `对话包含${newMessages.length}条新消息，由于总结失败，请手动检查对话内容`,
      keyPoints: ['增量总结生成失败'],
      context: '自动总结功能暂时不可用',
      timestamp: Date.now(),
    }
  }
}