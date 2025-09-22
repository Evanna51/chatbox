import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import localforage from 'localforage'
import type { FileMeta, KnowledgeBase, KnowledgeBaseFile, KnowledgeBaseSearchResult, Message } from 'src/shared/types'
import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeBaseController } from './interface'

// 延迟导入的依赖 - 避免循环依赖
let getModel: any = null
let createModelDependencies: any = null
let settingActions: any = null
let generateText: any = null

export default class MobileKnowledgeBaseController implements KnowledgeBaseController {
  private db: SQLiteDBConnection | null = null
  private sqlite: SQLiteConnection | null = null
  private storage: LocalForage
  private isInitialized = false
  private _initPromise: Promise<void> | null = null

  constructor() {
    try {
      this.storage = localforage.createInstance({ name: 'kb-documents' })
    } catch (error) {
      console.error('[Mobile KB] Failed to create LocalForage instance:', error)
      throw new Error(`LocalForage initialization failed: ${error}`)
    }
    
    // 预热 SQLite 插件（异步，不阻塞构造函数）
    this.warmupSQLitePlugin().catch(error => {
      console.warn('[Mobile KB] SQLite plugin warmup failed:', error)
    })
  }

  /**
   * 预热 SQLite 插件，避免首次使用时的初始化问题
   */
  private async warmupSQLitePlugin(): Promise<void> {
    try {
      // 延迟执行，让应用完全启动
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (typeof window !== 'undefined' && 'Capacitor' in window) {
        const { Capacitor } = await import('@capacitor/core')
        
        if (Capacitor.isNativePlatform() && CapacitorSQLite) {
          console.log('[Mobile KB] Warming up SQLite plugin...')
          
          // 执行简单的 echo 测试
          try {
            await CapacitorSQLite.echo({ value: 'warmup' })
            console.log('[Mobile KB] SQLite plugin warmup successful')
          } catch (error) {
            console.warn('[Mobile KB] SQLite plugin warmup echo failed:', error)
          }
        }
      }
    } catch (error) {
      console.warn('[Mobile KB] SQLite plugin warmup error:', error)
    }
  }

  /**
   * 安全的数据库操作包装器
   */
  private async safeDbOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (!this.db) {
      console.error(`[Mobile KB] Database is null in ${operationName}`)
      throw new Error(`Database not initialized for operation: ${operationName}`)
    }
    
