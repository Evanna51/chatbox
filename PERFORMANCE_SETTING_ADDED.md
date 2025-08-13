# 性能检测功能开关实现

## 功能概述

在常规设置的"错误报告"部分下方添加了一个"性能检测"功能开关，允许用户控制是否启用性能监控功能。

## 实现细节

### 1. 类型定义更新 ✅

**文件**: `src/shared/types.ts`

在 `Settings` 接口中添加了新的配置项：
```typescript
enablePerformanceMonitoring: boolean // 是否启用性能监控
```

### 2. 默认设置配置 ✅

**文件**: `src/shared/defaults.ts`

设置默认值为关闭状态：
```typescript
enablePerformanceMonitoring: false, // 默认关闭性能监控
```

这样确保新安装的用户默认不会看到性能监控，需要手动开启。

### 3. 用户界面添加 ✅

**文件**: `src/renderer/routes/settings/general.tsx`

在"错误报告"部分下方添加了复选框：
```jsx
<Checkbox
  label={t('Enable performance monitoring (mobile only)')}
  checked={settings.enablePerformanceMonitoring}
  onChange={(e) => setSettings({ enablePerformanceMonitoring: e.target.checked })}
/>
```

### 4. 国际化支持 ✅

**添加的翻译文本**:
- 英文: `"Enable performance monitoring (mobile only)"`
- 中文: `"启用性能监控（仅移动端）"`

### 5. 性能监控组件更新 ✅

**文件**: `src/renderer/components/PerformanceMonitor.tsx`

更新组件逻辑，使其只在用户启用设置时才工作：

```typescript
// 引入设置钩子
import { useSettings } from '@/hooks/useSettings'

// 在组件中使用设置
const { settings } = useSettings()

// 条件判断中加入设置检查
if (!show || !isSmallScreen || !settings.enablePerformanceMonitoring) return

// useEffect 依赖中包含设置
}, [show, isSmallScreen, settings.enablePerformanceMonitoring, monitor, onOptimizationSuggestion])
```

## 功能特性

### 用户控制
- **默认关闭**: 新用户不会看到性能监控提醒
- **手动启用**: 用户可以在设置中主动开启
- **实时生效**: 更改设置后立即生效，无需重启

### 界面位置
- **路径**: 设置 → 常规设置 → 错误报告（下方）
- **标签**: "启用性能监控（仅移动端）"
- **类型**: 复选框开关

### 移动端专用
- 该功能仅在移动端设备上生效
- 桌面端不显示性能监控面板
- 标签明确标注"仅移动端"

## 使用方法

### 启用性能监控
1. 打开应用设置
2. 进入"常规设置"
3. 滚动到"错误报告"部分
4. 勾选"启用性能监控（仅移动端）"
5. 设置立即生效

### 禁用性能监控
1. 取消勾选该选项
2. 性能监控面板立即隐藏
3. 后台监控停止运行

## 技术实现

### 设置流程
```
用户操作 → UI组件 → useSettings钩子 → 存储更新 → 组件重新渲染
```

### 组件联动
```
设置页面 ← 双向绑定 → Settings Store → 性能监控组件
```

### 条件渲染
```typescript
// 多重条件判断
if (!show || !isSmallScreen || !showMonitor || !settings.enablePerformanceMonitoring) {
  return null
}
```

## 预期效果

### 用户体验
- **减少干扰**: 默认关闭，避免普通用户困惑
- **开发友好**: 开发者和高级用户可按需开启
- **性能提升**: 关闭时完全不运行监控逻辑

### 系统性能
- **资源节约**: 未启用时不消耗监控资源
- **按需加载**: 只有在需要时才启动性能检测
- **用户选择**: 把控制权交给用户

## 后续优化建议

1. **智能推荐**: 检测到性能问题时提示用户开启监控
2. **临时模式**: 提供临时启用选项，重启后自动关闭
3. **高级设置**: 允许用户自定义监控参数和阈值
4. **统计报告**: 提供性能使用统计和历史趋势

现在用户可以完全控制性能监控功能的开启和关闭！