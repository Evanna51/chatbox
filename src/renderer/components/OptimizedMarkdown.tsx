import { sanitizeUrl } from '@braintree/sanitize-url'
import { useTheme } from '@mui/material'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { a11yDark, atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { MobilePerformanceMonitor } from '@/utils/mobile-performance'
import platform from '@/platform'

import 'katex/dist/katex.min.css'

interface OptimizedMarkdownProps {
  children: string
  enableLaTeXRendering?: boolean
  enableMermaidRendering?: boolean
  hiddenCodeCopyButton?: boolean
  className?: string
  generating?: boolean
  preferCollapsedCodeBlock?: boolean
  maxRenderLength?: number // 新增：最大渲染长度限制
}

// 移动端专用的优化 Markdown 组件
const OptimizedMarkdown = memo<OptimizedMarkdownProps>(({
  children,
  enableLaTeXRendering = true,
  enableMermaidRendering = true,
  hiddenCodeCopyButton,
  preferCollapsedCodeBlock,
  className,
  generating,
  maxRenderLength = platform.type === 'mobile' ? 50000 : 200000, // 移动端更严格的限制
}) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const performanceMonitor = useRef(MobilePerformanceMonitor.getInstance())
  const [shouldOptimize, setShouldOptimize] = useState(false)
  const [renderMode, setRenderMode] = useState<'full' | 'simplified'>('full')

  // 检查内容长度和性能状况
  useEffect(() => {
    const contentLength = children.length
    
    // 如果正在生成中，保持当前渲染模式不变以避免闪烁
    if (generating) {
      return
    }
    
    // 更保守的长度检查，防止错误
    if (contentLength > maxRenderLength) {
      setShouldOptimize(true)
      setRenderMode('simplified')
    } else {
      setShouldOptimize(false)
      setRenderMode('full')
    }
  }, [children.length, maxRenderLength, generating])

  // 简化版本的插件配置（性能优先）
  const simplifiedPlugins = useMemo(() => ({
    remarkPlugins: [remarkBreaks], // 只保留基本的换行插件
    rehypePlugins: [], // 禁用 LaTeX 等重型插件
  }), [])

  // 完整版本的插件配置 - 暂时禁用LaTeX和Mermaid
  const fullPlugins = useMemo(() => ({
    remarkPlugins: [remarkGfm, remarkBreaks], // 移除 remarkMath
    rehypePlugins: [], // 暂时禁用 rehypeKatex
  }), [])

  // 选择插件配置
  const plugins = renderMode === 'simplified' ? simplifiedPlugins : fullPlugins

  // 简化的组件配置（移动端性能优化）
  const getComponents = useCallback(() => {
    if (renderMode === 'simplified') {
      return {
        // 简化版本：不渲染复杂的代码高亮
        code: ({ node, inline, className, children, ...props }: any) => {
          if (inline) {
            return <code className={className} {...props}>{children}</code>
          }
          return (
            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
              <code className={className} {...props}>{children}</code>
            </pre>
          )
        },
        a: ({ node, ...props }: any) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer"
            onClick={(e: any) => e.stopPropagation()}
          />
        ),
      }
    }

    // 完整版本：包含所有功能 - 暂时禁用Mermaid
    return {
      code: (props: any) => (
        <OptimizedCodeRenderer
          {...props}
          hiddenCodeCopyButton={hiddenCodeCopyButton}
          enableMermaidRendering={false} // 暂时禁用Mermaid
          generating={generating}
          preferCollapsedCodeBlock={preferCollapsedCodeBlock}
        />
      ),
      a: ({ node, ...props }: any) => (
        <a
          {...props}
          target="_blank"
          rel="noreferrer"
          onClick={(e: any) => e.stopPropagation()}
        />
      ),
    }
  }, [renderMode, hiddenCodeCopyButton, enableMermaidRendering, generating, preferCollapsedCodeBlock])

  // 性能监控：标记渲染开始和结束
  useEffect(() => {
    performanceMonitor.current.markRenderStart()
    return () => {
      performanceMonitor.current.markRenderEnd()
    }
  })

  const processedContent = useMemo(() => {
    // 如果正在生成中，不要截断内容以保证流式显示
    if (generating) {
      return children
    }
    
    // 安全检查：如果内容过长，强制截断以防止错误
    const safeMaxLength = renderMode === 'simplified' ? maxRenderLength : maxRenderLength * 2
    let content = children
    
    if (content.length > safeMaxLength) {
      content = content.slice(0, safeMaxLength) + `\n\n... (${t('Content truncated for performance')})`
      console.warn(`OptimizedMarkdown: Content truncated from ${children.length} to ${safeMaxLength} characters`)
    }
    
    if (renderMode === 'simplified') {
      // 简化模式：移除复杂的 LaTeX 处理
      return content
    }
    // 完整模式：保留所有处理
    return enableLaTeXRendering ? content : content // TODO: 添加 LaTeX 处理
  }, [children, enableLaTeXRendering, renderMode, maxRenderLength, generating])

  return (
    <div className={`optimized-markdown ${className || ''}`}>
      {shouldOptimize && (
        <div className="mb-2 text-xs text-gray-500 flex items-center justify-between">
          <span>{t('Performance mode:')} {renderMode === 'simplified' ? t('Simplified') : t('Full')}</span>
          <button
            onClick={() => setRenderMode(renderMode === 'simplified' ? 'full' : 'simplified')}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            {renderMode === 'simplified' ? t('Switch to Full') : t('Switch to Simplified')}
          </button>
        </div>
      )}
      
      <ReactMarkdown
        remarkPlugins={plugins.remarkPlugins}
        rehypePlugins={plugins.rehypePlugins}
        className={`break-words ${renderMode === 'simplified' ? 'simplified-markdown' : ''}`}
        urlTransform={(url) => sanitizeUrl(url)}
        components={getComponents()}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
})

// 优化的代码渲染器（懒加载语法高亮）
const OptimizedCodeRenderer = memo(({ children, className, ...props }: any) => {
  const [shouldHighlight, setShouldHighlight] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 使用 Intersection Observer 实现懒加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setShouldHighlight(true)
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  const language = /language-(\w+)/.exec(className || '')?.[1] || 'text'
  
  if (!String(children).includes('\n')) {
    return <code className={className}>{children}</code>
  }

  return (
    <div ref={ref}>
      {shouldHighlight && isVisible ? (
        <SyntaxHighlighter
          language={language}
          style={atomDark}
          customStyle={{
            margin: 0,
            borderRadius: '4px',
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <pre className="bg-gray-800 text-white p-3 rounded overflow-x-auto">
          <code>{children}</code>
        </pre>
      )}
    </div>
  )
})

OptimizedMarkdown.displayName = 'OptimizedMarkdown'
OptimizedCodeRenderer.displayName = 'OptimizedCodeRenderer'

export default OptimizedMarkdown