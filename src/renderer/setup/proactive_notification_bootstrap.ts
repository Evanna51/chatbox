import { initializeProactiveNotifications } from '@/packages/proactive-notification'
import platform from '@/platform'
import { featureFlags } from '@/utils/feature-flags'

// 只在桌面端和移动端启用主动通知功能
if (featureFlags.mcp || platform.type === 'mobile') {
  platform
    .getSettings()
    .then(() => {
      console.info('[ProactiveNotification] Initializing proactive notification service...')
      // 延迟初始化，避免在应用启动时立即调用可能有问题的API
      setTimeout(() => {
        try {
          initializeProactiveNotifications()
        } catch (error) {
          console.error('[ProactiveNotification] Initialization error:', error)
        }
      }, 3000) // 延迟3秒初始化
    })
    .catch((err) => {
      console.error('[ProactiveNotification] Bootstrap error:', err)
    })
}