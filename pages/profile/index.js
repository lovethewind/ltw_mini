const { clearToken, getToken, saveToken } = require('../../utils/auth')
const { checkUsernameExists, getUserInfo, getWechatUserInfo, loginUser, loginWechatUser, registerWechatUser } = require('../../utils/user')
const { login } = require('../../utils/wechat')
const { getThemeState } = require('../../utils/theme')

Page({
  data: {
    ...getThemeState(),
    user: null,
    loggedIn: false,
    wechatBound: false,
    loading: true,
    unbound: false,
    error: '',
    registerVisible: false,
    registerSubmitting: false,
    registerUsernameChecking: false,
    registerUsernameExists: false,
    registerUsernameCheckValue: '',
    loginVisible: false,
    loginSubmitting: false,
    wechatLoginSubmitting: false,
    loginForm: {
      username: '',
      password: ''
    },
    registerForm: {
      username: '',
      password: '',
      nickname: ''
    }
  },

  onLoad() {
    this.loadProfile()
  },

  /**
   * 页面显示时同步主题并更新底部导航。
   *
   * @returns {Promise<void>|void} 注册后刷新账号的 Promise，普通显示不请求。
   */
  onShow() {
    this.setData(getThemeState())
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 3 })
    const app = getApp && getApp()
    if (app && app.globalData && app.globalData.profileRefreshRequested) {
      app.globalData.profileRefreshRequested = false
      return this.loadProfile()
    }
  },

  async loadProfile() {
    const token = getToken()
    this.setData({
      loading: true,
      unbound: false,
      error: '',
      registerVisible: false,
      loginVisible: false,
      registerSubmitting: false,
      loginSubmitting: false,
      wechatLoginSubmitting: false,
      loggedIn: Boolean(token)
    })
    try {
      const user = token
        ? await getUserInfo()
        : await getWechatUserInfo(await login())
      this.setData({
        user,
        loading: false,
        loggedIn: Boolean(token),
        wechatBound: token ? Boolean(user && user.wechat) : true
      })
    } catch (error) {
      if (token && [10007, 10010, 11002].includes(Number(error.code))) {
        clearToken()
        return this.loadProfile()
      }
      if ([11002, 11013].includes(Number(error.code))) {
        this.setData({
          user: null,
          loading: false,
          unbound: true,
          loggedIn: false,
          wechatBound: false
        })
        return
      }
      this.setData({
        loading: false,
        error: error.message || '账号信息加载失败'
      })
    }
  },

  openRegister() {
    if (!this.data.unbound) return
    this._usernameCheckSerial = (this._usernameCheckSerial || 0) + 1
    this.setData({
      registerVisible: true,
      loginVisible: false,
      registerForm: { username: '', password: '', nickname: '' },
      registerUsernameChecking: false,
      registerUsernameExists: false,
      registerUsernameCheckValue: ''
    })
  },

  closeRegister() {
    if (this.data.registerSubmitting) return
    this._usernameCheckSerial = (this._usernameCheckSerial || 0) + 1
    this.setData({ registerVisible: false })
  },

  openLogin() {
    if (this.data.loginSubmitting) return
    this.setData({
      loginVisible: true,
      registerVisible: false,
      loginForm: { username: '', password: '' }
    })
  },

  closeLogin() {
    if (this.data.loginSubmitting) return
    this.setData({ loginVisible: false })
  },

  updateLoginField(event) {
    const field = event.currentTarget.dataset.field
    if (!['username', 'password'].includes(field)) return
    this.setData({ [`loginForm.${field}`]: event.detail.value })
  },

  async submitLogin() {
    if (this.data.loginSubmitting) return
    const { username, password } = this.data.loginForm
    if (username.length < 3 || username.length > 20) {
      wx.showToast({ title: '用户名需为3-20个字符', icon: 'none' })
      return
    }
    this.setData({ loginSubmitting: true })
    try {
      const result = await loginUser(username, password)
      if (!result || !result.token) throw new Error('登录结果无效，请稍后重试')
      saveToken(result.token)
      const app = getApp && getApp()
      if (app && app.globalData) {
        app.globalData.noteRefreshRequested = true
        app.globalData.profileRefreshRequested = true
      }
      this.setData({ loginVisible: false, loginSubmitting: false, loggedIn: true })
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => wx.switchTab({
        url: '/pages/note/index',
        fail: () => wx.reLaunch({ url: '/pages/note/index' })
      }), 500)
    } catch (error) {
      this.setData({ loginSubmitting: false })
      wx.showToast({ title: error.message || '登录失败，请检查账号密码', icon: 'none' })
    }
  },

  async wechatLogin() {
    if (this.data.wechatLoginSubmitting || this.data.loggedIn || !this.data.wechatBound) return
    this.setData({ wechatLoginSubmitting: true })
    try {
      const result = await loginWechatUser(await login())
      if (!result || !result.token) throw new Error('微信登录结果无效，请稍后重试')
      saveToken(result.token)
      const app = getApp && getApp()
      if (app && app.globalData) {
        app.globalData.noteRefreshRequested = true
        app.globalData.profileRefreshRequested = true
      }
      this.setData({ wechatLoginSubmitting: false, loggedIn: true })
      wx.showToast({ title: '微信登录成功', icon: 'success' })
      setTimeout(() => wx.switchTab({
        url: '/pages/note/index',
        fail: () => wx.reLaunch({ url: '/pages/note/index' })
      }), 500)
    } catch (error) {
      this.setData({ wechatLoginSubmitting: false })
      wx.showToast({ title: error.message || '微信登录失败，请稍后重试', icon: 'none' })
    }
  },

  logout() {
    if (!this.data.loggedIn) return
    clearToken()
    const app = getApp && getApp()
    if (app && app.globalData) app.globalData.noteRefreshRequested = true
    wx.showToast({ title: '已退出登录', icon: 'success' })
    this.loadProfile()
  },

  updateRegisterField(event) {
    const field = event.currentTarget.dataset.field
    if (!['username', 'password', 'nickname'].includes(field)) return
    const data = { [`registerForm.${field}`]: event.detail.value }
    if (field === 'username') {
      this._usernameCheckSerial = (this._usernameCheckSerial || 0) + 1
      data.registerUsernameChecking = false
      data.registerUsernameExists = false
      data.registerUsernameCheckValue = ''
    }
    this.setData(data)
  },

  async checkRegisterUsername() {
    const username = this.data.registerForm.username
    const serial = (this._usernameCheckSerial || 0) + 1
    this._usernameCheckSerial = serial
    if (username.length < 3 || username.length > 20) {
      this.setData({
        registerUsernameChecking: false,
        registerUsernameExists: false,
        registerUsernameCheckValue: ''
      })
      return false
    }
    this.setData({
      registerUsernameChecking: true,
      registerUsernameExists: false,
      registerUsernameCheckValue: username
    })
    try {
      const exists = Boolean(await checkUsernameExists(username))
      if (serial !== this._usernameCheckSerial || this.data.registerForm.username !== username) return false
      this.setData({
        registerUsernameChecking: false,
        registerUsernameExists: exists,
        registerUsernameCheckValue: username
      })
      if (exists) wx.showToast({ title: '该用户名已存在，请更换', icon: 'none' })
      return exists
    } catch (error) {
      if (serial === this._usernameCheckSerial) this.setData({ registerUsernameChecking: false })
      return false
    }
  },

  async submitRegister() {
    if (this.data.registerSubmitting) return
    const { username, password, nickname } = this.data.registerForm
    if (username.length < 3 || username.length > 20) {
      wx.showToast({ title: '用户名需为3-20个字符', icon: 'none' })
      return
    }
    if (password.length < 6 || password.length > 30) {
      wx.showToast({ title: '密码需为6-30个字符', icon: 'none' })
      return
    }
    if (this.data.registerUsernameChecking) {
      wx.showToast({ title: '正在检查用户名，请稍候', icon: 'none' })
      return
    }
    if (this.data.registerUsernameExists && this.data.registerUsernameCheckValue === username) {
      wx.showToast({ title: '该用户名已存在，请更换', icon: 'none' })
      return
    }
    if (this.data.registerUsernameCheckValue !== username && await this.checkRegisterUsername()) return
    if (nickname.length > 20) {
      wx.showToast({ title: '昵称不能超过20个字符', icon: 'none' })
      return
    }
    this.setData({ registerSubmitting: true })
    try {
      const code = await login()
      const result = await registerWechatUser(username, password, nickname, code)
      if (!result || !result.token) throw new Error('注册结果无效，请稍后重试')
      saveToken(result.token)
      const app = getApp && getApp()
      if (app && app.globalData) {
        app.globalData.noteRefreshRequested = true
        app.globalData.profileRefreshRequested = true
      }
      this.setData({ registerVisible: false, registerSubmitting: false })
      wx.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => wx.switchTab({
        url: '/pages/note/index',
        fail: () => wx.reLaunch({ url: '/pages/note/index' })
      }), 500)
    } catch (error) {
      this.setData({ registerSubmitting: false })
      wx.showToast({ title: error.message || '注册失败，请稍后重试', icon: 'none' })
    }
  }
})
