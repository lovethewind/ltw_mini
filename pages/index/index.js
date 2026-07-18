const { getArticleList } = require('../../utils/article')
const { normalizeArticle } = require('../../utils/format')
const { extractScene, normalizeScene } = require('../../utils/scan')
const { getThemeState } = require('../../utils/theme')

Page({
  data: {
    ...getThemeState(),
    articles: [],
    loading: true,
    error: ''
  },

  onLoad(options) {
    const scene = normalizeScene(options.scene || '')
    if (scene) {
      wx.navigateTo({
        url: `/pages/scan/confirm/index?scene=${encodeURIComponent(scene)}`
      })
    }
    this.loadArticles()
  },

  /**
   * 页面显示时同步主题并更新底部导航。
   *
   * @returns {void}
   */
  onShow() {
    this.setData(getThemeState())
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 0 })
  },

  async loadArticles() {
    this.setData({ loading: true, error: '' })
    try {
      const result = await getArticleList(1, 5, { orderType: 1 })
      this.setData({
        articles: (result.records || []).map(normalizeArticle),
        loading: false
      })
    } catch (error) {
      this.setData({
        error: error.message || '文章加载失败',
        loading: false
      })
    }
  },

  openArticle(event) {
    wx.navigateTo({
      url: `/pages/article/detail/index?id=${event.detail.articleId}`
    })
  },

  openArticles() {
    wx.switchTab({
      url: '/pages/article/list/index'
    })
  },

  scanCode() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (result) => {
        const scene = extractScene(result.path || result.result)
        if (!scene) {
          wx.showToast({
            title: '未识别到验证二维码',
            icon: 'none'
          })
          return
        }
        wx.navigateTo({
          url: `/pages/scan/confirm/index?scene=${encodeURIComponent(scene)}`
        })
      }
    })
  }
})
