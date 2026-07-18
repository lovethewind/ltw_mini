const { addArticleViewCount, getArticleDetail, getCategories, getTags } = require('../../../utils/article')
const { formatDate, normalizeArticle, normalizeArticleContent, normalizeMediaUrl, stripHtml } = require('../../../utils/format')
const { getThemeState, subscribeTheme } = require('../../../utils/theme')

/**
 * 引导用户前往系统设置开启微信剪贴板权限。
 *
 * @returns {void}
 */
function showClipboardPermissionGuide() {
  wx.showModal({
    title: '需要剪贴板权限',
    content: '系统未允许微信使用剪贴板，请在系统设置中开启相关权限后重试。',
    confirmText: '去设置',
    cancelText: '稍后再说',
    success(result) {
      if (!result.confirm) return
      if (typeof wx.openAppAuthorizeSetting !== 'function') {
        wx.showModal({
          title: '请手动开启',
          content: '请前往手机设置，在微信的权限管理中开启剪贴板权限。',
          showCancel: false
        })
        return
      }
      wx.openAppAuthorizeSetting({
        fail(error) {
          console.error('打开微信授权设置失败', error)
          wx.showModal({
            title: '请手动开启',
            content: '请前往手机设置，在微信的权限管理中开启剪贴板权限。',
            showCancel: false
          })
        }
      })
    }
  })
}

/**
 * 处理文章正文中的复制代码操作。
 *
 * @param {WechatMiniprogram.TouchEvent} event Towxml 点击事件。
 * @returns {void}
 */
function handleArticleContentTap(event) {
  const node = event.currentTarget && event.currentTarget.dataset
    ? event.currentTarget.dataset.data
    : null
  const imageUrl = node && node.attr ? String(node.attr.src || '') : ''
  if (imageUrl && (node.tag === 'image' || node.tag === 'img')) {
    wx.previewImage({
      current: imageUrl,
      urls: [imageUrl]
    })
    return
  }
  const className = node && node.attr ? String(node.attr.class || '') : ''
  if (!className.includes('h2w__copyButton')) return
  const code = String(node.attr.data || '')
  if (!code) {
    wx.showToast({ title: '没有可复制的内容', icon: 'none' })
    return
  }
  wx.setClipboardData({
    data: code,
    fail(error) {
      console.error('复制代码失败', error)
      const errorMessage = String(error && error.errMsg ? error.errMsg : '')
      if (/system permission denied/i.test(errorMessage)) {
        showClipboardPermissionGuide()
        return
      }
      wx.showModal({
        title: '复制失败',
        content: errorMessage || '剪贴板调用失败，请重试',
        showCancel: false
      })
    }
  })
}

/**
 * 为文章补充分类名与标签名。
 *
 * @param {Record<string, any>} article 文章详情。
 * @param {Array<Record<string, any>>} categories 分类列表。
 * @param {{records?: Array<Record<string, any>>}} tagData 标签元数据。
 * @returns {Record<string, any>} 补充展示字段后的文章详情。
 */
function enrichArticleMetadata(article, categories, tagData) {
  const category = (categories || []).find((item) => String(item.id) === String(article.categoryId))
  const tagMap = {}
  const tagRecords = tagData.records || []
  tagRecords.forEach((item) => {
    tagMap[String(item.id)] = item
  })
  const displayTags = (article.tagList || []).map((item) => {
    if (item && typeof item === 'object') return item.name || ''
    const tag = tagMap[String(item)]
    return tag ? tag.name : ''
  }).filter(Boolean)

  return {
    ...article,
    displayCategory: article.categoryName || (category ? category.name : ''),
    displayTags
  }
}

/**
 * 根据正文计算字数和预计阅读时长。
 *
 * @param {string} content 文章正文。
 * @returns {{wordCount: number, readMinutes: number}} 阅读统计。
 */
function calculateReadingStats(content) {
  const wordCount = stripHtml(content).replace(/\s/g, '').length
  return {
    wordCount,
    readMinutes: Math.max(1, Math.ceil(wordCount / 400))
  }
}

/**
 * 将文章内容解析为 Towxml 节点。
 *
 * @param {string} content 文章正文。
 * @param {boolean} isMarkdown 是否为 Markdown 内容。
 * @param {string} theme 当前主题。
 * @returns {Record<string, any>} Towxml 渲染节点。
 */
function renderArticleContent(content, isMarkdown, theme) {
  return getApp().towxml(content, isMarkdown ? 'markdown' : 'html', {
    theme: theme === 'dark' ? 'dark' : 'light',
    copyCode: true,
    highlightCode: true,
    events: {
      tap: handleArticleContentTap
    }
  })
}

