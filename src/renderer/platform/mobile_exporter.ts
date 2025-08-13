import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Toast } from '@capacitor/toast'
import { Exporter } from './interfaces'
import * as base64 from '@/packages/base64'

export default class MobileExporter implements Exporter {
  constructor() {}

  async exportBlob(filename: string, blob: Blob, encoding?: 'utf8' | 'ascii' | 'utf16'): Promise<void> {
    try {
      // 确保文件名安全
      const safeFilename = this.sanitizeFilename(filename)
      
      // 将Blob转换为base64
      const reader = new FileReader()
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          // 移除data URL前缀
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      // 写入文件到Documents目录
      const result = await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })

      console.log('文件已保存到:', result.uri)

      // 显示成功提示
      await Toast.show({
        text: `文件已保存: ${safeFilename}`,
        duration: 'long'
      })

      // 可选：分享文件
      await this.shareFile(result.uri, safeFilename)
    } catch (error) {
      console.error('移动设备导出Blob失败:', error)
      await Toast.show({
        text: `导出失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: 'long'
      })
      throw error
    }
  }

  async exportTextFile(filename: string, content: string): Promise<void> {
    try {
      // 确保文件名安全
      const safeFilename = this.sanitizeFilename(filename)
      
      // 写入文件到Documents目录
      const result = await Filesystem.writeFile({
        path: safeFilename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })

      console.log('文件已保存到:', result.uri)

      // 显示成功提示
      await Toast.show({
        text: `文件已保存: ${safeFilename}`,
        duration: 'long'
      })

      // 分享文件
      await this.shareFile(result.uri, safeFilename)
    } catch (error) {
      console.error('移动设备导出文本文件失败:', error)
      await Toast.show({
        text: `导出失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: 'long'
      })
      throw error
    }
  }

  async exportImageFile(basename: string, base64Data: string): Promise<void> {
    try {
      // 解析 base64 数据
      let { type, data } = base64.parseImage(base64Data)
      if (type === '') {
        type = 'image/png'
        data = base64Data
      }
      const ext = (type.split('/')[1] || 'png').split('+')[0] // 处理 svg+xml 的情况
      const filename = basename + '.' + ext
      const safeFilename = this.sanitizeFilename(filename)

      // 写入文件到Documents目录
      const result = await Filesystem.writeFile({
        path: safeFilename,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })

      console.log('图片已保存到:', result.uri)

      // 显示成功提示
      await Toast.show({
        text: `图片已保存: ${safeFilename}`,
        duration: 'long'
      })

      // 分享文件
      await this.shareFile(result.uri, safeFilename)
    } catch (error) {
      console.error('移动设备导出图片失败:', error)
      await Toast.show({
        text: `导出失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: 'long'
      })
      throw error
    }
  }

  async exportByUrl(filename: string, url: string): Promise<void> {
    try {
      // 对于移动设备，我们可以直接分享URL
      await Share.share({
        title: filename,
        text: `分享文件: ${filename}`,
        url: url,
        dialogTitle: '分享文件'
      })
    } catch (error) {
      console.error('移动设备分享URL失败:', error)
      await Toast.show({
        text: `分享失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: 'long'
      })
      throw error
    }
  }

  private async shareFile(uri: string, filename: string): Promise<void> {
    try {
      await Share.share({
        title: `分享 ${filename}`,
        text: `来自Chatbox的导出文件: ${filename}`,
        url: uri,
        dialogTitle: '分享文件'
      })
    } catch (error) {
      console.warn('文件分享失败:', error)
      // 分享失败不抛出错误，因为文件已经保存成功
    }
  }

  private sanitizeFilename(filename: string): string {
    // 移除或替换不安全的字符
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // 替换不安全字符为下划线
      .replace(/\s+/g, '_') // 替换空格为下划线
      .substring(0, 100) // 限制文件名长度
  }
}