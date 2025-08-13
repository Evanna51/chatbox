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
  Alert
} from '@mantine/core'
import { 
  IconPlus, 
  IconTrash, 
  IconSearch, 
  IconUpload,
  IconFile,
  IconInfoCircle
} from '@tabler/icons-react'
import { toast } from 'sonner'
import platform from '@/platform'
import type { KnowledgeBase, KnowledgeBaseFile } from 'src/shared/types'

export default function MobileKnowledgeBase() {
  const { t } = useTranslation()
  const [kbList, setKbList] = useState<KnowledgeBase[]>([])
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null)
  const [files, setFiles] = useState<KnowledgeBaseFile[]>([])
  const [loading, setLoading] = useState(false)
  
  // 新建知识库
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  
  // 搜索
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

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
      const fileList = await knowledgeBaseController.listFiles(kbId)
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

    try {
      setLoading(true)
      await knowledgeBaseController.create({
        name: newKbName.trim(),
        embeddingModel: 'simple-text',
        rerankModel: 'none',
      })
      
      toast.success(t('Knowledge base created'))
      setNewKbName('')
      setCreateModalOpen(false)
      await fetchKbList()
    } catch (error) {
      toast.error(t('Failed to create knowledge base'))
      console.error('Failed to create KB:', error)
    } finally {
      setLoading(false)
    }
  }

  // 删除知识库
  const deleteKb = async (kb: KnowledgeBase) => {
    if (!confirm(t('Are you sure you want to delete this knowledge base?'))) {
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

    try {
      setLoading(true)
      await knowledgeBaseController.uploadFile(selectedKb.id, file)
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
    if (!confirm(t('Are you sure you want to delete this file?'))) {
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

  useEffect(() => {
    fetchKbList()
  }, [fetchKbList])

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={600}>
          {t('Knowledge Base')} 
          <Badge variant="light" color="blue" ml="xs">Mobile</Badge>
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
        {t('Simplified knowledge base for mobile devices. Supports text files and basic search.')}
      </Alert>

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
                <Group justify="space-between" align="center">
                  <Box flex={1}>
                    <Text fw={500}>{kb.name}</Text>
                    <Text size="sm" c="dimmed">
                      {t('Created')}: {new Date(kb.createdAt).toLocaleDateString()}
                    </Text>
                  </Box>
                  
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteKb(kb)
                    }}
                    disabled={loading}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
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
                placeholder={t('Search in this knowledge base...')}
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
                    <Text size="sm" fw={500} mb="xs">
                      {result.filename}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {result.text.substring(0, 200)}...
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
                          {Math.round(file.fileSize / 1024)} KB • {file.mimeType}
                        </Text>
                      </Box>
                    </Group>
                    
                    <Group gap="xs">
                      <Badge 
                        color={file.status === 'completed' ? 'green' : 'orange'}
                        size="sm"
                      >
                        {file.status}
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
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label={t('Name')}
            placeholder={t('Enter knowledge base name')}
            value={newKbName}
            onChange={(e) => setNewKbName(e.target.value)}
            data-autofocus
          />
          
          <Group justify="end" gap="sm">
            <Button 
              variant="subtle" 
              onClick={() => setCreateModalOpen(false)}
              disabled={loading}
            >
              {t('Cancel')}
            </Button>
            <Button 
              onClick={createKb}
              disabled={!newKbName.trim() || loading}
              loading={loading}
            >
              {t('Create')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}