Component({
  properties: {
    visible: { type: Boolean, value: false },
    mode: { type: String, value: "action" },
    title: { type: String, value: "" },
    description: { type: String, value: "" },
    value: { type: String, value: "" },
    placeholder: { type: String, value: "请输入内容" },
    confirmText: { type: String, value: "确定" },
    danger: { type: Boolean, value: false },
    itemsJson: { type: String, value: "[]" }
  },

  data: {
    inputValue: "",
    renderItems: []
  },

  observers: {
    /**
     * 弹层打开时同步输入框初始值。
     *
     * @param {boolean} visible 是否显示弹层。
     * @param {string} value 输入框初始值。
     * @returns {void}
     */
    "visible,value": function observeDialog(visible, value) {
      if (visible) this.setData({ inputValue: value || "" })
    },

    /**
     * 将页面传入的菜单 JSON 转换为渲染数组。
     *
     * @param {string} itemsJson 菜单项 JSON。
     * @returns {void}
     */
    itemsJson: function observeItems(itemsJson) {
      try {
        this.setData({ renderItems: JSON.parse(itemsJson || "[]") })
      } catch (error) {
        this.setData({ renderItems: [] })
      }
    }
  },

  methods: {
    /**
     * 阻止点击弹层主体时关闭弹层。
     *
     * @returns {void}
     */
    stopPropagation() {},

    /**
     * 通知页面关闭当前弹层。
     *
     * @returns {void}
     */
    close() {
      this.triggerEvent("close")
    },

    /**
     * 同步输入框内容。
     *
     * @param {WechatMiniprogram.InputEvent} event 输入事件。
     * @returns {void}
     */
    updateInput(event) {
      this.setData({ inputValue: event.detail.value })
    },

    /**
     * 提交输入或确认操作。
     *
     * @returns {void}
     */
    confirm() {
      this.triggerEvent("confirm", { value: this.data.inputValue })
    },

    /**
     * 提交当前选中的菜单项。
     *
     * @param {WechatMiniprogram.BaseEvent} event 菜单点击事件。
     * @returns {void}
     */
    selectOption(event) {
      this.triggerEvent("select", { index: Number(event.currentTarget.dataset.index) })
    }
  }
})
