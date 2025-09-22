import React, { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, Stack, Text, Badge, Group } from '@mantine/core'
import { useProviders } from '@/hooks/useProviders'
import { useSettings } from '@/hooks/useSettings'
import type { ProviderModelInfo, ProviderInfo } from 'src/shared/types'
import compactArray from 'lodash/compact'
import flatten from 'lodash/flatten'

interface MobileModelSelectorProps {
  embeddingModel?: string | null
  rerankModel?: string | null
  visionModel?: string | null
  onEmbeddingModelChange?: (value: string | null) => void
  onRerankModelChange?: (value: string | null) => void
  onVisionModelChange?: (value: string | null) => void
  showEmbeddingModel?: boolean
  showRerankModel?: boolean
  showVisionModel?: boolean
  compact?: boolean
}

export const MobileModelSelector: React.FC<MobileModelSelectorProps> = ({
  embeddingModel,
  rerankModel,
  visionModel,
  onEmbeddingModelChange,
  onRerankModelChange,
  onVisionModelChange,
  showEmbeddingModel = true,
  showRerankModel = true,
  showVisionModel = false,
  compact = false,
}) => {
  const { t } = useTranslation()
  const { providers = [] } = useProviders()
  const safeProviders: ProviderInfo[] = Array.isArray(providers) ? (providers as unknown as ProviderInfo[]) : []
  const { settings } = useSettings()

  // 获取模型列表的通用函数
  const getModelList = useCallback(
    (filter: (model: ProviderModelInfo) => boolean) => {
      try {
        const safeProviders = Array.isArray(providers) ? providers : []
        console.log('[MobileModelSelector] providers summary', safeProviders.map((p: any) => ({ id: p.id, name: p.name, models: p?.models?.length, defaultModels: p?.defaultSettings?.models?.length })))
        const optionGroups = safeProviders.map((provider) => {
          const providerModels = ((provider && (provider as any).models) || (provider as any)?.defaultSettings?.models || []) as (ProviderModelInfo | null | undefined)[]
          const filteredModels = Array.isArray(providerModels)
            ? providerModels.filter((m): m is ProviderModelInfo => Boolean(m) && filter(m as ProviderModelInfo))
            : []
          return filteredModels
            .map((model) => {
              const providerId = (provider as any)?.id as string | undefined
              const modelId = (model as any)?.modelId as string | undefined
              if (!providerId || !modelId) return null
              const label = compact
                ? (model.nickname || modelId)
                : `${(provider as any)?.name || providerId} | ${model.nickname || modelId}`
              // 注意：不要包含 group 字段，避免 Mantine 误判为分组数据从而访问 items.map
              return {
                label,
                value: `${providerId}:${modelId}`,
              }
            })
            .filter(Boolean)
        })
        return compactArray(flatten(optionGroups))
      } catch (err) {
        console.error('[MobileModelSelector] getModelList error:', err)
        return []
      }
    },
    [providers, compact]
  )

  // 获取不同类型的模型列表
  const embeddingModelList = useMemo(() => {
    const list = getModelList((model) => !!model.type && model.type === 'embedding') || []
    console.log('[MobileModelSelector] embeddingModelList length', list.length)
    if (list.length) console.table(list.slice(0, 5))
    return list
  }, [getModelList])

  const rerankModelList = useMemo(() => {
    const list = getModelList((model) => (model as any)?.type === 'rerank') || []
    console.log('[MobileModelSelector] rerankModelList length', list.length)
    if (list.length) console.table(list.slice(0, 5))
    return list
  }, [getModelList])

  const visionModelList = useMemo(() => {
    const list = getModelList((model) => Array.isArray((model as any)?.capabilities) && (model as any).capabilities.includes('vision')) || []
    console.log('[MobileModelSelector] visionModelList length', list.length)
    if (list.length) console.table(list.slice(0, 5))
    return list
  }, [getModelList])

  // 格式化模型名称显示
  const formatModelName = useCallback((modelValue: string | null) => {
    if (!modelValue) return t('None')
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = safeProviders.find((p: ProviderInfo) => p.id === providerId)
    const allModels = ((provider && (provider as any).models) || (provider as any)?.defaultSettings?.models || []) as ProviderModelInfo[]
    const model = allModels.find(m => m.modelId === modelId)
    
    if (compact) {
      return model?.nickname || modelId || modelValue
    }
    
    return `${provider?.name || providerId} | ${model?.nickname || modelId || modelValue}`
  }, [safeProviders, t, compact])

  // 检查模型是否可用
  const isModelAvailable = useCallback((modelValue: string | null) => {
    if (!modelValue) return true
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = safeProviders.find((p: ProviderInfo) => p.id === providerId)
    const allModels = ((provider && (provider as any).models) || (provider as any)?.defaultSettings?.models || []) as ProviderModelInfo[]
    return Array.isArray(allModels) && !!allModels.find(m => m.modelId === modelId)
  }, [safeProviders])

  // 获取模型状态标识
  const getModelBadge = useCallback((modelValue: string | null) => {
    if (!modelValue) return null
    
    const available = isModelAvailable(modelValue)
    if (!available) {
      return <Badge color="red" size="xs">{t('Unavailable')}</Badge>
    }
    
    return <Badge color="green" size="xs">{t('Available')}</Badge>
  }, [isModelAvailable, t])

  const selectProps = {
    searchable: true,
    clearable: true,
    comboboxProps: { withinPortal: false },
    size: compact ? 'sm' : 'md',
  }

  class RenderGuard extends React.Component<{ name: string; children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { name: string; children: React.ReactNode }) {
      super(props)
      this.state = { hasError: false }
    }
    componentDidCatch(error: any, info: any) {
      console.error(`[MobileModelSelector] ${this.props.name} render error:`, error, info?.componentStack)
      this.setState({ hasError: true })
    }
    render() {
      if (this.state.hasError) {
        return (
          <Text size="xs" c="red">
            {this.props.name} render error
          </Text>
        )
      }
      return this.props.children as any
    }
  }

  return (
    <Stack gap={compact ? 'xs' : 'sm'}>
      {showEmbeddingModel && (
        <div>
            <Group justify="space-between" mb={4}>
              <Text size={compact ? 'sm' : 'md'} fw={500}>
                {t('Embedding Model')}
              </Text>
              {getModelBadge(embeddingModel || null)}
            </Group>
            <RenderGuard name="EmbeddingSelect">
              <Select
                placeholder={String(t('Select embedding model'))}
                description={compact ? undefined : String(t('Used to extract text feature vectors'))}
                data={embeddingModelList}
                value={embeddingModelList.length > 0 ? (embeddingModel || null) : null}
                onChange={onEmbeddingModelChange}
                {...selectProps}
                allowDeselect={false}
                required
              />
            </RenderGuard>
        </div>
      )}

      {showRerankModel && (
        <div>
          <Group justify="space-between" mb={4}>
            <Text size={compact ? 'sm' : 'md'} fw={500}>
              {t('Rerank Model')} <Text span c="dimmed" size="xs">({t('Optional')})</Text>
            </Text>
            {getModelBadge(rerankModel || null)}
          </Group>
          <RenderGuard name="RerankSelect">
            <Select
              placeholder={String(t('Select rerank model'))}
              description={compact ? undefined : String(t('Used to get more accurate search results'))}
              data={rerankModelList}
              value={rerankModelList.length > 0 ? (rerankModel || null) : null}
              onChange={onRerankModelChange}
              {...selectProps}
            />
          </RenderGuard>
        </div>
      )}

      {showVisionModel && (
        <div>
          <Group justify="space-between" mb={4}>
            <Text size={compact ? 'sm' : 'md'} fw={500}>
              {t('Vision Model')} <Text span c="dimmed" size="xs">({t('Optional')})</Text>
            </Text>
            {getModelBadge(visionModel || null)}
          </Group>
          <RenderGuard name="VisionSelect">
            <Select
              placeholder={String(t('Select vision model'))}
              description={compact ? undefined : String(t('Used to preprocess image files'))}
              data={visionModelList}
              value={visionModelList.length > 0 ? (visionModel || null) : null}
              onChange={onVisionModelChange}
              {...selectProps}
            />
          </RenderGuard>
        </div>
      )}

      {/* 模型配置提示 */}
      {!compact && (embeddingModelList.length === 0 || rerankModelList.length === 0) && (
        <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
          💡 {t('Tip')}: {t('Add models in Settings - Provider - Model List to see more options')}
        </Text>
      )}
    </Stack>
  )
}

