const { cancelWechatScan, confirmWechatScan, getWechatUserInfo, notifyWechatScan } = require('../../../utils/user')
const { login } = require('../../../utils/wechat')
const { canConfirmUnbound, getScanCopy, normalizeScene } = require('../../../utils/scan')
const { getThemeState } = require('../../../utils/theme')

Page({
  data: {
    ...getThemeState(),
    scene: '',
    stateCode: '',
    scanCopy: {},
    user: null,
    bound: false,
    canConfirm: false,
    status: 'loading',
    error: ''
  },

  onLoad(options) {
    const scene = normalizeScene(options.scene || '')
    this.setData({ scene })
    this.initialize()
  },

  /**
   * 页面显示时同步当前主题。
   *
   * @returns {void}
   */
  onShow() {
    this.setData(getThemeState())
  },

  /**
   * 识别扫码用途和微信身份，并通知网站等待用户确认。
   *
   * @returns {Promise<void>} 初始化完成。
   */
  async initialize() {
    const scanCopy = getScanCopy(this.data.scene)
    if (!scanCopy.type) {
      this.setData({
        scanCopy,
        status: 'error',
        error: '二维码内容无法识别，请返回网页重新获取。'
      })
      return
    }

    this.setData({
      scanCopy,
      status: 'loading',
      error: ''
    })
    try {
      const stateCode = await login()
      this.setData({ stateCode })
      let user = null
      try {
        user = await getWechatUserInfo(stateCode)
      } catch (error) {
        if (Number(error.code) !== 11002) throw error
      }
      await notifyWechatScan(this.data.scene, stateCode)
      const bound = Boolean(user)
      this.setData({
        user,
        bound,
        canConfirm: bound || canConfirmUnbound(scanCopy.type),
        status: 'ready'
      })
    } catch (error) {
      this.setData({
        status: 'error',
        error: error.message || '微信身份识别失败，请稍后重试'
      })
    }
  },

  async confirm() {
    if (!this.data.canConfirm || this.data.status !== 'ready') return
    this.setData({ status: 'submitting', error: '' })
    try {
      await confirmWechatScan(this.data.scene, this.data.stateCode)
      this.setData({ status: 'success' })
      wx.vibrateShort({ type: 'light' })
    } catch (error) {
      const expired = Number(error.code) === 11015
      this.setData({
        status: 'error',
        error: expired ? '二维码已过期，请返回网页刷新后重新扫码。' : (error.message || '确认失败，请稍后重试')
      })
    }
  },

  /**
   * 取消当前尚未确认的扫码操作。
   *
   * @returns {Promise<void>} 取消完成。
   */
  async cancel() {
    if (this.data.status !== 'ready') return
    this.setData({ status: 'cancelling', error: '' })
    try {
      await cancelWechatScan(this.data.scene, this.data.stateCode)
      this.setData({ status: 'cancelled' })
    } catch (error) {
      const expired = Number(error.code) === 11015
      this.setData({
        status: 'error',
        error: expired ? '二维码已过期，请返回网页刷新后重新扫码。' : (error.message || '取消失败，请稍后重试')
      })
    }
  },

  retry() {
    this.initialize()
  },

  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
