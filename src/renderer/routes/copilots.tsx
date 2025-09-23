import { Switch as MantineSwitch } from '@mantine/core'
import { ConfirmDeleteMenuItem } from '@/components/ConfirmDeleteButton'
import EmojiPicker from '@/components/EmojiPicker'
import { ImageInStorage, handleImageInputAndSave } from '@/components/Image'
import Page from '@/components/Page'
import StyledMenu from '@/components/StyledMenu'
import { useMyCopilots } from '@/hooks/useCopilots'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { trackingEvent } from '@/packages/event'
import platform from '@/platform'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as atoms from '@/stores/atoms'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import EditIcon from '@mui/icons-material/Edit'
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions'
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import StarIcon from '@mui/icons-material/Star'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Card,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import type { CopilotDetail } from '../../shared/types'

// 定义分类选项
const COPILOT_CATEGORIES = {
  CHARACTER: 'Character',
} as const

// Character分类的默认prompt模板
const CHARACTER_DEFAULT_PROMPT = '你是一个有趣的AI助手，拥有独特的个性。请用友好、幽默的方式与用户交流，展现你的个性特点。'

export const Route = createFileRoute('/copilots')({
  component: Copilots,
})

function Copilots() {
  const [open, setOpen] = useAtom(atoms.openCopilotDialogAtom)
  const [showCopilotsInNewSession, setShowCopilotsInNewSession] = useAtom(atoms.showCopilotsInNewSessionAtom)
  const navigate = useNavigate()

  const { t } = useTranslation()

  const store = useMyCopilots()
  

  const handleClose = () => {
    setOpen(false)
  }

  const selectCopilot = (detail: CopilotDetail) => {
    const newDetail = { ...detail, usedCount: (detail.usedCount || 0) + 1 }
    store.addOrUpdate(newDetail)

    navigate({
      to: '/',
      search: {
        copilotId: detail.id,
      },
    })
    handleClose()
  }

  const [copilotEdit, setCopilotEdit] = useState<CopilotDetail | null>(null)
  useEffect(() => {
    if (!open) {
      setCopilotEdit(null)
    } else {
      trackingEvent('copilot_window', { event_category: 'screen_view' })
    }
  }, [open])

  const list = [
    ...store.copilots.filter((item) => item.starred).sort((a, b) => b.usedCount - a.usedCount),
    ...store.copilots.filter((item) => !item.starred).sort((a, b) => b.usedCount - a.usedCount),
  ]

  return (
    <Page title={t('My Copilots')}>
      <div className="p-4 max-w-4xl mx-auto">
        {copilotEdit ? (
          <CopilotForm
            copilotDetail={copilotEdit}
            close={() => {
              setCopilotEdit(null)
            }}
            save={(detail) => {
              store.addOrUpdate(detail)
              setCopilotEdit(null)
            }}
          />
        ) : (
          <>
            {/* Setting Section */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#212529'),
                }}
              >
                {t('Settings')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MantineSwitch
                  checked={showCopilotsInNewSession}
                  onChange={(event) => setShowCopilotsInNewSession(event.currentTarget.checked)}
                  label={t('Show Copilots in New Session')}
                />
              </Box>
            </Box>
            {/* Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={async () => {
                  const empty = await getEmptyCopilot()
                  setCopilotEdit(empty)
                }}
              >
                {t('Create New Copilot')}
              </Button>
            </Box>

            {/* Local Copilots */}
            <Stack spacing={1}>
              {list.map((item) => (
                <MiniItem
                  key={item.id}
                  mode="local"
                  detail={item}
                  selectMe={() => selectCopilot(item)}
                  switchStarred={() => {
                    const updated = { ...item, starred: !item.starred }
                    store.addOrUpdate(updated)
                  }}
                  editMe={() => setCopilotEdit(item)}
                  deleteMe={() => store.remove(item.id)}
                />
              ))}
            </Stack>
          </>
        )}

        {/* <ScrollableTabsButtonAuto
          values={[
            {
              value: 'chatbox-featured',
              label: t('Chatbox Featured'),
            },
          ]}
          currentValue="chatbox-featured"
          onChange={() => {}}
        /> */}
        {/* <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            width: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {remoteCopilots?.map((item, ix) => (
            <MiniItem key={`${item.id}_${ix}`} mode="remote" detail={item} useMe={() => useCopilot(item)} />
          ))}
        </div> */}
      </div>
    </Page>
  )
}

type MiniItemProps =
  | {
      mode: 'local'
      detail: CopilotDetail
      selectMe(): void
      switchStarred(): void
      editMe(): void
      deleteMe(): void
    }
  | {
      mode: 'remote'
      detail: CopilotDetail
      selectMe(): void
    }