// 简化版本的模型显示组件
interface ModelDisplayProps {
  embeddingModel?: string | null
  rerankModel?: string | null
  visionModel?: string | null
}

export const MobileModelDisplay: React.FC<ModelDisplayProps> = ({
  embeddingModel = null,
  rerankModel = null,
  visionModel = null,
}) => {
  const { t } = useTranslation()
  const { providers = [] } = useProviders()
  const safeProviders = Array.isArray(providers) ? providers : []

  const formatModelName = useCallback((modelValue: string | null) => {
    if (!modelValue) return t('None')
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = safeProviders.find((p: ProviderInfo) => p.id === providerId)
    const allModels = ((provider && (provider as any).models) || (provider as any)?.defaultSettings?.models || []) as ProviderModelInfo[]
    const model = allModels.find(m => m.modelId === modelId)
    
    return model?.nickname || modelId || modelValue
  }, [safeProviders, t])

  const isModelAvailable = useCallback((modelValue: string | null) => {
    if (!modelValue) return true
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = safeProviders.find((p: ProviderInfo) => p.id === providerId)
    const allModels = ((provider && (provider as any).models) || (provider as any)?.defaultSettings?.models || []) as ProviderModelInfo[]
    return Array.isArray(allModels) && !!allModels.find(m => m.modelId === modelId)
  }, [safeProviders])

  const ModelBadge: React.FC<{ modelValue: string | null; label: string }> = ({ modelValue, label }) => {
    const available = isModelAvailable(modelValue)
    const modelName = formatModelName(modelValue)
    
    return (
      <Group gap="xs">
        <Text size="xs" c="dimmed">{label}:</Text>
        <Badge 
          color={!modelValue ? 'gray' : available ? 'blue' : 'red'} 
          size="sm"
          variant="light"
        >
          {modelName}
        </Badge>
      </Group>
    )
  }

  return (
    <Stack gap="xs">
      <ModelBadge modelValue={embeddingModel} label={t('Embedding')} />
      <ModelBadge modelValue={rerankModel} label={t('Rerank')} />
      {/* <ModelBadge modelValue={visionModel} label={t('Vision')} /> */}
    </Stack>
  )
}

export default MobileModelSelector
