import { useMemo, useLayoutEffect } from 'react'
import { getDefaultStore, useAtomValue } from 'jotai'
import { realThemeAtom, themeAtom, colorModeAtom, fontSizeAtom, languageAtom } from '../stores/atoms'
import { createTheme } from '@mui/material/styles'
import { ThemeOptions } from '@mui/material/styles'
import { Theme, Language, ColorMode } from '../../shared/types'
import platform from '../platform'
import DesktopPlatform from '../platform/desktop_platform'
import { themeColors, getThemeVariant, getThemeColors } from '../theme/themeConfigs'

// 将颜色值转换为 RGB 格式
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0 0 0'
  
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  
  return `${r} ${g} ${b}`
}

// 生成颜色梯度
function generateColorScale(baseColor: string): Record<string, string> {
  const rgb = hexToRgb(baseColor)
  const [r, g, b] = rgb.split(' ').map(Number)
  
  // 生成 50-900 的颜色梯度
  return {
    50: `${Math.min(255, r + 100)} ${Math.min(255, g + 100)} ${Math.min(255, b + 100)}`,
    100: `${Math.min(255, r + 80)} ${Math.min(255, g + 80)} ${Math.min(255, b + 80)}`,
    200: `${Math.min(255, r + 60)} ${Math.min(255, g + 60)} ${Math.min(255, b + 60)}`,
    300: `${Math.min(255, r + 40)} ${Math.min(255, g + 40)} ${Math.min(255, b + 40)}`,
    400: `${Math.min(255, r + 20)} ${Math.min(255, g + 20)} ${Math.min(255, b + 20)}`,
    500: rgb, // 基础颜色
    600: `${Math.max(0, r - 20)} ${Math.max(0, g - 20)} ${Math.max(0, b - 20)}`,
    700: `${Math.max(0, r - 40)} ${Math.max(0, g - 40)} ${Math.max(0, b - 40)}`,
    800: `${Math.max(0, r - 60)} ${Math.max(0, g - 60)} ${Math.max(0, b - 60)}`,
    900: `${Math.max(0, r - 80)} ${Math.max(0, g - 80)} ${Math.max(0, b - 80)}`,
  }
}

// 更新主题颜色的 CSS 变量
function updateThemeColorVariables(theme: Theme, realTheme: 'light' | 'dark') {
  const themeConfig = getThemeColors(theme, realTheme)
  
  if (!themeConfig) return
  
  const primaryColor = themeConfig.primary.main
  const secondaryColor = themeConfig.secondary.main
  const primaryColorScale = generateColorScale(primaryColor)
  const secondaryColorScale = generateColorScale(secondaryColor)
  
  const root = document.documentElement
  
  // 根据明暗主题设置不同的颜色梯度
  if (realTheme === 'dark') {
    // 深色主题：反转颜色梯度
    // Primary colors
    root.style.setProperty('--color-primary-50', primaryColorScale[900])
    root.style.setProperty('--color-primary-100', primaryColorScale[800])
    root.style.setProperty('--color-primary-200', primaryColorScale[700])
    root.style.setProperty('--color-primary-300', primaryColorScale[600])
    root.style.setProperty('--color-primary-400', primaryColorScale[500])
    root.style.setProperty('--color-primary-500', primaryColorScale[400])
    root.style.setProperty('--color-primary-600', primaryColorScale[300])
    root.style.setProperty('--color-primary-700', primaryColorScale[200])
    root.style.setProperty('--color-primary-800', primaryColorScale[100])
    root.style.setProperty('--color-primary-900', primaryColorScale[50])
    
    // Secondary colors
    root.style.setProperty('--color-secondary-50', secondaryColorScale[900])
    root.style.setProperty('--color-secondary-100', secondaryColorScale[800])
    root.style.setProperty('--color-secondary-200', secondaryColorScale[700])
    root.style.setProperty('--color-secondary-300', secondaryColorScale[600])
    root.style.setProperty('--color-secondary-400', secondaryColorScale[500])
    root.style.setProperty('--color-secondary-500', secondaryColorScale[400])
    root.style.setProperty('--color-secondary-600', secondaryColorScale[300])
    root.style.setProperty('--color-secondary-700', secondaryColorScale[200])
    root.style.setProperty('--color-secondary-800', secondaryColorScale[100])
    root.style.setProperty('--color-secondary-900', secondaryColorScale[50])
  } else {
    // 浅色主题：正常颜色梯度
    // Primary colors
    root.style.setProperty('--color-primary-50', primaryColorScale[50])
    root.style.setProperty('--color-primary-100', primaryColorScale[100])
    root.style.setProperty('--color-primary-200', primaryColorScale[200])
    root.style.setProperty('--color-primary-300', primaryColorScale[300])
    root.style.setProperty('--color-primary-400', primaryColorScale[400])
    root.style.setProperty('--color-primary-500', primaryColorScale[500])
    root.style.setProperty('--color-primary-600', primaryColorScale[600])
    root.style.setProperty('--color-primary-700', primaryColorScale[700])
    root.style.setProperty('--color-primary-800', primaryColorScale[800])
    root.style.setProperty('--color-primary-900', primaryColorScale[900])
    
    // Secondary colors
    root.style.setProperty('--color-secondary-50', secondaryColorScale[50])
    root.style.setProperty('--color-secondary-100', secondaryColorScale[100])
    root.style.setProperty('--color-secondary-200', secondaryColorScale[200])
    root.style.setProperty('--color-secondary-300', secondaryColorScale[300])
    root.style.setProperty('--color-secondary-400', secondaryColorScale[400])
    root.style.setProperty('--color-secondary-500', secondaryColorScale[500])
    root.style.setProperty('--color-secondary-600', secondaryColorScale[600])
    root.style.setProperty('--color-secondary-700', secondaryColorScale[700])
    root.style.setProperty('--color-secondary-800', secondaryColorScale[800])
    root.style.setProperty('--color-secondary-900', secondaryColorScale[900])
  }
}

