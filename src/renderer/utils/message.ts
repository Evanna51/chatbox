import { assign, cloneDeep, omit } from 'lodash'
import type { Message, MessageContentParts, MessagePicture, SearchResultItem } from 'src/shared/types'
import { countWord } from '@/packages/word-count'

export function getMessageText(message: Message, includeImagePlaceHolder = true, includeReasoning = true): string {
  if (message.contentParts && message.contentParts.length > 0) {
    return message.contentParts
      .map((c) => {
        if (c.type === 'reasoning') {
          return includeReasoning ? c.text : null
        }
        if (c.type === 'text') {
          return c.text
        }
        if (c.type === 'image') {
          return includeImagePlaceHolder ? '[image]' : null
        }
        return ''
      })
      .filter((c) => c !== null)
      .join('\n')
  }
  return ''
}

// 只有这里可以访问 message 的 content / webBrowsing 字段，迁移到 contentParts 字段
export function migrateMessage(
  message: Omit<Message, 'contentParts'> & { contentParts?: MessageContentParts }
): Message {
  const result: Message = {
    id: message.id || '',
    role: message.role || 'user',
    contentParts: message.contentParts || [],
  }
  // 还是保留原始content字段，删除webBrowsing字段
  assign(result, omit(message, 'webBrowsing'))

  // 如果 contentParts 不存在，或者 contentParts 为空，或者 contentParts 的内容为 '...'(placeholder)，则使用 content 的值
  if (
    (!result.contentParts?.length || getMessageText(result) === '...' || !getMessageText(result)) &&
    'content' in message
  ) {
    const imageParts = (message as Message & { pictures?: MessagePicture[] }).pictures
      ?.filter((pic) => pic.storageKey || pic.url)
      .map((pic) => ({ type: 'image' as const, storageKey: pic.storageKey!, url: pic.url }))
    result.contentParts = [{ type: 'text', text: String(message.content ?? '') }, ...(imageParts || [])]
  }

  if ('webBrowsing' in message) {
    const webBrowsing = message.webBrowsing as {
      query: string[]
      links: { title: string; url: string }[]
    }
    result.contentParts.unshift({
      type: 'tool-call',
      state: 'result',
      toolCallId: `web_search_${message.id}`,
      toolName: 'web_search',
      args: {
        query: webBrowsing.query.join(', '),
      },
      result: {
        query: webBrowsing.query.join(', '),
        searchResults: webBrowsing.links.map((link) => ({
          title: link.title,
          link: link.url,
          snippet: link.title,
        })) satisfies SearchResultItem[],
      },
    })
  }

  return result
}

export function cloneMessage(message: Message): Message {
  return cloneDeep(message)
}

export function isEmptyMessage(message: Message): boolean {
  return getMessageText(message).length === 0
}

export function countMessageWords(message: Message): number {
  return countWord(getMessageText(message))
}

export function mergeMessages(a: Message, b: Message): Message {
  const ret = cloneMessage(a)
  // Merge contentParts
  ret.contentParts = [...(ret.contentParts || []), ...(b.contentParts || [])]

  return ret
}

export function fixMessageRoleSequence(messages: Message[]): Message[] {
  let result: Message[] = []
  if (messages.length <= 1) {
    result = messages
  } else {
    let currentMessage = cloneMessage(messages[0]) // 复制，避免后续修改导致的引用问题

    for (let i = 1; i < messages.length; i++) {
      const message = cloneMessage(messages[i]) // 复制消息避免修改原对象

      if (message.role === currentMessage.role) {
        currentMessage = mergeMessages(currentMessage, message)
      } else {
        result.push(currentMessage)
        currentMessage = message
      }
    }
    result.push(currentMessage)
  }
  // 如果顺序中的第一条 assistant 消息前面不是 user 消息，则插入一个 user 消息
  const firstAssistantIndex = result.findIndex((m) => m.role === 'assistant')
  if (firstAssistantIndex !== -1 && result[firstAssistantIndex - 1]?.role !== 'user') {
    result = [
      ...result.slice(0, firstAssistantIndex),
      { role: 'user', contentParts: [{ type: 'text', text: 'OK.' }], id: 'user_before_assistant_id' },
      ...result.slice(firstAssistantIndex),
    ]
  }
  return result
}

/**
 * SequenceMessages organizes and orders messages to follow the sequence: system -> user -> assistant -> user -> etc.
 * 这个方法只能用于 llm 接口请求前的参数构造，因为会过滤掉消息中的无关字段，所以不适用于其他消息存储的场景
 * 这个方法本质上是 golang API 服务中方法的 TypeScript 实现
 * @param msgs
 * @returns
 */
export function sequenceMessages(msgs: Message[]): Message[] {
  // 将带有 [AUTO SUMMARY] 标记的 system 消息在请求阶段转换为 user，避免被合并到系统提示中
  const normalizedMsgs = msgs.map((m) => {
    if (m.role === 'system' && /\[AUTO SUMMARY\]/.test(getMessageText(m))) {
      return { ...m, role: 'user' as const }
    }
    return m
  })

  // Merge all system messages first
  let system: Message = {
    id: '',
    role: 'system',
    contentParts: [],
  }
  for (const msg of normalizedMsgs) {
    if (msg.role === 'system') {
      system = mergeMessages(system, msg)
    }
  }
  // Initialize the result array with the non-empty system message, if present
  const ret: Message[] = system.contentParts.length > 0 ? [system] : []
  let next: Message = {
    id: '',
    role: 'user',
    contentParts: [],
  }
  let isFirstUserMsg = true // Special handling for the first user message
  const isAutoSummary = (m: Message) => /\[AUTO SUMMARY\]/.test(getMessageText(m))
  for (const msg of normalizedMsgs) {
    // Skip the already processed system messages or empty messages
    if (msg.role === 'system' || isEmptyMessage(msg)) {
      continue
    }
    // Merge consecutive messages from the same role
    if (msg.role === next.role) {
      // 如果包含自动总结，强制边界，不进行合并
      if (isAutoSummary(msg) || isAutoSummary(next)) {
        if (!isEmptyMessage(next)) {
          ret.push(next)
          isFirstUserMsg = false
        }
        next = msg
        continue
      } else {
        next = mergeMessages(next, msg)
        continue
      }
    }
    // 不再将首条 assistant 折叠为用户引用，避免把助手内容放进 user 的 content 里
    if (isEmptyMessage(next) && isFirstUserMsg && msg.role === 'assistant') {
      // 直接作为独立的 assistant 消息加入序列
      ret.push(msg)
      continue
    }
    // If not the first user message, add the current message to the result and start a new one
    if (!isEmptyMessage(next)) {
      ret.push(next)
      isFirstUserMsg = false
    }
    next = msg
  }
  // Add the last message if it's not empty
  if (!isEmptyMessage(next)) {
    ret.push(next)
  }
  // If there's only one system message, convert it to a user message
  if (ret.length === 1 && ret[0].role === 'system') {
    ret[0].role = 'user'
  }
  return ret
}