function MiniItem(props: MiniItemProps) {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const selectCopilot = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    if (open) {
      return
    }
    props.selectMe()
  }
  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    event.preventDefault()
    setAnchorEl(event.currentTarget)
  }
  const closeMenu = () => {
    setAnchorEl(null)
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '10px 16px',
        height: '49px',
        cursor: 'pointer',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#dee2e6'),
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#fff'),
        transition: 'all 0.2s',
        '.edit-icon': {
          opacity: 0.5,
        },
        '&:hover': {
          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#adb5bd'),
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fa'),
        },
        '&:hover .edit-icon': {
          opacity: 1,
        },
      }}
      onClick={selectCopilot}
    >
      <Avatar sizes="30px" sx={{ width: '30px', height: '30px' }} src={props.detail.picUrl}>
        {props.detail.avatarKey ? (
          <ImageInStorage storageKey={props.detail.avatarKey} className="object-cover object-center w-full h-full" />
        ) : props.detail.avatarEmoji ? (
          <Typography variant="body1">{props.detail.avatarEmoji}</Typography>
        ) : null}
      </Avatar>
      <div
        style={{
          marginLeft: '5px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <Typography
          variant="body1"
          noWrap
          sx={{
            fontSize: '14px',
            fontWeight: 400,
            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#212529'),
          }}
        >
          {props.detail.name}
        </Typography>
      </div>

      {props.mode === 'local' && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: 'auto',
            }}
          >
            <IconButton
              onClick={openMenu}
              sx={{
                padding: '4px',
                color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#495057'),
              }}
            >
              {props.detail.starred ? (
                <StarIcon fontSize="small" sx={{ color: '#228be6' }} />
              ) : (
                <MoreHorizOutlinedIcon className="edit-icon" fontSize="small" />
              )}
            </IconButton>
          </Box>
          <StyledMenu
            MenuListProps={{
              'aria-labelledby': 'long-button',
            }}
            anchorEl={anchorEl}
            open={open}
            onClose={closeMenu}
          >
            <MenuItem
              key={'star'}
              onClick={() => {
                props.switchStarred()
                closeMenu()
              }}
              disableRipple
            >
              {props.detail.starred ? (
                <>
                  <StarOutlineIcon fontSize="small" />
                  {t('unstar')}
                </>
              ) : (
                <>
                  <StarIcon fontSize="small" />
                  {t('star')}
                </>
              )}
            </MenuItem>

            <MenuItem
              key={'edit'}
              onClick={() => {
                props.editMe()
                closeMenu()
              }}
              disableRipple
            >
              <EditIcon />
              {t('edit')}
            </MenuItem>

            <Divider sx={{ my: 0.5 }} />

            <ConfirmDeleteMenuItem
              onDelete={() => {
                setAnchorEl(null)
                closeMenu()
                props.deleteMe()
              }}
            />
          </StyledMenu>
        </>
      )}
    </Box>
  )
}

interface CopilotFormProps {
  copilotDetail: CopilotDetail
  close(): void
  save(copilotDetail: CopilotDetail): void
  // premiumActivated: boolean
  // openPremiumPage(): void
}

