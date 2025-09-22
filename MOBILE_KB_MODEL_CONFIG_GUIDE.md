# 移动端知识库模型配置功能指南

## 功能概述

为移动端知识库页面添加了完整的模型配置功能，包括嵌入模型、重排模型和视觉模型的选择和管理。

## 新增功能

### 1. 模型选择组件 (`MobileModelSelector`)

**位置**: `src/renderer/components/knowledge-base/MobileModelSelector.tsx`

**功能特性**:
- 支持嵌入模型、重排模型、视觉模型的选择
- 自动获取可用的 API 模型列表
- 显示模型可用性状态
- 支持紧凑模式和完整模式
- 提供模型配置提示

**主要组件**:
- `MobileModelSelector`: 完整的模型选择器
- `MobileModelDisplay`: 简化的模型显示组件

### 2. 知识库创建功能增强

**新增字段**:
- 嵌入模型选择（必填）
- 重排模型选择（可选）
- 视觉模型选择（可选）

**验证逻辑**:
- 必须选择嵌入模型才能创建知识库
- 自动将未选择的可选模型设置为 'none'

### 3. 知识库编辑功能

**新增功能**:
- 点击设置图标编辑现有知识库的模型配置
- 支持修改重排模型和视觉模型
- 嵌入模型可以修改，但会显示警告提示

### 4. 模型状态显示

**知识库列表增强**:
- 每个知识库卡片显示当前配置的模型
- 使用颜色标识模型可用性状态
- 紧凑的徽章显示格式

## 使用方法

### 创建知识库

1. 点击"新建"按钮
2. 输入知识库名称
3. 在"模型配置"部分选择：
   - **嵌入模型**（必选）：用于提取文本特征向量
   - **重排模型**（可选）：用于获得更准确的搜索结果
   - **视觉模型**（可选）：用于预处理图像文件
4. 点击"创建"

### 编辑知识库模型

1. 在知识库列表中点击设置图标（⚙️）
2. 在弹出的编辑窗口中修改模型配置
3. 注意嵌入模型修改的警告提示
4. 点击"更新"保存更改

### 模型配置说明

#### 嵌入模型
- **用途**: 将文本转换为向量表示，用于语义搜索
- **要求**: 必须选择，影响搜索质量
- **类型**: 支持各种 API 提供商的嵌入模型

#### 重排模型
- **用途**: 对搜索结果进行重新排序，提高准确性
- **要求**: 可选，但推荐使用
- **类型**: 支持专门的重排模型

#### 视觉模型
- **用途**: 处理图像文件，提取图像中的文本信息
- **要求**: 可选，仅在需要处理图像时使用
- **类型**: 支持具有视觉能力的多模态模型

## 技术实现

### 模型列表获取

```typescript
// 从 providers 中筛选不同类型的模型
const embeddingModelList = getModelList((model) => 
  !!model.type && model.type === 'embedding'
)

const rerankModelList = getModelList((model) => 
  model.type === 'rerank'
)

const visionModelList = getModelList((model) => 
  !!model.capabilities?.includes('vision')
)
```

### 模型状态检查

```typescript
// 检查模型是否可用
const isModelAvailable = (modelValue: string | null) => {
  if (!modelValue) return true
  
  const [providerId, modelId] = modelValue.split(':')
  const provider = providers.find(p => p.id === providerId)
  return !!provider?.models?.find(m => m.modelId === modelId)
}
```

### 数据库更新

知识库控制器的 `create` 和 `update` 方法已支持新的模型字段：

```typescript
await knowledgeBaseController.create({
  name: newKbName.trim(),
  embeddingModel: newEmbeddingModel,
  rerankModel: newRerankModel || 'none',
  visionModel: newVisionModel || 'none',
})
```

## 界面设计

### 响应式布局
- 使用 Mantine 组件库确保移动端友好
- 支持紧凑模式和完整模式切换
- 自适应不同屏幕尺寸

### 用户体验优化
- 清晰的模型状态指示
- 实时的可用性检查
- 友好的错误提示和验证
- 直观的图标和颜色编码

### 可访问性
- 支持键盘导航
- 提供工具提示和说明文本
- 清晰的标签和描述

## 配置要求

### 模型提供商设置
在使用模型配置功能之前，需要在设置中配置相应的模型提供商：

1. 进入 设置 → 提供商 → 模型列表
2. 添加支持嵌入、重排、视觉功能的模型
3. 确保 API 密钥等配置正确

### 支持的模型类型
- **嵌入模型**: OpenAI text-embedding-ada-002, text-embedding-3-small 等
- **重排模型**: Cohere rerank 系列模型
- **视觉模型**: GPT-4V, Claude-3 等多模态模型

## 故障排除

### 常见问题

1. **没有可选的模型**
   - 检查提供商配置是否正确
   - 确认模型类型标记是否正确

2. **模型显示为不可用**
   - 检查 API 密钥是否有效
   - 确认网络连接正常

3. **创建知识库失败**
   - 确保选择了嵌入模型
   - 检查控制台错误信息

### 调试方法

可以使用之前创建的调试工具：

```javascript
// 在控制台中运行
debugKnowledgeBase()
```

## 未来扩展

### 计划功能
1. 模型性能监控
2. 自动模型推荐
3. 批量模型配置
4. 模型使用统计

### 优化方向
1. 模型加载性能优化
2. 更智能的模型选择建议
3. 模型配置的导入导出功能

## 总结

移动端知识库模型配置功能为用户提供了完整的模型管理能力，支持创建和编辑知识库时选择最适合的 AI 模型。通过直观的界面和完善的验证机制，确保用户能够轻松配置高质量的知识库系统。


