const { getThemeState, initializeTheme } = require('./utils/theme')

const DEVTOOLS_API_BASE_URL = 'http://127.0.0.1:8001/api'
const DEVICE_API_BASE_URL = 'http://192.168.50.133:8001/api'
const ONLINE_API_BASE_URL = 'https://lovethewind.cn/api'

const accountInfo = wx.getAccountInfoSync()
const envVersion = accountInfo.miniProgram.envVersion || 'release'
const platform = wx.getSystemInfoSync().platform
const localApiBaseUrl = platform === 'devtools' ? DEVTOOLS_API_BASE_URL : DEVICE_API_BASE_URL
const themeState = getThemeState()

initializeTheme()

App({
  towxml: require('./towxml/index'),
  globalData: {
    apiBaseUrl: envVersion === 'develop' ? localApiBaseUrl : ONLINE_API_BASE_URL,
    noteRefreshRequested: false,
    profileRefreshRequested: false,
    ...themeState
  }
})
