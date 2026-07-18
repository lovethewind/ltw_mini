const { getArticleList, getCategories } = require('../../../utils/article')
const { normalizeArticle } = require('../../../utils/format')
const { getThemeState } = require('../../../utils/theme')

Page({
  data: {
    ...getThemeState(),
    articles: [],
    categories: [],
    selectedCategoryId: '',
    keyword: '',
    page: 1,
    pageSize: 10,
    loading: true,
    loadingMore: false,
    refreshing: false,
    hasMore: true,
    error: ''
  },

  onLoad() {
    this.loadCategories()
    this.loadArticles(true)
  },

  /**
   * 页面显示时同步主题并更新底部导航。
   *
   * @returns {void}
   */
  onShow() {
    this.setData(getThemeState())
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 1 })
  },

  onPullDownRefresh() {
    this.loadArticles(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.loadingMore && this.data.hasMore) {
      this.loadArticles(false)
    }
  },

  /**
   * 刷新文章列表。
   *
   * @returns {Promise<void>} 刷新完成后结束下拉状态。
   */
  async handleRefresh() {
    this.setData({ refreshing: true })
    try {
      await this.loadArticles(true)
    } finally {
      this.setData({ refreshing: false })
    }
  },

  async loadCategories() {
    try {
      const categories = await getCategories()
      this.setData({ categories: categories || [] })
    } catch (error) {
      this.setData({ categories: [] })
    }
  },

  async loadArticles(reset = false) {
    const page = reset ? 1 : this.data.page
    this.setData(reset ? { loading: true, error: '' } : { loadingMore: true })
    try {
      const params = { orderType: 1 }
      if (this.data.keyword) params.keyword = this.data.keyword
      if (this.data.selectedCategoryId) params.categoryId = this.data.selectedCategoryId
      const result = await getArticleList(page, this.data.pageSize, params)
      const incoming = (result.records || []).map(normalizeArticle)
      this.setData({
        articles: reset ? incoming : this.data.articles.concat(incoming),
        page: page + 1,
        hasMore: incoming.length >= this.data.pageSize,
        loading: false,
        loadingMore: false,
        error: ''
      })
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false,
        error: error.message || '文章加载失败'
      })
    }
  },

  handleKeywordInput(event) {
    this.setData({ keyword: event.detail.value })
  },

  handleSearch() {
    this.loadArticles(true)
  },

  selectCategory(event) {
    const categoryId = event.currentTarget.dataset.id || ''
    if (String(categoryId) === String(this.data.selectedCategoryId)) return
    this.setData({ selectedCategoryId: categoryId })
    this.loadArticles(true)
  },

  openArticle(event) {
    wx.navigateTo({
      url: `/pages/article/detail/index?id=${event.detail.articleId}`
    })
  }
})
