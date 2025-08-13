import React, { useState } from 'react'
import { Box, Button, Popover, Typography, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// 常用emoji列表
const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
  '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
  '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
  '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
  '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
  '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓',
  '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙',
  '💜', '🤎', '🖤', '🤍', '💯', '💢', '💥', '💫', '💦', '💨',
  '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '👋', '🤚',
  '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊',
  '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
  '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
  '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶', '🧒'
]

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  trigger: React.ReactElement
}

export default function EmojiPicker({ onEmojiSelect, trigger }: EmojiPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const theme = useTheme()

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    handleClose()
  }

  const open = Boolean(anchorEl)

  return (
    <>
      {React.cloneElement(trigger, { onClick: handleClick })}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            width: 320,
            maxHeight: 400,
            overflow: 'auto',
          },
        }}
      >
        <Box p={2}>
          <Typography variant="subtitle2" gutterBottom>
            选择一个表情符号
          </Typography>
          <Grid container spacing={0.5}>
            {COMMON_EMOJIS.map((emoji, index) => (
              <Grid item key={index}>
                <Button
                  variant="text"
                  onClick={() => handleEmojiClick(emoji)}
                  sx={{
                    minWidth: 32,
                    width: 32,
                    height: 32,
                    padding: 0,
                    fontSize: '18px',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  {emoji}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Popover>
    </>
  )
}