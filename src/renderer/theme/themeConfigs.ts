import { Theme, ColorMode } from '../../shared/types'

// Material-UI 主题颜色配置
export interface ThemeColorConfig {
  primary: { main: string; light: string; dark: string }
  secondary: { main: string; light: string; dark: string }
  success: { main: string; light: string; dark: string }
  warning: { main: string; light: string; dark: string }
  error: { main: string; light: string; dark: string }
  info: { main: string; light: string; dark: string }
}

// Mantine 主题颜色配置
export interface MantineColorConfig {
  brand: string
  secondary: string
  success: string
  error: string
  warning: string
}

// 定义不同主题的颜色配置 - 支持浅色和深色两套配置
export interface ThemeColorConfigs {
  light: ThemeColorConfig
  dark: ThemeColorConfig
}

export const themeColors: Record<string, ThemeColorConfigs> = {
  default: {
    light: {
      primary: { main: '#00b894', light: '#55d6c2', dark: '#008a6b' }, // 薄荷绿
      secondary: { main: '#74b9ff', light: '#a6ccff', dark: '#4a8bcc' }, // 天空蓝
      success: { main: '#00cec9', light: '#55e0db', dark: '#009c98' }, // 翠绿色
      warning: { main: '#fdcb6e', light: '#fed89e', dark: '#ca9f3e' }, // 阳光橙
      error: { main: '#e17055', light: '#e89377', dark: '#b4562b' }, // 珊瑚红
      info: { main: '#a29bfe', light: '#c2bffe', dark: '#7f77cb' }, // 薰衣草紫
    },
    dark: {
      primary: { main: '#4dd0c7', light: '#7de0d9', dark: '#26a69a' }, // 深色薄荷绿
      secondary: { main: '#42a5f5', light: '#64b5f6', dark: '#1976d2' }, // 深色天空蓝
      success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色翠绿色
      warning: { main: '#ffb74d', light: '#ffcc80', dark: '#f57c00' }, // 深色阳光橙
      error: { main: '#ef5350', light: '#e57373', dark: '#c62828' }, // 深色珊瑚红
      info: { main: '#ab47bc', light: '#ba68c8', dark: '#7b1fa2' }, // 深色薰衣草紫
    },
  },
  freshMint: {
    light: {
      primary: { main: '#00b894', light: '#55d6c2', dark: '#008a6b' }, // 薄荷绿主导
      secondary: { main: '#81ecec', light: '#b2f5f5', dark: '#5fb3b3' }, // 浅薄荷
      success: { main: '#00cec9', light: '#55e0db', dark: '#009c98' }, // 翠绿
      warning: { main: '#fdcb6e', light: '#fed89e', dark: '#ca9f3e' }, // 温和橙
      error: { main: '#fd79a8', light: '#fe9bc2', dark: '#ca5d85' }, // 粉红
      info: { main: '#6c5ce7', light: '#8b7eed', dark: '#5644b8' }, // 深紫
    },
    dark: {
      primary: { main: '#4dd0c7', light: '#7de0d9', dark: '#26a69a' }, // 深色薄荷绿
      secondary: { main: '#4fc3f7', light: '#81d4fa', dark: '#0288d1' }, // 深色天空蓝
      success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色成功绿
      warning: { main: '#ffb74d', light: '#ffcc80', dark: '#f57c00' }, // 深色警告橙
      error: { main: '#ef5350', light: '#e57373', dark: '#c62828' }, // 深色错误红
      info: { main: '#ab47bc', light: '#ba68c8', dark: '#7b1fa2' }, // 深色信息紫
    },
  },
  oceanBreeze: {
    light: {
      primary: { main: '#74b9ff', light: '#a6ccff', dark: '#4a8bcc' }, // 天空蓝主导
      secondary: { main: '#0984e3', light: '#4ba3f0', dark: '#0669b8' }, // 深蓝
      success: { main: '#00b894', light: '#55d6c2', dark: '#008a6b' }, // 薄荷绿
      warning: { main: '#f39c12', light: '#f5b041', dark: '#c27d0e' }, // 海洋橙
      error: { main: '#e74c3c', light: '#ec7063', dark: '#b93d30' }, // 海洋红
      info: { main: '#9b59b6', light: '#bb7bd1', dark: '#7c4693' }, // 海洋紫
    },
    dark: {
      primary: { main: '#42a5f5', light: '#64b5f6', dark: '#1976d2' }, // 深色海洋蓝
      secondary: { main: '#26c6da', light: '#4dd0e1', dark: '#0097a7' }, // 深色青色
      success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色成功绿
      warning: { main: '#ffa726', light: '#ffb74d', dark: '#f57c00' }, // 深色警告橙
      error: { main: '#ef5350', light: '#e57373', dark: '#c62828' }, // 深色错误红
      info: { main: '#ab47bc', light: '#ba68c8', dark: '#7b1fa2' }, // 深色信息紫
    },
  },
  forestFresh: {
    light: {
      primary: { main: '#00cec9', light: '#55e0db', dark: '#009c98' }, // 翠绿主导
      secondary: { main: '#55a3ff', light: '#88c0ff', dark: '#2980b9' }, // 森林蓝
      success: { main: '#27ae60', light: '#58d68d', dark: '#1e8449' }, // 深绿
      warning: { main: '#f39c12', light: '#f5b041', dark: '#c27d0e' }, // 森林橙
      error: { main: '#e67e22', light: '#f0a04b', dark: '#b8651b' }, // 森林红
      info: { main: '#8e44ad', light: '#a569bd', dark: '#6c3483' }, // 森林紫
    },
    dark: {
      primary: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色森林绿
      secondary: { main: '#42a5f5', light: '#64b5f6', dark: '#1976d2' }, // 深色森林蓝
      success: { main: '#4caf50', light: '#66bb6a', dark: '#2e7d32' }, // 深色成功绿
      warning: { main: '#ff9800', light: '#ffb74d', dark: '#f57c00' }, // 深色警告橙
      error: { main: '#f44336', light: '#ef5350', dark: '#c62828' }, // 深色错误红
      info: { main: '#9c27b0', light: '#ab47bc', dark: '#6a1b9a' }, // 深色信息紫
    },
  },
  sunsetGlow: {
    light: {
      primary: { main: '#fdcb6e', light: '#fed89e', dark: '#ca9f3e' }, // 阳光橙主导
      secondary: { main: '#fd79a8', light: '#fe9bc2', dark: '#ca5d85' }, // 夕阳粉
      success: { main: '#00b894', light: '#55d6c2', dark: '#008a6b' }, // 清新绿
      warning: { main: '#e17055', light: '#e89377', dark: '#b4562b' }, // 夕阳红
      error: { main: '#d63031', light: '#e55a5b', dark: '#a82627' }, // 深红
      info: { main: '#a29bfe', light: '#c2bffe', dark: '#7f77cb' }, // 夕阳紫
    },
    dark: {
      primary: { main: '#ffb74d', light: '#ffcc80', dark: '#f57c00' }, // 深色夕阳橙
      secondary: { main: '#f06292', light: '#f48fb1', dark: '#c2185b' }, // 深色夕阳粉
      success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色成功绿
      warning: { main: '#ff8a65', light: '#ffab91', dark: '#d84315' }, // 深色警告橙
      error: { main: '#e53935', light: '#ef5350', dark: '#b71c1c' }, // 深色错误红
      info: { main: '#ab47bc', light: '#ba68c8', dark: '#7b1fa2' }, // 深色信息紫
    },
  },
  lavenderDream: {
    light: {
      primary: { main: '#a29bfe', light: '#c2bffe', dark: '#7f77cb' }, // 薰衣草紫主导
      secondary: { main: '#fd79a8', light: '#fe9bc2', dark: '#ca5d85' }, // 梦幻粉
      success: { main: '#00b894', light: '#55d6c2', dark: '#008a6b' }, // 清新绿
      warning: { main: '#fdcb6e', light: '#fed89e', dark: '#ca9f3e' }, // 温暖橙
      error: { main: '#e84393', light: '#f06292', dark: '#b8336a' }, // 梦幻红
      info: { main: '#6c5ce7', light: '#8b7eed', dark: '#5644b8' }, // 深紫
    },
    dark: {
      primary: { main: '#ba68c8', light: '#ce93d8', dark: '#8e24aa' }, // 深色薰衣草紫
      secondary: { main: '#f06292', light: '#f48fb1', dark: '#c2185b' }, // 深色梦幻粉
      success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色成功绿
      warning: { main: '#ffb74d', light: '#ffcc80', dark: '#f57c00' }, // 深色警告橙
      error: { main: '#ec407a', light: '#f06292', dark: '#ad1457' }, // 深色梦幻红
      info: { main: '#7e57c2', light: '#9575cd', dark: '#512da8' }, // 深色信息紫
    },
  },
  cherryBlossom: {
    light: {
      primary: { main: '#ff7675', light: '#fd9d9c', dark: '#cc5d5c' }, // 樱花粉主导
      secondary: { main: '#fd79a8', light: '#fe9bc2', dark: '#ca5d85' }, // 深粉
      success: { main: '#00b894', light: '#55d6c2', dark: '#008a6b' }, // 清新绿
      warning: { main: '#fdcb6e', light: '#fed89e', dark: '#ca9f3e' }, // 温暖橙
      error: { main: '#e84393', light: '#f06292', dark: '#b8336a' }, // 玫瑰红
      info: { main: '#a29bfe', light: '#c2bffe', dark: '#7f77cb' }, // 薰衣草紫
    },
    dark: {
      primary: { main: '#f06292', light: '#f48fb1', dark: '#c2185b' }, // 深色樱花粉
      secondary: { main: '#ec407a', light: '#f06292', dark: '#ad1457' }, // 深色玫瑰粉
      success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' }, // 深色成功绿
      warning: { main: '#ffb74d', light: '#ffcc80', dark: '#f57c00' }, // 深色警告橙
      error: { main: '#e91e63', light: '#ec407a', dark: '#ad1457' }, // 深色错误红
      info: { main: '#ab47bc', light: '#ba68c8', dark: '#7b1fa2' }, // 深色信息紫
    },
  },
}

