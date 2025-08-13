import { Box, Typography, Button, Collapse, Alert } from '@mui/material'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MobilePerformanceMonitor } from '@/utils/mobile-performance'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useSettings } from '@/hooks/useSettings'

interface PerformanceMonitorProps {
  show?: boolean
  onOptimizationSuggestion?: (suggestions: string[]) => void
}

export default function PerformanceMonitor({ 
  show = false, 
  onOptimizationSuggestion 
}: PerformanceMonitorProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const { settings } = useSettings()
  const [monitor] = useState(() => MobilePerformanceMonitor.getInstance())
  const [metrics, setMetrics] = useState(() => monitor.getMetrics())
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)

  // 定期更新性能指标
  useEffect(() => {
    if (!show || !isSmallScreen || !settings.enablePerformanceMonitoring) return

    const interval = setInterval(() => {
      const currentMetrics = monitor.getMetrics()
      setMetrics(currentMetrics)
      
      const currentSuggestions = monitor.getOptimizationSuggestions()
      setSuggestions(currentSuggestions)
      
      // 只有在真正有性能问题时才显示监控器
      const hasIssues = monitor.shouldOptimize()
      setShowMonitor(hasIssues)
      
      if (currentSuggestions.length > 0 && onOptimizationSuggestion) {
        onOptimizationSuggestion(currentSuggestions)
      }
    }, 5000) // 改为每5秒更新一次，减少监控频率

    return () => clearInterval(interval)
  }, [show, isSmallScreen, settings.enablePerformanceMonitoring, monitor, onOptimizationSuggestion])

  const handleClearCache = useCallback(() => {
    // 触发垃圾回收（如果可用）
    if (typeof window !== 'undefined' && window.gc) {
      window.gc()
    }
    
    // 清理本地存储
    try {
      localStorage.removeItem('sessionScrollPositionCache')
    } catch (e) {
      console.warn('Failed to clear cache:', e)
    }
  }, [])

  if (!show || !isSmallScreen || !showMonitor || !settings.enablePerformanceMonitoring) {
    return null
  }

  const hasPerformanceIssues = monitor.shouldOptimize()

  return (
    <Box sx={{ 
      position: 'fixed', 
      bottom: 16, 
      right: 16, 
      zIndex: 1000,
      maxWidth: 300
    }}>
      <Box
        sx={{
          backgroundColor: hasPerformanceIssues ? 'warning.light' : 'primary.light',
          color: hasPerformanceIssues ? 'warning.contrastText' : 'primary.contrastText',
          p: 1,
          borderRadius: 1,
          cursor: 'pointer',
          opacity: 0.9,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Typography variant="caption" fontWeight="bold">
          📊 {t('Performance Monitor')}
        </Typography>
        {hasPerformanceIssues && (
          <Typography variant="caption" display="block">
            ⚠️ {t('Performance issues detected')}
          </Typography>
        )}
      </Box>

      <Collapse in={isExpanded}>
        <Box
          sx={{
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            mt: 1,
            boxShadow: 2,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {t('Performance Metrics')}
          </Typography>

          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" display="block">
              {t('Memory')}: {metrics.memoryUsage ? `${Math.round(metrics.memoryUsage)}MB` : t('Unknown')}
            </Typography>
            <Typography variant="caption" display="block">
              {t('FPS')}: {metrics.scrollFPS || t('Unknown')}
            </Typography>
            <Typography variant="caption" display="block">
              {t('Render Time')}: {metrics.renderTime ? `${Math.round(metrics.renderTime)}ms` : t('Unknown')}
            </Typography>
          </Box>

          {suggestions.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1, fontSize: '0.75rem' }}>
              <Typography variant="caption" component="div">
                {t('Optimization Suggestions')}:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.7rem' }}>
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleClearCache}
              sx={{ fontSize: '0.7rem' }}
            >
              {t('Clear Cache')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setIsExpanded(false)}
              sx={{ fontSize: '0.7rem' }}
            >
              {t('Close')}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}