// 新的主题切换函数，支持独立的深浅色模式
export const switchTheme = async (theme: Theme, colorMode?: ColorMode) => {
  const store = getDefaultStore()
  
  // 如果没有提供 colorMode，从 store 中获取当前设置
  if (colorMode === undefined) {
    colorMode = store.get(colorModeAtom) || ColorMode.System
  }
  
  let finalTheme = 'light' as 'light' | 'dark'
  
  // 统一的主题处理逻辑：所有主题都根据 colorMode 决定深浅色
  if (colorMode === ColorMode.Dark) {
    finalTheme = 'dark'
  } else if (colorMode === ColorMode.Light) {
    finalTheme = 'light'
  } else { // ColorMode.System
    finalTheme = (await platform.shouldUseDarkColors()) ? 'dark' : 'light'
  }
  
  store.set(realThemeAtom, finalTheme)
  localStorage.setItem('initial-theme', finalTheme)
  if (platform instanceof DesktopPlatform) {
    await platform.switchTheme(finalTheme)
  }
}

export default function useAppTheme() {
  const theme = useAtomValue(themeAtom)
  const colorMode = useAtomValue(colorModeAtom)
  const fontSize = useAtomValue(fontSizeAtom)
  const realTheme = useAtomValue(realThemeAtom)
  const language = useAtomValue(languageAtom)

  useLayoutEffect(() => {
    switchTheme(theme, colorMode)
  }, [theme, colorMode])

  useLayoutEffect(() => {
    platform.onSystemThemeChange(() => {
      const store = getDefaultStore()
      const theme = store.get(themeAtom)
      const colorMode = store.get(colorModeAtom)
      switchTheme(theme, colorMode)
    })
  }, [])

  useLayoutEffect(() => {
    // update material-ui theme
    document.querySelector('html')?.setAttribute('data-theme', realTheme)
    // update mantine color scheme to keep consistent with data-theme
    document.querySelector('html')?.setAttribute('data-mantine-color-scheme', realTheme)
    // update tailwindcss theme
    if (realTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // update theme color CSS variables based on theme
    updateThemeColorVariables(theme, realTheme)
  }, [realTheme, theme])

  const themeObj = useMemo(
    () => createTheme(getThemeDesign(realTheme, fontSize, language, theme)),
    [realTheme, fontSize, language, theme]
  )
  return themeObj
}

export function getThemeDesign(realTheme: 'light' | 'dark', fontSize: number, language: Language, theme: Theme): ThemeOptions {
  const colors = getThemeColors(theme, realTheme)
  
  return {
    palette: {
      mode: realTheme,
      primary: {
        ...colors.primary,
        contrastText: '#ffffff',
      },
      secondary: {
        ...colors.secondary,
        contrastText: '#ffffff',
      },
      success: {
        ...colors.success,
        contrastText: '#ffffff',
      },
      warning: {
        ...colors.warning,
        contrastText: getThemeVariant(theme) === 'sunsetGlow' ? '#000000' : '#ffffff',
      },
      error: {
        ...colors.error,
        contrastText: '#ffffff',
      },
      info: {
        ...colors.info,
        contrastText: '#ffffff',
      },
      ...(realTheme === 'light'
        ? {}
        : {
            background: {
              default: 'rgb(40, 40, 40)',
              paper: 'rgb(40, 40, 40)',
            },
          }),
    },
    typography: {
      // In Chinese and Japanese the characters are usually larger,
      // so a smaller fontsize may be appropriate.
      ...(language === 'ar'
        ? {
            fontFamily: 'Cairo, Arial, sans-serif',
          }
        : {}),
      fontSize: (fontSize * 14) / 16,
    },
    direction: language === 'ar' ? 'rtl' : 'ltr',
    breakpoints: {
      values: {
        xs: 0,
        sm: 640, // 修改sm的值与tailwindcss保持一致
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
  }
}
