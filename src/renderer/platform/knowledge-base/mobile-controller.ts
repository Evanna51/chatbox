import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import localforage from 'localforage'
import type { FileMeta, KnowledgeBase, KnowledgeBaseFile, KnowledgeBaseSearchResult } from 'src/shared/types'
import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeBaseController } from './interface'

export default class MobileKnowledgeBaseController implements KnowledgeBaseController {
  private db: SQLiteDBConnection | null = null
  private storage: LocalForage.LocalForage
  private isInitialized = false

  constructor() {
    this.storage = localforage.createInstance({ name: 'kb-documents' })
  }

  private async ensureInitialized() {
    if (this.isInitialized) return

    try {
      // 创建 SQLite 连接
      const ret = await CapacitorSQLite.createConnection({
        database: 'knowledge_base',
        version: 1,
        encrypted: false,
        mode: 'no-encryption',
        readonly: false,
      })
      
      this.db = ret

      // 打开数据库
      await this.db.open()

      // 创建表结构
      await this.initTables()
      
      this.isInitialized = true
      console.log('[Mobile KB] Database initialized successfully')
    } catch (error) {
      console.error('[Mobile KB] Failed to initialize database:', error)
      throw error
    }
  }

  private async initTables() {
    if (!this.db) throw new Error('Database not initialized')

    const createTables = `
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        embedding_model TEXT DEFAULT 'simple-text',
        rerank_model TEXT DEFAULT 'none',
        vision_model TEXT DEFAULT 'none',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS kb_file (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kb_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        content_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        chunk_count INTEGER DEFAULT 0,
        total_chunks INTEGER DEFAULT 0,
        keywords TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'completed',
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kb_id) REFERENCES knowledge_base(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_kb_file_kb_id ON kb_file(kb_id);
      CREATE INDEX IF NOT EXISTS idx_kb_file_status ON kb_file(status);
    `

    await this.db.execute(createTables)
  }

  async list(): Promise<KnowledgeBase[]> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query('SELECT * FROM knowledge_base ORDER BY created_at DESC')
    
