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
  private kbStorage: LocalForage
  private fileStorage: LocalForage
  private chunkStorage: LocalForage
  private contentStorage: LocalForage
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
      createdAt: new Date(kb.createdAt).getTime(),
    }))
  }

  async create(createParams: {
    name: string
    embeddingModel: string
    rerankModel: string
    visionModel?: string
  }): Promise<void> {
    await this.ensureInitialized()
    
    const kb: SimpleKnowledgeBase = {
      id: this.nextKbId++,
      name: createParams.name,
      embeddingModel: createParams.embeddingModel,
      rerankModel: createParams.rerankModel,
      visionModel: createParams.visionModel || 'none',
      createdAt: new Date().toISOString(),
    }
    
    await this.kbStorage.setItem(`kb_${kb.id}`, kb)
  }

  async update(updateParams: {
    id: number
    name?: string
    rerankModel?: string
    visionModel?: string
  }): Promise<void> {
    await this.ensureInitialized()
    
    const kb = await this.kbStorage.getItem<SimpleKnowledgeBase>(`kb_${updateParams.id}`)
    if (!kb) throw new Error('Knowledge base not found')
    
    const updatedKb: SimpleKnowledgeBase = {
      ...kb,
      ...updateParams,
    }
    
    await this.kbStorage.setItem(`kb_${updateParams.id}`, updatedKb)
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
    
    console.log(`[Simple Mobile KB] Listing files for KB ${kbId}`)
    
    const files = await this.getAllFiles()
    console.log(`[Simple Mobile KB] All files:`, files)
    
    const kbFiles = files.filter(file => file.kbId === kbId)
    console.log(`[Simple Mobile KB] Filtered files for KB ${kbId}:`, kbFiles)
    
    const result = kbFiles.map(file => ({
      id: file.id,
      kb_id: file.kbId, // 注意：这里要用 kb_id 而不是 kbId
      filename: file.filename,
      filepath: file.filename, // 添加 filepath 字段
      mime_type: file.mimeType, // 注意：这里要用 mime_type
      file_size: file.fileSize, // 注意：这里要用 file_size
      chunk_count: file.chunkCount,
      total_chunks: file.totalChunks,
      status: file.status,
      error: file.error || '',
      createdAt: new Date(file.createdAt).getTime(), // 转换为时间戳
    }))
    
    console.log(`[Simple Mobile KB] Mapped result:`, result)
    return result
  }

  async listFilesPaginated(kbId: number, offset: number, limit: number): Promise<KnowledgeBaseFile[]> {
    const files = await this.listFiles(kbId)
    return files.slice(offset, offset + limit)
  }

  async countFiles(kbId: number): Promise<number> {
    const files = await this.listFiles(kbId)
    return files.length
  }

  async uploadFile(kbId: number, file: FileMeta): Promise<void> {
    await this.ensureInitialized()
    
    console.log(`[Simple Mobile KB] Uploading file: ${file.name} to KB ${kbId}`)
    
    // 读取文件内容
    const content = await this.readFileContent(file)
    
    const contentKey = uuidv4()
    const kbFile: SimpleKnowledgeBaseFile = {
      id: this.nextFileId++,
      kbId: kbId,
      filename: file.name,
      contentKey,
      mimeType: file.type,
      fileSize: file.size,
      chunkCount: 1,
      totalChunks: 1,
      keywords: this.extractKeywords(content),
      status: 'completed',
      createdAt: new Date().toISOString(),
    }
    
    console.log(`[Simple Mobile KB] Created file record:`, kbFile)
    
    await this.fileStorage.setItem(`file_${kbFile.id}`, kbFile)
    
    // 存储文件内容
    await this.contentStorage.setItem(contentKey, content)
    
    console.log(`[Simple Mobile KB] File uploaded successfully: ${file.name}`)
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(file: FileMeta): Promise<string> {
    return new Promise((resolve, reject) => {
      // 检查是否有原始 File 对象引用
      const fileObj = file._file
      if (!fileObj) {
        console.warn('[Simple Mobile KB] No _file reference found, using fallback content')
        resolve(`File: ${file.name} (${file.type}, ${file.size} bytes)`)
        return
      }

      console.log(`[Simple Mobile KB] Reading file content: ${file.name}`)
      
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        console.log(`[Simple Mobile KB] File content read successfully, length: ${content?.length || 0}`)
        resolve(content || '')
      }
      
      reader.onerror = (error) => {
        console.error('[Simple Mobile KB] Failed to read file content:', error)
        reject(new Error(`Failed to read file: ${file.name}`))
      }
      
      try {
        // 根据文件类型选择读取方式
        if (file.type.startsWith('text/') || file.type === 'application/json' || 
            file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
          console.log(`[Simple Mobile KB] Reading as text file: ${file.name}`)
          reader.readAsText(fileObj, 'UTF-8')
        } else {
          console.log(`[Simple Mobile KB] Unsupported file type, using fallback: ${file.type}`)
          resolve(`File: ${file.name} (${file.type}, ${file.size} bytes)`)
        }
      } catch (error) {
        console.error('[Simple Mobile KB] Error starting file read:', error)
        reject(new Error(`Failed to start reading file: ${file.name}`))
      }
    })
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string {
    // 简单的关键词提取：移除标点符号，转小写，去重
    const words = content
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中英文字符
      .split(/\s+/)
      .filter(word => word.length > 2) // 过滤短词
      .slice(0, 20) // 限制关键词数量
    
    return [...new Set(words)].join(' ')
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
    
    console.log(`[Simple Mobile KB] Searching for: "${query}" in KB ${kbId}`)
    
    // 获取原始文件数据（包含 contentKey）
    const allFiles = await this.getAllFiles()
    const kbFiles = allFiles.filter(file => file.kbId === kbId)
    const results: KnowledgeBaseSearchResult[] = []
    
    console.log(`[Simple Mobile KB] Found ${kbFiles.length} files to search`)
    
    for (const file of kbFiles) {
      try {
        console.log(`[Simple Mobile KB] Searching file: ${file.filename}, contentKey: ${file.contentKey}`)
        
        const content = await this.contentStorage.getItem<string>(file.contentKey)
        console.log(`[Simple Mobile KB] Content loaded for ${file.filename}, length: ${content?.length || 0}`)
        
        if (content && content.toLowerCase().includes(query.toLowerCase())) {
          // 简单的相关性评分（基于查询词出现次数）
          const matches = (content.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length
          const score = Math.min(matches / 10, 1) // 归一化到 0-1
          
          console.log(`[Simple Mobile KB] Match found in ${file.filename}, matches: ${matches}, score: ${score}`)
          
          results.push({
            id: file.id,
            fileId: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            chunkIndex: 0,
            text: content.slice(0, 500) + (content.length > 500 ? '...' : ''), // 截取前500字符
            score,
          })
        } else {
          console.log(`[Simple Mobile KB] No match in ${file.filename}`)
        }
      } catch (error) {
        console.error('Error searching file:', file.filename, error)
      }
    }
    
    // 按相关性排序并限制结果数量
    results.sort((a, b) => b.score - a.score)
    console.log(`[Simple Mobile KB] Search completed, found ${results.length} results`)
    return results.slice(0, topK || 10)
  }

  async getFileContent(contentKey: string): Promise<string> {
    await this.ensureInitialized()
    const content = await this.contentStorage.getItem<string>(contentKey)
    return content || ''
  }

  /**
   * 调试方法：检查知识库状态
   */
  async debugDatabase(kbId: number): Promise<void> {
    await this.ensureInitialized()
    
    console.log(`=== 调试知识库 ${kbId} ===`)
    
    // 检查知识库是否存在
    const kb = await this.kbStorage.getItem<SimpleKnowledgeBase>(`kb_${kbId}`)
    console.log('知识库信息:', kb)
    
    // 检查所有文件
    const allFiles = await this.getAllFiles()
    console.log('所有文件:', allFiles)
    
    const kbFiles = allFiles.filter(file => file.kbId === kbId)
    console.log(`知识库 ${kbId} 的文件:`, kbFiles)
    
    // 检查文件内容
    for (const file of kbFiles) {
      console.log(`检查文件 ${file.filename} (ID: ${file.id})`)
      console.log('文件信息:', file)
      
      try {
        const content = await this.contentStorage.getItem<string>(file.contentKey)
        console.log(`文件内容长度: ${content?.length || 0}`)
        if (content) {
          console.log(`文件内容预览: ${content.slice(0, 200)}...`)
        } else {
          console.log('文件内容为空或不存在')
        }
      } catch (error) {
        console.error(`读取文件内容失败:`, error)
      }
    }
    
    // 检查存储状态
    const kbKeys = await this.kbStorage.keys()
    const fileKeys = await this.fileStorage.keys()
    const contentKeys = await this.contentStorage.keys()
    
    console.log('存储键统计:')
    console.log('- 知识库键:', kbKeys)
    console.log('- 文件键:', fileKeys)
    console.log('- 内容键:', contentKeys)
    
    console.log(`=== 调试结束 ===`)
  }

  // 实现接口要求的方法
  async retryFile(fileId: number): Promise<void> {
    console.log('[Simple Mobile KB] Retry not supported')
  }

  async pauseFile(fileId: number): Promise<void> {
    console.log('[Simple Mobile KB] Pause not supported')
  }

  async resumeFile(fileId: number): Promise<void> {
    console.log('[Simple Mobile KB] Resume not supported')
  }

  async getFilesMeta(kbId: number, fileIds: number[]): Promise<any[]> {
    const files = await this.listFiles(kbId)
    return files.filter(file => fileIds.includes(file.id))
  }

  async readFileChunks(
    kbId: number,
    chunks: { fileId: number; chunkIndex: number }[]
  ): Promise<{ fileId: number; filename: string; chunkIndex: number; text: string }[]> {
    const results: { fileId: number; filename: string; chunkIndex: number; text: string }[] = []
    
    for (const chunk of chunks) {
      const files = await this.listFiles(kbId)
      const file = files.find(f => f.id === chunk.fileId)
      
      if (file) {
        const content = await this.contentStorage.getItem<string>((file as any).contentKey)
        if (content) {
          results.push({
            fileId: chunk.fileId,
            filename: file.filename,
            chunkIndex: chunk.chunkIndex,
            text: content,
          })
        }
      }
    }
    
    return results
  }

}