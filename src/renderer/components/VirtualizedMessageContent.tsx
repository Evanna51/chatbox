import { Box, Typography } from '@mui/material'
import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { FixedSizeList as List } from 'react-window'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'

interface VirtualizedMessageContentProps {
  content: string
  lineHeight?: number
  maxVisibleLines?: number
  children: React.ReactElement
}

interface LineData {
  lines: string[]
  originalContent: string
  renderMode: 'virtualized' | 'full'
}

// 虚拟化行渲染器
const LineRenderer = memo<{
  index: number
  style: React.CSSStyle
  data: LineData
}>(({ index, style, data }) => {
  const line = data.lines[index] || ''
  
  return (
    <div style={style}>
      <Typography
        component="div"
        sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          margin: 0,
          padding: '2px 0',
        }}
      >
        {line}
      </Typography>
    </div>
  )
})

LineRenderer.displayName = 'LineRenderer'

const VirtualizedMessageContent = memo<VirtualizedMessageContentProps>(({
  content,
  lineHeight = 24,
  maxVisibleLines = 100, // 移动端默认只显示100行
  children
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [renderMode, setRenderMode] = useState<'virtualized' | 'full'>('full')
  const listRef = useRef<List>(null)

  // 根据设备类型调整参数
  const actualMaxVisibleLines = useMemo(() => {
    return isSmallScreen ? Math.min(maxVisibleLines, 50) : maxVisibleLines
  }, [maxVisibleLines, isSmallScreen])

  const actualLineHeight = useMemo(() => {
    return isSmallScreen ? Math.max(lineHeight, 20) : lineHeight
  }, [lineHeight, isSmallScreen])

  // 分析内容并决定渲染模式
  const contentAnalysis = useMemo(() => {
    const lines = content.split('\n')
    const totalLines = lines.length
    const shouldVirtualize = totalLines > actualMaxVisibleLines && content.length > 10000

    return {
      lines,
      totalLines,
      shouldVirtualize,
      estimatedHeight: totalLines * actualLineHeight,
    }
  }, [content, actualMaxVisibleLines, actualLineHeight])

  // 虚拟化数据
  const virtualizedData: LineData = useMemo(() => ({
    lines: contentAnalysis.lines,
    originalContent: content,
    renderMode,
  }), [contentAnalysis.lines, content, renderMode])

  // 切换渲染模式
  const toggleRenderMode = useCallback(() => {
    setRenderMode(prev => prev === 'virtualized' ? 'full' : 'virtualized')
  }, [])

  // 如果不需要虚拟化，直接返回原始组件
  if (!contentAnalysis.shouldVirtualize) {
    return children
  }

  // 强制使用完整模式
  if (renderMode === 'full') {
    return (
      <Box>
        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {t('Content has {{lines}} lines', { lines: contentAnalysis.totalLines })}
          </Typography>
          <button
            onClick={toggleRenderMode}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            {t('Switch to Virtual Mode')}
          </button>
        </Box>
        {children}
      </Box>
    )
  }

  // 虚拟化模式
  const containerHeight = Math.min(
    actualMaxVisibleLines * actualLineHeight,
    isSmallScreen ? 400 : 600
  )

  return (
    <Box>
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {t('Virtual mode: showing {{visible}}/{{total}} lines', {
            visible: actualMaxVisibleLines,
            total: contentAnalysis.totalLines
          })}
        </Typography>
        <button
          onClick={toggleRenderMode}
          className="text-blue-500 hover:text-blue-700 text-xs"
        >
          {t('Switch to Full Mode')}
        </button>
      </Box>
      
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: 'background.paper',
        }}
      >
        <List
          ref={listRef}
          height={containerHeight}
          itemCount={contentAnalysis.totalLines}
          itemSize={actualLineHeight}
          itemData={virtualizedData}
          overscanCount={5} // 预渲染额外的行以提升滚动体验
        >
          {LineRenderer}
        </List>
      </Box>
      
      {contentAnalysis.totalLines > actualMaxVisibleLines && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {t('{{remaining}} more lines available in full mode', {
            remaining: contentAnalysis.totalLines - actualMaxVisibleLines
          })}
        </Typography>
      )}
    </Box>
  )
})

VirtualizedMessageContent.displayName = 'VirtualizedMessageContent'

export default VirtualizedMessageContent