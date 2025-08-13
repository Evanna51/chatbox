export interface ProactiveNotificationConfig {
  enabled: boolean
  timeWindow: {
    startHour: number // 开始小时 (0-23)
    endHour: number   // 结束小时 (0-23)
  }
  inactivityThreshold: number // 无活动阈值（毫秒）
  messages: string[] // 主动消息模板
}

export interface NotificationSchedule {
  sessionId: string
  lastActivityTime: number
  nextNotificationTime: number
  isScheduled: boolean
}

export const DEFAULT_PROACTIVE_CONFIG: ProactiveNotificationConfig = {
  enabled: true,
  timeWindow: {
    startHour: 11, // 上午11点
    endHour: 13    // 下午1点
  },
  inactivityThreshold: 5 * 60 * 1000, // 5分钟
  messages: [
    '吃饭了吗？',
    '最近怎么样呀？',
    '有什么想聊的吗？',
    '在忙什么呢？'
  ]
}