Page({
  data: {
    ...getThemeState(),
    articleId: '',
    article: null,
    sourceContent: '',
    contentIsMarkdown: false,
    contentNodes: {},
    hasContent: false,
    recommendedArticles: [],
    readingProgress: 0,
    showBackTop: false,
    loading: true,
    error: ''
  },

  /**
   * 初始化文章详情页和分享能力。
   *
   * @param {Record<string, string>} options 页面路由参数。
   * @returns {void}
   */
  onLoad(options) {
    const windowInfo = typeof wx.getWindowInfo === 'function'
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync()
    this._viewportHeight = windowInfo.windowHeight || 0
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    }
    if (!options.id) {
      this.setData({
        loading: false,
        error: '文章参数无效'
      })
      return
    }
    this.setData({ articleId: options.id })
    this.loadArticle()
  },

  /**
   * 页面就绪后订阅主题变化。
   *
   * @returns {void}
   */
  onReady() {
    this._unsubscribeTheme = subscribeTheme((state) => this.syncArticleTheme(state))
  },

  /**
   * 页面卸载时取消主题订阅。
   *
   * @returns {void}
   */
  onUnload() {
    if (this._unsubscribeTheme) this._unsubscribeTheme()
  },

  /**
   * 页面显示时同步当前主题。
   *
   * @returns {void}
   */
  onShow() {
    this.syncArticleTheme(getThemeState())
  },

  /**
   * 同步页面主题并重新渲染正文颜色。
   *
   * @param {{themeMode: string, theme: string}} themeState 当前主题状态。
   * @returns {void}
   */
  syncArticleTheme(themeState) {
    const nextData = { ...themeState }
    if (this.data.sourceContent) {
      nextData.contentNodes = renderArticleContent(
        this.data.sourceContent,
        this.data.contentIsMarkdown,
        themeState.theme
      )
    }
    this.setData(nextData, () => this.measurePageHeight())
  },

  /**
   * 测量文章页面内容高度，用于计算阅读进度。
   *
   * @returns {void}
   */
  measurePageHeight() {
    wx.createSelectorQuery()
      .select('.page-shell')
      .boundingClientRect((rect) => {
        this._pageContentHeight = rect ? Number(rect.height || 0) : 0
      })
      .exec()
  },

  /**
   * 加载并渲染文章详情。
   *
   * @returns {Promise<void>}
   */
  async loadArticle() {
    this.setData({ loading: true, error: '' })
    try {
      const [articleData, categories, tagData] = await Promise.all([
        getArticleDetail(this.data.articleId),
        getCategories().catch(() => []),
        getTags().catch(() => ({ records: [] }))
      ])
      const article = enrichArticleMetadata(articleData, categories, tagData)
      const content = normalizeArticleContent(article.content)
      const readingStats = calculateReadingStats(content)
      const normalized = {
        ...article,
        ...readingStats,
        displayTime: formatDate(article.createTime),
        displayEditTime: formatDate(article.editTime || article.createTime),
        displayCover: normalizeMediaUrl(article.cover || article.coverThumb || ''),
        displayOrigin: article.isOriginal === undefined || article.isOriginal === null
          ? ''
          : (article.isOriginal ? '原创' : '转载')
      }
      const contentIsMarkdown = Boolean(article.isMarkdown)
      const recommendedArticles = (article.newestArticleList || [])
        .filter((item) => String(item.id) !== String(article.id))
        .slice(0, 3)
        .map(normalizeArticle)
      const hasContent = Boolean(
        content
          .replace(/<br\s*\/?>/gi, '')
          .replace(/<p[^>]*>\s*<\/p>/gi, '')
          .trim()
      )
      this.setData({
        article: normalized,
        sourceContent: content,
        contentIsMarkdown,
        contentNodes: hasContent ? renderArticleContent(content, contentIsMarkdown, this.data.theme) : {},
        hasContent,
        recommendedArticles,
        loading: false
      }, () => this.measurePageHeight())
      addArticleViewCount(article.id).catch(() => {})
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '文章加载失败'
      })
    }
  },

  openNeighbor(event) {
    const articleId = event.currentTarget.dataset.id
    if (!articleId) return
    wx.redirectTo({
      url: `/pages/article/detail/index?id=${articleId}`
    })
  },

  /**
   * 打开推荐文章并替换当前详情页。
   *
   * @param {WechatMiniprogram.CustomEvent<{articleId: string}>} event 文章卡片选择事件。
   * @returns {void}
   */
  openRecommended(event) {
    const articleId = event.detail.articleId
    if (!articleId) return
    wx.redirectTo({
      url: `/pages/article/detail/index?id=${articleId}`
    })
  },

  /**
   * 根据正文滚动位置更新阅读进度和回顶按钮状态。
   *
   * @param {WechatMiniprogram.Page.IPageScrollOption} event 页面滚动事件。
   * @returns {void}
   */
  onPageScroll(event) {
    const scrollTop = Number(event.scrollTop || 0)
    const maxScrollTop = Math.max(0, Number(this._pageContentHeight || 0) - this._viewportHeight)
    const readingProgress = maxScrollTop > 0
      ? Math.min(100, Math.max(0, Math.round(scrollTop / maxScrollTop * 100)))
      : 0
    const showBackTop = scrollTop > 600
    const nextData = {}

    this._currentScrollTop = scrollTop
    if (readingProgress !== this.data.readingProgress) nextData.readingProgress = readingProgress
    if (showBackTop !== this.data.showBackTop) {
      nextData.showBackTop = showBackTop
    }
    if (Object.keys(nextData).length) this.setData(nextData)
  },

  /**
   * 平滑滚动回文章顶部。
   *
   * @returns {void}
   */
  backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 280
    })
  },

  /**
   * 配置文章分享给好友的标题、路径与封面。
   *
   * @returns {{title: string, path: string, imageUrl: string}} 分享配置。
   */
  onShareAppMessage() {
    const article = this.data.article
    return {
      title: article ? article.title : '心悦心享',
      path: `/pages/article/detail/index?id=${this.data.articleId}`,
      imageUrl: article ? article.displayCover : ''
    }
  },

  /**
   * 配置文章分享到朋友圈的标题与封面。
   *
   * @returns {{title: string, query: string, imageUrl: string}} 分享配置。
   */
  onShareTimeline() {
    const article = this.data.article
    return {
      title: article ? article.title : '心悦心享',
      query: `id=${this.data.articleId}`,
      imageUrl: article ? article.displayCover : ''
    }
  }
})
