import { v4 as uuidv4 } from 'uuid'
import { Message, Session, Settings, createMessage } from '../../../shared/types'
import { getMessageText } from '../../../shared/utils/message'
import { convertToCoreMessages } from '../model-calls/message-utils'
import { getModel } from '../../../shared/models'
import { createModelDependencies } from '../../adapters'
import { 
  MemoryItem, 
  EventItem, 
  MemoryCollection, 
  AnalysisConfig, 
  DEFAULT_ANALYSIS_CONFIG,
  MessageBatch
} from './types'

export class MemoryAnalyzer {
  private config: AnalysisConfig
  private settings?: Settings

  constructor(config: Partial<AnalysisConfig> = {}, settings?: Settings) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config }
    this.settings = settings
  }

  /**
   * 分析会话并提取记忆和事件
   */
  async analyzeSession(session: Session): Promise<MemoryCollection> {
    const messages = this.filterMessages(session.messages)
    const memories: MemoryItem[] = []
    const events: EventItem[] = []

    if (this.config.useAIAnalysis && this.settings) {
      // 使用AI批处理分析
      try {
        const batches = this.createMessageBatches(messages)
        console.log(`分批处理: ${batches.length} 个批次，共 ${messages.length} 条消息`)
        
        for (const batch of batches) {
          const batchResults = await this.analyzeBatchWithAI(batch)
          memories.push(...batchResults.memories)
          events.push(...batchResults.events)
        }
      } catch (error) {
        console.error('AI批处理分析失败:', error)
        throw error
      }
    } else {
      // 使用正则表达式逐条分析
      return this.analyzeSessionWithRegex(session, messages)
    }

    // 过滤和排序
    const filteredMemories = this.filterAndRankMemories(memories)
    const filteredEvents = this.filterAndRankEvents(events)

    // 生成总结
    const summary = this.generateSummary(session, filteredMemories, filteredEvents)

    return {
      sessionId: session.id,
      copilotId: session.copilotId || '',
      copilotName: session.name,
      collectedAt: Date.now(),
      memories: filteredMemories,
      events: filteredEvents,
      summary,
      totalMessages: session.messages.length,
      analyzedMessages: messages.length,
    }
  }

  /**
   * 过滤消息
   */
  private filterMessages(messages: Message[]): Message[] {
    return messages.filter(message => {
      if (message.role === 'system' && !this.config.includeSystemMessages) {
        return false
      }
      return message.role === 'user' || message.role === 'assistant'
    })
  }

  /**
   * 创建消息批次
   */
  private createMessageBatches(messages: Message[]): MessageBatch[] {
    const batches: MessageBatch[] = []
    let currentBatch: Message[] = []
    let currentLength = 0
    const maxTokens = this.config.maxBatchTokens
    const tokensPerChar = this.config.estimatedTokensPerChar

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const messageText = getMessageText(message)
      
      if (!messageText || messageText.trim().length < 10) {
        continue
      }

      const messageLength = messageText.length
      const estimatedTokens = messageLength * tokensPerChar

      // 如果添加这条消息会超过限制，先处理当前批次
      if (currentBatch.length > 0 && currentLength + estimatedTokens > maxTokens) {
        batches.push({
          messages: [...currentBatch],
          totalLength: currentLength,
          startIndex: batches.length > 0 ? batches[batches.length - 1].endIndex + 1 : 0,
          endIndex: i - 1
        })
        currentBatch = []
        currentLength = 0
      }

      currentBatch.push(message)
      currentLength += estimatedTokens
    }

    // 处理最后一个批次
    if (currentBatch.length > 0) {
      batches.push({
        messages: currentBatch,
        totalLength: currentLength,
        startIndex: batches.length > 0 ? batches[batches.length - 1].endIndex + 1 : 0,
        endIndex: messages.length - 1
      })
    }

    return batches
  }

  /**
   * 使用正则表达式分析会话（备选方案）
   */
  private async analyzeSessionWithRegex(session: Session, messages: Message[]): Promise<MemoryCollection> {
    const memories: MemoryItem[] = []
    const events: EventItem[] = []

    // 逐条分析消息
    for (const message of messages) {
      const messageText = getMessageText(message)
      if (!messageText || messageText.trim().length < 10) continue

      // 提取记忆信息
      const extractedMemories = this.extractMemoriesWithRegex(message, messageText)
      memories.push(...extractedMemories)

      // 提取事件信息  
      const extractedEvents = this.extractEventsWithRegex(message, messageText)
      events.push(...extractedEvents)
    }

    // 过滤和排序
    const filteredMemories = this.filterAndRankMemories(memories)
    const filteredEvents = this.filterAndRankEvents(events)

    // 生成总结
    const summary = this.generateSummary(session, filteredMemories, filteredEvents)

    return {
      sessionId: session.id,
      copilotId: session.copilotId || '',
      copilotName: session.name,
      collectedAt: Date.now(),
      memories: filteredMemories,
      events: filteredEvents,
      summary,
      totalMessages: session.messages.length,
      analyzedMessages: messages.length,
    }
  }

  /**
   * 使用AI批量分析消息批次
   */
  private async analyzeBatchWithAI(batch: MessageBatch): Promise<{ memories: MemoryItem[], events: EventItem[] }> {
    if (!this.settings) {
      throw new Error('Settings not provided for AI analysis')
    }

    const memories: MemoryItem[] = []
    const events: EventItem[] = []

    // 构建批次上下文
    const conversationContext = batch.messages.map((msg, index) => {
      const text = getMessageText(msg)
      const role = msg.role === 'user' ? '用户' : 'AI助手'
      return `${index + 1}. 【${role}】: ${text}`
    }).join('\n\n')

    // 分别分析记忆和事件
    const [batchMemories, batchEvents] = await Promise.all([
      this.extractMemoriesFromBatch(batch, conversationContext),
      this.extractEventsFromBatch(batch, conversationContext)
    ])

    memories.push(...batchMemories)
    events.push(...batchEvents)

    return { memories, events }
  }

  /**
   * 从消息批次中提取记忆信息
   */
  private async extractMemoriesFromBatch(batch: MessageBatch, conversationContext: string): Promise<MemoryItem[]> {
    const memoryTypesDescription = this.config.enabledMemoryTypes.map(type => {
      switch (type) {
        case 'personal': return '个人信息：姓名、身份、背景、基本情况等'
        case 'preference': return '偏好信息：喜好、观点、态度、倾向等'
        case 'skill': return '技能信息：能力、专长、经验、学习内容等'
        case 'relationship': return '关系信息：家人、朋友、同事、社交关系等'
        case 'other': return '其他信息：不属于上述类别的重要个人信息'
        default: return type
      }
    }).join('\n- ')

    const prompt = createMessage('user', `你是一个专业的对话分析专家，请从以下对话片段中提取重要的个人记忆信息。

分析原则：
1. 只提取明确表达的、有价值的个人信息，避免推测或假设
2. 记忆内容应该是可以用于后续对话的有用信息
3. 置信度反映信息的明确程度和重要性：
   - 0.9-1.0: 非常明确的个人信息（姓名、职业、明确的技能等）
   - 0.7-0.8: 比较明确的偏好或经验
   - 0.5-0.6: 暗示性的信息或倾向
   - 低于0.5的信息应该被过滤掉
4. 对于批量对话，要注意上下文关系，避免重复提取相似信息

记忆类型说明：
- ${memoryTypesDescription}

对话内容（共${batch.messages.length}条消息）：
${conversationContext}

输出要求：严格按照以下JSON数组格式输出，不要添加任何其他文字：
[
  {
    "type": "记忆类型",
    "content": "记忆的简洁但完整描述",
    "confidence": 置信度数值,
    "tags": ["标签1", "标签2"],
    "sourceIndex": 消息在批次中的索引号（从1开始）
  }
]

如果没有发现有价值的记忆信息，请返回空数组 []`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
    // 使用总结模型进行分析，如果没有配置则使用默认模型
    const analysisSettings = this.settings!.summaryModel ? {
      ...this.settings!,
      provider: this.settings!.summaryModel.provider,
      modelId: this.settings!.summaryModel.model,
    } : this.settings!
    
    const model = getModel(analysisSettings, configs, dependencies)
    const coreMessages = await convertToCoreMessages([prompt], {
      modelSupportVision: model.isSupportVision(),
    })

    const result = await model.chat(coreMessages, {})
    const responseText = result.contentParts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    
    // 解析AI返回的JSON
    let aiMemories: any[]
    try {
      // 尝试解析JSON，支持markdown代码块格式
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim()
      aiMemories = JSON.parse(jsonText)
    } catch (error) {
      throw new Error(`AI返回的不是有效JSON格式: ${responseText}`)
    }

    // 转换为MemoryItem格式
    const memories: MemoryItem[] = []
    for (const aiMemory of aiMemories) {
      if (aiMemory.type && aiMemory.content && typeof aiMemory.confidence === 'number') {
        const sourceIndex = aiMemory.sourceIndex || 1
        const sourceMessage = batch.messages[sourceIndex - 1] || batch.messages[0]
        
        memories.push(this.createMemoryItem(
          aiMemory.type,
          aiMemory.content,
          sourceMessage,
          aiMemory.confidence,
          aiMemory.tags || []
        ))
      }
    }

    return memories
  }

  /**
   * 从消息批次中提取事件信息
   */
  private async extractEventsFromBatch(batch: MessageBatch, conversationContext: string): Promise<EventItem[]> {
    const eventTypesDescription = this.config.enabledEventTypes.map(type => {
      switch (type) {
        case 'conversation': return '对话事件：重要的讨论话题、交流内容等'
        case 'decision': return '决策事件：做出的选择、决定、计划等'
        case 'achievement': return '成就事件：完成的任务、取得的成果、学到的技能等'
        case 'problem': return '问题事件：遇到的困难、挑战、需要解决的问题等'
        case 'other': return '其他事件：不属于上述类别的重要事件'
        default: return type
      }
    }).join('\n- ')

    const prompt = createMessage('user', `你是一个专业的对话分析专家，请从以下对话片段中提取重要的事件信息。

分析原则：
1. 只提取有实际意义的具体事件，避免过于琐碎的日常交流
2. 事件应该对理解用户或对话历史有价值
3. 准确区分不同类型的事件，避免模糊分类
4. 参与者应该明确，结果描述要客观
5. 对于批量对话，要关注事件的时间序列和因果关系

事件类型标准：
- ${eventTypesDescription}

对话内容（共${batch.messages.length}条消息）：
${conversationContext}

输出要求：严格按照以下JSON数组格式输出，不要添加任何其他文字：
[
  {
    "type": "事件类型",
    "title": "事件简要标题",
    "description": "事件详细描述，包含关键信息",
    "participants": ["明确的参与者"],
    "outcome": "事件结果或当前状态（如有）",
    "tags": ["相关标签"],
    "sourceIndex": 主要相关消息在批次中的索引号（从1开始）
  }
]

如果没有发现有意义的事件，请返回空数组 []`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
    // 使用总结模型进行分析，如果没有配置则使用默认模型
    const analysisSettings = this.settings!.summaryModel ? {
      ...this.settings!,
      provider: this.settings!.summaryModel.provider,
      modelId: this.settings!.summaryModel.model,
    } : this.settings!
    
    const model = getModel(analysisSettings, configs, dependencies)
    const coreMessages = await convertToCoreMessages([prompt], {
      modelSupportVision: model.isSupportVision(),
    })

    const result = await model.chat(coreMessages, {})
    const responseText = result.contentParts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    
    // 解析AI返回的JSON
    let aiEvents: any[]
    try {
      // 尝试解析JSON，支持markdown代码块格式
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim()
      aiEvents = JSON.parse(jsonText)
    } catch (error) {
      throw new Error(`AI返回的不是有效JSON格式: ${responseText}`)
    }

    // 转换为EventItem格式
    const events: EventItem[] = []
    for (const aiEvent of aiEvents) {
      if (aiEvent.type && aiEvent.title && aiEvent.description) {
        const sourceIndex = aiEvent.sourceIndex || 1
        const sourceMessage = batch.messages[sourceIndex - 1] || batch.messages[0]
        
        events.push(this.createEventItem(
          aiEvent.type,
          aiEvent.title,
          aiEvent.description,
          sourceMessage,
          aiEvent.outcome,
          aiEvent.tags || [],
          aiEvent.participants || [sourceMessage.role === 'user' ? '用户' : 'AI助手']
        ))
      }
    }

    return events
  }

  /**
   * 使用AI智能提取记忆信息（单条消息，保留用于兼容）
   */
  private async extractMemoriesWithAI(message: Message, text: string): Promise<MemoryItem[]> {
    if (!this.settings) {
      throw new Error('Settings not provided for AI analysis')
    }

    const memoryTypesDescription = this.config.enabledMemoryTypes.map(type => {
      switch (type) {
        case 'personal': return '个人信息：姓名、身份、背景、基本情况等'
        case 'preference': return '偏好信息：喜好、观点、态度、倾向等'
        case 'skill': return '技能信息：能力、专长、经验、学习内容等'
        case 'relationship': return '关系信息：家人、朋友、同事、社交关系等'
        case 'other': return '其他信息：不属于上述类别的重要个人信息'
        default: return type
      }
    }).join('\n- ')

    const prompt = createMessage('user', `你是一个专业的对话分析专家，请从以下对话消息中提取重要的个人记忆信息。

分析原则：
1. 只提取明确表达的、有价值的个人信息，避免推测或假设
2. 记忆内容应该是可以用于后续对话的有用信息
3. 置信度反映信息的明确程度和重要性：
   - 0.9-1.0: 非常明确的个人信息（姓名、职业、明确的技能等）
   - 0.7-0.8: 比较明确的偏好或经验
   - 0.5-0.6: 暗示性的信息或倾向
   - 低于0.5的信息应该被过滤掉

记忆类型说明：
- ${memoryTypesDescription}

消息内容：
【${message.role === 'user' ? '用户' : 'AI助手'}】: ${text}

输出要求：严格按照以下JSON数组格式输出，不要添加任何其他文字：
[
  {
    "type": "记忆类型",
    "content": "记忆的简洁但完整描述",
    "confidence": 置信度数值,
    "tags": ["标签1", "标签2"]
  }
]

如果没有发现有价值的记忆信息，请返回空数组 []`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
    // 使用总结模型进行分析，如果没有配置则使用默认模型
    const analysisSettings = this.settings!.summaryModel ? {
      ...this.settings!,
      provider: this.settings!.summaryModel.provider,
      modelId: this.settings!.summaryModel.model,
    } : this.settings!
    
    const model = getModel(analysisSettings, configs, dependencies)
    const coreMessages = await convertToCoreMessages([prompt], {
      modelSupportVision: model.isSupportVision(),
    })

    const result = await model.chat(coreMessages, {})
    const responseText = result.contentParts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    
    // 解析AI返回的JSON
    let aiMemories: any[]
    try {
      // 尝试解析JSON，支持markdown代码块格式
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim()
      aiMemories = JSON.parse(jsonText)
    } catch (error) {
      throw new Error(`AI返回的不是有效JSON格式: ${responseText}`)
    }

    // 转换为MemoryItem格式
    const memories: MemoryItem[] = []
    for (const aiMemory of aiMemories) {
      if (aiMemory.type && aiMemory.content && typeof aiMemory.confidence === 'number') {
        memories.push(this.createMemoryItem(
          aiMemory.type,
          aiMemory.content,
          message,
          aiMemory.confidence,
          aiMemory.tags || []
        ))
      }
    }

    return memories
  }

  /**
   * 使用正则表达式提取记忆信息（备选方案）
   */
  private extractMemoriesWithRegex(message: Message, text: string): MemoryItem[] {
    const memories: MemoryItem[] = []

    // 个人信息模式
    const personalPatterns = [
      /我是|我叫|我的名字是|我来自|我在(.{1,20})(工作|学习|生活)/gi,
      /我喜欢|我不喜欢|我讨厌|我热爱|我的爱好是/gi,
      /我的专业是|我学的是|我研究|我擅长/gi,
    ]

    // 偏好信息模式
    const preferencePatterns = [
      /我觉得|我认为|我比较喜欢|我更倾向于/gi,
      /我的看法是|我的观点是|对我来说/gi,
    ]

    // 技能信息模式
    const skillPatterns = [
      /我会|我能|我掌握|我了解|我熟悉/gi,
      /我学过|我做过|我有经验/gi,
    ]

    // 关系信息模式
    const relationshipPatterns = [
      /我的(朋友|同事|家人|父母|孩子|伴侣)/gi,
      /和我的|跟我的/gi,
    ]

    // 分析个人信息
    if (this.config.enabledMemoryTypes.includes('personal')) {
      for (const pattern of personalPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          memories.push(this.createMemoryItem('personal', match[0], message, 0.8))
        }
      }
    }

    // 分析偏好信息
    if (this.config.enabledMemoryTypes.includes('preference')) {
      for (const pattern of preferencePatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          memories.push(this.createMemoryItem('preference', match[0], message, 0.7))
        }
      }
    }

    // 分析技能信息
    if (this.config.enabledMemoryTypes.includes('skill')) {
      for (const pattern of skillPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          memories.push(this.createMemoryItem('skill', match[0], message, 0.8))
        }
      }
    }

    // 分析关系信息
    if (this.config.enabledMemoryTypes.includes('relationship')) {
      for (const pattern of relationshipPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          memories.push(this.createMemoryItem('relationship', match[0], message, 0.7))
        }
      }
    }

    return memories
  }

  /**
   * 从消息中提取事件信息
   */
  private async extractEvents(message: Message, text: string): Promise<EventItem[]> {
    // 如果启用AI分析，优先使用AI
    if (this.config.useAIAnalysis && this.settings) {
      try {
        return await this.extractEventsWithAI(message, text)
      } catch (error) {
        console.error('AI事件提取失败:', error)
        return []
      }
    }

    // 使用正则表达式模式作为备选方案
    return this.extractEventsWithRegex(message, text)
  }

  /**
   * 使用AI智能提取事件信息
   */
  private async extractEventsWithAI(message: Message, text: string): Promise<EventItem[]> {
    if (!this.settings) {
      throw new Error('Settings not provided for AI analysis')
    }

    const eventTypesDescription = this.config.enabledEventTypes.map(type => {
      switch (type) {
        case 'conversation': return '对话事件：重要的讨论话题、交流内容等'
        case 'decision': return '决策事件：做出的选择、决定、计划等'
        case 'achievement': return '成就事件：完成的任务、取得的成果、学到的技能等'
        case 'problem': return '问题事件：遇到的困难、挑战、需要解决的问题等'
        case 'other': return '其他事件：不属于上述类别的重要事件'
        default: return type
      }
    }).join('\n- ')

    const prompt = createMessage('user', `你是一个专业的对话分析专家，请从以下对话消息中提取重要的事件信息。

分析原则：
1. 只提取有实际意义的具体事件，避免过于琐碎的日常交流
2. 事件应该对理解用户或对话历史有价值
3. 准确区分不同类型的事件，避免模糊分类
4. 参与者应该明确，结果描述要客观

事件类型标准：
- ${eventTypesDescription}

消息内容：
【${message.role === 'user' ? '用户' : 'AI助手'}】: ${text}

输出要求：严格按照以下JSON数组格式输出，不要添加任何其他文字：
[
  {
    "type": "事件类型",
    "title": "事件简要标题",
    "description": "事件详细描述，包含关键信息",
    "participants": ["明确的参与者"],
    "outcome": "事件结果或当前状态（如有）",
    "tags": ["相关标签"]
  }
]

如果没有发现有意义的事件，请返回空数组 []`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
    // 使用总结模型进行分析，如果没有配置则使用默认模型
    const analysisSettings = this.settings!.summaryModel ? {
      ...this.settings!,
      provider: this.settings!.summaryModel.provider,
      modelId: this.settings!.summaryModel.model,
    } : this.settings!
    
    const model = getModel(analysisSettings, configs, dependencies)
    const coreMessages = await convertToCoreMessages([prompt], {
      modelSupportVision: model.isSupportVision(),
    })

    const result = await model.chat(coreMessages, {})
    const responseText = result.contentParts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    
    // 解析AI返回的JSON
    let aiEvents: any[]
    try {
      // 尝试解析JSON，支持markdown代码块格式
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim()
      aiEvents = JSON.parse(jsonText)
    } catch (error) {
      throw new Error(`AI返回的不是有效JSON格式: ${responseText}`)
    }

    // 转换为EventItem格式
    const events: EventItem[] = []
    for (const aiEvent of aiEvents) {
      if (aiEvent.type && aiEvent.title && aiEvent.description) {
        events.push(this.createEventItem(
          aiEvent.type,
          aiEvent.title,
          aiEvent.description,
          message,
          aiEvent.outcome,
          aiEvent.tags || [],
          aiEvent.participants || [message.role === 'user' ? '用户' : 'AI助手']
        ))
      }
    }

    return events
  }

  /**
   * 使用正则表达式提取事件信息（备选方案）
   */
  private extractEventsWithRegex(message: Message, text: string): EventItem[] {
    const events: EventItem[] = []

    // 对话事件模式
    const conversationPatterns = [
      /我们讨论了|我们聊了|我们谈到/gi,
      /关于(.{1,30})这个话题/gi,
    ]

    // 决策事件模式
    const decisionPatterns = [
      /我决定|我选择了|我打算|我计划/gi,
      /最终我|经过考虑/gi,
    ]

    // 成就事件模式
    const achievementPatterns = [
      /我完成了|我做到了|我成功|我实现了/gi,
      /我学会了|我掌握了|我解决了/gi,
    ]

    // 问题事件模式
    const problemPatterns = [
      /我遇到了|我碰到|出现了问题|有个问题/gi,
      /困难|挑战|难题/gi,
    ]

    // 分析对话事件
    if (this.config.enabledEventTypes.includes('conversation')) {
      for (const pattern of conversationPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          events.push(this.createEventItem('conversation', '对话讨论', match[0], message))
        }
      }
    }

    // 分析决策事件
    if (this.config.enabledEventTypes.includes('decision')) {
      for (const pattern of decisionPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          events.push(this.createEventItem('decision', '做出决策', match[0], message))
        }
      }
    }

    // 分析成就事件
    if (this.config.enabledEventTypes.includes('achievement')) {
      for (const pattern of achievementPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          events.push(this.createEventItem('achievement', '取得成就', match[0], message))
        }
      }
    }

    // 分析问题事件
    if (this.config.enabledEventTypes.includes('problem')) {
      for (const pattern of problemPatterns) {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          events.push(this.createEventItem('problem', '遇到问题', match[0], message))
        }
      }
    }

    return events
  }

  /**
   * 创建记忆项
   */
  private createMemoryItem(
    type: MemoryItem['type'], 
    content: string, 
    message: Message, 
    confidence: number,
    tags?: string[]
  ): MemoryItem {
    return {
      id: uuidv4(),
      type,
      content: content.trim(),
      source: message.id,
      timestamp: message.timestamp || Date.now(),
      confidence,
      tags: tags || this.extractTags(content),
    }
  }

  /**
   * 创建事件项
   */
  private createEventItem(
    type: EventItem['type'],
    title: string,
    description: string,
    message: Message,
    outcome?: string,
    tags?: string[],
    participants?: string[]
  ): EventItem {
    return {
      id: uuidv4(),
      type,
      title,
      description: description.trim(),
      participants: participants || [message.role === 'user' ? '用户' : 'AI助手'],
      source: message.id,
      timestamp: message.timestamp || Date.now(),
      context: getMessageText(message),
      outcome,
      tags: tags || this.extractTags(description),
    }
  }

  /**
   * 提取标签
   */
  private extractTags(text: string): string[] {
    const tags: string[] = []
    
    // 简单的关键词提取
    const keywords = [
      '工作', '学习', '生活', '家庭', '朋友', '爱好', '技能', 
      '喜欢', '不喜欢', '问题', '解决', '成功', '困难', '决定'
    ]

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        tags.push(keyword)
      }
    }

    return tags.slice(0, 5) // 最多5个标签
  }

  /**
   * 过滤和排序记忆
   */
  private filterAndRankMemories(memories: MemoryItem[]): MemoryItem[] {
    return memories
      .filter(memory => memory.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxMemoriesPerSession)
  }

  /**
   * 过滤和排序事件
   */
  private filterAndRankEvents(events: EventItem[]): EventItem[] {
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.config.maxEventsPerSession)
  }

  /**
   * 生成总结
   */
  private generateSummary(
    session: Session, 
    memories: MemoryItem[], 
    events: EventItem[]
  ): string {
    const parts: string[] = []

    if (memories.length > 0) {
      parts.push(`收集到 ${memories.length} 条记忆信息`)
    }

    if (events.length > 0) {
      parts.push(`记录了 ${events.length} 个事件`)
    }

    if (session.copilotId) {
      parts.push(`来自AI搭档"${session.name}"的对话`)
    }

    return parts.join('，') || '未收集到关键信息'
  }
}