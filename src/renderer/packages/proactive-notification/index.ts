import { Session, CopilotDetail, Message } from '../../../shared/types'
import { isCharacterCopilotSession } from '../memory-collector'
import * as sessionActions from '../../stores/sessionActions'
import platform from '../../platform'
import { getDefaultStore } from 'jotai'
import { sessionsListAtom, myCopilotsAtom } from '../../stores/atoms'
import { getSession } from '../../stores/sessionStorageMutations'

interface NotificationSchedule {
  sessionId: string
  lastActivityTime: number
  nextNotificationTime: number
  isScheduled: boolean
}

interface ProactiveNotificationService {
  start(): void
  stop(): void
  scheduleSessionNotification(sessionId: string): void
  cancelSessionNotification(sessionId: string): void
  updateLastActivity(sessionId: string): void
}

// 主动通知的消息模板
const PROACTIVE_MESSAGES = [
  '吃饭了吗？',
  '最近怎么样呀？',
  '有什么想聊的吗？',
  '在忙什么呢？'
]

class ProactiveNotificationServiceImpl implements ProactiveNotificationService {
  private schedules = new Map<string, NotificationSchedule>()
  private checkInterval: number | null = null
  private isRunning = false

  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('[ProactiveNotification] Service started')
    
    // 每分钟检查一次是否需要发送通知
    this.checkInterval = setInterval(() => {
      this.checkAndSendNotifications()
    }, 60 * 1000) // 1分钟检查一次
    