    return result.values?.map((row: any) => ({
      id: row.id,
      name: row.name,
      embeddingModel: row.embedding_model || 'simple-text',
      rerankModel: row.rerank_model || 'none',
      visionModel: row.vision_model || 'none',
      createdAt: row.created_at,
    })) || []
  }

  async create(createParams: {
    name: string
    embeddingModel: string
    rerankModel: string
    visionModel?: string
  }): Promise<void> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const { name, embeddingModel, rerankModel, visionModel } = createParams

    await this.db.run(
      'INSERT INTO knowledge_base (name, embedding_model, rerank_model, vision_model) VALUES (?, ?, ?, ?)',
      [name, embeddingModel || 'simple-text', rerankModel || 'none', visionModel || 'none']
    )
  }

  async delete(id: number): Promise<void> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    // 获取要删除的文件列表
    const files = await this.listFiles(id)
    
    // 删除 LocalForage 中的文档内容
    for (const file of files) {
      const contentKey = `kb_${id}_file_${file.id}`
      await this.storage.removeItem(contentKey)
    }

    // 删除数据库记录
    await this.db.run('DELETE FROM knowledge_base WHERE id = ?', [id])
  }

  async listFiles(kbId: number): Promise<KnowledgeBaseFile[]> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM kb_file WHERE kb_id = ? ORDER BY created_at DESC',
      [kbId]
    )

    return result.values?.map((row: any) => ({
      id: row.id,
      kbId: row.kb_id,
      filename: row.filename,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      chunkCount: row.chunk_count,
      totalChunks: row.total_chunks,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
    })) || []
  }

  async countFiles(kbId: number): Promise<number> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM kb_file WHERE kb_id = ?',
      [kbId]
    )

    return result.values?.[0]?.count || 0
  }

  async listFilesPaginated(kbId: number, offset = 0, limit = 20): Promise<KnowledgeBaseFile[]> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM kb_file WHERE kb_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [kbId, limit, offset]
    )

    return result.values?.map((row: any) => ({
      id: row.id,
      kbId: row.kb_id,
      filename: row.filename,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      chunkCount: row.chunk_count,
      totalChunks: row.total_chunks,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
    })) || []
  }

  async uploadFile(kbId: number, file: FileMeta): Promise<void> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    try {
      // 生成唯一的内容键
      const contentKey = `kb_${kbId}_file_${uuidv4()}`
      
      // 读取文件内容
      const content = await this.readFileContent(file)
      
      // 提取关键词 (简单实现)
      const keywords = this.extractKeywords(content)
      
      // 存储文档内容到 LocalForage
      await this.storage.setItem(contentKey, content)
      
      // 存储文件元数据到 SQLite
      await this.db.run(
        `INSERT INTO kb_file 
         (kb_id, filename, content_key, mime_type, file_size, chunk_count, total_chunks, keywords, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          kbId,
          file.name,
          contentKey,
          file.type,
          file.size,
          1, // 简化为单块
          1,
          keywords,
          'completed'
        ]
      )
      
      console.log(`[Mobile KB] File uploaded: ${file.name}`)
    } catch (error) {
      console.error('[Mobile KB] Failed to upload file:', error)
      throw error
    }
  }

  private async readFileContent(file: FileMeta): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      if (file.type.startsWith('text/')) {
        reader.readAsText(file as File)
      } else {
        // 对于其他类型，简单返回文件名作为内容
        resolve(`File: ${file.name} (${file.type})`)
      }
    })
  }

  private extractKeywords(content: string): string {
    // 简单的关键词提取：移除标点符号，转小写，去重
    const words = content
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中英文字符
      .split(/\s+/)
      .filter(word => word.length > 2) // 过滤短词
      .slice(0, 50) // 限制关键词数量
    
    return [...new Set(words)].join(' ')
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    // 获取文件信息
    const result = await this.db.query('SELECT content_key FROM kb_file WHERE id = ?', [fileId])
    
    if (result.values?.[0]) {
      const contentKey = result.values[0].content_key
      // 删除 LocalForage 中的内容
      await this.storage.removeItem(contentKey)
    }

    // 删除数据库记录
    await this.db.run('DELETE FROM kb_file WHERE id = ?', [fileId])
  }

  async retryFile(fileId: number): Promise<void> {
    // 移动端简化实现：将状态重置为 completed
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    await this.db.run('UPDATE kb_file SET status = ? WHERE id = ?', ['completed', fileId])
  }

  async pauseFile(fileId: number): Promise<void> {
    // 移动端不需要暂停功能
    console.log('[Mobile KB] Pause not supported on mobile')
  }

  async resumeFile(fileId: number): Promise<void> {
    // 移动端不需要恢复功能
    console.log('[Mobile KB] Resume not supported on mobile')
  }

  async search(kbId: number, query: string): Promise<KnowledgeBaseSearchResult[]> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    try {
      // 简单的关键词匹配搜索
      const searchTerms = query.toLowerCase().trim().split(/\s+/)
      
      if (searchTerms.length === 0) {
        return []
      }

      // 构建 SQL 查询
      const whereConditions = searchTerms.map(() => '(keywords LIKE ? OR filename LIKE ?)').join(' AND ')
      const params = [kbId]
      
      searchTerms.forEach(term => {
        params.push(`%${term}%`, `%${term}%`)
      })

      const result = await this.db.query(
        `SELECT * FROM kb_file WHERE kb_id = ? AND ${whereConditions} ORDER BY created_at DESC LIMIT 10`,
        params
      )

      if (!result.values) return []

      // 获取文档内容并生成搜索结果
      const searchResults: KnowledgeBaseSearchResult[] = []

      for (const row of result.values) {
        try {
          const content = await this.storage.getItem<string>(row.content_key)
          
          if (content) {
            // 查找匹配的文本片段
            const snippet = this.findMatchingSnippet(content, query)
            
            searchResults.push({
              fileId: row.id,
              filename: row.filename,
              chunkIndex: 0,
              similarity: 0.8, // 固定相似度
              text: snippet,
              metadata: {
                fileSize: row.file_size,
                mimeType: row.mime_type,
              },
            })
          }
        } catch (error) {
          console.warn(`[Mobile KB] Failed to load content for file ${row.id}:`, error)
        }
      }

      return searchResults
    } catch (error) {
      console.error('[Mobile KB] Search failed:', error)
      return []
    }
  }

  private findMatchingSnippet(content: string, query: string, maxLength = 200): string {
    const queryLower = query.toLowerCase()
    const contentLower = content.toLowerCase()
    
    const index = contentLower.indexOf(queryLower)
    
    if (index !== -1) {
      // 找到匹配，返回周围的文本
      const start = Math.max(0, index - 50)
      const end = Math.min(content.length, index + query.length + 150)
      
      let snippet = content.substring(start, end)
      
      if (start > 0) snippet = '...' + snippet
      if (end < content.length) snippet = snippet + '...'
      
      return snippet
    } else {
      // 没找到精确匹配，返回开头
      return content.length > maxLength 
        ? content.substring(0, maxLength) + '...'
        : content
    }
  }

  async update(updateParams: { 
    id: number
    name?: string
    rerankModel?: string
    visionModel?: string 
  }): Promise<void> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const { id, name, rerankModel, visionModel } = updateParams
    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (rerankModel !== undefined) {
      updates.push('rerank_model = ?')
      values.push(rerankModel)
    }
    if (visionModel !== undefined) {
      updates.push('vision_model = ?')
      values.push(visionModel)
    }

    if (updates.length > 0) {
      values.push(id)
      await this.db.run(
        `UPDATE knowledge_base SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }
  }

  async getFilesMeta(kbId: number, fileIds: number[]): Promise<any[]> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    if (fileIds.length === 0) return []

    const placeholders = fileIds.map(() => '?').join(',')
    const result = await this.db.query(
      `SELECT id, kb_id as kbId, filename, mime_type as mimeType, 
              file_size as fileSize, chunk_count as chunkCount, 
              total_chunks as totalChunks, status, created_at as createdAt
       FROM kb_file 
       WHERE kb_id = ? AND id IN (${placeholders})`,
      [kbId, ...fileIds]
    )

    return result.values || []
  }

  async readFileChunks(
    kbId: number,
    chunks: { fileId: number; chunkIndex: number }[]
  ): Promise<{ fileId: number; filename: string; chunkIndex: number; text: string }[]> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    const results: { fileId: number; filename: string; chunkIndex: number; text: string }[] = []

    for (const chunk of chunks) {
      try {
        const fileResult = await this.db.query(
          'SELECT filename, content_key FROM kb_file WHERE id = ? AND kb_id = ?',
          [chunk.fileId, kbId]
        )

        if (fileResult.values?.[0]) {
          const { filename, content_key } = fileResult.values[0]
          const content = await this.storage.getItem<string>(content_key)

          if (content) {
            results.push({
              fileId: chunk.fileId,
              filename,
              chunkIndex: chunk.chunkIndex,
              text: content,
            })
          }
        }
      } catch (error) {
        console.warn(`[Mobile KB] Failed to read chunk for file ${chunk.fileId}:`, error)
      }
    }

    return results
  }
}