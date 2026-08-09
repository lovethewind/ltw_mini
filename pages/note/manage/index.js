const {
  createFolder,
  createTag,
  ensureNoteSession,
  getFolders,
  getTags,
  removeFolder,
  removeTag,
  renameFolder,
  renameTag
} = require('../../../utils/note')
const { getThemeState } = require('../../../utils/theme')

Page({
  data: {
    ...getThemeState(),
    tab: 'folder',
    folders: [],
    tags: [],
    dialog: { visible: false, mode: 'action', title: '', description: '', options: [] },
    loading: true,
    error: ''
  },

  onLoad() {
    this.loadResources()
  },

  onShow() {
    this.setData(getThemeState())
  },

  async loadResources() {
    this.setData({ loading: true, error: '' })
    try {
      await ensureNoteSession()
      const [folders, tags] = await Promise.all([getFolders(), getTags()])
      this.setData({ folders: folders || [], tags: tags || [], loading: false })
    } catch (error) {
      this.setData({ loading: false, error: error.message || '分类信息加载失败' })
    }
  },

  selectTab(event) {
    this.setData({ tab: event.currentTarget.dataset.tab })
  },

  createResource() {
    const isFolder = this.data.tab === 'folder'
    this.promptName({
      title: isFolder ? '新建文件夹' : '新建标签',
      confirmText: '创建',
      submit: (name) => isFolder ? createFolder(name) : createTag(name)
    })
  },

  showResourceActions(event) {
    const type = event.currentTarget.dataset.type
    const id = event.currentTarget.dataset.id
    const records = type === 'folder' ? this.data.folders : this.data.tags
    const record = records.find((item) => String(item.id) === String(id))
    if (!record) return
    this.openDialog({
      mode: 'action',
      title: record.name,
      options: [{ label: '重命名' }, { label: '删除', danger: true }]
    }, ({ index }) => {
      if (index === 0) this.renameResource(type, record)
      else this.confirmRemoveResource(type, record)
    })
  },

  renameResource(type, record) {
    this.promptName({
      title: type === 'folder' ? '重命名文件夹' : '重命名标签',
      value: record.name,
      confirmText: '保存',
      submit: (name) => type === 'folder' ? renameFolder(record.id, name) : renameTag(record.id, name)
    })
  },

  confirmRemoveResource(type, record) {
    const isFolder = type === 'folder'
    this.openDialog({
      mode: 'confirm',
      title: isFolder ? '删除文件夹' : '删除标签',
      description: isFolder ? '文件夹及其中笔记会移入回收站，是否继续？' : '标签会从所有笔记中移除，是否继续？',
      confirmText: '删除',
      danger: true
    }, async () => {
      try {
        if (isFolder) await removeFolder(record.id)
        else await removeTag(record.id)
        await this.loadResources()
        wx.showToast({ title: '已删除', icon: 'success' })
      } catch (error) {
        wx.showToast({ title: error.message || '删除失败', icon: 'none' })
      }
    })
  },

  promptName(options) {
    this.openDialog({
      mode: 'prompt',
      title: options.title,
      placeholder: '请输入名称',
      value: options.value || '',
      confirmText: options.confirmText
    }, async ({ value }) => {
      const name = String(value || '').trim()
      if (!name) return
      try {
        await options.submit(name)
        await this.loadResources()
        wx.showToast({ title: '已保存', icon: 'success' })
      } catch (error) {
        wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      }
    })
  },

  /**
   * 打开统一的分类管理弹层。
   *
   * @param {Record<string, any>} dialog 弹层配置。
   * @param {(detail: Record<string, any>) => void} onSubmit 提交回调。
   * @returns {void}
   */
  openDialog(dialog, onSubmit) {
    this._dialogSubmit = onSubmit
    const options = dialog.options || []
    this.setData({ dialog: { visible: true, description: '', value: '', options, ...dialog, itemsJson: JSON.stringify(options) } })
  },

  /**
   * 关闭统一弹层。
   *
   * @returns {void}
   */
  closeDialog() {
    this._dialogSubmit = null
    this.setData({ 'dialog.visible': false })
  },

  /**
   * 处理统一弹层提交事件。
   *
   * @param {WechatMiniprogram.CustomEvent} event 弹层事件。
   * @returns {void}
   */
  submitDialog(event) {
    const submit = this._dialogSubmit
    this._dialogSubmit = null
    this.setData({ 'dialog.visible': false })
    if (submit) submit(event.detail || {})
  }
})