    // 立即检查一次
    this.checkAndSendNotifications()
  }

  stop() {
    if (!this.isRunning) return
    
    this.isRunning = false
    console.log('[ProactiveNotification] Service stopped')
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    
    this.schedules.clear()
  }

  scheduleSessionNotification(sessionId: string) {
    const now = Date.now()
    const schedule: NotificationSchedule = {
      sessionId,
      lastActivityTime: now,
      nextNotificationTime: this.calculateNextNotificationTime(),
      isScheduled: true
    }
    
    this.schedules.set(sessionId, schedule)
    console.log(`[ProactiveNotification] Scheduled notification for session ${sessionId}`)
  }

  cancelSessionNotification(sessionId: string) {
    if (this.schedules.has(sessionId)) {
      this.schedules.delete(sessionId)
      console.log(`[ProactiveNotification] Cancelled notification for session ${sessionId}`)
    }
  }

  updateLastActivity(sessionId: string) {
    const schedule = this.schedules.get(sessionId)
    if (schedule) {
      schedule.lastActivityTime = Date.now()
      schedule.nextNotificationTime = this.calculateNextNotificationTime()
      console.log(`[ProactiveNotification] Updated activity for session ${sessionId}`)
    }
  }

  private async checkAndSendNotifications() {
    if (!this.isRunning) return

    const store = getDefaultStore()
    const sessionsList = store.get(sessionsListAtom)
    const copilots = store.get(myCopilotsAtom)
    const now = Date.now()

    for (const [sessionId, schedule] of this.schedules) {
      // 检查会话是否存在
      const sessionMeta = sessionsList.find(s => s.id === sessionId)
      if (!sessionMeta) {
        // 会话已被删除，移除调度
        this.schedules.delete(sessionId)
        continue
      }
      
      // 获取完整的会话数据
      const session = getSession(sessionId)
      if (!session) {
        // 会话数据无法加载，移除调度
        this.schedules.delete(sessionId)
        continue
      }

      // 检查是否是Character类型且启用了主动通知
      if (!this.shouldSendNotification(session, copilots)) {
        continue
      }

      // 检查是否到了通知时间且满足条件
      if (this.shouldTriggerNotification(schedule, now)) {
        await this.sendProactiveNotification(session)
        // 重新安排下次通知时间
        schedule.nextNotificationTime = this.calculateNextNotificationTime()
      }
    }
  }

  private shouldSendNotification(session: Session, copilots: CopilotDetail[]): boolean {
    // 检查是否是Character类型会话
    if (!isCharacterCopilotSession(session, copilots)) {
      return false
    }

    // 检查是否启用了主动通知
    if (!session.settings?.enableProactiveNotification) {
      return false
    }

    return true
  }

  private shouldTriggerNotification(schedule: NotificationSchedule, now: number): boolean {
    // 检查是否到了通知时间
    if (now < schedule.nextNotificationTime) {
      return false
    }

    // 检查是否在11点到1点之间（11:00-13:00）
    const currentHour = new Date().getHours()
    if (currentHour < 11 || currentHour >= 13) {
      return false
    }

    // 检查最后活动时间是否超过5分钟
    const timeSinceLastActivity = now - schedule.lastActivityTime
    const fiveMinutes = 5 * 60 * 1000
    if (timeSinceLastActivity < fiveMinutes) {
      return false
    }

    return true
  }

  private calculateNextNotificationTime(): number {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(11, 0, 0, 0) // 明天11点开始
    
    // 在11点到1点之间随机选择一个时间
    const randomMinutes = Math.floor(Math.random() * 120) // 0-120分钟（2小时）
    tomorrow.setMinutes(randomMinutes)
    
    return tomorrow.getTime()
  }

  private async sendProactiveNotification(session: Session) {
    try {
      // 随机选择一个消息
      const message = PROACTIVE_MESSAGES[Math.floor(Math.random() * PROACTIVE_MESSAGES.length)]
      
      // 发送本地通知
      await this.sendLocalNotification(session.name, message, session.id)
      
      // 向会话添加AI消息
      await this.addProactiveMessage(session, message)
      
      console.log(`[ProactiveNotification] Sent notification to session ${session.id}: ${message}`)
    } catch (error) {
      console.error('[ProactiveNotification] Error sending notification:', error)
    }
  }

  private async sendLocalNotification(sessionName: string, message: string, sessionId: string) {
    try {
      // 使用平台API发送通知
      if (platform.sendProactiveNotification) {
        await platform.sendProactiveNotification(sessionName, message, sessionId)
      } else {
        console.warn('[ProactiveNotification] Platform does not support proactive notifications')
      }
    } catch (error) {
      console.error('[ProactiveNotification] Error sending notification:', error)
    }
  }

  private async addProactiveMessage(session: Session, message: string) {
    try {
      // 创建AI消息
      const aiMessage: Message = {
        id: `proactive_${Date.now()}`,
        role: 'assistant',
        contentParts: [{ type: 'text', text: message }],
        timestamp: Date.now(),
        isProactive: true // 标记为主动消息
      }

      // 插入消息到会话
      sessionActions.insertMessage(session.id, aiMessage)
      
      // 更新最后活动时间
      this.updateLastActivity(session.id)
    } catch (error) {
      console.error('[ProactiveNotification] Error adding proactive message:', error)
    }
  }
}

// 全局单例
let notificationService: ProactiveNotificationService | null = null

export function getProactiveNotificationService(): ProactiveNotificationService {
  if (!notificationService) {
    notificationService = new ProactiveNotificationServiceImpl()
  }
  return notificationService
}

export function initializeProactiveNotifications() {
  const service = getProactiveNotificationService()
  service.start()
  
  // 监听会话变化，为Character类型会话启用通知
  const store = getDefaultStore()
  const sessionsList = store.get(sessionsListAtom)
  const copilots = store.get(myCopilotsAtom)
  
  sessionsList.forEach(sessionMeta => {
    const session = getSession(sessionMeta.id)
    if (session && isCharacterCopilotSession(session, copilots) && session.settings?.enableProactiveNotification) {
      service.scheduleSessionNotification(session.id)
    }
  })
}

// 导出服务实例以便在其他地方调用
export function updateSessionActivity(sessionId: string) {
  if (notificationService) {
    notificationService.updateLastActivity(sessionId)
  }
}

export function scheduleSessionNotification(sessionId: string) {
  if (notificationService) {
    notificationService.scheduleSessionNotification(sessionId)
  }
}

export function cancelSessionNotification(sessionId: string) {
  if (notificationService) {
    notificationService.cancelSessionNotification(sessionId)
  }
}

export function cleanupProactiveNotifications() {
  if (notificationService) {
    notificationService.stop()
    notificationService = null
  }
}

export * from './types'