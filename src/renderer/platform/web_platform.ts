import localforage from 'localforage'
import * as defaults from 'src/shared/defaults'
import type { Config, Settings, ShortcutSetting } from 'src/shared/types'
import { v4 as uuidv4 } from 'uuid'
import { parseLocale } from '@/i18n/parser'
import { sliceTextByTokenLimit } from '@/packages/token'
import { getBrowser, getOS } from '../packages/navigator'
import type { Platform, PlatformType } from './interfaces'
import type { KnowledgeBaseController } from './knowledge-base/interface'
// import SimpleMobileKnowledgeBaseController from './knowledge-base/simple-mobile-controller'
import MobileKnowledgeBaseController from './knowledge-base/mobile-controller'
import WebExporter from './web_exporter'
import MobileExporter from './mobile_exporter'
import { parseTextFileLocally } from './web_platform_utils'
import { CHATBOX_BUILD_TARGET } from '../variables'

const store = localforage.createInstance({ name: 'chatboxstore' })

export default class WebPlatform implements Platform {
  public type: PlatformType = CHATBOX_BUILD_TARGET === 'mobile_app' ? 'mobile' : 'web'

  public exporter = CHATBOX_BUILD_TARGET === 'mobile_app' ? new MobileExporter() : new WebExporter()
  private _kbController?: KnowledgeBaseController

  constructor() {}

  public async getVersion(): Promise<string> {
    return 'web'
  }
  public async getPlatform(): Promise<string> {
    return 'web'
  }
  public async getArch(): Promise<string> {
    return 'web'
  }
  public async shouldUseDarkColors(): Promise<boolean> {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  public onSystemThemeChange(callback: () => void): () => void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', callback)
    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', callback)
    }
  }
  public onWindowShow(callback: () => void): () => void {
    return () => null
  }
  public onUpdateDownloaded(callback: () => void): () => void {
    return () => null
  }
  public async openLink(url: string): Promise<void> {
    window.open(url)
  }
  public async getInstanceName(): Promise<string> {
    return `${getOS()} / ${getBrowser()}`
  }
  public async getLocale() {
    const lang = window.navigator.language
    return parseLocale(lang)
  }
  public async ensureShortcutConfig(config: ShortcutSetting): Promise<void> {
    return
  }
  public async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
    return
  }
  public async relaunch(): Promise<void> {
    location.reload()
  }

  public async getConfig(): Promise<Config> {
    let value: Config = await this.getStoreValue('configs')
    if (value === undefined || value === null) {
      value = defaults.newConfigs()
      await this.setStoreValue('configs', value)
    }
    return value
  }
  public async getSettings(): Promise<Settings> {
    let value: Settings = await this.getStoreValue('settings')
    if (value === undefined || value === null) {
      value = defaults.settings()
      await this.setStoreValue('settings', value)
    }
    return value
  }

  public async setStoreValue(key: string, value: any) {
    // 为什么序列化成 JSON？
    // 因为 IndexedDB 作为底层驱动时，可以直接存储对象，但是如果对象中包含函数或引用，将会直接报错
    await store.setItem(key, JSON.stringify(value))
  }
  public async getStoreValue(key: string) {
    const json = await store.getItem<string>(key)
    return json ? JSON.parse(json) : null
  }
  public async delStoreValue(key: string) {
    return await store.removeItem(key)
  }
  public async getAllStoreValues(): Promise<{ [key: string]: any }> {
    const ret: { [key: string]: any } = {}
    await store.iterate((json, key) => {
      const value = typeof json === 'string' ? JSON.parse(json) : null
      ret[key] = value
    })
    return ret
  }
  public async setAllStoreValues(data: { [key: string]: any }): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await store.setItem(key, JSON.stringify(value))
    }
  }

  public async getStoreBlob(key: string): Promise<string | null> {
    return localforage.getItem<string>(key)
  }
  public async setStoreBlob(key: string, value: string): Promise<void> {
    await localforage.setItem(key, value)
  }
  public async delStoreBlob(key: string) {
    return localforage.removeItem(key)
  }
  public async listStoreBlobKeys(): Promise<string[]> {
    return localforage.keys()
  }

  public async initTracking() {
    const GAID = 'G-B365F44W6E'
    try {
      const conf = await this.getConfig()
      window.gtag('config', GAID, {
        app_name: 'chatbox',
        user_id: conf.uuid,
        client_id: conf.uuid,
        app_version: await this.getVersion(),
        chatbox_platform_type: 'web',
        chatbox_platform: await this.getPlatform(),
        app_platform: await this.getPlatform(),
      })
    } catch (e) {
      window.gtag('config', GAID, {
        app_name: 'chatbox',
      })
      throw e
    }
  }
  public trackingEvent(name: string, params: { [key: string]: string }) {
    window.gtag('event', name, params)
  }

  public async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
    return false
  }

  public async appLog(level: string, message: string): Promise<void> {
    console.log(`APP_LOG: [${level}] ${message}`)
  }

  public async ensureAutoLaunch(enable: boolean) {
    return
  }

  async parseFileLocally(
    file: File,
    options?: { tokenLimit?: number }
  ): Promise<{ key?: string; isSupported: boolean }> {
    const result = await parseTextFileLocally(file)
    if (!result.isSupported) {
      return { isSupported: false }
    }
    if (options?.tokenLimit) {
      result.text = sliceTextByTokenLimit(result.text, options.tokenLimit)
    }
    const key = `parseFile-` + uuidv4()
    await this.setStoreBlob(key, result.text)
    return { key, isSupported: true }
  }

  public async parseUrl(url: string): Promise<{ key: string; title: string }> {
    throw new Error('Not implemented')
  }

  public async isFullscreen() {
    return true
  }

  public async setFullscreen(enabled: boolean): Promise<void> {
    return
  }

  installUpdate(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async sendProactiveNotification(title: string, body: string, sessionId?: string): Promise<void> {
    if (this.type === 'mobile') {
      // 使用Capacitor的LocalNotifications
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        
        // 请求通知权限
        const permission = await LocalNotifications.requestPermissions()
        if (permission.display !== 'granted') {
          console.warn('[ProactiveNotification] Notification permission not granted')
          return
        }

        // 发送本地通知
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Date.now(),
              schedule: { at: new Date() },
              sound: 'default',
              attachments: [],
              actionTypeId: '',
              extra: sessionId ? { sessionId } : {}
            }
          ]
        })
      } catch (error) {
        console.error('[ProactiveNotification] Error sending mobile notification:', error)
        // 在移动端，如果通知失败不应该阻止应用运行
        return
      }
    } else {
      // Web端使用浏览器的Notification API
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico'
          })
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          // 请求权限
          const permission = await Notification.requestPermission()
          if (permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/favicon.ico'
            })
          }
        }
      } catch (error) {
        console.error('[ProactiveNotification] Error sending web notification:', error)
      }
    }
  }

  public getKnowledgeBaseController(): KnowledgeBaseController {
    if (CHATBOX_BUILD_TARGET === 'mobile_app') {
      if (!this._kbController) {
        // 使用优化后的 MobileKnowledgeBaseController，已解决循环依赖问题
        this._kbController = new MobileKnowledgeBaseController();
        console.log('[Platform] 📦 Initialized with MobileKnowledgeBaseController (SQLite + AI enhanced)')
      }
      return this._kbController
    } else {
      throw new Error('Knowledge base not supported on web platform')
    }
  }

}
