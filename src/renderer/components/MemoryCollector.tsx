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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Session, CopilotDetail, Message, KnowledgeBase } from '../../shared/types'
import { useSettings } from '../hooks/useSettings'
import { 
  analyzeSession,
  exportMemoryCollectionAsJSON,
  MemoryCollection,
  AnalysisConfig,
  AnalysisMode,
  DEFAULT_ANALYSIS_CONFIG
} from '../packages/memory-collector'
import { generateSafeFilename } from '../utils'
import platform from '../platform'

interface MemoryCollectorProps {
  sessions: Session[]
  copilots: CopilotDetail[]
  currentSession?: Session
  open?: boolean
  onClose?: () => void
}


export function MemoryCollector({ sessions, copilots, currentSession, open: externalOpen, onClose }: MemoryCollectorProps) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const [internalOpen, setInternalOpen] = useState(false)
  
  // 使用外部控制的open状态，如果没有则使用内部状态
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const handleClose = onClose || (() => setInternalOpen(false))
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<MemoryCollection | null>(null)
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_ANALYSIS_CONFIG)
  const [error, setError] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string>('all_threads')
  const [kbDialogOpen, setKbDialogOpen] = useState(false)
  const [kbOptions, setKbOptions] = useState<KnowledgeBase[]>([])
  const [selectedKbId, setSelectedKbId] = useState<number | ''>('')
  const [addingToKb, setAddingToKb] = useState(false)

  // 检查当前会话是否可以进行话题分析
  const isCurrentSessionAvailable = !!currentSession
  // const canAnalyzeTopics = isCurrentSessionAvailable && currentSession.messages.length > 0
  
  // 构建话题选项列表
  const threadOptions = React.useMemo(() => {
    if (!currentSession) return []
    
    const options = []
    
    // 添加"所有话题"选项
    const totalMessages = (currentSession.messages?.length || 0) + 
      (currentSession.threads?.reduce((sum, thread) => sum + (thread.messages?.length || 0), 0) || 0)
    
    if (totalMessages > 0) {
      options.push({
        id: 'all_threads',
        name: '所有话题',
        messageCount: totalMessages
      })
    }
    
    // 添加当前话题（如果有消息）
    if (currentSession.messages && currentSession.messages.length > 0) {
      options.push({
        id: 'current',
        name: currentSession.threadName || '当前话题',
        messageCount: currentSession.messages.length
      })
    }
    
    // 添加历史话题
    if (currentSession.threads) {
      currentSession.threads.forEach(thread => {
        if (thread.messages && thread.messages.length > 0) {
          options.push({
            id: thread.id,
            name: thread.name,
            messageCount: thread.messages.length
          })
        }
      })
    }
    
    return options
  }, [currentSession])

  const handleAnalyze = async () => {
    if (!currentSession || !selectedThreadId) return

    setAnalyzing(true)
    setError(null)

    try {
      let sessionToAnalyze: Session
      
      if (selectedThreadId === 'all_threads') {
        // 分析整个会话（包括所有话题）
        sessionToAnalyze = currentSession
      } else if (selectedThreadId === 'current') {
        // 分析当前话题
        sessionToAnalyze = {
          ...currentSession,
          messages: currentSession.messages,
          name: `${currentSession.name} - ${currentSession.threadName || '当前话题'}`
        }
      } else {
        // 分析选中的历史话题
        const selectedThread = currentSession.threads?.find(t => t.id === selectedThreadId)
        if (!selectedThread || !selectedThread.messages.length) {
          setError('选中的话题没有消息内容')
          return
        }
        
        sessionToAnalyze = {
          ...currentSession,
          messages: selectedThread.messages,
          name: `${currentSession.name} - ${selectedThread.name}`
        }
      }
      
      const result = await analyzeSession(sessionToAnalyze, config, settings)
      setAnalysisResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleExport = () => {
    if (!analysisResult) return

    try {
      const content = exportMemoryCollectionAsJSON(analysisResult)
      
      // 使用主题名字生成安全的文件名
      let baseName = ''
      
      // 优先使用会话名称作为基础名称
      if (currentSession?.name) {
        baseName = currentSession.name
      } else {
        baseName = analysisResult.copilotName || 'analysis'
      }
      
      // 如果是分析特定话题（非全部话题），添加话题信息
      if (selectedThreadId && selectedThreadId !== 'all_threads' && currentSession) {
        let threadName = ''
        if (selectedThreadId === 'current') {
          threadName = currentSession.threadName || '当前话题'
        } else {
          const selectedThread = currentSession.threads?.find(t => t.id === selectedThreadId)
          threadName = selectedThread?.name || ''
        }
        
        if (threadName) {
          baseName = `${baseName}-${threadName}`
        }
      }
      
      // 生成安全的文件名，限制长度为30个字符（为日期和扩展名留出空间）
      const safeBaseName = generateSafeFilename(baseName, 30)
      // 只保留日期部分 (YYYYMMDD)
      // const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '')
      const filename = `${safeBaseName}.json`
      
      // 使用平台导出器，兼容移动端（Capacitor）与 Web
      platform.exporter.exportTextFile(filename, content)
    } catch (error) {
      setError(error instanceof Error ? error.message : '导出失败')
    }
  }

  const buildFilenameAndContent = () => {
    if (!analysisResult) return null
    const content = exportMemoryCollectionAsJSON(analysisResult)
    let baseName = ''
    if (currentSession?.name) {
      baseName = currentSession.name
    } else {
      baseName = analysisResult.copilotName || 'analysis'
    }
    if (selectedThreadId && selectedThreadId !== 'all_threads' && currentSession) {
      let threadName = ''
      if (selectedThreadId === 'current') {
        threadName = currentSession.threadName || '当前话题'
      } else {
        const selectedThread = currentSession.threads?.find(t => t.id === selectedThreadId)
        threadName = selectedThread?.name || ''
      }
      if (threadName) {
        baseName = `${baseName}-${threadName}`
      }
    }
    const safeBaseName = generateSafeFilename(baseName, 30)
    const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '')
    const filename = `${safeBaseName}-${dateStr}.json`
    return { filename, content }
  }

  const handleAddToKnowledgeBase = async () => {
    try {
      if (!analysisResult) return
      setError(null)
      const fc = buildFilenameAndContent()
      if (!fc) return
      const { filename, content } = fc

      // 获取知识库列表
      let controller
      try {
        controller = platform.getKnowledgeBaseController()
      } catch (e) {
        setError('当前平台不支持知识库')
        return
      }

      const list = await controller.list()
      if (!list || list.length === 0) {
        setError('请先在知识库页面创建一个知识库')
        return
      }
      if (list.length === 1) {
        // 直接添加
        await addJsonToKb(list[0].id, filename, content)
        return
      }
      // 多个知识库，弹出选择
      setKbOptions(list)
      setSelectedKbId('')
      setKbDialogOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加到知识库失败')
    }
  }

  const addJsonToKb = async (kbId: number, filename: string, content: string) => {
    try {
      setAddingToKb(true)
      const controller = platform.getKnowledgeBaseController()
      const file = new File([content], filename, { type: 'application/json' })
      const fileMeta = {
        name: filename,
        path: filename,
        type: 'application/json',
        size: file.size,
        _file: file,
      }
      await controller.uploadFile(kbId, fileMeta)
      setKbDialogOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传到知识库失败')
    } finally {
      setAddingToKb(false)
    }
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

  const ConversationSummaryDisplay = ({ summary }: { summary: MemoryCollection['conversationSummary'] }) => {
    if (!summary) return null
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>对话总结分析</Typography>
        
        <Box sx={{ mb: 3 }}>

          <Typography variant="subtitle2" gutterBottom>主要话题</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {summary.mainTopics.map((topic, index) => (
              <Chip key={index} label={topic} color="primary" variant="outlined" />
            ))}
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>关键信息</Typography>
          <List dense>
            {summary.keyInformation.map((info, index) => (
              <ListItem key={index}>
                <ListItemText primary={info} />
              </ListItem>
            ))}
          </List>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>情绪分析</Typography>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Chip 
                label={`整体情绪: ${summary.emotionalTone.overall}`} 
                color={
                  summary.emotionalTone.overall === 'positive' ? 'success' :
                  summary.emotionalTone.overall === 'negative' ? 'error' :
                  summary.emotionalTone.overall === 'mixed' ? 'warning' : 'default'
                }
                sx={{ mr: 1 }}
              />
            </Box>
            <Typography variant="body2" sx={{ mb: 2 }}>{summary.emotionalTone.details}</Typography>
            <Box>
              <Typography variant="caption" color="text.secondary">用户情绪：</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>{summary.participantMoods.user}</Typography>
              <Typography variant="caption" color="text.secondary">AI助手情绪：</Typography>
              <Typography variant="body2">{summary.participantMoods.assistant}</Typography>
            </Box>
          </Card>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>对话流程</Typography>
          <Typography variant="body2">{summary.conversationFlow}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>主要结论</Typography>
          <List dense>
            {summary.conclusions.map((conclusion, index) => (
              <ListItem key={index}>
                <ListItemText primary={conclusion} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    )
  }

  const NovelOutlineDisplay = ({ outline }: { outline: MemoryCollection['novelOutline'] }) => {
    if (!outline) return null
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>小说大纲分析</Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>基本信息</Typography>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}><strong>类型：</strong>{outline.genre}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}><strong>时间背景：</strong>{outline.setting.time}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}><strong>地点背景：</strong>{outline.setting.place}</Typography>
            <Typography variant="body2"><strong>世界观：</strong>{outline.setting.worldBuilding}</Typography>
          </Card>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>角色设定</Typography>
          <List dense>
            {outline.characters.map((character, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={`${character.name} (${character.role})`}
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>{character.description}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {character.traits.map((trait, traitIndex) => (
                          <Chip key={traitIndex} label={trait} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>情节结构</Typography>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ mb: 2 }}><strong>开端：</strong>{outline.plotStructure.setup}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}><strong>起始事件：</strong>{outline.plotStructure.incitingIncident}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}><strong>发展：</strong></Typography>
            <List dense sx={{ ml: 2 }}>
              {outline.plotStructure.risingAction.map((action, index) => (
                <ListItem key={index}>
                  <ListItemText primary={action} />
                </ListItem>
              ))}
            </List>
            <Typography variant="body2" sx={{ mb: 2 }}><strong>高潮：</strong>{outline.plotStructure.climax}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}><strong>下降：</strong>{outline.plotStructure.fallingAction}</Typography>
            <Typography variant="body2"><strong>结局：</strong>{outline.plotStructure.resolution}</Typography>
          </Card>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>主题</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {outline.themes.map((theme, index) => (
              <Chip key={index} label={theme} color="secondary" variant="outlined" />
            ))}
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>冲突</Typography>
          <List dense>
            {outline.conflicts.map((conflict, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={`${conflict.type} 冲突`}
                  secondary={conflict.description}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>关键场景</Typography>
          <List dense>
            {outline.keyScenes.map((scene, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={scene.title}
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>{scene.description}</Typography>
                      <Typography variant="caption" color="text.secondary">重要性：{scene.importance}</Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    )
  }

  return (
    <>
      {externalOpen === undefined && (
        <Button variant="outlined" onClick={() => setInternalOpen(true)}>
          {t('Memory Collector')}
        </Button>
      )}

      <Dialog 
       open={open} onClose={handleClose} maxWidth="md" fullWidth
       PaperProps={{
        sx: {
          margin: '12px',
          maxWidth: '400px',
          borderRadius: 2,
        },
      }}>
        <DialogTitle>
          {t('Memory Collector')}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            自动收集对话中的关键信息，整理为事件和记忆
          </Typography>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            
            <div style={{padding: '10px 0'}}></div>
            {threadOptions.length > 0 && (
              <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>选择分析范围</InputLabel>
                  <Select
                    value={selectedThreadId}
                    label="选择分析范围"
                    onChange={(e) => setSelectedThreadId(e.target.value)}
                    disabled={analyzing}
                  >
                    {/* <MenuItem value="">
                      <em>请选择分析范围</em>
                    </MenuItem> */}
                    {threadOptions.map(option => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.name} ({option.messageCount} 条)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Button
                  variant="contained"
                  onClick={handleAnalyze}
                  disabled={!selectedThreadId || analyzing}
                >
                  {analyzing ? <CircularProgress size={20} /> : '开始分析'}
                </Button>
              </Box>
            )}

            {/* 配置选项 */}
            <Box sx={{ mb: 2 }}>
             
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>分析模式</InputLabel>
                  <Select
                    value={config.analysisMode}
                    label="分析模式"
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      analysisMode: e.target.value as AnalysisMode
                    }))}
                  >
                    <MenuItem value="default">人物模式</MenuItem>
                    <MenuItem value="conversation_summary">对话总结</MenuItem>
                    <MenuItem value="novel_outline">小说大纲</MenuItem>
                  </Select>
                </FormControl>
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
                  label="系统消息"
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
                  disabled={config.analysisMode !== 'default'}
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
              {config.analysisMode === 'conversation_summary' && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  对话总结模式：将分析对话的主要内容、情绪基调和关键信息点
                </Alert>
              )}
              {config.analysisMode === 'novel_outline' && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  小说大纲模式：将提取小说创作相关的角色、情节、设定等元素
                </Alert>
              )}
            </Box>
          </Box>

          {/* 分析结果显示 */}
          {analysisResult ? (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    {analysisResult.copilotName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={handleExport} variant="outlined" size="small">
                      导出JSON
                    </Button>
                    <Button onClick={handleAddToKnowledgeBase} variant="contained" size="small">
                      添加到知识库
                    </Button>
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {analysisResult.summary}
                </Typography>

                <Divider sx={{ my: 2 }} />

                {/* 根据分析模式显示不同内容 */}
                {config.analysisMode === 'conversation_summary' && analysisResult.conversationSummary && (
                  <ConversationSummaryDisplay summary={analysisResult.conversationSummary} />
                )}

                {config.analysisMode === 'novel_outline' && analysisResult.novelOutline && (
                  <NovelOutlineDisplay outline={analysisResult.novelOutline} />
                )}

                {config.analysisMode === 'default' && (
                  <>
                    <Typography variant="subtitle1" gutterBottom>
                      记忆信息 ({analysisResult.memories.length})
                    </Typography>
                    <List dense>
                      {analysisResult.memories.map(memory => (
                        <MemoryItem key={memory.id} memory={memory} />
                      ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle1" gutterBottom>
                      事件记录 ({analysisResult.events.length})
                    </Typography>
                    <List dense>
                      {analysisResult.events.map(event => (
                        <EventItem key={event.id} event={event} />
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              请选择分析范围并开始分析
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>
            {t('Close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 选择知识库对话框 */}
      <Dialog open={kbDialogOpen} onClose={() => setKbDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>选择知识库</DialogTitle>
        <DialogContent>
          <FormControl size="small" fullWidth sx={{ mt: 1 }}>
            <InputLabel>知识库</InputLabel>
            <Select
              value={selectedKbId}
              label="知识库"
              onChange={(e) => setSelectedKbId(Number(e.target.value))}
            >
              {kbOptions.map(kb => (
                <MenuItem key={kb.id} value={kb.id}>{kb.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKbDialogOpen(false)} disabled={addingToKb}>取消</Button>
          <Button
            onClick={async () => {
              const fc = buildFilenameAndContent()
              if (!fc || !selectedKbId) return
              await addJsonToKb(Number(selectedKbId), fc.filename, fc.content)
            }}
            variant="contained"
            disabled={!selectedKbId || addingToKb}
          >
            {addingToKb ? <CircularProgress size={18} /> : '添加'}
          </Button>
        </DialogActions>
      </Dialog>

    </>
  )
}

export default MemoryCollector