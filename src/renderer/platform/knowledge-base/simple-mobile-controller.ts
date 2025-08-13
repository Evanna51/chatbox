import localforage from 'localforage'
import type { FileMeta, KnowledgeBase, KnowledgeBaseFile, KnowledgeBaseSearchResult } from 'src/shared/types'
import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeBaseController } from './interface'

interface SimpleKnowledgeBase {
  id: number
  name: string
  embeddingModel: string
  rerankModel: string
  visionModel: string
  createdAt: string
}

interface SimpleKnowledgeBaseFile {
  id: number
  kbId: number
  filename: string
  contentKey: string
  mimeType: string
  fileSize: number
  chunkCount: number
  totalChunks: number
  keywords: string
  status: string
  error?: string
  createdAt: string
}

interface SimpleKnowledgeBaseChunk {
  id: string
  fileId: number
  content: string
  keywords: string
  metadata: Record<string, any>
}

/**
 * 简单的移动端知识库控制器
 * 使用 LocalForage 存储数据，避免 SQLite 连接问题
 */
export default class SimpleMobileKnowledgeBaseController implements KnowledgeBaseController {
  private kbStorage: LocalForage.LocalForage
  private fileStorage: LocalForage.LocalForage
  private chunkStorage: LocalForage.LocalForage
  private contentStorage: LocalForage.LocalForage
  private isInitialized = false
  private nextKbId = 1
  private nextFileId = 1

  constructor() {
    this.kbStorage = localforage.createInstance({ name: 'simple-kb' })
    this.fileStorage = localforage.createInstance({ name: 'simple-kb-files' })
    this.chunkStorage = localforage.createInstance({ name: 'simple-kb-chunks' })
    this.contentStorage = localforage.createInstance({ name: 'simple-kb-content' })
  }

  private async ensureInitialized() {
    if (this.isInitialized) return

    try {
      // 初始化 ID 计数器
      const kbs = await this.getAllKnowledgeBases()
      const files = await this.getAllFiles()
      
      this.nextKbId = kbs.length > 0 ? Math.max(...kbs.map(kb => kb.id)) + 1 : 1
      this.nextFileId = files.length > 0 ? Math.max(...files.map(file => file.id)) + 1 : 1
      
      this.isInitialized = true
      console.log('[Simple Mobile KB] Initialized successfully')
    } catch (error) {
      console.error('[Simple Mobile KB] Failed to initialize:', error)
      throw error
    }
  }