// Mantine 主题颜色配置 - 支持浅色和深色两套配置
export interface MantineColorConfigs {
  light: MantineColorConfig
  dark: MantineColorConfig
}

export const mantineThemeColors: Record<string, MantineColorConfigs> = {
  default: {
    light: { brand: '#00b894', secondary: '#74b9ff', success: '#00cec9', error: '#e17055', warning: '#fdcb6e' },
    dark: { brand: '#4dd0c7', secondary: '#42a5f5', success: '#66bb6a', error: '#ef5350', warning: '#ffb74d' },
  },
  freshMint: {
    light: { brand: '#00b894', secondary: '#81ecec', success: '#00cec9', error: '#fd79a8', warning: '#fdcb6e' },
    dark: { brand: '#4dd0c7', secondary: '#4fc3f7', success: '#66bb6a', error: '#ef5350', warning: '#ffb74d' },
  },
  oceanBreeze: {
    light: { brand: '#74b9ff', secondary: '#0984e3', success: '#00b894', error: '#e74c3c', warning: '#f39c12' },
    dark: { brand: '#42a5f5', secondary: '#26c6da', success: '#66bb6a', error: '#ef5350', warning: '#ffa726' },
  },
  forestFresh: {
    light: { brand: '#00cec9', secondary: '#55a3ff', success: '#27ae60', error: '#e67e22', warning: '#f39c12' },
    dark: { brand: '#66bb6a', secondary: '#42a5f5', success: '#4caf50', error: '#f44336', warning: '#ff9800' },
  },
  sunsetGlow: {
    light: { brand: '#fdcb6e', secondary: '#fd79a8', success: '#00b894', error: '#d63031', warning: '#e17055' },
    dark: { brand: '#ffb74d', secondary: '#f06292', success: '#66bb6a', error: '#e53935', warning: '#ff8a65' },
  },
  lavenderDream: {
    light: { brand: '#a29bfe', secondary: '#fd79a8', success: '#00b894', error: '#e84393', warning: '#fdcb6e' },
    dark: { brand: '#ba68c8', secondary: '#f06292', success: '#66bb6a', error: '#ec407a', warning: '#ffb74d' },
  },
  cherryBlossom: {
    light: { brand: '#ff7675', secondary: '#fd79a8', success: '#00b894', error: '#e84393', warning: '#fdcb6e' },
    dark: { brand: '#f06292', secondary: '#ec407a', success: '#66bb6a', error: '#e91e63', warning: '#ffb74d' },
  },
}

