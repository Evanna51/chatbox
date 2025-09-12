import { Box, Button, Typography } from '@mui/material'
import React, { memo, useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'

interface LazyMessageContentProps {
  content: string
  isMarkdownEnabled: boolean
  children: React.ReactElement
  maxInitialLength?: number
  chunkSize?: number
  generating?: boolean // 新增：是否正在生成中
}

const LazyMessageContent = memo<LazyMessageContentProps>(({
  content,
  isMarkdownEnabled,
  children,
  maxInitialLength = 10000, // 移动端减少初始加载内容
  chunkSize = 5000,
  generating = false // 新增：是否正在生成中
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [loadedChunks, setLoadedChunks] = useState(1)
  
  // 根据设备类型调整参数 - 需要先定义，因为后面的useEffect会用到
  const actualMaxInitialLength = useMemo(() => {
    return isSmallScreen ? Math.min(maxInitialLength, 5000) : maxInitialLength
  }, [maxInitialLength, isSmallScreen])
  
  // 记录是否曾经处于生成状态，避免生成完成后突然切换渲染模式
  const [wasGenerating, setWasGenerating] = useState(generating)
  
  // 更新生成状态记录
  useEffect(() => {
    if (generating) {
      setWasGenerating(true)
    } else if (wasGenerating && !generating) {
      // 生成完成后，延迟重置状态，给用户一些时间适应
      const timer = setTimeout(() => {
        // 只有在内容确实很长的情况下才重置，避免不必要的高度变化
        if (content.length > actualMaxInitialLength * 3) {
          setWasGenerating(false)
        }
      }, 3000) // 3秒后允许切换到懒加载模式（仅对很长的内容）
      return () => clearTimeout(timer)
    }
  }, [generating, wasGenerating, content.length, actualMaxInitialLength])

  const actualChunkSize = useMemo(() => {
    return isSmallScreen ? Math.min(chunkSize, 3000) : chunkSize
  }, [chunkSize, isSmallScreen])

  // 检查是否正在生成中 - 优先使用直接传入的generating属性
  const isGenerating = useMemo(() => {
    // 优先使用直接传入的generating属性
    if (generating !== undefined) {
      return generating
    }
    // 备用方案：通过检查children的props来判断是否正在生成
    if (React.isValidElement(children) && children.props && typeof children.props === 'object') {
      return (children.props as any).generating === true
    }
    return false
  }, [generating, children])

  // 决定是否应该直接渲染（避免高度突变）
  const shouldRenderDirectly = useMemo(() => {
    // 正在生成中，直接渲染
    if (isGenerating) {
      return true
    }
    // 曾经生成过，继续直接渲染以避免高度跳跃
    // 只有当内容非常长时才考虑懒加载
    if (wasGenerating && content.length <= actualMaxInitialLength * 3) {
      return true
    }
    // 内容较短，直接渲染
    if (content.length <= actualMaxInitialLength) {
      return true
    }
    return false
  }, [isGenerating, wasGenerating, content.length, actualMaxInitialLength])

  // 如果应该直接渲染，返回完整内容
  if (shouldRenderDirectly) {
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
        if (typeof (children.props as any).children === 'string') {
          return React.cloneElement(children as any, {
            ...(children.props as any),
            children: visibleContent
          })
        }
        
        // 对于复杂的嵌套结构，使用更安全的方法
        // 如果children是组件（如Markdown），传递visibleContent作为children
        if (children.type && typeof children.type !== 'string') {
          return React.cloneElement(children as any, {
            ...(children.props as any),
            children: visibleContent
          })
        }
        
        // 对于原生DOM元素，只处理简单情况，避免深度递归
        if (typeof children.type === 'string') {
          return React.cloneElement(children as any, {
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