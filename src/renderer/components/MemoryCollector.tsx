import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Session, CopilotDetail } from '../../shared/types'
import { useSettings } from '../hooks/useSettings'
import { 
  analyzeCharacterSession,
  analyzeCharacterSessions,
  exportMemoryCollectionAsJSON,
  exportMemoryCollectionsAsJSON,
  getCharacterCopilotSessions,
  MemoryCollection,
  AnalysisConfig,
  DEFAULT_ANALYSIS_CONFIG
} from '../packages/memory-collector'

interface MemoryCollectorProps {
  sessions: Session[]
  copilots: CopilotDetail[]
  currentSession?: Session
  open?: boolean
  onClose?: () => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`memory-tabpanel-${index}`}
      aria-labelledby={`memory-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export function MemoryCollector({ sessions, copilots, currentSession, open: externalOpen, onClose }: MemoryCollectorProps) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const [internalOpen, setInternalOpen] = useState(false)
  
  // 使用外部控制的open状态，如果没有则使用内部状态
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const handleClose = onClose || (() => setInternalOpen(false))
  const [tabValue, setTabValue] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<MemoryCollection[]>([])
  const [currentResult, setCurrentResult] = useState<MemoryCollection | null>(null)
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_ANALYSIS_CONFIG)
  const [error, setError] = useState<string | null>(null)

  // 获取Character类型的会话
  const characterSessions = getCharacterCopilotSessions(sessions, copilots)
  const isCurrentSessionCharacter = currentSession ? 
    characterSessions.some(s => s.id === currentSession.id) : false

  const handleAnalyzeCurrent = async () => {
    if (!currentSession || !isCurrentSessionCharacter) return

    setAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeCharacterSession(currentSession, config, settings)
      setCurrentResult(result)
      setTabValue(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAnalyzeAll = async () => {
    setAnalyzing(true)
    setError(null)

    try {
      const results = await analyzeCharacterSessions(sessions, copilots, config, settings)
      setResults(results)
      setTabValue(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleExportCurrent = () => {
    if (!currentResult) return

    const json = exportMemoryCollectionAsJSON(currentResult)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-${currentResult.sessionId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportAll = () => {
    if (results.length === 0) return

    const json = exportMemoryCollectionsAsJSON(results)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memories-all-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const MemoryItem = ({ memory }: { memory: MemoryCollection['memories'][0] }) => (
    <ListItem>
      <ListItemText
        primary={memory.content}
        secondary={
          <Box sx={{ mt: 1 }}>
            <Chip 
              label={memory.type} 
              size="small" 
              sx={{ mr: 1 }} 
              color={memory.confidence > 0.8 ? 'primary' : 'default'}
            />
            <Typography variant="caption" color="text.secondary">
              置信度: {(memory.confidence * 100).toFixed(0)}%
            </Typography>
            {memory.tags.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                {memory.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  )

  const EventItem = ({ event }: { event: MemoryCollection['events'][0] }) => (
    <ListItem>
      <ListItemText
        primary={event.title}
        secondary={
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {event.description}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={event.type} size="small" sx={{ mr: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {new Date(event.timestamp).toLocaleString()}
              </Typography>
            </Box>
            {event.tags.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                {event.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  )

  return (
    <>
      {externalOpen === undefined && (
        <Button variant="outlined" onClick={() => setInternalOpen(true)}>
          {t('Memory Collector')}
        </Button>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('Character Memory Collector')}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            自动收集Character类AI搭档对话中的关键信息，整理为事件和记忆
          </Typography>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Character类型会话: {characterSessions.length} 个
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                onClick={handleAnalyzeCurrent}
                disabled={!isCurrentSessionCharacter || analyzing}
              >
                {analyzing ? <CircularProgress size={20} /> : t('Analyze Current')}
              </Button>
              
              <Button
                variant="outlined"
                onClick={handleAnalyzeAll}
                disabled={characterSessions.length === 0 || analyzing}
              >
                {analyzing ? <CircularProgress size={20} /> : t('Analyze All')}
              </Button>
            </Box>

            {/* 配置选项 */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                分析配置
              </Typography>
              {/* <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.useAIAnalysis}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        useAIAnalysis: e.target.checked
                      }))}
                    />
                  }
                  label="启用AI智能分析"
                />

              </Box> */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.includeSystemMessages}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        includeSystemMessages: e.target.checked
                      }))}
                    />
                  }
                  label="包含系统消息"
                />
                <TextField
                  label="最小置信度"
                  type="number"
                  size="small"
                  value={config.minConfidence}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    minConfidence: parseFloat(e.target.value)
                  }))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="批处理最大Tokens"
                  type="number"
                  size="small"
                  value={config.maxBatchTokens}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    maxBatchTokens: parseInt(e.target.value)
                  }))}
                  inputProps={{ min: 1000, max: 200000, step: 1000 }}
                  sx={{ width: 150 }}
                  disabled={!config.useAIAnalysis}
                />
              </Box>
              
              {/* AI分析模式说明 */}
              {config.useAIAnalysis && (
                <Box sx={{ mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="caption" color="info.contrastText">
                    💡 AI批量分析模式：使用{settings?.summaryModel ? `${settings.summaryModel.provider} - ${settings.summaryModel.model}` : '默认模型'}进行智能语义分析。
                    将多条消息拼接至{(config.maxBatchTokens / 1000).toFixed(0)}K tokens后批量处理，大幅提升效率并保持上下文连贯性。
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="当前会话分析" />
              <Tab label="批量分析结果" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            {currentResult ? (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      {currentResult.copilotName}
                    </Typography>
                    <Button onClick={handleExportCurrent} variant="outlined" size="small">
                      导出JSON
                    </Button>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {currentResult.summary}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle1" gutterBottom>
                    记忆信息 ({currentResult.memories.length})
                  </Typography>
                  <List dense>
                    {currentResult.memories.map(memory => (
                      <MemoryItem key={memory.id} memory={memory} />
                    ))}
                  </List>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle1" gutterBottom>
                    事件记录 ({currentResult.events.length})
                  </Typography>
                  <List dense>
                    {currentResult.events.map(event => (
                      <EventItem key={event.id} event={event} />
                    ))}
                  </List>
                </CardContent>
              </Card>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                请点击"分析当前会话"开始分析
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {results.length > 0 ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    分析结果 ({results.length} 个会话)
                  </Typography>
                  <Button onClick={handleExportAll} variant="outlined" size="small">
                    导出全部JSON
                  </Button>
                </Box>

                {results.map(result => (
                  <Card key={result.sessionId} sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {result.copilotName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {result.summary}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={`${result.memories.length} 条记忆`} size="small" />
                        <Chip label={`${result.events.length} 个事件`} size="small" />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                请点击"批量分析"开始分析所有Character类型会话
              </Typography>
            )}
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>
            {t('Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default MemoryCollector