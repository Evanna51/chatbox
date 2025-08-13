/**
 * 移动端性能优化工具类
 */

export interface PerformanceMetrics {
  memoryUsage?: number
  renderTime?: number
  scrollFPS?: number
  messageCount?: number
}

export class MobilePerformanceMonitor {
  private static instance: MobilePerformanceMonitor
  private metrics: PerformanceMetrics = {}
  private renderStartTime = 0
  private frameCount = 0
  private lastFrameTime = 0
  private rafId?: number
  private performanceHistory: PerformanceMetrics[] = []
  private consecutiveIssues = 0

  static getInstance(): MobilePerformanceMonitor {
    if (!this.instance) {
      this.instance = new MobilePerformanceMonitor()
    }
    return this.instance
  }

  // 开始性能监控
  startMonitoring(): void {
    this.startFPSMonitoring()
    this.startMemoryMonitoring()
  }

  // 停止性能监控
  stopMonitoring(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = undefined
    }
  }

  // 监控 FPS
  private startFPSMonitoring(): void {
    const measureFPS = (timestamp: number) => {
      if (this.lastFrameTime === 0) {
        this.lastFrameTime = timestamp
      }

      const delta = timestamp - this.lastFrameTime
      if (delta >= 1000) {
        this.metrics.scrollFPS = Math.round((this.frameCount * 1000) / delta)
        this.frameCount = 0
        this.lastFrameTime = timestamp
      }
      
      this.frameCount++
      this.rafId = requestAnimationFrame(measureFPS)
    }

    this.rafId = requestAnimationFrame(measureFPS)
  }

  // 监控内存使用
  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory
      this.metrics.memoryUsage = memoryInfo.usedJSHeapSize / 1024 / 1024 // MB
    }
  }

  // 标记渲染开始
  markRenderStart(): void {
    this.renderStartTime = performance.now()
  }

  // 标记渲染结束
  markRenderEnd(): void {
    if (this.renderStartTime > 0) {
      this.metrics.renderTime = performance.now() - this.renderStartTime
      this.renderStartTime = 0
    }
  }

  // 获取当前性能指标
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // 检查是否需要性能优化 - 更智能的检测
  shouldOptimize(): boolean {
    const { scrollFPS, memoryUsage, renderTime } = this.metrics
    
    // 记录当前性能状况
    this.performanceHistory.push({ ...this.metrics })
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift() // 只保留最近10次记录
    }
    
    let currentIssues = 0
    
    // FPS 持续低于 15 才认为有问题
    if (scrollFPS && scrollFPS < 15) currentIssues++
    
    // 内存使用超过 800MB 才认为有问题  
    if (memoryUsage && memoryUsage > 800) currentIssues++
    
    // 渲染时间超过 1000ms 才认为有问题
    if (renderTime && renderTime > 1000) currentIssues++
    
    // 需要连续3次检测到问题才报告
    if (currentIssues > 0) {
      this.consecutiveIssues++
    } else {
      this.consecutiveIssues = 0
    }
    
    return this.consecutiveIssues >= 3
  }

  // 获取优化建议
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = []
    const { scrollFPS, memoryUsage, renderTime } = this.metrics

    if (scrollFPS && scrollFPS < 15) {
      suggestions.push('滚动性能严重下降，建议减少虚拟化缓冲区大小')
    }

    if (memoryUsage && memoryUsage > 800) {
      suggestions.push('内存使用过高，建议启用消息懒加载')
    }

    if (renderTime && renderTime > 1000) {
      suggestions.push('渲染时间过长，建议减少单次渲染内容')
    }

    return suggestions
  }
}

// 性能优化配置
export interface PerformanceConfig {
  enableLazyLoading: boolean
  maxInitialContent: number
  chunkSize: number
  viewportBuffer: { top: number; bottom: number }
  enableVirtualization: boolean
}

export const getOptimalPerformanceConfig = (
  deviceType: 'mobile' | 'desktop' | 'web' = 'mobile',
  memoryMB: number = 0
): PerformanceConfig => {
  const baseConfig: PerformanceConfig = {
    enableLazyLoading: true,
    maxInitialContent: 10000,
    chunkSize: 5000,
    viewportBuffer: { top: 2000, bottom: 2000 },
    enableVirtualization: true
  }

  if (deviceType === 'mobile') {
    // 移动端更严格的限制
    baseConfig.maxInitialContent = 5000
    baseConfig.chunkSize = 3000
    baseConfig.viewportBuffer = { top: 500, bottom: 500 }
    
    // 根据设备内存进一步调整
    if (memoryMB > 0 && memoryMB < 4096) { // 内存小于 4GB
      baseConfig.maxInitialContent = 3000
      baseConfig.chunkSize = 2000
      baseConfig.viewportBuffer = { top: 300, bottom: 300 }
    }
  }

  return baseConfig
}

// 节流函数，用于优化滚动性能
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T => {
  let inThrottle: boolean
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }) as T
}

// 防抖函数，用于优化搜索等操作
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): T => {
  let timeout: NodeJS.Timeout | null = null
  
  return ((...args: any[]) => {
    const callNow = immediate && !timeout
    
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      timeout = null
      if (!immediate) func.apply(null, args)
    }, wait)
    
    if (callNow) func.apply(null, args)
  }) as T
}

// 内存清理工具
export const cleanupMemory = (): void => {
  // 清理可能的内存泄漏
  if (typeof window !== 'undefined' && window.gc) {
    window.gc()
  }
}