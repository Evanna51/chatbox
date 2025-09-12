import NiceModal from '@ebay/nice-modal-react'
import EditIcon from '@mui/icons-material/Edit'
import ImageIcon from '@mui/icons-material/Image'
import { Box, Chip, IconButton, Tooltip as MuiTooltip, Typography, useTheme } from '@mui/material'
import { Flex, Text, Tooltip } from '@mantine/core'
import { IconSelector } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { PanelRightClose, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { isChatSession, isPictureSession, type ModelProvider } from '../../shared/types'
import useNeedRoomForWinControls from '../hooks/useNeedRoomForWinControls'
import { useIsSmallScreen } from '../hooks/useScreenChange'
import { useProviders } from '../hooks/useProviders'
import * as atoms from '../stores/atoms'
import * as sessionActions from '../stores/sessionActions'
import * as settingActions from '../stores/settingActions'
import ImageModelSelect from './ImageModelSelect'
import ProviderImageIcon from './icons/ProviderImageIcon'
import MiniButton from './MiniButton'
import ModelSelector from './ModelSelectorNew'
import Toolbar from './Toolbar'

export type HeaderProps = {
  model?: {
    provider: string
    modelId: string
  }
  onSelectModel?(provider: ModelProvider, modelId: string): void
}

export default function Header(props: HeaderProps = {}) {
  const { model, onSelectModel } = props
  const { t } = useTranslation()
  const theme = useTheme()
  const currentSession = useAtomValue(atoms.currentSessionAtom)
  const [showSidebar, setShowSidebar] = useAtom(atoms.showSidebarAtom)
  

  const isSmallScreen = useIsSmallScreen()
  const { providers } = useProviders()

  const { needRoomForMacWindowControls, needRoomForWindowsWindowControls } = useNeedRoomForWinControls()
  // Model display text logic (similar to InputBox)
  const modelSelectorDisplayText = useMemo(() => {
    if (!model) {
      return t('Select Model')
    }
    const providerInfo = providers.find((p) => p.id === model.provider)
    const modelInfo = providerInfo?.models?.find((m) => m.modelId === model.modelId)
    return `${modelInfo?.nickname || model.modelId}`
  }, [providers, model, t])

  // Short model display text for small screens
  const shortModelDisplayText = useMemo(() => {
    if (!modelSelectorDisplayText || modelSelectorDisplayText === t('Select Model')) {
      return modelSelectorDisplayText
    }
    const parts = modelSelectorDisplayText.split('/')
    return parts[parts.length - 1]
  }, [modelSelectorDisplayText, t])

  // Model selection error tip
  const [showSelectModelErrorTip, setShowSelectModelErrorTip] = useState(false)
  useEffect(() => {
    if (showSelectModelErrorTip) {
      const clickEventListener = () => {
        setShowSelectModelErrorTip(false)
        document.removeEventListener('click', clickEventListener)
      }
      document.addEventListener('click', clickEventListener)
      return () => {
        document.removeEventListener('click', clickEventListener)
      }
    }
  }, [showSelectModelErrorTip])

  // Listen for model validation events from InputBox
  useEffect(() => {
    const handleModelValidation = () => {
      if (currentSession && !currentSession.settings?.provider) {
        setShowSelectModelErrorTip(true)
      }
    }
    
    window.addEventListener('model-validation-needed', handleModelValidation)
    return () => {
      window.removeEventListener('model-validation-needed', handleModelValidation)
    }
  }, [currentSession])

  // 会话名称自动生成
  useEffect(() => {
    if (!currentSession) {
      return
    }
    const autoGenerateTitle = settingActions.getAutoGenerateTitle()
    if (!autoGenerateTitle) {
      return
    }

    // 检查是否有正在生成的消息
    const hasGeneratingMessage = currentSession.messages.some((msg) => msg.generating)

    // 如果有消息正在生成，或者消息数量少于2条，不触发名称生成
    if (hasGeneratingMessage || currentSession.messages.length < 2) {
      return
    }

    // 触发名称生成（在 sessionActions 中进行去重和延迟处理）
    if (currentSession.name === 'Untitled') {
      sessionActions.scheduleGenerateNameAndThreadName(currentSession.id)
    } else if (!currentSession.threadName) {
      sessionActions.scheduleGenerateThreadName(currentSession.id)
    }
  }, [currentSession])

  const editCurrentSession = () => {
    if (!currentSession) {
      return
    }
    NiceModal.show('session-settings', { session: currentSession })
  }

  let EditButton: React.ReactNode | null = null
  if (currentSession && isChatSession(currentSession) && currentSession.settings) {
    EditButton = (
      <MuiTooltip title={t('Current conversation configured with specific model settings')} className="cursor-pointer">
        <EditIcon
          className="ml-1 cursor-pointer w-4 h-4 opacity-30"
          fontSize="small"
          style={{ color: theme.palette.warning.main }}
        />
      </MuiTooltip>
    )
  } else if (currentSession && isPictureSession(currentSession)) {
    EditButton = (
      <MuiTooltip
        title={t('The Image Creator plugin has been activated for the current conversation')}
        className="cursor-pointer"
      >
        <Chip
          className="ml-2 cursor-pointer"
          variant="outlined"
          color="secondary"
          size="small"
          icon={<ImageIcon className="cursor-pointer" />}
          label={<span className="cursor-pointer">{t('Image Creator')}</span>}
        />
      </MuiTooltip>
    )
  } else {
    EditButton = <EditIcon className="ml-1 cursor-pointer w-4 h-4 opacity-30" fontSize="small" />
  }

  return (
    <div
      className={cn('title-bar flex flex-col')}
      style={{
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: theme.palette.divider,
      }}
    >
      {/* Title bar row */}
      <div
        className={cn(
          // 固定高度，和 Windows 的 win controls bar 高度一致
          'flex flex-row h-12 items-center',
          isSmallScreen ? '' : showSidebar ? 'sm:pl-3 sm:pr-2' : 'pr-2',
          (!showSidebar || isSmallScreen) && needRoomForMacWindowControls ? 'pl-20' : 'pl-3'
        )}
      >
        {(!showSidebar || isSmallScreen) && (
          <Box className={cn('controls cursor-pointer')} onClick={() => setShowSidebar(!showSidebar)}>
            <IconButton
              sx={
                isSmallScreen
                  ? {
                      borderColor: theme.palette.action.hover,
                      borderStyle: 'solid',
                      borderWidth: 1,
                    }
                  : {}
              }
            >
              <PanelRightClose size="20" strokeWidth={1.5} />
            </IconButton>
          </Box>
        )}
        {/* showSidebar ? 'ml-3' : 'ml-1' */}
        <div className={cn('w-full flex flex-row flex-grow pt-2 pb-2 ml-1')}>
          <div className="flex flex-row items-center w-0 flex-1 mr-1">
            <div className="">
              <Typography
                variant="h6"
                noWrap
                className={cn(
                  'flex-shrink flex-grow-0 overflow-hidden text-ellipsis whitespace-nowrap',
                  
                )}
                sx={{
                  fontSize: '14px',
                }}
              >
                {currentSession?.name}
              </Typography>
            {/* Model selector row */}
            {currentSession && onSelectModel && (
            <div className={cn('flex flex-row items-center relative z-10 controls')}>
          
              <div  className={cn('flex items-center controls', )}>
            <Tooltip
              label={t('Please select a model')}
              color="red"
              opened={showSelectModelErrorTip}
              withArrow
            >
              {currentSession.type === 'picture' ? (
                <ImageModelSelect onSelect={onSelectModel}>
                  <span 
                    className="flex items-center text-xs opacity-70 cursor-pointer bg-transparent hover:bg-slate-400/25 h-6 px-2 py-1 rounded controls"
                  >
                    {providers.find((p) => p.id === model?.provider)?.name || model?.provider || t('Select Model')}
                    <IconSelector size={12} className="opacity-50 ml-1" />
                  </span>
                </ImageModelSelect>
              ) : (
                <ModelSelector onSelect={onSelectModel}>
                  <Flex
                    gap="xxs"
                    
                    
                    align="center"
                    justify="flex-start"
                    className="cursor-pointer hover:bg-slate-400/25 rounded-lg min-h-[24px] controls"
                  >
                    {/* {!!model && <ProviderImageIcon size={12} provider={model.provider} />} */}
                    <Text size="xs" className="line-clamp-1">
                      {model?.provider?.slice(0,2).toUpperCase() +'/'}
                      {isSmallScreen ? shortModelDisplayText : modelSelectorDisplayText}
                    </Text>
                    <IconSelector
                      size={16}
                      className="flex-[0_0_auto] text-[var(--mantine-color-chatbox-tertiary-text)]"
                    />
                  </Flex>
                </ModelSelector>
              )}
            </Tooltip>
          </div>
        </div>
      )}
            </div>
            {isSmallScreen ? (
              <MiniButton
                className="ml-1 sm:ml-2 controls cursor-pointer"
                style={{ color: theme.palette.text.secondary }}
                onClick={() => {
                  editCurrentSession()
                }}
                tooltipTitle={
                  <div className="text-center inline-block">
                    <span>{t('Customize settings for the current conversation')}</span>
                  </div>
                }
                tooltipPlacement="top"
              >
                <Settings2 size="14" strokeWidth={1} />
              </MiniButton>
            ) : (
              <a
                onClick={() => {
                  editCurrentSession()
                }}
                className="controls flex mr-8 cursor-pointer"
              >
                {EditButton}
              </a>
            )}
          </div>
          <div className={cn('flex-shrink-0', needRoomForWindowsWindowControls ? 'mr-36' : '')}>
            <Toolbar />
          </div>
        </div>
      </div>
    </div>
  )
}
