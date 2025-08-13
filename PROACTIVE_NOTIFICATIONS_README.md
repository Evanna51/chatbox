# Character 主动通知功能

## 功能概述

为 Character 类型的 AI 搭档对话实现了主动通知功能，AI 会在特定时间段内主动发起对话。

## 主要特性

### 1. 配置选项
- 在会话设置中，Character 类型的对话会显示"主动通知"开关
- 用户可以为每个 Character 对话单独开启/关闭主动通知

### 2. 触发条件
- **时间窗口**：中午 11:00 - 13:00 之间
- **活动检测**：5 分钟内无对话活动
- **随机时间**：在时间窗口内随机选择通知时间

### 3. 通知方式
- **移动端**：使用 Capacitor LocalNotifications 发送本地通知
- **桌面端**：使用 Electron Notification API 发送系统通知
- **Web端**：使用浏览器的 Notification API

### 4. 消息内容
AI 会随机选择以下消息之一主动发送：
- "吃饭了吗？"
- "最近怎么样呀？"
- "有什么想聊的吗？" 
- "在忙什么呢？"

## 技术实现

### 核心文件
1. **主动通知服务**: `src/renderer/packages/proactive-notification/index.ts`
2. **类型定义**: `src/renderer/packages/proactive-notification/types.ts`
3. **启动引导**: `src/renderer/setup/proactive_notification_bootstrap.ts`
4. **设置界面**: `src/renderer/modals/SessionSettings.tsx`

### 平台支持
- **桌面端**: 通过 IPC 调用主进程的 Electron Notification API
- **移动端**: 使用 @capacitor/local-notifications 插件
- **Web端**: 使用浏览器原生 Notification API

### 数据流
1. 应用启动时初始化主动通知服务
2. 为启用主动通知的 Character 会话创建调度
3. 定时检查触发条件（每分钟检查一次）
4. 满足条件时发送通知并向会话添加 AI 消息
5. 用户发送消息时更新活动时间

## 使用方法

1. 创建或选择一个 Character 类型的 AI 搭档
2. 进入会话设置（点击右上角设置按钮）
3. 在"模型设置"部分找到"主动通知"开关
4. 开启主动通知功能
5. AI 会在中午时间段主动发起对话

## 注意事项

- 只有 Character 类型的会话才会显示主动通知选项
- 需要用户授权通知权限
- 通知触发需要满足时间窗口和无活动的双重条件
- 主动消息会标记为 `isProactive: true`

## 扩展性

该功能设计具有良好的扩展性：
- 可以通过配置文件修改时间窗口、消息模板等
- 可以为不同 Character 设置个性化的消息内容
- 可以添加更多触发条件（如特定日期、用户状态等）