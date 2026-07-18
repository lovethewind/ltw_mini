const { cycleThemeMode, subscribeTheme } = require('../../utils/theme')

Component({
  properties: {
    title: {
      type: String,
      value: '心悦心享'
    },
    showBack: {
      type: Boolean,
      value: false
    },
    showLogo: {
      type: Boolean,
      value: false
    },
    showTheme: {
      type: Boolean,
      value: false
    },
    action: {
      type: String,
      value: ''
    }
  },

  data: {
    headerTop: 26,
    headerHeight: 32,
    headerPlaceholderHeight: 66,
    capsuleRight: 12,
    themeIcon: '/images/theme/system.svg',
    themeLabel: '跟随系统'
  },

  lifetimes: {
    /**
     * 初始化导航尺寸并订阅主题状态。
     *
     * @returns {void}
     */
    attached() {
      const windowInfo = wx.getWindowInfo()
      const capsule = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = windowInfo.statusBarHeight || 20
      const headerHeight = capsule.height || 32
      const headerTop = capsule.top || statusBarHeight + 6
      const capsuleBottom = capsule.bottom || headerTop + headerHeight
      const capsuleRight = capsule.left > 0 ? Math.max(windowInfo.windowWidth - capsule.left + 8, 12) : 12
      this.setData({
        headerTop,
        headerHeight,
        headerPlaceholderHeight: capsuleBottom + 8,
        capsuleRight
      })
      this._unsubscribeTheme = subscribeTheme((state) => {
        const themeCopy = {
          system: { themeIcon: '/images/theme/system.svg', themeLabel: '跟随系统' },
          light: { themeIcon: '/images/theme/sun.svg', themeLabel: '日间模式' },
          dark: { themeIcon: '/images/theme/moon.svg', themeLabel: '夜间模式' }
        }
        this.setData(themeCopy[state.themeMode])
      })
    },

    /**
     * 取消主题状态订阅。
     *
     * @returns {void}
     */
    detached() {
      if (this._unsubscribeTheme) this._unsubscribeTheme()
    }
  },

  methods: {
    handleBack() {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
        return
      }
      wx.switchTab({
        url: '/pages/index/index'
      })
    },

    handleAction() {
      this.triggerEvent('action')
    },

    /**
     * 切换主题模式并提示当前选择。
     *
     * @returns {void}
     */
    handleTheme() {
      const state = cycleThemeMode()
      const titleMap = {
        system: '已跟随系统',
        light: '已切换日间模式',
        dark: '已切换夜间模式'
      }
      wx.showToast({ title: titleMap[state.themeMode], icon: 'none' })
    }
  }
})
