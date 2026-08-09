Component({
  properties: {
    type: {
      type: String,
      value: 'empty'
    },
    loading: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    actionText: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleAction() {
      this.triggerEvent('action')
    }
  }
})
