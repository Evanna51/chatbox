import React from 'react'
import * as Sentry from '@sentry/react'
import { useTranslation } from 'react-i18next'
import { getLogger } from '../lib/utils'

const log = getLogger('ErrorBoundary')

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  isDismissed: boolean
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isDismissed: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    log.error('ErrorBoundary caught an error:', error, errorInfo)

    // Capture exception in Sentry with additional context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', true)
      scope.setLevel('error')
      scope.setContext('errorInfo', {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
      })
      Object.keys(errorInfo).forEach((key) => {
        scope.setExtra(key, errorInfo[key as keyof React.ErrorInfo])
      })
      Sentry.captureException(error)
    })

    this.setState({
      error,
      errorInfo,
    })
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isDismissed: false,
    })
  }

  handleDismiss = () => {
    this.setState({
      isDismissed: true,
    })
  }

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props
      const { error } = this.state

      if (Fallback && error) {
        return <Fallback error={error} retry={this.handleRetry} />
      }

      // Default error UI
      return (
        <DefaultErrorFallback 
          error={error} 
          errorInfo={this.state.errorInfo} 
          retry={this.handleRetry}
          onDismiss={this.handleDismiss}
        />
      )
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retry: () => void
  onDismiss?: () => void
}

function DefaultErrorFallback({ error, errorInfo, retry, onDismiss }: DefaultErrorFallbackProps) {
  const { t } = useTranslation()
  const [showDetails, setShowDetails] = React.useState(false)
  const [isDismissed, setIsDismissed] = React.useState(false)

  // 判断是否是内容相关的错误（如超长内容导致的渲染问题）
  const isContentRelatedError = React.useMemo(() => {
    if (!error) return false
    const errorMessage = error.message?.toLowerCase() || ''
    const errorStack = error.stack?.toLowerCase() || ''
    
    // 检查是否是与内容渲染相关的错误
    const contentErrorPatterns = [
      'maximum call stack size exceeded',
      'out of memory',
      'script timeout',
      'too much recursion',
      'range error',
      'cannot read prop',
      'cannot read properties'
    ]
    
    return contentErrorPatterns.some(pattern => 
      errorMessage.includes(pattern) || errorStack.includes(pattern)
    )
  }, [error])

  // 如果错误已被用户关闭，返回 null 或一个最小化的提示
  if (isDismissed) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 shadow-lg max-w-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600 dark:text-yellow-300">⚠️</span>
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                {isContentRelatedError ? t('Content rendering issue detected') : t('Error dismissed')}
              </span>
            </div>
            <button
              onClick={retry}
              className="ml-2 text-yellow-600 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-100"
              title="Retry"
            >
              ↻
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {isContentRelatedError ? t('Content Display Issue') : t('Something went wrong!')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {isContentRelatedError 
            ? t('The content might be too large to display properly. This is usually not a serious error.')
            : t('The application encountered an unexpected error. This error has been automatically reported.')
          }
        </p>

        <div className="space-y-3">
          <button
            onClick={retry}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            {t('Try Again')}
          </button>

          {isContentRelatedError && (
            <button
              onClick={() => setIsDismissed(true)}
              className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              {t('Dismiss (Content Issue)')}
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            {t('Reload App')}
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              {t('Close Error Dialog')}
            </button>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-4 py-2 rounded-md transition-colors text-sm"
          >
            {showDetails ? t('Hide Error') : t('Show Error')}
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-left">
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              {error && (
                <div>
                  <strong>Error:</strong>
                  <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap">
                    {error.name}: {error.message}
                  </pre>
                </div>
              )}
              {error?.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap max-h-32">{error.stack}</pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap max-h-32">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Sentry Error Boundary (alternative approach using Sentry's built-in ErrorBoundary)
export const SentryErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  {
    fallback: ({ error, resetError }) => (
      <DefaultErrorFallback 
        error={error} 
        errorInfo={null} 
        retry={resetError}
        onDismiss={() => {
          // For Sentry error boundary, we can call resetError to dismiss
          resetError()
        }}
      />
    ),
    beforeCapture: (scope, error, errorInfo) => {
      scope.setTag('errorBoundary', 'sentry')
      scope.setLevel('error')
      if (errorInfo) {
        scope.setContext('errorInfo', {
          componentStack: (errorInfo as any).componentStack || 'Unknown component stack',
        })
      }
    },
  }
)
