const THEME_MODE_KEY = 'themeMode'
const THEME_MODES = ['system', 'light', 'dark']
const subscribers = []

let initialized = false
let themeMode = normalizeThemeMode(wx.getStorageSync(THEME_MODE_KEY))
let systemTheme = normalizeTheme(wx.getSystemInfoSync().theme)

/**
 * 规范化主题模式。
 *
 * @param {string} mode 待校验的主题模式。
 * @returns {'system'|'light'|'dark'} 可用的主题模式。
 */
function normalizeThemeMode(mode) {
  return THEME_MODES.includes(mode) ? mode : 'system'
}

/**
 * 规范化实际主题。
 *
 * @param {string} theme 系统返回的主题。
 * @returns {'light'|'dark'} 可用的实际主题。
 */
function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light'
}

/**
 * 获取当前主题状态。
 *
 * @returns {{themeMode: 'system'|'light'|'dark', theme: 'light'|'dark'}} 当前模式与实际主题。
 */
function getThemeState() {
  return {
    themeMode,
    theme: themeMode === 'system' ? systemTheme : themeMode
  }
}

/**
 * 向页面和订阅组件同步主题。
 *
 * @returns {void}
 */
function notifyThemeChange() {
  const state = getThemeState()
  getCurrentPages().forEach((page) => {
    if (page.data && Object.prototype.hasOwnProperty.call(page.data, 'theme')) {
      page.setData(state)
    }
  })
  subscribers.slice().forEach((subscriber) => subscriber(state))
}

/**
 * 处理系统主题变化。
 *
 * @param {{theme: string}} event 系统主题变化事件。
 * @returns {void}
 */
function handleSystemThemeChange(event) {
  systemTheme = normalizeTheme(event.theme)
  if (themeMode === 'system') notifyThemeChange()
}

/**
 * 初始化系统主题监听。
 *
 * @returns {void}
 */
function initializeTheme() {
  if (initialized) return
  initialized = true
  wx.onThemeChange(handleSystemThemeChange)
}

/**
 * 按自动、日间、夜间的顺序切换主题模式。
 *
 * @returns {{themeMode: 'system'|'light'|'dark', theme: 'light'|'dark'}} 切换后的主题状态。
 */
function cycleThemeMode() {
  const currentIndex = THEME_MODES.indexOf(themeMode)
  themeMode = THEME_MODES[(currentIndex + 1) % THEME_MODES.length]
  wx.setStorageSync(THEME_MODE_KEY, themeMode)
  notifyThemeChange()
  return getThemeState()
}

/**
 * 订阅主题变化。
 *
 * @param {(state: {themeMode: 'system'|'light'|'dark', theme: 'light'|'dark'}) => void} subscriber 主题变化回调。
 * @returns {() => void} 取消订阅函数。
 */
function subscribeTheme(subscriber) {
  if (!subscribers.includes(subscriber)) subscribers.push(subscriber)
  subscriber(getThemeState())
  return () => {
    const index = subscribers.indexOf(subscriber)
    if (index >= 0) subscribers.splice(index, 1)
  }
}

module.exports = {
  cycleThemeMode,
  getThemeState,
  initializeTheme,
  subscribeTheme
}
