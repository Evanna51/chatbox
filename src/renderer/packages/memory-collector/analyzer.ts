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
  MessageBatch,
  ConversationSummary,
  NovelOutline
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
    let conversationSummary: ConversationSummary | undefined
    let novelOutline: NovelOutline | undefined

    if (this.config.useAIAnalysis && this.settings) {
      // 根据分析模式选择不同的分析方法
      switch (this.config.analysisMode) {
        case 'conversation_summary':
          console.log(`对话总结模式: 共 ${messages.length} 条消息`)
          conversationSummary = await this.analyzeConversationSummary(messages)
          break
        
        case 'novel_outline':
          console.log(`小说大纲模式: 共 ${messages.length} 条消息`)
          novelOutline = await this.analyzeNovelOutline(messages)
          break
        
        default:
          // 默认模式：使用AI统一分析User的所有消息
          console.log(`统一分析模式: 共 ${messages.length} 条消息`)
          try {
            const unifiedResults = await this.analyzeAllMessagesUnified(messages)
            memories.push(...unifiedResults.memories)
            events.push(...unifiedResults.events)
          } catch (error) {
            console.error('AI统一分析失败:', error)
            throw error
          }
          break
      }
    }

    // 过滤和排序（仅对默认模式）
    const filteredMemories = this.config.analysisMode === 'default' ? this.filterAndRankMemories(memories) : []
    const filteredEvents = this.config.analysisMode === 'default' ? this.filterAndRankEvents(events) : []

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
      conversationSummary,
      novelOutline,
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
   * 使用AI统一分析所有消息
   */
  private async analyzeAllMessagesUnified(messages: Message[]): Promise<{ memories: MemoryItem[], events: EventItem[] }> {
    if (!this.settings) {
      throw new Error('Settings not provided for AI analysis')
    }

    const memories: MemoryItem[] = []
    const events: EventItem[] = []

    // 构建带时间戳的对话上下文，保留顺序，便于生成时间线
    const conversationContext = messages.map((msg, index) => {
      const text = getMessageText(msg)
      if (!text || text.trim().length < 1) {
        return null
      }
      const role = msg.role
      const ts = (msg as any).timestamp ? new Date((msg as any).timestamp).toISOString() : 'NA'
      return `${index + 1}. [${ts}] ${role}: ${text}`
    }).filter(Boolean).join('\n')

    if (!conversationContext.trim()) {
      return { memories, events }
    }

    // 同时分析记忆和事件
    const [unifiedMemories, unifiedEvents] = await Promise.all([
      this.extractMemoriesFromUnifiedContext(messages, conversationContext),
      this.extractEventsFromUnifiedContext(messages, conversationContext)
    ])

    memories.push(...unifiedMemories)
    events.push(...unifiedEvents)

    return { memories, events }
  }

  /**
   * 从统一的对话上下文中提取记忆信息
   */
  private async extractMemoriesFromUnifiedContext(messages: Message[], conversationContext: string): Promise<MemoryItem[]> {

    const memoryTypesDescription = this.config.enabledMemoryTypes.map(type => {
      switch (type) {
        case 'personal': return 'personal: name, identity, background, basic_info'
        case 'preference': return 'preference: likes, opinions, attitudes, tendencies'
        case 'skill': return 'skill: abilities, expertise, experience, learning_content'
        case 'relationship': return 'relationship: family, friends, colleagues, social_connections'
        case 'other': return 'other: important_personal_info not in above categories'
        default: return type
      }
    }).join('\n- ')

    const prompt = createMessage('user', `Extract personal memory information from conversation data.

ANALYSIS_RULES:
1. extract_explicit_valuable_info(avoid_speculation=true, avoid_assumptions=true)
2. memory_content.should_be_useful_for_future_conversations()
3. confidence_score.reflects(clarity_level, importance_level):
   - 0.9-1.0: explicit_personal_info(name, profession, clear_skills)
   - 0.7-0.8: clear_preferences_or_experiences
   - 0.5-0.6: implied_info_or_tendencies
   - filter_out(confidence < 0.5)
4. for_complete_conversation.avoid_duplicate_similar_info()
5. downgrade_assistant_generated_content_confidence(to_lowest=true); only treat USER-originated facts as reliable

MEMORY_TYPES:
- ${memoryTypesDescription}

CONVERSATION_DATA (${messages.length} messages):
${conversationContext}

IMPORTANT: Output all content and tags in Chinese language.

OUTPUT_FORMAT (strict JSON array, no additional text):
[
  {
    "type": "memory_type",
    "content": "concise_but_complete_description—in Chinese",  
    "confidence": confidence_value,
    "tags": ["tag1", "tag2"],
    "sourceIndex": message_index_in_batch_starting_from_1
  }
]

return [] if no_valuable_memory_found`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
    // 使用总结模型进行分析，如果没有配置则使用默认模型
    const analysisSettings = this.settings!.summaryModel ? {
      ...this.settings!,
      provider: this.settings!.summaryModel.provider,
      modelId: this.settings!.summaryModel.model,
    } : this.settings!
    
    const model = getModel(analysisSettings, configs, dependencies)
    // 
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
        const sourceMessage = messages[sourceIndex - 1] || messages[0]
        
        // 将 assistant 源的记忆置信度降到最低，便于后续基于 minConfidence 过滤
        const adjustedConfidence = sourceMessage.role === 'assistant'
          ? Math.min(aiMemory.confidence, 0.5)
          : aiMemory.confidence

        memories.push(this.createMemoryItem(
          aiMemory.type,
          aiMemory.content,
          sourceMessage,
          adjustedConfidence,
          aiMemory.tags || []
        ))
      }
    }

    return memories
  }

  /**
   * 从统一的对话上下文中提取事件信息
   */
  private async extractEventsFromUnifiedContext(messages: Message[], conversationContext: string): Promise<EventItem[]> {
    const eventTypesDescription = this.config.enabledEventTypes.map(type => {
      switch (type) {
        case 'conversation': return 'conversation: important_discussions, communication_content'
        case 'decision': return 'decision: choices_made, decisions, plans'
        case 'achievement': return 'achievement: completed_tasks, accomplishments, skills_learned'
        case 'problem': return 'problem: difficulties_encountered, challenges, issues_to_solve'
        case 'other': return 'other: important_events not in above categories'
        default: return type
      }
    }).join('\n- ')

    const prompt = createMessage('user', `Extract important event information from conversation data.

ANALYSIS_RULES:
1. extract_meaningful_concrete_events(avoid_trivial_daily_exchanges=true)
2. events.should_be_valuable_for_understanding(user_context=true, conversation_history=true)
3. classify_event_types_accurately(avoid_ambiguous_classification=true)
4. participants.should_be_explicit(), outcome.should_be_objective()
5. for_complete_conversation.focus_on(temporal_sequence=true, causal_relationships=true)
6. downgrade_assistant_generated_content_confidence(to_lowest=true); prefer user-originated facts

EVENT_TYPE_STANDARDS:
- ${eventTypesDescription}

CONVERSATION_DATA (${messages.length} messages):
${conversationContext}

IMPORTANT: Output all content, titles, descriptions and tags in Chinese language.

OUTPUT_FORMAT (strict JSON array, no additional text):
[
  {
    "type": "event_type",
    "title": "brief_event_title",
    "description": "detailed_event_description_with_key_info",
    "participants": ["explicit_participants"],
    "outcome": "event_result_or_current_status_if_any",
    "tags": ["related_tags"],
    "sourceIndex": primary_related_message_index_in_batch_starting_from_1
  }
]

return [] if no_meaningful_events_found`)

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
        const sourceMessage = messages[sourceIndex - 1] || messages[0]
        
        // 当最小置信度 > 0.5 时，过滤掉来源为 assistant 的事件
        if (this.config.minConfidence > 0.5 && sourceMessage.role === 'assistant') {
          continue
        }

        events.push(this.createEventItem(
          aiEvent.type,
          aiEvent.title,
          aiEvent.description,
          sourceMessage,
          aiEvent.outcome,
          aiEvent.tags || [],
          aiEvent.participants || [sourceMessage.role === 'user' ? 'user' : 'assistant']
        ))
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
      participants: participants || [message.role === 'user' ? 'user' : 'assistant'],
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

  /**
   * 分析对话总结（包含情绪分析）
   */
  private async analyzeConversationSummary(messages: Message[]): Promise<ConversationSummary> {
    if (!this.settings) {
      throw new Error('Settings not provided for conversation summary analysis')
    }

    // 构建完整的对话上下文
    const conversationContext = messages.map((msg, index) => {
      const text = getMessageText(msg)
      if (!text || text.trim().length < 10) {
        return null
      }
      const role = msg.role === 'user' ? 'user' : 'assistant'
      return `${index + 1}. 【${role}】: ${text}`
    }).filter(Boolean).join('\n\n')

    if (!conversationContext.trim()) {
      throw new Error('没有有效的对话内容可以分析')
    }

    const prompt = createMessage('user', `请基于以下对话完整生成“压缩且结构化”的总结，重点保留事件时间线：

目标：
1) 强力压缩 assistant 的冗长输出，仅保留结论/答案/关键参数；
2) 完整记录 user 的主动输出、意图、决策与约束条件；
3) 生成严格按时间顺序的 timeline（事件时间线），用于快速回溯；
4) 输出可直接用于继续对话的关键上下文；
5) 补充情绪分析与对话流程，保留必要细节但简洁表达。

输出 JSON（严格 JSON，无多余文本）：
{
  "summary": "对话主线与结论的概述（尽量短）",
  "keyPoints": ["关键要点，动词开头，按重要性排序"],
  "userHighlights": ["用户目标/决策/约束等关键点"],
  "timestamp": 1680000000000,
  "timeline": [
    {
      "index": 1,
      "role": "user|assistant|system|tool",
      "time": "ISO或数字时间戳，可省略",
      "brief": "该条消息单行摘要：user≤120字，assistant≤60字",
      "type": "user_intent|ai_answer|clarification|decision|other"
    }
  ],
  "mainTopics": ["..."],
  "keyInformation": ["..."],
  "emotionalTone": { "overall": "positive|negative|neutral|mixed", "details": "..." },
  "participantMoods": { "user": "...", "assistant": "..." },
  "conversationFlow": "开端-发展-高潮-结尾的简要流程",
  "conclusions": ["...", "..."]
}

注意：
- 对 assistant 的长文本务必强力压缩，允许合并相近多段输出；
- timeline 必须保留原始顺序，尽量包含时间信息；
- 仅返回 JSON，不要任何多余文字或解释。

对话历史（含时间戳，共 ${messages.length} 条）：
${conversationContext}`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
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
    try {
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim()
      const summary: ConversationSummary = JSON.parse(jsonText)
      return summary
    } catch (error) {
      throw new Error(`AI返回的不是有效JSON格式: ${responseText}`)
    }
  }

  /**
   * 分析小说大纲
   */
  private async analyzeNovelOutline(messages: Message[]): Promise<NovelOutline> {
    if (!this.settings) {
      throw new Error('Settings not provided for novel outline analysis')
    }

    // 构建完整的对话上下文
    const conversationContext = messages.map((msg, index) => {
      const text = getMessageText(msg)
      if (!text || text.trim().length < 10) {
        return null
      }
      const role = msg.role === 'user' ? 'user' : 'assistant'
      return `${index + 1}. 【${role}】: ${text}`
    }).filter(Boolean).join('\n\n')

    if (!conversationContext.trim()) {
      throw new Error('没有有效的对话内容可以分析')
    }

    const prompt = createMessage('user', `Extract and analyze novel creation elements from conversation data to construct complete novel outline.

ANALYSIS_REQUIREMENTS:
1. identify_novel_genre_theme_and_worldview_settings()
2. extract_main_characters_with_traits_and_roles()
3. analyze_plot_structure(beginning=true, development=true, climax=true, ending=true)
4. identify_themes_and_conflict_types()
5. extract_key_scenes_and_important_plot_points()

CONVERSATION_DATA (${messages.length} messages):
${conversationContext}

IMPORTANT: Output all content in Chinese language.

OUTPUT_FORMAT (strict JSON, no additional text):
{
  "genre": "novel_genre_or_theme_like_fantasy_scifi_realism",
  "setting": {
    "time": "time_background_setting",
    "place": "location_background_setting", 
    "worldBuilding": "detailed_worldview_and_background_setting_description"
  },
  "characters": [
    {
      "name": "character_name",
      "role": "protagonist|antagonist|supporting|minor",
      "description": "character_description",
      "traits": ["trait_1", "trait_2", "trait_3"]
    }
  ],
  "plotStructure": {
    "setup": "story_beginning_and_background_introduction",
    "incitingIncident": "key_event_that_triggers_story",
    "risingAction": ["main_development_event_1", "main_development_event_2"],
    "climax": "story_climax",
    "fallingAction": "development_after_climax",
    "resolution": "story_ending"
  },
  "themes": ["theme_1", "theme_2", "theme_3"],
  "conflicts": [
    {
      "type": "internal|external|interpersonal|societal",
      "description": "conflict_description"
    }
  ],
  "keyScenes": [
    {
      "title": "scene_title",
      "description": "scene_description",
      "importance": "scene_importance_in_story"
    }
  ]
}`)

    const dependencies = await createModelDependencies()
    const configs = { uuid: '' }
    
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
    try {
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim()
      const outline: NovelOutline = JSON.parse(jsonText)
      return outline
    } catch (error) {
      throw new Error(`AI返回的不是有效JSON格式: ${responseText}`)
    }
  }
}