  private async getAllKnowledgeBases(): Promise<SimpleKnowledgeBase[]> {
    const keys = await this.kbStorage.keys()
    const kbs: SimpleKnowledgeBase[] = []
    
    for (const key of keys) {
      const kb = await this.kbStorage.getItem<SimpleKnowledgeBase>(key)
      if (kb) kbs.push(kb)
    }
    
    return kbs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  private async getAllFiles(): Promise<SimpleKnowledgeBaseFile[]> {
    const keys = await this.fileStorage.keys()
    const files: SimpleKnowledgeBaseFile[] = []
    
    for (const key of keys) {
      const file = await this.fileStorage.getItem<SimpleKnowledgeBaseFile>(key)
      if (file) files.push(file)
    }
    
    return files
  }

  async list(): Promise<KnowledgeBase[]> {
    await this.ensureInitialized()
    const kbs = await this.getAllKnowledgeBases()
    
    return kbs.map(kb => ({
      id: kb.id,
      name: kb.name,
      embeddingModel: kb.embeddingModel,
      rerankModel: kb.rerankModel,
      visionModel: kb.visionModel,
      createdAt: kb.createdAt,
    }))
  }

  async create(createParams: {
    name: string
    embeddingModel: string
    rerankModel: string
    visionModel: string
  }): Promise<KnowledgeBase> {
    await this.ensureInitialized()
    
    const kb: SimpleKnowledgeBase = {
      id: this.nextKbId++,
      name: createParams.name,
      embeddingModel: createParams.embeddingModel,
      rerankModel: createParams.rerankModel,
      visionModel: createParams.visionModel,
      createdAt: new Date().toISOString(),
    }
    
    await this.kbStorage.setItem(`kb_${kb.id}`, kb)
    
    return {
      id: kb.id,
      name: kb.name,
      embeddingModel: kb.embeddingModel,
      rerankModel: kb.rerankModel,
      visionModel: kb.visionModel,
      createdAt: kb.createdAt,
    }
  }

  async update(id: number, updateParams: {
    name?: string
    embeddingModel?: string
    rerankModel?: string
    visionModel?: string
  }): Promise<void> {
    await this.ensureInitialized()
    
    const kb = await this.kbStorage.getItem<SimpleKnowledgeBase>(`kb_${id}`)
    if (!kb) throw new Error('Knowledge base not found')
    
    const updatedKb: SimpleKnowledgeBase = {
      ...kb,
      ...updateParams,
    }
    
    await this.kbStorage.setItem(`kb_${id}`, updatedKb)
  }

  async delete(id: number): Promise<void> {
    await this.ensureInitialized()
    
    // 删除知识库
    await this.kbStorage.removeItem(`kb_${id}`)
    
    // 删除相关文件
    const files = await this.getAllFiles()
    const kbFiles = files.filter(file => file.kbId === id)
    
    for (const file of kbFiles) {
      await this.deleteFile(file.id)
    }
  }

  async listFiles(kbId: number): Promise<KnowledgeBaseFile[]> {
    await this.ensureInitialized()
    
    const files = await this.getAllFiles()
    const kbFiles = files.filter(file => file.kbId === kbId)
    
    return kbFiles.map(file => ({
      id: file.id,
      kbId: file.kbId,
      filename: file.filename,
      contentKey: file.contentKey,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      chunkCount: file.chunkCount,
      totalChunks: file.totalChunks,
      keywords: file.keywords,
      status: file.status as any,
      error: file.error,
      createdAt: file.createdAt,
    }))
  }

  async listFilesPaginated(kbId: number, offset: number, limit: number): Promise<KnowledgeBaseFile[]> {
    const files = await this.listFiles(kbId)
    return files.slice(offset, offset + limit)
  }

  async countFiles(kbId: number): Promise<number> {
    const files = await this.listFiles(kbId)
    return files.length
  }

  async uploadFile(file: FileMeta): Promise<KnowledgeBaseFile> {
    await this.ensureInitialized()
    
    const contentKey = uuidv4()
    const kbFile: SimpleKnowledgeBaseFile = {
      id: this.nextFileId++,
      kbId: file.kbId,
      filename: file.name,
      contentKey,
      mimeType: file.type,
      fileSize: file.size,
      chunkCount: 0,
      totalChunks: 0,
      keywords: '',
      status: 'completed',
      createdAt: new Date().toISOString(),
    }
    
    await this.fileStorage.setItem(`file_${kbFile.id}`, kbFile)
    
    // 存储文件内容
    await this.contentStorage.setItem(contentKey, file.content)
    
    return {
      id: kbFile.id,
      kbId: kbFile.kbId,
      filename: kbFile.filename,
      contentKey: kbFile.contentKey,
      mimeType: kbFile.mimeType,
      fileSize: kbFile.fileSize,
      chunkCount: kbFile.chunkCount,
      totalChunks: kbFile.totalChunks,
      keywords: kbFile.keywords,
      status: kbFile.status as any,
      createdAt: kbFile.createdAt,
    }
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.ensureInitialized()
    
    const file = await this.fileStorage.getItem<SimpleKnowledgeBaseFile>(`file_${fileId}`)
    if (!file) return
    
    // 删除文件记录
    await this.fileStorage.removeItem(`file_${fileId}`)
    
    // 删除文件内容
    await this.contentStorage.removeItem(file.contentKey)
    
    // 删除相关分块
    const chunkKeys = await this.chunkStorage.keys()
    for (const key of chunkKeys) {
      const chunk = await this.chunkStorage.getItem<SimpleKnowledgeBaseChunk>(key)
      if (chunk && chunk.fileId === fileId) {
        await this.chunkStorage.removeItem(key)
      }
    }
  }

  async search(kbId: number, query: string, topK?: number): Promise<KnowledgeBaseSearchResult[]> {
    await this.ensureInitialized()
    
    // 简单的文本搜索实现
    const files = await this.listFiles(kbId)
    const results: KnowledgeBaseSearchResult[] = []
    
    for (const file of files) {
      try {
        const content = await this.contentStorage.getItem<string>(file.contentKey)
        if (content && content.toLowerCase().includes(query.toLowerCase())) {
          // 简单的相关性评分（基于查询词出现次数）
          const matches = (content.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length
          const score = Math.min(matches / 10, 1) // 归一化到 0-1
          
          results.push({
            id: uuidv4(),
            fileId: file.id,
            filename: file.filename,
            content: content.slice(0, 500) + (content.length > 500 ? '...' : ''), // 截取前500字符
            score,
            metadata: {},
          })
        }
      } catch (error) {
        console.error('Error searching file:', file.filename, error)
      }
    }
    
    // 按相关性排序并限制结果数量
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK || 10)
  }

  async getFileContent(contentKey: string): Promise<string> {
    await this.ensureInitialized()
    const content = await this.contentStorage.getItem<string>(contentKey)
    return content || ''
  }
}