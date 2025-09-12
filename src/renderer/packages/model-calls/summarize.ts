import { generateText } from 'ai'
import { createMessage, Message } from '../../../shared/types'
import { createSummaryMessage, getMessageText } from '../../../shared/utils/message'
import { convertToCoreMessages } from './message-utils'
import type { ModelInterface } from '../../../shared/models/types'

/**
 * AI总结响应的JSON格式接口
 */
interface SummaryResponse {
  summary: string
  keyPoints: string[]
  context: string
  timestamp: number
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
  // 构造总结的提示词
  const summaryPrompt = createMessage('user', `Summarize the following conversation history and return the result in JSON format.

Requirements:
1. Extract core content and key information from the conversation
2. Preserve important contextual information for future reference
3. Return in JSON format with the following fields:
   - summary: Main summary of the conversation (string)
   - keyPoints: List of key points (string array)
   - context: Important contextual information (string)
   - timestamp: Summary generation timestamp (number)

Return only JSON, no additional text or explanations.

Conversation history:
${messages.map((msg, index) => `${index + 1}. ${msg.role}: ${getMessageText(msg)}`).join('\n')}`)

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
            onProgress?.('Summary generation completed, processing...')
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
      
      summaryData = JSON.parse(jsonString)
      
      // 验证必要字段
      if (!summaryData.summary || !summaryData.keyPoints || !summaryData.context) {
        throw new Error('Missing required fields in summary response')
      }
      
      // 设置时间戳
      summaryData.timestamp = Date.now()
      
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', parseError)
      // 如果JSON解析失败，创建一个基本的总结
      summaryData = {
        summary: responseText.slice(0, 500) + (responseText.length > 500 ? '...' : ''),
        keyPoints: ['对话内容总结失败，保留原始回复'],
        context: '自动总结功能遇到问题，建议手动检查对话历史',
        timestamp: Date.now(),
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
  const summaryText = `📝 **${summaryData.keyPoints.length} messages auto-summarized**

**Summary:**
${summaryData.summary}

**Key Points:**
${summaryData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

**Context:**
${summaryData.context}
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

**Context:**
${summaryData.context}

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
  },
  settings: {
    autoSummarize?: boolean
    autoSummarizeMessageThreshold?: number
    autoSummarizeTokenThreshold?: number
    maxContextMessageCount?: number
  }
): boolean {
  if (!settings.autoSummarize) {
    return false
  }

  let messageThreshold = settings.autoSummarizeMessageThreshold || 16
  const tokenThreshold = settings.autoSummarizeTokenThreshold || 6*1024

  // 智能调整：确保总结阈值不超过上下文限制
  // 这样可以避免AI在总结之前就开始"忘记"对话内容
  if (settings.maxContextMessageCount) {
    // 总结阈值应该是上下文限制减1，最大化利用上下文空间
    const maxRecommendedThreshold = Math.max(1, settings.maxContextMessageCount - 1)
    if (messageThreshold > maxRecommendedThreshold*2) {
      console.warn(`自动总结阈值(${messageThreshold})过大，已自动调整为${maxRecommendedThreshold}以匹配上下文限制(${settings.maxContextMessageCount})`)
      messageThreshold = maxRecommendedThreshold
    }
  }

  // 检查自上次总结以来的新消息数量
  if (settings.autoSummarizeMessageThreshold && summaryMetadata.messagesSinceLastSummary >= messageThreshold) {
    return true
  }

  // 检查自上次总结以来的新token数量
  if (summaryMetadata.tokensSinceLastSummary >= tokenThreshold) {
    return true
  }

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
  const summaryPrompt = createMessage('user', `请对以下对话进行增量总结，并以JSON格式返回结果。

${previousSummary ? `
**上次总结内容：**
${previousSummary}

**新增对话内容：**` : '**对话内容：**'}
${newMessages.map((msg, index) => `${index + 1}. ${msg.role}: ${getMessageText(msg)}`).join('\n')}

要求：
1. ${previousSummary ? '基于上次总结，整合新增对话内容' : '对对话内容进行总结'}
2. 提取核心信息和关键要点
3. 保留重要的上下文信息，删除冗余内容
4. 以JSON格式返回，包含以下字段：
   - summary: 整合后的主要总结（字符串）
   - keyPoints: 关键要点列表（字符串数组）
   - context: 重要的上下文信息（字符串）
   - timestamp: 总结生成时间戳（数字）

请直接返回JSON，不要包含其他文字说明。`)

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
      
      summaryData = JSON.parse(jsonString)
      
      // 验证必要字段
      if (!summaryData.summary || !summaryData.keyPoints || !summaryData.context) {
        throw new Error('Missing required fields in summary response')
      }
      
      // 设置时间戳
      summaryData.timestamp = Date.now()
      
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', parseError)
      // 如果JSON解析失败，创建一个基本的总结
      summaryData = {
        summary: responseText.slice(0, 500) + (responseText.length > 500 ? '...' : ''),
        keyPoints: ['Summary generation failed, preserved original response'],
        context: 'Auto-summary encountered an issue, manual review recommended',
        timestamp: Date.now(),
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