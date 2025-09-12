import React, { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, Stack, Text, Badge, Group } from '@mantine/core'
import { useProviders } from '@/hooks/useProviders'
import { useSettings } from '@/hooks/useSettings'
import type { ProviderModelInfo } from 'src/shared/types'
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
  showVisionModel = true,
  compact = false,
}) => {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const { settings } = useSettings()

  // 获取模型列表的通用函数
  const getModelList = useCallback(
    (filter: (model: ProviderModelInfo) => boolean) => {
      return compactArray(
        flatten(
          providers.map((provider) => {
            return provider.models?.filter(filter).map((model) => {
              const label = compact ? 
                (model.nickname || model.modelId) : 
                `${provider.name} | ${model.nickname || model.modelId}`
              
              return {
                label,
                value: `${provider.id}:${model.modelId}`,
                group: compact ? provider.name : undefined,
              }
            })
          })
        )
      )
    },
    [providers, compact]
  )

  // 获取不同类型的模型列表
  const embeddingModelList = useMemo(() => {
    return getModelList((model) => !!model.type && model.type === 'embedding')
  }, [getModelList])

  const rerankModelList = useMemo(() => {
    return getModelList((model) => model.type === 'rerank')
  }, [getModelList])

  const visionModelList = useMemo(() => {
    return getModelList((model) => !!model.capabilities?.includes('vision'))
  }, [getModelList])

  // 格式化模型名称显示
  const formatModelName = useCallback((modelValue: string | null) => {
    if (!modelValue) return t('None')
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = providers.find(p => p.id === providerId)
    const model = provider?.models?.find(m => m.modelId === modelId)
    
    if (compact) {
      return model?.nickname || modelId || modelValue
    }
    
    return `${provider?.name || providerId} | ${model?.nickname || modelId || modelValue}`
  }, [providers, t, compact])

  // 检查模型是否可用
  const isModelAvailable = useCallback((modelValue: string | null) => {
    if (!modelValue) return true
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = providers.find(p => p.id === providerId)
    return !!provider?.models?.find(m => m.modelId === modelId)
  }, [providers])

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
            <Select
              placeholder={String(t('Select embedding model'))}
              description={compact ? undefined : String(t('Used to extract text feature vectors'))}
              data={embeddingModelList}
              value={embeddingModel || null}
              onChange={onEmbeddingModelChange}
              {...selectProps}
              allowDeselect={false}
              required
            />
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
          <Select
            placeholder={String(t('Select rerank model'))}
            description={compact ? undefined : String(t('Used to get more accurate search results'))}
            data={rerankModelList}
            value={rerankModel || null}
            onChange={onRerankModelChange}
            {...selectProps}
          />
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
          <Select
            placeholder={String(t('Select vision model'))}
            description={compact ? undefined : String(t('Used to preprocess image files'))}
            data={visionModelList}
            value={visionModel || null}
            onChange={onVisionModelChange}
            {...selectProps}
          />
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
  const { providers } = useProviders()

  const formatModelName = useCallback((modelValue: string | null) => {
    if (!modelValue) return t('None')
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = providers.find(p => p.id === providerId)
    const model = provider?.models?.find(m => m.modelId === modelId)
    
    return model?.nickname || modelId || modelValue
  }, [providers, t])

  const isModelAvailable = useCallback((modelValue: string | null) => {
    if (!modelValue) return true
    
    const [providerId, modelId] = modelValue.split(':')
    const provider = providers.find(p => p.id === providerId)
    return !!provider?.models?.find(m => m.modelId === modelId)
  }, [providers])

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
      <ModelBadge modelValue={visionModel} label={t('Vision')} />
    </Stack>
  )
}

export default MobileModelSelector
