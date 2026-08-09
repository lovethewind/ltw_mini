const { getArticleList } = require('../../utils/article')
const { normalizeArticle } = require('../../utils/format')
const { createNote } = require('../../utils/note')
const { extractScene, normalizeScene } = require('../../utils/scan')
const { getThemeState } = require('../../utils/theme')
const { isArticleContentCompatible } = require('../../utils/runtime')

Page({
  data: {
    ...getThemeState(),
    articles: [],
    articleEnabled: false,
    quickNoteCreating: false,
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
    this.loadHomeContent()
  },

  async loadHomeContent() {
    const articleEnabled = await isArticleContentCompatible()
    this.setData({ articleEnabled })
    if (articleEnabled) {
      await this.loadArticles()
      return
    }
    this.setData({ articles: [], loading: false, error: '' })
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

  /**
   * 切换到私人笔记页。
   *
   * @returns {void}
   */
  openNotes() {
    wx.switchTab({
      url: '/pages/note/index'
    })
  },

  /**
   * 从首页直接创建一篇空白笔记并进入编辑页。
   *
   * @returns {Promise<void>} 创建并打开笔记的异步任务。
   */
  async createQuickNote() {
    if (this.data.quickNoteCreating) return
    this.setData({ quickNoteCreating: true })
    try {
      const noteId = await createNote()
      wx.navigateTo({ url: `/pages/note/edit/index?id=${noteId}&created=1` })
    } catch (error) {
      if ([10007, 10010].includes(Number(error.code))) {
        wx.switchTab({
          url: '/pages/profile/index',
          fail: () => wx.reLaunch({ url: '/pages/profile/index' })
        })
        return
      }
      wx.showToast({ title: error.message || '新建笔记失败', icon: 'none' })
    } finally {
      this.setData({ quickNoteCreating: false })
    }
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
