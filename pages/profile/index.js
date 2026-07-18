const { getWechatUserInfo } = require('../../utils/user')
const { login } = require('../../utils/wechat')
const { getThemeState } = require('../../utils/theme')

Page({
  data: {
    ...getThemeState(),
    user: null,
    loading: true,
    unbound: false,
    error: ''
  },

  onLoad() {
    this.loadProfile()
  },

  /**
   * 页面显示时同步主题并更新底部导航。
   *
   * @returns {void}
   */
  onShow() {
    this.setData(getThemeState())
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 2 })
  },

  async loadProfile() {
    this.setData({ loading: true, unbound: false, error: '' })
    try {
      const code = await login()
      const user = await getWechatUserInfo(code)
      this.setData({
        user,
        loading: false
      })
    } catch (error) {
      if (Number(error.code) === 11002) {
        this.setData({
          loading: false,
          unbound: true
        })
        return
      }
      this.setData({
        loading: false,
        error: error.message || '账号信息加载失败'
      })
    }
  }
})
