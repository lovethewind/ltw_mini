Component({
  properties: {
    article: {
      type: Object,
      value: {}
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('select', {
        articleId: this.data.article.id
      })
    }
  }
})
