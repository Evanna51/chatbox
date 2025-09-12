import { Box, Button, Typography } from '@mui/material'
import React, { memo, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'

interface LazyMessageContentProps {
  content: string
  isMarkdownEnabled: boolean
  children: React.ReactElement
  maxInitialLength?: number
  chunkSize?: number
  generating?: boolean
}

const LazyMessageContent = memo<LazyMessageContentProps>(({
  content,
  isMarkdownEnabled,
  children,
  maxInitialLength = 10000, // 移动端减少初始加载内容
  chunkSize = 5000
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [loadedChunks, setLoadedChunks] = useState(1)

  // 根据设备类型调整参数
  const actualMaxInitialLength = useMemo(() => {
    return isSmallScreen ? Math.min(maxInitialLength, 5000) : maxInitialLength
  }, [maxInitialLength, isSmallScreen])

  const actualChunkSize = useMemo(() => {
    return isSmallScreen ? Math.min(chunkSize, 3000) : chunkSize
  }, [chunkSize, isSmallScreen])

  // 如果内容较短，直接渲染
  if (content.length <= actualMaxInitialLength) {
    return children
  }

  // 计算当前应该显示的内容
  const visibleContent = useMemo(() => {
    const totalVisible = actualMaxInitialLength + (loadedChunks - 1) * actualChunkSize
    return content.slice(0, totalVisible)
  }, [content, loadedChunks, actualMaxInitialLength, actualChunkSize])

  // 是否还有更多内容
  const hasMore = visibleContent.length < content.length

  // 加载更多内容
  const loadMore = useCallback(() => {
    setLoadedChunks(prev => prev + 1)
  }, [])

  // 安全地处理内容截断 - 避免深度递归和React元素修改
  const modifiedChildren = useMemo(() => {
    if (!children) return null
    
    // 检查是否是React元素并且具有字符串children
    if (React.isValidElement(children)) {
      try {
        // 对于简单的情况，直接克隆并替换children
        if (typeof (children.props as any)?.children === 'string') {
          return React.cloneElement(children as React.ReactElement<any>, {
            ...(children.props as any),
            children: visibleContent
          })
        }
        
        // 对于复杂的嵌套结构，使用更安全的方法
        // 如果children是组件（如Markdown），传递visibleContent作为children
        if (children.type && typeof children.type !== 'string') {
          return React.cloneElement(children as React.ReactElement<any>, {
            ...(children.props as any),
            children: visibleContent
          })
        }
        
        // 对于原生DOM元素，只处理简单情况，避免深度递归
        if (typeof children.type === 'string') {
          return React.cloneElement(children as React.ReactElement<any>, {
            ...(children.props as any),
            children: visibleContent
          })
        }
      } catch (error) {
        // 如果克隆失败，记录错误并降级到原始children
        console.warn('LazyMessageContent: Failed to clone element safely, falling back to original:', error)
        return children
      }
    }
    
    // 如果无法安全处理，返回原始children
    return children
  }, [children, visibleContent])

  return (
    <Box>
      {modifiedChildren}
      {hasMore && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={loadMore}
            sx={{ 
              fontSize: '0.75rem',
              py: 0.5,
              px: 2
            }}
          >
            {t('Load More Content')} ({Math.round((content.length - visibleContent.length) / 1000)}k chars remaining)
          </Button>
          <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.6 }}>
            {t('Showing')} {Math.round(visibleContent.length / 1000)}k / {Math.round(content.length / 1000)}k {t('characters')}
          </Typography>
        </Box>
      )}
    </Box>
  )
})

LazyMessageContent.displayName = 'LazyMessageContent'

export default LazyMessageContent