function CopilotForm(props: CopilotFormProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isSmallScreen = useIsSmallScreen()
  const [copilotEdit, setCopilotEdit] = useState<CopilotDetail>(props.copilotDetail)
  const avatarInputRef = React.useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    setCopilotEdit(props.copilotDetail)
  }, [props.copilotDetail])
  
  const [helperTexts, setHelperTexts] = useState({
    name: <></>,
    prompt: <></>,
  })
  
  const inputHandler = (field: keyof CopilotDetail) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setHelperTexts({ name: <></>, prompt: <></> })
      setCopilotEdit({ ...copilotEdit, [field]: event.target.value })
    }
  }
  
  const handleCategoryChange = (event: any) => {
    const category = event.target.value
    const updatedCopilot = { ...copilotEdit, category }
    
    // 如果选择Character分类，自动填充默认prompt
    if (category === COPILOT_CATEGORIES.CHARACTER && !copilotEdit.prompt) {
      updatedCopilot.prompt = CHARACTER_DEFAULT_PROMPT
    }
    
    setCopilotEdit(updatedCopilot)
    setHelperTexts({ name: <></>, prompt: <></> })
  }

  const handleEmojiSelect = (emoji: string) => {
    setCopilotEdit({ 
      ...copilotEdit, 
      avatarEmoji: emoji, 
      avatarKey: undefined, // 清除上传的图片
      picUrl: '' // 清除URL
    })
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const key = StorageKeyGenerator.picture(`copilot-avatar:${copilotEdit.id}`)
      handleImageInputAndSave(file, key, (savedKey) => {
        setCopilotEdit({ 
          ...copilotEdit, 
          avatarKey: savedKey, 
          avatarEmoji: undefined, // 清除emoji
          picUrl: '' // 清除URL
        })
      })
    }
  }

  const clearAvatar = () => {
    setCopilotEdit({ 
      ...copilotEdit, 
      avatarKey: undefined, 
      avatarEmoji: undefined, 
      picUrl: '' 
    })
  }

  const renderAvatar = () => {
    if (copilotEdit.avatarKey) {
      return <ImageInStorage storageKey={copilotEdit.avatarKey} className="object-cover object-center w-full h-full" />
    } else if (copilotEdit.avatarEmoji) {
      return <Typography variant="h3">{copilotEdit.avatarEmoji}</Typography>
    } else if (copilotEdit.picUrl) {
      return <img src={copilotEdit.picUrl} className="object-cover object-center w-full h-full" alt="Avatar" />
    } else {
      return <PhotoCameraIcon sx={{ fontSize: 40, color: 'action.disabled' }} />
    }
  }
  
  const save = () => {
    copilotEdit.name = copilotEdit.name.trim()
    copilotEdit.prompt = copilotEdit.prompt.trim()
    if (copilotEdit.picUrl) {
      copilotEdit.picUrl = copilotEdit.picUrl.trim()
    }
    if (copilotEdit.name.length === 0) {
      setHelperTexts({
        ...helperTexts,
        name: <p style={{ color: 'red' }}>{t('cannot be empty')}</p>,
      })
      return
    }
    if (copilotEdit.prompt.length === 0) {
      setHelperTexts({
        ...helperTexts,
        prompt: <p style={{ color: 'red' }}>{t('cannot be empty')}</p>,
      })
      return
    }
    props.save(copilotEdit)
    trackingEvent('create_copilot', { event_category: 'user' })
  }
  
  return (
    <Box
      sx={{
        marginBottom: '20px',
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[50],
        padding: '8px',
      }}
    >
      <TextField
        autoFocus={!isSmallScreen}
        margin="dense"
        label={t('Copilot Name')}
        fullWidth
        variant="outlined"
        placeholder={t('My Assistant') || ''}
        value={copilotEdit.name}
        onChange={inputHandler('name')}
        helperText={helperTexts.name}
      />
      
      <FormControl fullWidth margin="dense" variant="outlined">
        <InputLabel>{t('Copilot Category')}</InputLabel>
        <Select
          value={copilotEdit.category || ''}
          onChange={handleCategoryChange}
          label={t('Copilot Category')}
        >
          <MenuItem value="">
            <em>{t('None')}</em>
          </MenuItem>
          <MenuItem value={COPILOT_CATEGORIES.CHARACTER}>
            {t('Character')}
          </MenuItem>
        </Select>
      </FormControl>

      {/* 头像配置区域 */}
      <Card sx={{ margin: '16px 0', padding: '16px' }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('Copilot Avatar')}
        </Typography>
        
        <Stack direction="row" spacing={2} alignItems="center">
          {/* 头像预览 */}
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80,
              backgroundColor: theme.palette.grey[200],
              cursor: 'pointer'
            }}
            onClick={() => avatarInputRef.current?.click()}
          >
            {renderAvatar()}
          </Avatar>
          
          {/* 操作按钮 */}
          <Stack spacing={1}>
            <EmojiPicker
              onEmojiSelect={handleEmojiSelect}
              trigger={
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EmojiEmotionsIcon />}
                >
                  {t('Select Emoji')}
                </Button>
              }
            />
            
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCameraIcon />}
              onClick={() => avatarInputRef.current?.click()}
            >
              {t('Upload Image')}
            </Button>
            
            {(copilotEdit.avatarKey || copilotEdit.avatarEmoji || copilotEdit.picUrl) && (
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={clearAvatar}
              >
                {t('Clear Avatar')}
              </Button>
            )}
          </Stack>
        </Stack>
        
        <input
          type="file"
          ref={avatarInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        
        {/* 可选：保留URL输入 */}
        <TextField
          margin="dense"
          label={t('Copilot Avatar URL')}
          placeholder="http://xxxxx/xxx.png"
          fullWidth
          variant="outlined"
          size="small"
          value={copilotEdit.picUrl || ''}
          onChange={inputHandler('picUrl')}
          sx={{ marginTop: 2 }}
          helperText={t('Optional: Use URL instead of emoji or upload')}
        />
      </Card>
      
      <TextField
        margin="dense"
        label={t('Copilot Prompt')}
        placeholder={t('Copilot Prompt Demo') || ''}
        fullWidth
        variant="outlined"
        multiline
        minRows={4}
        maxRows={10}
        value={copilotEdit.prompt}
        onChange={inputHandler('prompt')}
        helperText={helperTexts.prompt}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <ButtonGroup>
          <Button variant="outlined" onClick={() => props.close()}>
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={save}>
            {t('save')}
          </Button>
        </ButtonGroup>
      </Box>
    </Box>
  )
}

export async function getEmptyCopilot(): Promise<CopilotDetail> {
  const conf = await platform.getConfig()
  return {
    id: `${conf.uuid}:${uuidv4()}`,
    name: '',
    picUrl: '',
    avatarKey: undefined,
    avatarEmoji: undefined,
    prompt: CHARACTER_DEFAULT_PROMPT,
    starred: false,
    usedCount: 0,
    category: COPILOT_CATEGORIES.CHARACTER,
  }
}
