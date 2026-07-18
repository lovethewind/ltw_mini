const { subscribeTheme } = require('../utils/theme')

Component({
  data: {
    theme: 'light',
    selected: 0,
    tabs: [
      {
        text: '首页',
        symbol: '⌂',
        path: '/pages/index/index'
      },
      {
        text: '文章',
        symbol: '▤',
        path: '/pages/article/list/index'
      },
      {
        text: '我',
        symbol: '♙',
        path: '/pages/profile/index'
      }
    ]
  },

  lifetimes: {
    /**
     * 订阅全局主题状态。
     *
     * @returns {void}
     */
    attached() {
      this._unsubscribeTheme = subscribeTheme((state) => {
        this.setData({ theme: state.theme })
      })
    },

    /**
     * 取消全局主题订阅。
     *
     * @returns {void}
     */
    detached() {
      if (this._unsubscribeTheme) this._unsubscribeTheme()
    }
  },

  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const tab = this.data.tabs[index]
      if (!tab || index === this.data.selected) return
      wx.switchTab({
        url: tab.path
      })
    }
  }
})
