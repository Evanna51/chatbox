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
 * @returns 总结后的JSON格式内容
 */
export async function summarizeMessages(
  model: ModelInterface,
  messages: Message[]
): Promise<SummaryResponse> {
  // 构造总结的提示词
  const summaryPrompt = createMessage('user', `请对以下对话历史进行总结，并以JSON格式返回结果。

要求：
1. 提取对话的核心内容和关键信息
2. 保留重要的上下文信息，以便后续对话参考
3. 删除不重要的细节和冗余信息
4. 以JSON格式返回，包含以下字段：
   - summary: 对话的主要总结（字符串）
   - keyPoints: 关键要点列表（字符串数组）
   - context: 重要的上下文信息（字符串）
   - timestamp: 总结生成时间戳（数字）

请直接返回JSON，不要包含其他文字说明。

对话历史：
${messages.map((msg, index) => `${index + 1}. ${msg.role}: ${getMessageText(msg)}`).join('\n')}`)

  const coreMessages = await convertToCoreMessages([summaryPrompt], {
    modelSupportVision: model.isSupportVision(),
  })

  try {
    // 使用模型默认设置进行总结
    const result = await model.chat(coreMessages, {})

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
 * 创建总结消息，用于注入到上下文中
 * @param summaryData 总结数据
 * @returns 格式化的总结消息
 */
export function createSummaryContextMessage(summaryData: SummaryResponse): Message {
  const summaryText = `
对话历史总结（生成时间：${new Date(summaryData.timestamp).toLocaleString()}）

主要内容：
${summaryData.summary}

关键要点：
${summaryData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

重要上下文：
${summaryData.context}

注：这是AI自动生成的对话历史总结，用于优化上下文管理。
`.trim()

  return createSummaryMessage(summaryText)
}

/**
 * 检查是否需要触发自动总结
 * @param messages 当前消息列表
 * @param settings 会话设置
 * @returns 是否需要总结
 */
export function shouldTriggerSummary(
  messages: Message[],
  settings: {
    autoSummarize?: boolean
    autoSummarizeMessageThreshold?: number
    autoSummarizeTokenThreshold?: number
  }
): boolean {
  if (!settings.autoSummarize) {
    return false
  }

  const messageThreshold = settings.autoSummarizeMessageThreshold || 4
  const tokenThreshold = settings.autoSummarizeTokenThreshold || 1000

  // 检查消息数量
  if (messages.length > messageThreshold) {
    return true
  }

  // 检查token总数（这里需要估算）
  const totalTokens = messages.reduce((sum, msg) => {
    return sum + (msg.tokenCount || 0)
  }, 0)

  if (totalTokens > tokenThreshold) {
    return true
  }

  return false
}