// 根据主题类型选择颜色方案
export function getThemeVariant(theme: Theme): keyof typeof themeColors {
  switch (theme) {
    // 清新主题系列
    case Theme.FreshMint: return 'freshMint'
    case Theme.OceanBreeze: return 'oceanBreeze'
    case Theme.ForestFresh: return 'forestFresh'
    case Theme.SunsetGlow: return 'sunsetGlow'
    case Theme.LavenderDream: return 'lavenderDream'
    case Theme.CherryBlossom: return 'cherryBlossom'
    // 所有其他情况（包括旧值）都使用默认主题
    default: return 'default'
  }
}

// 根据主题类型选择 Mantine 颜色方案
export function getMantineThemeVariant(theme: Theme): keyof typeof mantineThemeColors {
  return getThemeVariant(theme) // 使用相同的映射逻辑
}

// 获取主题颜色配置（根据深浅色模式）
export function getThemeColors(theme: Theme, colorMode: 'light' | 'dark'): ThemeColorConfig {
  const variant = getThemeVariant(theme)
  const themeConfig = themeColors[variant]
  return themeConfig ? themeConfig[colorMode] : themeColors.default[colorMode]
}

// 将单个颜色转换为 Mantine 颜色数组
function generateMantineColorTuple(baseColor: string): readonly [string, string, string, string, string, string, string, string, string, string] {
  // 将 hex 颜色转换为 RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return { r: 0, g: 0, b: 0 }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    }
  }

  const { r, g, b } = hexToRgb(baseColor)
  
  // 生成颜色梯度 (0-9 对应 50-900)
  const generateShade = (factor: number) => {
    const newR = Math.round(Math.max(0, Math.min(255, r + (255 - r) * factor)))
    const newG = Math.round(Math.max(0, Math.min(255, g + (255 - g) * factor)))
    const newB = Math.round(Math.max(0, Math.min(255, b + (255 - b) * factor)))
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
  }

  const generateDarkShade = (factor: number) => {
    const newR = Math.round(Math.max(0, r * factor))
    const newG = Math.round(Math.max(0, g * factor))
    const newB = Math.round(Math.max(0, b * factor))
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
  }

  return [
    generateShade(0.9),    // 0: 最浅
    generateShade(0.8),    // 1
    generateShade(0.6),    // 2
    generateShade(0.4),    // 3
    generateShade(0.2),    // 4
    baseColor,             // 5: 基础颜色
    generateDarkShade(0.8), // 6
    generateDarkShade(0.6), // 7
    generateDarkShade(0.4), // 8
    generateDarkShade(0.2)  // 9: 最深
  ] as const
}

// 获取 Mantine 主题颜色配置（根据深浅色模式）
export function getMantineThemeColors(theme: Theme, colorMode: 'light' | 'dark'): MantineColorConfig {
  const variant = getMantineThemeVariant(theme)
  const themeConfig = mantineThemeColors[variant]
  return themeConfig ? themeConfig[colorMode] : mantineThemeColors.default[colorMode]
}

// 获取 Mantine 主题颜色数组（用于 virtualColor）
export function getMantineThemeColorTuples(theme: Theme, colorMode: 'light' | 'dark') {
  const colors = getMantineThemeColors(theme, colorMode)
  return {
    brand: generateMantineColorTuple(colors.brand),
    success: generateMantineColorTuple(colors.success),
    error: generateMantineColorTuple(colors.error),
    warning: generateMantineColorTuple(colors.warning),
  }
}
