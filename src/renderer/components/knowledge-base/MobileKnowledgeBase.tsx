import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Box, 
  Button, 
  Card, 
  Text, 
  Group, 
  Stack, 
  TextInput, 
  Modal,
  ActionIcon,
  Badge,
  Divider,
  Alert,
  Tabs,
  ScrollArea
} from '@mantine/core'
import { 
  IconPlus, 
  IconTrash, 
  IconSearch, 
  IconUpload,
  IconFile,
  IconInfoCircle,
  IconRefresh,
  IconBug,
  IconSettings,
  IconEdit
} from '@tabler/icons-react'
import { toast } from 'sonner'
import platform from '@/platform'
import type { KnowledgeBase, KnowledgeBaseFile } from 'src/shared/types'
import { MobileModelSelector, MobileModelDisplay } from './MobileModelSelector'

export default function MobileKnowledgeBase() {
  const { t } = useTranslation()
  const [kbList, setKbList] = useState<KnowledgeBase[]>([])
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null)
  const [files, setFiles] = useState<KnowledgeBaseFile[]>([])
  const [loading, setLoading] = useState(false)
  
  // 新建知识库
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [newEmbeddingModel, setNewEmbeddingModel] = useState<string | null>(null)
  const [newRerankModel, setNewRerankModel] = useState<string | null>(null)
  const [newVisionModel, setNewVisionModel] = useState<string | null>(null)
  
  // 编辑知识库
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editKb, setEditKb] = useState<KnowledgeBase | null>(null)
  const [editEmbeddingModel, setEditEmbeddingModel] = useState<string | null>(null)
  const [editRerankModel, setEditRerankModel] = useState<string | null>(null)
  const [editVisionModel, setEditVisionModel] = useState<string | null>(null)
  
  // 搜索
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'unknown'>('checking')
  const [controllerType, setControllerType] = useState<'SQLite' | 'LocalStorage' | 'Unknown'>('Unknown')

  const knowledgeBaseController = platform.getKnowledgeBaseController()

  // 获取知识库列表
  const fetchKbList = useCallback(async () => {
    try {
      setLoading(true)
      const list = await knowledgeBaseController.list()
      setKbList(list)
    } catch (error) {
      toast.error(t('Failed to fetch knowledge base list'))
      console.error('Failed to fetch KB list:', error)
    } finally {
      setLoading(false)
    }
  }, [knowledgeBaseController, t])

  // 获取文件列表
  const fetchFiles = useCallback(async (kbId: number) => {
    try {
      console.log(`[Mobile KB UI] Fetching files for KB ${kbId}`)
      const fileList = await knowledgeBaseController.listFiles(kbId)
      console.log(`[Mobile KB UI] Fetched ${fileList.length} files:`, fileList)
      setFiles(fileList)
    } catch (error) {
      toast.error(t('Failed to fetch files'))
      console.error('Failed to fetch files:', error)
    }
  }, [knowledgeBaseController, t])

  // 创建知识库
  const createKb = async () => {
    if (!newKbName.trim()) {
      toast.error(t('Please enter a name'))
      return
    }

    if (!newEmbeddingModel) {
      toast.error(t('Please select an embedding model'))
      return
    }

    try {
      setLoading(true)
      await knowledgeBaseController.create({
        name: newKbName.trim(),
        embeddingModel: newEmbeddingModel,
        rerankModel: newRerankModel || 'none',
        visionModel: newVisionModel || 'none',
      })
      
      toast.success(t('Knowledge base created'))
      
      // 重置表单
      setNewKbName('')
      setNewEmbeddingModel(null)
      setNewRerankModel(null)
      setNewVisionModel(null)
      setCreateModalOpen(false)
      
      await fetchKbList()
    } catch (error) {
      toast.error(t('Failed to create knowledge base'))
      console.error('Failed to create KB:', error)
    } finally {
      setLoading(false)
    }
  }

  // 编辑知识库
  const updateKb = async () => {
    if (!editKb) return

    if (!editEmbeddingModel) {
      toast.error(t('Please select an embedding model'))
      return
    }

    try {
      setLoading(true)
      await knowledgeBaseController.update({
        id: editKb.id,
        name: editKb.name, // 保持名称不变，或者可以添加名称编辑功能
        rerankModel: editRerankModel || 'none',
        visionModel: editVisionModel || 'none',
      })
      
      toast.success(t('Knowledge base updated'))
      
      // 重置编辑状态
      setEditKb(null)
      setEditEmbeddingModel(null)
      setEditRerankModel(null)
      setEditVisionModel(null)
      setEditModalOpen(false)
      
      await fetchKbList()
      
      // 如果当前选中的是被编辑的知识库，更新选中状态
      if (selectedKb?.id === editKb.id) {
        const updatedList = await knowledgeBaseController.list()
        const updatedKb = updatedList.find(kb => kb.id === editKb.id)
        if (updatedKb) {
          setSelectedKb(updatedKb)
        }
      }
    } catch (error) {
      toast.error(t('Failed to update knowledge base'))
      console.error('Failed to update KB:', error)
    } finally {
      setLoading(false)
    }
  }

  // 打开编辑模态框
  const openEditModal = (kb: KnowledgeBase) => {
    setEditKb(kb)
    setEditEmbeddingModel(kb.embeddingModel || null)
    setEditRerankModel(kb.rerankModel === 'none' ? null : (kb.rerankModel || null))
    setEditVisionModel(kb.visionModel === 'none' ? null : (kb.visionModel || null))
    setEditModalOpen(true)
  }

  // 删除知识库
  const deleteKb = async (kb: KnowledgeBase) => {
    if (!confirm(String(t('Are you sure you want to delete this knowledge base?')))) {
      return
    }

    try {
      setLoading(true)
      await knowledgeBaseController.delete(kb.id)
      toast.success(t('Knowledge base deleted'))
      
      if (selectedKb?.id === kb.id) {
        setSelectedKb(null)
        setFiles([])
      }
      
      await fetchKbList()
    } catch (error) {
      toast.error(t('Failed to delete knowledge base'))
      console.error('Failed to delete KB:', error)
    } finally {
      setLoading(false)
    }
  }

  // 上传文件
  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedKb) return

    // 重置 input
    event.target.value = ''

    console.log(`[Mobile KB UI] Starting upload for file: ${file.name} (${file.size} bytes, ${file.type})`)

    try {
      setLoading(true)
      
      // 将 File 对象转换为 FileMeta 格式
      const fileMeta = {
        name: file.name,
        path: file.name, // 移动端没有真实路径，使用文件名
        type: file.type || 'text/plain', // 确保有默认类型
        size: file.size,
        // 添加原始 File 对象的引用，供读取内容使用
        _file: file
      }
      
      console.log(`[Mobile KB UI] Uploading file to KB ${selectedKb.id}:`, fileMeta)
      await knowledgeBaseController.uploadFile(selectedKb.id, fileMeta)
      console.log(`[Mobile KB UI] Upload completed, refreshing file list`)
      
      toast.success(t('File uploaded successfully'))
      await fetchFiles(selectedKb.id)
    } catch (error) {
      toast.error(t('Failed to upload file'))
      console.error('Failed to upload file:', error)
    } finally {
      setLoading(false)
    }
  }

  // 删除文件
  const deleteFile = async (file: KnowledgeBaseFile) => {
    if (!confirm(String(t('Are you sure you want to delete this file?')))) {
      return
    }

    try {
      setLoading(true)
      await knowledgeBaseController.deleteFile(file.id)
      toast.success(t('File deleted'))
      
      if (selectedKb) {
        await fetchFiles(selectedKb.id)
      }
    } catch (error) {
      toast.error(t('Failed to delete file'))
      console.error('Failed to delete file:', error)
    } finally {
      setLoading(false)
    }
  }

  // 搜索
  const performSearch = async () => {
    if (!searchQuery.trim() || !selectedKb) return

    try {
      setLoading(true)
      const results = await knowledgeBaseController.search(selectedKb.id, searchQuery.trim())
      setSearchResults(results)
      
      if (results.length === 0) {
        toast.info(t('No results found'))
      }
    } catch (error) {
      toast.error(t('Search failed'))
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 选择知识库
  const selectKb = (kb: KnowledgeBase) => {
    setSelectedKb(kb)
    setSearchResults([])
    fetchFiles(kb.id)
  }

  // 调试工具：检查数据库状态
  const debugDatabase = async () => {
    if (!selectedKb) {
      toast.error('请先选择一个知识库')
      return
    }

    try {
      console.log('=== 调试信息开始 ===')
      console.log('选中的知识库:', selectedKb)
      
      // 调用控制器的调试方法
      const controller = knowledgeBaseController as any
      if (controller.debugDatabase) {
        await controller.debugDatabase(selectedKb.id)
      }
      
      // 强制刷新文件列表
      await fetchFiles(selectedKb.id)
      
      toast.success('调试信息已输出到控制台，请查看开发者工具')
      console.log('=== 调试信息结束 ===')
    } catch (error) {
      console.error('调试失败:', error)
      toast.error('调试失败，请查看控制台')
    }
  }

  // 检测控制器类型
  const detectControllerType = useCallback(async () => {
    try {
      // 使用优化后的 MobileKnowledgeBaseController，支持 SQLite 和 AI 功能
      setControllerType('SQLite')
      console.log(`[KB UI] Using MobileKnowledgeBaseController (SQLite + AI enhanced)`)
    } catch (error) {
      console.error('Failed to detect controller type:', error)
      setControllerType('Unknown')
    }
  }, [knowledgeBaseController])

  // 检查权限状态
  const checkPermissions = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && 'Capacitor' in window) {
        const { Capacitor } = await import('@capacitor/core')
        
        if (Capacitor.isNativePlatform()) {
          try {
            const { Filesystem } = await import('@capacitor/filesystem')
            const permissions = await Filesystem.checkPermissions()
            
            if (permissions.publicStorage === 'granted') {
              setPermissionStatus('granted')
            } else {
              setPermissionStatus('denied')
            }
          } catch (error) {
            console.warn('Permission check failed:', error)
            setPermissionStatus('unknown')
          }
        } else {
          setPermissionStatus('granted') // Web环境默认有权限
        }
      } else {
        setPermissionStatus('granted') // 非Capacitor环境
      }
    } catch (error) {
      console.error('Permission check error:', error)
      setPermissionStatus('unknown')
    }
  }, [])

  // 请求权限
  const requestPermissions = async () => {
    try {
      if (typeof window !== 'undefined' && 'Capacitor' in window) {
        const { Capacitor } = await import('@capacitor/core')
        
        if (Capacitor.isNativePlatform()) {
          const { Filesystem } = await import('@capacitor/filesystem')
          const permissions = await Filesystem.requestPermissions()
          
          if (permissions.publicStorage === 'granted') {
            setPermissionStatus('granted')
            toast.success(t('Permissions granted successfully'))
            // 权限获取后重新初始化
            await fetchKbList()
          } else {
            setPermissionStatus('denied')
            toast.error(t('Storage permission is required for knowledge base functionality'))
          }
        }
      }
    } catch (error) {
      console.error('Permission request failed:', error)
      toast.error(t('Failed to request permissions'))
    }
  }

  useEffect(() => {
    checkPermissions()
  }, [checkPermissions])

  useEffect(() => {
    if (permissionStatus === 'granted') {
      fetchKbList()
      detectControllerType()
    }
  }, [fetchKbList, permissionStatus, detectControllerType])

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={600}>
          {t('Knowledge Base')} 
          <Badge variant="light" color="blue" ml="xs">Mobile</Badge>
          <Badge 
            variant="light" 
            color={controllerType === 'SQLite' ? 'green' : controllerType === 'LocalStorage' ? 'orange' : 'gray'} 
            ml="xs"
          >
            {controllerType}
          </Badge>
        </Text>
        
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
          disabled={loading}
          size="sm"
        >
          {t('New')}
        </Button>
      </Group>

      <Alert 
        icon={<IconInfoCircle size={16} />} 
        title={t('Mobile Knowledge Base')}
        color="blue"
        mb="md"
      >
        {t('AI-enhanced knowledge base for mobile devices. Supports intelligent document analysis and semantic search.')}
      </Alert>

      {/* 权限状态提示 */}
      {permissionStatus === 'checking' && (
        <Alert color="yellow" mb="md">
          🔍 {t('Checking storage permissions...')}
        </Alert>
      )}
      
      {permissionStatus === 'denied' && (
        <Alert 
          color="red" 
          mb="md"
          title={t('Storage Permission Required')}
          withCloseButton={false}
        >
          <Text size="sm" mb="sm">
            {t('Knowledge base functionality requires storage access to save and manage your documents.')}
          </Text>
          <Button size="sm" onClick={requestPermissions}>
            {t('Grant Permission')}
          </Button>
        </Alert>
      )}
      
      {permissionStatus === 'unknown' && (
        <Alert color="orange" mb="md">
          ⚠️ {t('Unable to check permissions. Some features may not work properly.')}
        </Alert>
      )}

      {/* 知识库列表 */}
      {!selectedKb ? (
        <Stack gap="sm">
          {kbList.length === 0 ? (
            <Card padding="lg" withBorder>
              <Text ta="center" c="dimmed">
                {t('No knowledge bases found. Create one to get started.')}
              </Text>
            </Card>
          ) : (
            kbList.map((kb) => (
              <Card 
                key={kb.id} 
                padding="md" 
                withBorder 
                style={{ cursor: 'pointer' }}
                onClick={() => selectKb(kb)}
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Box flex={1}>
                      <Text fw={500}>{kb.name}</Text>
                      <Text size="sm" c="dimmed">
                        {t('Created')}: {new Date(kb.createdAt).toLocaleDateString()}
                      </Text>
                    </Box>
                    
                    <Group gap="xs">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(kb)
                        }}
                        title={t('Edit models')}
                        disabled={loading}
                      >
                        <IconSettings size={16} />
                      </ActionIcon>
                      
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteKb(kb)
                        }}
                        title={t('Delete')}
                        disabled={loading}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  
                  {/* 模型配置显示 */}
                  <MobileModelDisplay
                    embeddingModel={kb.embeddingModel}
                    rerankModel={kb.rerankModel}
                    visionModel={kb.visionModel}
                  />
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      ) : (
        /* 知识库详情 */
        <Stack gap="md">
          {/* 返回按钮 */}
          <Group>
            <Button 
              variant="subtle" 
              onClick={() => setSelectedKb(null)}
              size="sm"
            >
              ← {t('Back')}
            </Button>
            <Text fw={500}>{selectedKb.name}</Text>
          </Group>

          {/* 搜索 */}
          <Card padding="md" withBorder>
            <Group gap="sm">
              <TextInput
                placeholder={String(t('Search in this knowledge base...'))}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                flex={1}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              />
              <Button
                onClick={performSearch}
                disabled={!searchQuery.trim() || loading}
                size="sm"
              >
                <IconSearch size={16} />
              </Button>
            </Group>
          </Card>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <Card padding="md" withBorder>
              <Text fw={500} mb="sm">{t('Search Results')}</Text>
              <Stack gap="sm">
                {searchResults.map((result, index) => (
                  <Card key={index} padding="sm" withBorder>
                    <Group justify="space-between" align="flex-start" mb="xs">
                      <Text size="sm" fw={500}>
                        {result.filename}
                      </Text>
                      <Group gap="xs">
                        {result.chunkIndex > 0 && (
                          <Badge size="xs" variant="light" color="blue">
                            块 {result.chunkIndex + 1}
                          </Badge>
                        )}
                        <Badge size="xs" variant="light" color="green">
                          {Math.round((result as any).score * 100)}%
                        </Badge>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={3}>
                      {result.text}
                    </Text>
                  </Card>
                ))}
              </Stack>
            </Card>
          )}

          <Divider />

          {/* 文件管理 */}
          <Group justify="space-between">
            <Text fw={500}>{t('Files')} ({files.length})</Text>
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                onClick={() => selectedKb && fetchFiles(selectedKb.id)}
                disabled={loading}
                size="sm"
                title="刷新文件列表"
              >
                <IconRefresh size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={debugDatabase}
                disabled={loading}
                size="sm"
                color="orange"
                title="调试数据库状态"
              >
                <IconBug size={16} />
              </ActionIcon>
              <Button
                component="label"
                leftSection={<IconUpload size={16} />}
                disabled={loading}
                size="sm"
              >
                {t('Upload')}
                <input
                  type="file"
                  hidden
                  onChange={uploadFile}
                  accept=".txt,.md,.json"
                />
              </Button>
            </Group>
          </Group>

          {/* 文件列表 */}
          <Stack gap="sm">
            {files.length === 0 ? (
              <Card padding="lg" withBorder>
                <Text ta="center" c="dimmed">
                  {t('No files uploaded yet. Upload some text files to get started.')}
                </Text>
              </Card>
            ) : (
              files.map((file) => (
                <Card key={file.id} padding="md" withBorder>
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <IconFile size={20} />
                      <Box>
                        <Text fw={500}>{file.filename}</Text>
                        <Text size="xs" c="dimmed">
                          {Math.round(file.file_size / 1024)} KB • {file.mime_type}
                        </Text>
                        {(file as any).summary && (
                          <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                            📄 {(file as any).summary}
                          </Text>
                        )}
                        {(file as any).chunk_count > 1 && (
                          <Text size="xs" c="blue" mt={2}>
                            🧩 {(file as any).chunk_count} 个智能分块
                          </Text>
                        )}
                      </Box>
                    </Group>
                    
                    <Group gap="xs">
                      <Badge 
                        color={
                          file.status === 'completed' ? 'green' : 
                          file.status === 'processing' ? 'blue' : 
                          file.status === 'failed' ? 'red' : 'orange'
                        }
                        size="sm"
                      >
                        {file.status === 'processing' ? '🤖 AI处理中' : 
                         file.status === 'completed' ? (
                           (file as any).ai_processed ? '✨ AI增强' : '✅ 完成'
                         ) : 
                         file.status === 'failed' ? '❌ 失败' : file.status}
                      </Badge>
                      
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => deleteFile(file)}
                        disabled={loading}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </Stack>
      )}

      {/* 创建知识库 Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('Create Knowledge Base')}
        size="lg"
      >
        <ScrollArea.Autosize mah={600}>
          <Stack gap="md">
            <TextInput
              label={t('Name')}
              placeholder={String(t('Enter knowledge base name'))}
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              data-autofocus
              required
            />
            
            <Divider label={t('Model Configuration')} labelPosition="center" />
            
            <MobileModelSelector
              embeddingModel={newEmbeddingModel}
              rerankModel={newRerankModel}
              visionModel={newVisionModel}
              onEmbeddingModelChange={setNewEmbeddingModel}
              onRerankModelChange={setNewRerankModel}
              onVisionModelChange={setNewVisionModel}
              compact={true}
            />
            
            <Group justify="end" gap="sm" mt="md">
              <Button 
                variant="subtle" 
                onClick={() => setCreateModalOpen(false)}
                disabled={loading}
              >
                {t('Cancel')}
              </Button>
              <Button 
                onClick={createKb}
                disabled={!newKbName.trim() || !newEmbeddingModel || loading}
                loading={loading}
              >
                {t('Create')}
              </Button>
            </Group>
          </Stack>
        </ScrollArea.Autosize>
      </Modal>

      {/* 编辑知识库模型 Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={t('Edit Knowledge Base Models')}
        size="lg"
      >
        <ScrollArea.Autosize mah={600}>
          <Stack gap="md">
            {editKb && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                {t('Editing models for')}: <strong>{editKb.name}</strong>
              </Alert>
            )}
            
            <Divider label={t('Model Configuration')} labelPosition="center" />
            
            <MobileModelSelector
              embeddingModel={editEmbeddingModel}
              rerankModel={editRerankModel}
              visionModel={editVisionModel}
              onEmbeddingModelChange={setEditEmbeddingModel}
              onRerankModelChange={setEditRerankModel}
              onVisionModelChange={setEditVisionModel}
              compact={true}
            />
            
            <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
              <Text size="sm">
                ⚠️ {t('Note')}: {t('Changing the embedding model may affect existing search results. The rerank and vision models can be changed safely.')}
              </Text>
            </Alert>
            
            <Group justify="end" gap="sm" mt="md">
              <Button 
                variant="subtle" 
                onClick={() => setEditModalOpen(false)}
                disabled={loading}
              >
                {t('Cancel')}
              </Button>
              <Button 
                onClick={updateKb}
                disabled={!editEmbeddingModel || loading}
                loading={loading}
              >
                {t('Update')}
              </Button>
            </Group>
          </Stack>
        </ScrollArea.Autosize>
      </Modal>
    </Box>
  )
}