    try {
      return await operation()
    } catch (error) {
      console.error(`[Mobile KB] Error in ${operationName}:`, error)
      
      // 如果是连接错误，重置数据库状态
      if (error instanceof Error && (
        error.message.includes('database is closed') ||
        error.message.includes('connection') ||
        error.message.includes('SQLITE_MISUSE')
      )) {
        console.warn(`[Mobile KB] Database connection issue detected, resetting state`)
        this.db = null
        this.isInitialized = false
        this._initPromise = null
      }
      
      throw new Error(`${operationName} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async ensureInitialized() {
    if (this.isInitialized) return

    try {
      // 添加初始化锁，防止并发初始化
      if (this._initPromise) {
        await this._initPromise
        return
      }

      this._initPromise = this._doInitialize()
      await this._initPromise
    } catch (error) {
      console.error('[Mobile KB] Initialization failed:', error)
      this._initPromise = null
      throw error
    }
  }

  private async _doInitialize() {
    try {
      // 检查并请求权限
      await this.checkAndRequestPermissions()
      
      // 延迟初始化 SQLite - 避免在模块加载时就创建连接
      await this.initSQLite()
      
      this.isInitialized = true
      console.log('[Mobile KB] Database initialized successfully with SQLite')
    } catch (error) {
      console.error('[Mobile KB] Failed to initialize SQLite database:', error)
      
      // 如果SQLite初始化失败，抛出错误而不是回退到LocalForage
      throw new Error(`SQLite initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 延迟初始化 SQLite 连接
   */
  private async initSQLite() {
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        console.log(`[Mobile KB] SQLite initialization attempt ${retryCount + 1}/${maxRetries}`)
        
        // 更安全的 Capacitor 环境检查
        if (typeof window === 'undefined' || !('Capacitor' in window)) {
          throw new Error('Capacitor environment not available')
        }
        
        // 动态导入 Capacitor 以避免模块加载时的问题
        const { Capacitor } = await import('@capacitor/core')
        
        if (!Capacitor.isNativePlatform()) {
          throw new Error('Not running on native platform')
        }
        
        // 检查 SQLite 插件是否可用
        if (!CapacitorSQLite) {
          throw new Error('CapacitorSQLite plugin not available')
        }
        
        // 验证插件方法是否可用
        if (typeof CapacitorSQLite.echo !== 'function') {
          throw new Error('CapacitorSQLite plugin methods not available')
        }
        
        // 测试插件是否响应
        try {
          await CapacitorSQLite.echo({ value: 'test' })
          console.log('[Mobile KB] SQLite plugin echo test passed')
        } catch (echoError) {
          console.warn('[Mobile KB] SQLite plugin echo test failed:', echoError)
          // 不抛出错误，继续尝试
        }
        
        // 添加更长的延迟以确保插件完全加载
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 创建 SQLiteConnection 并进行一致性检查（遵循官方推荐流程，避免原生崩溃）
        try {
          this.sqlite = new SQLiteConnection(CapacitorSQLite)
        } catch (connectionError) {
          console.error('[Mobile KB] Failed to create SQLiteConnection:', connectionError)
          throw new Error(`SQLiteConnection creation failed: ${connectionError}`)
        }

        console.log('[Mobile KB] Checking SQLite connections consistency...')
        try {
          await this.sqlite.checkConnectionsConsistency()
        } catch (consistencyError) {
          console.warn('[Mobile KB] checkConnectionsConsistency failed (will continue):', consistencyError)
        }

        // 复用已存在连接或创建新连接
        const dbName = 'knowledge_base'
        const isConn = await this.sqlite.isConnection(dbName, false).catch(() => ({ result: false as boolean }))
        if (isConn && (isConn as any).result) {
          console.log('[Mobile KB] Existing SQLite connection found, retrieving...')
          this.db = await this.sqlite.retrieveConnection(dbName, false)
        } else {
          console.log('[Mobile KB] Creating SQLite connection...')
          this.db = await this.sqlite.createConnection(
            dbName,
            false,
            'no-encryption',
            1,
            false
          )
        }
        
        if (!this.db) {
          throw new Error('Failed to create SQLite connection - returned null')
        }
        
        console.log('[Mobile KB] SQLite connection created, opening database...')
        
        // 打开数据库
        await this.db.open()

        // 保存到连接存储（仅 Web 需要；Android/iOS 未实现该方法）
        try {
          const { Capacitor } = await import('@capacitor/core')
          const platform = Capacitor.getPlatform()
          if (platform === 'web' && typeof (this.sqlite as any).saveToStore === 'function') {
            await this.sqlite.saveToStore(dbName)
          }
        } catch (storeError) {
          console.warn('[Mobile KB] saveToStore skipped or failed (non-fatal):', storeError)
        }
        
        console.log('[Mobile KB] Database opened, initializing tables...')
        
        // 创建表结构
        await this.initTables()
        
        console.log('[Mobile KB] SQLite initialization completed successfully')
        return // 成功，退出重试循环
        
      } catch (error) {
        retryCount++
        console.error(`[Mobile KB] SQLite initialization failed (attempt ${retryCount}/${maxRetries}):`, error)
        
        // 清理可能的部分初始化状态
        if (this.db) {
          try {
            await this.db.close()
          } catch (closeError) {
            console.warn('[Mobile KB] Failed to close database during cleanup:', closeError)
          }
          this.db = null
        }

        // 关闭并清理连接仓库中的状态
        if (this.sqlite) {
          try {
            await this.sqlite.closeConnection('knowledge_base', false)
          } catch (closeConnError) {
            console.warn('[Mobile KB] Failed to close SQLite connection during cleanup:', closeConnError)
          }
        }
        
        if (retryCount >= maxRetries) {
          console.error('[Mobile KB] All SQLite initialization attempts failed, throwing error')
          throw error
        }
        
        // 等待更长时间后重试，给插件更多时间初始化
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount))
      }
    }
  }

  /**
   * 检查并请求必要的权限
   */
  private async checkAndRequestPermissions(): Promise<void> {
    try {
      // 检查是否在移动端环境
      if (typeof window !== 'undefined' && 'Capacitor' in window) {
        const { Capacitor } = await import('@capacitor/core')
        
        if (Capacitor.isNativePlatform()) {
          console.log('[Mobile KB] Running on native platform, checking permissions')
          
          // 检查文件系统权限
          try {
            const { Filesystem } = await import('@capacitor/filesystem')
            const permissions = await Filesystem.requestPermissions()
            console.log('[Mobile KB] Filesystem permissions:', permissions)
            
            if (permissions.publicStorage !== 'granted') {
              console.warn('[Mobile KB] Storage permission not granted')
              throw new Error('Storage permission required for knowledge base functionality')
            }
          } catch (permError) {
            console.warn('[Mobile KB] Could not check filesystem permissions:', permError)
          }
        }
      }
    } catch (error) {
      console.warn('[Mobile KB] Permission check failed:', error)
      // 不阻塞初始化，但记录警告
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
        summary TEXT DEFAULT '',
        ai_processed BOOLEAN DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'processing',
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kb_id) REFERENCES knowledge_base(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kb_file_chunk (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES kb_file(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_kb_file_kb_id ON kb_file(kb_id);
      CREATE INDEX IF NOT EXISTS idx_kb_file_status ON kb_file(status);
      CREATE INDEX IF NOT EXISTS idx_kb_file_chunk_file_id ON kb_file_chunk(file_id);
    `

    await this.db.execute(createTables)
  }

  async list(): Promise<KnowledgeBase[]> {
    await this.ensureInitialized()
    
    return this.safeDbOperation(async () => {
      const result = await this.db!.query('SELECT * FROM knowledge_base ORDER BY created_at DESC')
      
      return result.values?.map((row: any) => ({
        id: row.id,
        name: row.name,
        embeddingModel: row.embedding_model || 'simple-text',
        rerankModel: row.rerank_model || 'none',
        visionModel: row.vision_model || 'none',
        createdAt: row.created_at,
      })) || []
    }, 'list')
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
    if (!this.db) {
      console.error('[Mobile KB] Database not initialized when listing files')
      return []
    }

    console.log(`[Mobile KB] Listing files for KB ${kbId}`)
    
    try {
      const result = await this.db.query(
        'SELECT * FROM kb_file WHERE kb_id = ? ORDER BY created_at DESC',
        [kbId]
      )

      console.log(`[Mobile KB] Raw query result:`, result)
      console.log(`[Mobile KB] Query values:`, result.values)
      console.log(`[Mobile KB] Values length:`, result.values?.length || 0)

      if (!result.values || result.values.length === 0) {
        console.warn(`[Mobile KB] No files found for KB ${kbId}`)
        
        // 调试：检查是否有任何文件记录
        const allFilesResult = await this.db.query('SELECT COUNT(*) as count FROM kb_file')
        console.log(`[Mobile KB] Total files in database:`, allFilesResult.values?.[0]?.count || 0)
        
        // 调试：检查是否有这个KB的任何记录
        const kbCheckResult = await this.db.query('SELECT * FROM kb_file WHERE kb_id = ?', [kbId])
        console.log(`[Mobile KB] Files for KB ${kbId}:`, kbCheckResult.values)
        
        return []
      }

      const mappedFiles = result.values.map((row: any) => {
        console.log(`[Mobile KB] Processing file row:`, row)
        return {
          id: row.id,
          kb_id: row.kb_id,
          filename: row.filename,
          filepath: row.filename, // 移动端使用 filename 作为 filepath
          mime_type: row.mime_type,
          file_size: row.file_size,
          chunk_count: row.chunk_count,
          total_chunks: row.total_chunks,
          status: row.status,
          error: row.error || '',
          createdAt: typeof row.created_at === 'string' ? new Date(row.created_at).getTime() : row.created_at,
        }
      })

      console.log(`[Mobile KB] Mapped files:`, mappedFiles)
      return mappedFiles
    } catch (error) {
      console.error('[Mobile KB] Error listing files:', error)
      return []
    }
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
    console.log(`[Mobile KB] listFilesPaginated called with kbId: ${kbId}, offset: ${offset}, limit: ${limit}`)
    
    await this.ensureInitialized()
    if (!this.db) {
      console.error('[Mobile KB] Database not initialized in listFilesPaginated')
      throw new Error('Database not initialized')
    }

    console.log(`[Mobile KB] Database is initialized, executing query`)
    
    try {
      const result = await this.db.query(
        'SELECT * FROM kb_file WHERE kb_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [kbId, limit, offset]
      )

      console.log(`[Mobile KB] listFilesPaginated query result:`, result)
      console.log(`[Mobile KB] listFilesPaginated values count:`, result.values?.length || 0)
      
      if (!result.values || result.values.length === 0) {
        console.warn(`[Mobile KB] No files found in listFilesPaginated for KB ${kbId}`)
        
        // 调试：检查是否有任何文件记录
        const totalCountResult = await this.db.query('SELECT COUNT(*) as count FROM kb_file WHERE kb_id = ?', [kbId])
        console.log(`[Mobile KB] Total files for KB ${kbId}:`, totalCountResult.values?.[0]?.count || 0)
        
        // 调试：检查所有状态的文件
        const allStatusResult = await this.db.query('SELECT status, COUNT(*) as count FROM kb_file WHERE kb_id = ? GROUP BY status', [kbId])
        console.log(`[Mobile KB] Files by status for KB ${kbId}:`, allStatusResult.values)
        
        return []
      }

      const mappedFiles = result.values.map((row: any) => {
        console.log(`[Mobile KB] Processing paginated file row:`, row)
        return {
          id: row.id,
          kb_id: row.kb_id,
          filename: row.filename,
          filepath: row.filename, // 移动端使用 filename 作为 filepath
          mime_type: row.mime_type,
          file_size: row.file_size,
          chunk_count: row.chunk_count,
          total_chunks: row.total_chunks,
          status: row.status,
          error: row.error || '',
          createdAt: typeof row.created_at === 'string' ? new Date(row.created_at).getTime() : row.created_at, // 转换为时间戳
        }
      })

      console.log(`[Mobile KB] listFilesPaginated mapped files:`, mappedFiles)
      return mappedFiles
    } catch (error) {
      console.error('[Mobile KB] Error in listFilesPaginated:', error)
      throw error
    }
  }

  async uploadFile(kbId: number, file: FileMeta): Promise<void> {
    await this.ensureInitialized()
    if (!this.db) throw new Error('Database not initialized')

    let fileId: number | null = null
    
    try {
      // 生成唯一的内容键
      const contentKey = `kb_${kbId}_file_${uuidv4()}`
      
      // 读取文件内容
      const content = await this.readFileContent(file)
      
      // 先插入文件记录，状态为 processing
      console.log(`[Mobile KB] Inserting file record:`, {
        kbId,
        filename: file.name,
        contentKey,
        mimeType: file.type,
        fileSize: file.size,
        status: 'processing'
      })
      
      const insertResult = await this.db.run(
        `INSERT INTO kb_file 
         (kb_id, filename, content_key, mime_type, file_size, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          kbId,
          file.name,
          contentKey,
          file.type,
          file.size,
          'processing'
        ]
      )
      
      console.log(`[Mobile KB] Insert result:`, insertResult)
      
      fileId = insertResult.changes?.lastId || null
      if (!fileId) {
        console.error('[Mobile KB] Failed to get file ID from insert result:', insertResult)
        throw new Error('Failed to get file ID')
      }
      
      console.log(`[Mobile KB] File record created with ID: ${fileId}`)
      
      // 立即验证插入是否成功
      const verifyResult = await this.db.query('SELECT * FROM kb_file WHERE id = ?', [fileId])
      console.log(`[Mobile KB] Verification query result:`, verifyResult)
      
      if (!verifyResult.values || verifyResult.values.length === 0) {
        console.error('[Mobile KB] File record not found after insert!')
        throw new Error('File record not persisted')
      }
      
      console.log(`[Mobile KB] File record verified successfully with ID: ${fileId}`)
      
      // 存储原始文档内容到 LocalForage
      await this.storage.setItem(contentKey, content)
      
      // 先尝试简单的完成状态更新，不进行AI处理
      console.log(`[Mobile KB] Updating file status to completed for testing`)
      await this.db.run(
        `UPDATE kb_file SET status = ?, keywords = ?, summary = ? WHERE id = ?`,
        ['completed', this.extractKeywords(content), content.slice(0, 200) + '...', fileId]
      )
      
      // 再次验证更新是否成功
      const finalVerifyResult = await this.db.query('SELECT * FROM kb_file WHERE id = ?', [fileId])
      console.log(`[Mobile KB] Final verification after update:`, finalVerifyResult.values?.[0])
      
      // 使用后备处理方法确保文件被正确分块
      console.log(`[Mobile KB] Starting fallback processing for file ${fileId}`)
      this.fallbackFileProcessing(fileId, content).catch(error => {
        console.error(`[Mobile KB] Fallback processing failed for file ${fileId}:`, error)
        // 如果后备处理也失败，至少标记为完成状态
        this.db?.run(
          `UPDATE kb_file SET status = ?, error = ? WHERE id = ?`,
          ['failed', String(error), fileId]
        ).catch(console.error)
      })
      
      console.log(`[Mobile KB] File uploaded and processed: ${file.name}`)
    } catch (error) {
      console.error('[Mobile KB] Failed to upload file:', error)
      
      // 如果上传失败，清理已创建的记录
      if (fileId) {
        await this.db?.run('DELETE FROM kb_file WHERE id = ?', [fileId]).catch(console.error)
      }
      
      throw error
    }
  }

  /**
   * 使用AI处理文件（异步）
   */
  private async processFileWithAI(fileId: number, content: string, filename: string): Promise<void> {
    try {
      console.log(`[Mobile KB] Starting AI processing for file ${fileId}`)
      
      // 使用AI增强处理
      const aiResult = await this.enhanceFileWithAI(content, filename)
      
      // 更新文件记录
      await this.db?.run(
        `UPDATE kb_file 
         SET keywords = ?, summary = ?, chunk_count = ?, total_chunks = ?, ai_processed = 1, status = ? 
         WHERE id = ?`,
        [
          aiResult.keywords,
          aiResult.summary,
          aiResult.chunks.length,
          aiResult.chunks.length,
          'completed',
          fileId
        ]
      )
      
      // 存储分块内容
      for (let i = 0; i < aiResult.chunks.length; i++) {
        const chunk = aiResult.chunks[i]
        const chunkKeywords = this.extractKeywords(chunk)
        
        await this.db?.run(
          `INSERT INTO kb_file_chunk (file_id, chunk_index, content, keywords) 
           VALUES (?, ?, ?, ?)`,
          [fileId, i, chunk, chunkKeywords]
        )
      }
      
      console.log(`[Mobile KB] AI processing completed for file ${fileId}, created ${aiResult.chunks.length} chunks`)
    } catch (error) {
      console.error(`[Mobile KB] AI processing failed for file ${fileId}:`, error)
      throw error
    }
  }

  /**
   * 后备文件处理（当AI处理失败时）
   */
  private async fallbackFileProcessing(fileId: number, content: string): Promise<void> {
    try {
      const keywords = this.extractKeywords(content)
      const summary = content.slice(0, 200) + '...'
      const chunks = this.chunkContent(content)
      
      await this.db?.run(
        `UPDATE kb_file 
         SET keywords = ?, summary = ?, chunk_count = ?, total_chunks = ?, ai_processed = 0, status = ? 
         WHERE id = ?`,
        [keywords, summary, chunks.length, chunks.length, 'completed', fileId]
      )
      
      // 存储分块内容
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const chunkKeywords = this.extractKeywords(chunk)
        
        await this.db?.run(
          `INSERT INTO kb_file_chunk (file_id, chunk_index, content, keywords) 
           VALUES (?, ?, ?, ?)`,
          [fileId, i, chunk, chunkKeywords]
        )
      }
      
      console.log(`[Mobile KB] Fallback processing completed for file ${fileId}`)
    } catch (error) {
      console.error(`[Mobile KB] Fallback processing failed for file ${fileId}:`, error)
      // 最后的兜底：至少标记为失败状态
      await this.db?.run(
        `UPDATE kb_file SET status = ?, error = ? WHERE id = ?`,
        ['failed', String(error), fileId]
      ).catch(console.error)
    }
  }

  private async readFileContent(file: FileMeta): Promise<string> {
    return new Promise((resolve, reject) => {
      // 检查是否有原始 File 对象引用
      const fileObj = file._file
      if (!fileObj) {
        console.warn('[Mobile KB] No _file reference found, using fallback content')
        resolve(`File: ${file.name} (${file.type}, ${file.size} bytes)`)
        return
      }

      console.log(`[Mobile KB] Reading file content: ${file.name} (${file.type}, ${file.size} bytes)`)
      
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        console.log(`[Mobile KB] File content read successfully, length: ${content?.length || 0}`)
        resolve(content || '')
      }
      
      reader.onerror = (error) => {
        console.error('[Mobile KB] Failed to read file content:', error)
        reject(new Error(`Failed to read file: ${file.name}`))
      }
      
      reader.onabort = () => {
        console.warn('[Mobile KB] File reading was aborted')
        reject(new Error(`File reading aborted: ${file.name}`))
      }
      
      try {
        // 根据文件类型选择读取方式
        if (file.type.startsWith('text/') || file.type === 'application/json' || 
            file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
          console.log(`[Mobile KB] Reading as text file: ${file.name}`)
          reader.readAsText(fileObj, 'UTF-8')
        } else {
          console.log(`[Mobile KB] Unsupported file type, using fallback: ${file.type}`)
          // 对于其他类型，返回文件基本信息
          resolve(`File: ${file.name} (${file.type}, ${file.size} bytes)`)
        }
      } catch (error) {
        console.error('[Mobile KB] Error starting file read:', error)
        reject(new Error(`Failed to start reading file: ${file.name}`))
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

  /**
   * 延迟加载AI相关依赖
   */
  private async loadAIDependencies() {
    if (!getModel) {
      const { getModel: _getModel } = await import('src/shared/models')
      getModel = _getModel
    }
    if (!createModelDependencies) {
      const { createModelDependencies: _createModelDependencies } = await import('@/adapters')
      createModelDependencies = _createModelDependencies
    }
    if (!settingActions) {
      settingActions = await import('@/stores/settingActions')
    }
    if (!generateText) {
      const { generateText: _generateText } = await import('@/packages/model-calls')
      generateText = _generateText
    }
  }

  /**
   * 使用AI增强文件处理
   */
  private async enhanceFileWithAI(content: string, filename: string): Promise<{
    summary: string
    keywords: string
    chunks: string[]
  }> {
    try {
      console.log(`[Mobile KB] Starting AI enhancement for file: ${filename}`)
      
      // 延迟加载依赖
      await this.loadAIDependencies()
      
      const settings = settingActions.getSettings()
      const dependencies = await createModelDependencies()
      const configs = { uuid: uuidv4() } // 提供必需的uuid字段
      const model = getModel(settings, configs, dependencies)

      // 创建AI处理的消息
      const messages: Message[] = [
        {
          id: uuidv4(),
          role: 'system',
          contentParts: [{
            type: 'text',
            text: `你是一个专业的文档分析助手。请分析以下文档内容，并提供：
1. 文档摘要（100-200字）
2. 关键词（用空格分隔，10-20个）
3. 将文档分割成逻辑块（每块300-500字）

请以JSON格式返回结果：
{
  "summary": "文档摘要",
  "keywords": "关键词1 关键词2 关键词3",
  "chunks": ["块1内容", "块2内容", "块3内容"]
}`
          }]
        },
        {
          id: uuidv4(),
          role: 'user',
          contentParts: [{
            type: 'text',
            text: `文件名：${filename}\n\n文档内容：\n${content.slice(0, 8000)}` // 限制长度避免token超限
          }]
        }
      ]

      const result = await generateText(model, messages)
      const aiResponse = result.contentParts.find((part: any) => part.type === 'text')?.text || ''
      
      console.log(`[Mobile KB] AI response received, length: ${aiResponse.length}`)

      // 尝试解析AI返回的JSON
      try {
        const parsed = JSON.parse(aiResponse)
        return {
          summary: parsed.summary || content.slice(0, 200) + '...',
          keywords: parsed.keywords || this.extractKeywords(content),
          chunks: parsed.chunks || [content]
        }
      } catch (parseError) {
        console.warn('[Mobile KB] Failed to parse AI response, using fallback')
        return {
          summary: content.slice(0, 200) + '...',
          keywords: this.extractKeywords(content),
          chunks: this.chunkContent(content)
        }
      }
    } catch (error) {
      console.error('[Mobile KB] AI enhancement failed, using fallback:', error)
      return {
        summary: content.slice(0, 200) + '...',
        keywords: this.extractKeywords(content),
        chunks: this.chunkContent(content)
      }
    }
  }

  /**
   * 简单的内容分块方法（作为AI失败时的后备方案）
   */
  private chunkContent(content: string, chunkSize = 500): string[] {
    const chunks: string[] = []
    const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
      } else {
        currentChunk += sentence + '。'
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks.length > 0 ? chunks : [content]
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
      console.log(`[Mobile KB] Searching for: "${query}" in KB ${kbId}`)
      
      const searchTerms = query.toLowerCase().trim().split(/\s+/)
      
      if (searchTerms.length === 0) {
        return []
      }

      const searchResults: KnowledgeBaseSearchResult[] = []

      // 首先搜索文件级别内容（包括 keywords, filename, summary）
      const fileWhereConditions = searchTerms.map(() => '(f.keywords LIKE ? OR f.filename LIKE ? OR f.summary LIKE ?)').join(' AND ')
      const fileParams: any[] = [kbId]
      searchTerms.forEach(term => {
        fileParams.push(`%${term}%`, `%${term}%`, `%${term}%`)
      })

      console.log(`[Mobile KB] Searching files with query: ${fileWhereConditions}`)
      const fileResult = await this.db.query(
        `SELECT f.id as file_id, f.filename, f.mime_type, f.summary, f.ai_processed, f.content_key, f.keywords
         FROM kb_file f 
         WHERE f.kb_id = ? AND ${fileWhereConditions} 
         ORDER BY f.created_at DESC 
         LIMIT 10`,
        fileParams
      )

      console.log(`[Mobile KB] File search returned ${fileResult.values?.length || 0} results`)

      // 处理文件搜索结果
      if (fileResult.values) {
        for (const row of fileResult.values) {
          try {
            // 尝试从 LocalForage 获取文件内容
            let content = ''
            if (row.content_key) {
              content = await this.storage.getItem<string>(row.content_key) || ''
            }
            
            // 如果没有内容，使用摘要
            if (!content && row.summary) {
              content = row.summary
            }
            
            if (content) {
              // 检查内容是否包含搜索词
              const contentLower = content.toLowerCase()
              const hasMatch = searchTerms.some(term => contentLower.includes(term))
              
              if (hasMatch) {
                const snippet = this.findMatchingSnippet(content, query, 300)
                const score = this.calculateRelevanceScore(content + ' ' + (row.keywords || ''), query)
                
                searchResults.push({
                  id: row.file_id,
                  fileId: row.file_id,
                  filename: row.filename,
                  mimeType: row.mime_type,
                  chunkIndex: 0,
                  score,
                  text: snippet,
                })
                
                console.log(`[Mobile KB] Found match in file: ${row.filename}, score: ${score}`)
              }
            }
          } catch (error) {
            console.warn(`[Mobile KB] Failed to process file ${row.file_id}:`, error)
          }
        }
      }

      // 然后搜索分块内容（如果存在）
      try {
        // 先检查是否有分块数据
        const chunkCountResult = await this.db.query(
          'SELECT COUNT(*) as count FROM kb_file_chunk WHERE file_id IN (SELECT id FROM kb_file WHERE kb_id = ?)',
          [kbId]
        )
        const totalChunks = chunkCountResult.values?.[0]?.count || 0
        console.log(`[Mobile KB] Total chunks available for KB ${kbId}: ${totalChunks}`)

        if (totalChunks > 0) {
          const chunkWhereConditions = searchTerms.map(() => '(c.keywords LIKE ? OR c.content LIKE ?)').join(' AND ')
          const chunkParams: any[] = [kbId]
          searchTerms.forEach(term => {
            chunkParams.push(`%${term}%`, `%${term}%`)
          })

          const chunkResult = await this.db.query(
            `SELECT f.id as file_id, f.filename, f.mime_type, f.summary, f.ai_processed,
                    c.id as chunk_id, c.chunk_index, c.content, c.keywords
             FROM kb_file f 
             JOIN kb_file_chunk c ON f.id = c.file_id 
             WHERE f.kb_id = ? AND ${chunkWhereConditions} 
             ORDER BY f.created_at DESC, c.chunk_index ASC 
             LIMIT 15`,
            chunkParams
          )

          console.log(`[Mobile KB] Chunk search returned ${chunkResult.values?.length || 0} results`)

          // 处理分块搜索结果
          if (chunkResult.values) {
            const processedFiles = new Set(searchResults.map(r => r.fileId))
            
            for (const row of chunkResult.values) {
              // 避免重复添加同一个文件的结果，但允许同一文件的不同分块
              const snippet = this.findMatchingSnippet(row.content, query, 300)
              const score = this.calculateRelevanceScore(row.content + ' ' + row.keywords, query)
              
              searchResults.push({
                id: row.chunk_id,
                fileId: row.file_id,
                filename: row.filename,
                mimeType: row.mime_type,
                chunkIndex: row.chunk_index,
                score,
                text: snippet,
              })
              
              console.log(`[Mobile KB] Found match in chunk: ${row.filename}[${row.chunk_index}], score: ${score}`)
            }
          }
        } else {
          console.log(`[Mobile KB] No chunks found, skipping chunk search`)
        }
      } catch (chunkError) {
        console.log(`[Mobile KB] Chunk search failed:`, chunkError)
        // 忽略分块搜索错误，可能表不存在
      }

      // 按相关性得分排序
      searchResults.sort((a, b) => b.score - a.score)
      
      console.log(`[Mobile KB] Search completed, found ${searchResults.length} results`)
      return searchResults.slice(0, 20) // 限制返回结果数量
    } catch (error) {
      console.error('[Mobile KB] Search failed:', error)
      return []
    }
  }

  /**
   * 计算搜索相关性得分
   */
  private calculateRelevanceScore(content: string, query: string): number {
    const contentLower = content.toLowerCase()
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/)
    
    let score = 0
    let totalTerms = queryTerms.length
    
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        // 精确匹配得分更高
        const exactMatches = (contentLower.match(new RegExp(term, 'g')) || []).length
        score += Math.min(exactMatches * 0.2, 1.0) // 每个匹配最多贡献1分
      }
    }
    
    // 完整查询匹配额外加分
    if (contentLower.includes(queryLower)) {
      score += 0.5
    }
    
    return Math.min(score / totalTerms, 1.0) // 标准化到0-1
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

  /**
   * 调试方法：输出数据库状态信息
   */
  async debugDatabase(kbId?: number): Promise<void> {
    try {
      await this.ensureInitialized()
      
      console.log('=== 数据库调试信息 ===')
      console.log('数据库连接状态:', this.db ? '已连接' : '未连接')
      console.log('初始化状态:', this.isInitialized)
      
      if (!this.db) {
        console.error('数据库未初始化')
        return
      }

      // 检查表是否存在
      const tablesResult = await this.db.query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )
      console.log('数据库表:', tablesResult.values?.map(row => row.name))

      // 检查知识库总数
      const kbCountResult = await this.db.query('SELECT COUNT(*) as count FROM knowledge_base')
      console.log('知识库总数:', kbCountResult.values?.[0]?.count)

      // 检查文件总数
      const fileCountResult = await this.db.query('SELECT COUNT(*) as count FROM kb_file')
      console.log('文件总数:', fileCountResult.values?.[0]?.count)

      // 如果指定了知识库ID，显示详细信息
      if (kbId) {
        console.log(`--- 知识库 ${kbId} 详细信息 ---`)
        
        const kbResult = await this.db.query('SELECT * FROM knowledge_base WHERE id = ?', [kbId])
        console.log('知识库信息:', kbResult.values?.[0])

        const filesResult = await this.db.query('SELECT * FROM kb_file WHERE kb_id = ?', [kbId])
        console.log(`知识库 ${kbId} 的文件:`, filesResult.values)

        // 检查分块表
        if (filesResult.values && filesResult.values.length > 0) {
          for (const file of filesResult.values) {
            const chunksResult = await this.db.query('SELECT COUNT(*) as count FROM kb_file_chunk WHERE file_id = ?', [file.id])
            console.log(`文件 ${file.id} (${file.filename}) 的分块数:`, chunksResult.values?.[0]?.count)
          }
        }
      }

      // 检查LocalForage存储
      const storageKeys = await this.storage.keys()
      console.log('LocalForage存储的键数量:', storageKeys.length)
      console.log('LocalForage存储的键:', storageKeys.slice(0, 10)) // 只显示前10个

      console.log('=== 调试信息结束 ===')
    } catch (error) {
      console.error('调试过程中出错:', error)
    }
  }
}