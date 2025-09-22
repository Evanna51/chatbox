export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * 生成安全的文件名，确保在移动设备上也能正常导出
 * @param baseName 基础名称（如主题名称）
 * @param maxLength 最大长度，默认50个字符
 * @returns 安全的文件名
 */
export function generateSafeFilename(baseName: string, maxLength: number = 50): string {
    // 移除或替换不安全的字符
    let safeName = baseName
        .trim() // 先去除首尾空格
        .replace(/[<>:"/\\|?*]/g, '-') // 替换文件系统不允许的字符
        .replace(/[\x00-\x1f\x80-\x9f]/g, '') // 移除控制字符
        .replace(/^\.+/, '') // 移除开头的点
        .replace(/\.+$/, '') // 移除结尾的点
        .replace(/\s+/g, '-') // 将空格替换为连字符
        .replace(/-+/g, '-') // 合并多个连字符
        .replace(/^-+/, '') // 移除开头的连字符
        .replace(/-+$/, '') // 移除结尾的连字符

    // 如果名称为空或只有特殊字符，使用默认名称
    if (!safeName) {
        safeName = 'analysis'
    }

    // 截断到最大长度，确保不会在中间截断多字节字符
    if (safeName.length > maxLength) {
        // 找到安全的截断点
        let truncated = safeName.substring(0, maxLength)
        // 如果最后一个字符是连字符，移除它
        if (truncated.endsWith('-')) {
            truncated = truncated.slice(0, -1)
        }
        safeName = truncated
    }

    return safeName
}