const {
  deleteNoteHistory,
  ensureNoteSession,
  getFolders,
  getNote,
  getNoteHistories,
  getNoteHistory,
  getTags,
  removeNote,
  restoreNoteHistory,
  updateNote
} = require('../../../utils/note')
const { formatDate } = require('../../../utils/format')
const { getThemeState } = require('../../../utils/theme')

const AUTOSAVE_DELAY = 1200

/**
 * 将旧版富文本换行标记转换为适合 Markdown 编辑的换行。
 *
 * @param {string} content 原始笔记正文。
 * @returns {string} 规范化后的正文。
 */
function normalizeNoteContent(content) {
  return String(content || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n?[ \t]*<br\s*\/?>[ \t]*\n?/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * 将笔记 Markdown 正文转换为阅读节点。
 *
 * @param {string} content 笔记正文。
 * @param {string} theme 当前主题。
 * @returns {Record<string, any>} Towxml 渲染节点。
 */
function renderNoteContent(content, theme) {
  const source = String(content || '').trim()
  if (!source) return {}
  return getApp().towxml(source, 'markdown', {
    theme: theme === 'dark' ? 'dark' : 'light',
    highlightCode: true
  })
}

/**
 * 将多级文件夹整理为笔记归档使用的树形选项。
 *
 * @param {Array<Record<string, any>>} folders 文件夹列表。
 * @returns {Array<Record<string, any>>} 按父子层级排列并带缩进深度的选项。
 */
function buildFolderOptions(folders) {
  const options = [{ id: '', name: '未分类', depth: 0, icon: '▱', virtual: true }]
  const visited = new Set()
  /**
   * 判断两个文件夹 ID 是否相同。
   *
   * @param {number|string|null|undefined} left 左侧 ID。
   * @param {number|string|null|undefined} right 右侧 ID。
   * @returns {boolean} 是否相同。
   */
  const isSameId = (left, right) => String(left === null || left === undefined ? '' : left) === String(right === null || right === undefined ? '' : right)
  /**
   * 递归追加指定父节点的直接子文件夹。
   *
   * @param {number|string|null} parentId 父文件夹 ID。
   * @param {number} depth 当前显示深度。
   * @returns {void}
   */
  const appendChildren = (parentId, depth) => {
    folders.filter((folder) => isSameId(folder.parentId, parentId)).forEach((folder) => {
      const key = String(folder.id)
      if (visited.has(key)) return
      visited.add(key)
      options.push({ ...folder, depth, icon: '▰' })
      appendChildren(folder.id, depth + 1)
    })
  }
  appendChildren(null, 0)
  folders.forEach((folder) => {
    if (visited.has(String(folder.id))) return
    options.push({ ...folder, depth: 0, icon: '▰' })
    appendChildren(folder.id, 1)
  })
  return options
}

Page({
  data: {
    ...getThemeState(),
    noteId: '',
    note: null,
    folders: [],
    folderOptions: [{ id: '', name: '未分类' }],
    folderIndex: 0,
    folderName: '未分类',
    tags: [],
    histories: [],
    historyVisible: false,
    historyPreviewVisible: false,
    historyPreviewTitle: '',
    historyPreviewTime: '',
    historyPreviewHasContent: false,
    historyPreviewNodes: {},
    metadataVisible: false,
    dialog: { visible: false, mode: 'action', title: '', description: '', options: [] },
    editing: false,
    showBackTop: false,
    contentNodes: {},
    cursorPosition: 0,
    editorFocused: false,
    loading: true,
    saving: false,
    saveStatus: '已同步',
    error: ''
  },

  onLoad(options) {
    if (!options.id) {
      this.setData({ loading: false, error: '笔记参数无效' })
      return
    }
    this._openInEditMode = options.created === '1'
    this.setData({ noteId: options.id })
    this.loadEditor()
  },

  onShow() {
    const themeState = getThemeState()
    const contentNodes = this.data.note
      ? renderNoteContent(this.data.note.content, themeState.theme)
      : this.data.contentNodes
    this.setData({ ...themeState, contentNodes })
  },

  onHide() {
    if (this._dirty && !this.data.saving) {
      this.markNoteListRefresh()
      this.saveNote(false)
    }
  },

  onUnload() {
    if (this._saveTimer) clearTimeout(this._saveTimer)
  },

  async loadEditor() {
    this.setData({ loading: true, error: '' })
    try {
      await ensureNoteSession()
      const [note, folders, tags, historyResult] = await Promise.all([
        getNote(this.data.noteId),
        getFolders(),
        getTags(),
        getNoteHistories(this.data.noteId)
      ])
      const normalizedNote = {
        ...note,
        content: normalizeNoteContent(note.content),
        tagList: note.tagList || []
      }
      const folderOptions = buildFolderOptions(folders || [])
      const folderIndex = Math.max(0, folderOptions.findIndex((folder) => String(folder.id) === String(note.folderId || '')))
      this.setData({
        note: normalizedNote,
        folders: folders || [],
        folderOptions,
        folderIndex,
        folderName: folderOptions[folderIndex].name,
        tags: (tags || []).map((tag) => ({ ...tag, selected: (normalizedNote.tagList || []).some((item) => String(item.id) === String(tag.id)) })),
        histories: this.normalizeHistories(historyResult.records || []),
        contentNodes: renderNoteContent(normalizedNote.content, this.data.theme),
        editing: this._openInEditMode,
        loading: false,
        saveStatus: '已同步'
      })
      this.restoreLocalDraft()
    } catch (error) {
      this.setData({ loading: false, error: error.message || '笔记打开失败' })
    }
  },

  normalizeHistories(histories) {
    return histories.map((history) => ({ ...history, displayTime: formatDate(history.createTime) }))
  },

  localDraftKey() {
    return `ltw_note_draft_${this.data.noteId}`
  },

  markNoteListRefresh() {
    const app = getApp && getApp()
    if (app && app.globalData) app.globalData.noteRefreshRequested = true
  },

  /**
   * 检查并恢复当前笔记的本地未同步草稿。
   *
   * @returns {void}
   */
  restoreLocalDraft() {
    const draft = wx.getStorageSync(this.localDraftKey())
    if (!draft || !this.data.note || (draft.title === this.data.note.title && draft.content === this.data.note.content)) return
    this.openDialog({
      mode: 'confirm',
      title: '发现未同步草稿',
      description: '上次编辑的内容尚未同步，是否继续恢复？',
      confirmText: '恢复草稿'
    }, () => this.applyLocalDraft(draft), () => wx.removeStorageSync(this.localDraftKey()))
  },

  /**
   * 将本地草稿恢复到当前编辑器。
   *
   * @param {Record<string, any>} draft 本地草稿。
   * @returns {void}
   */
  applyLocalDraft(draft) {
    const note = { ...this.data.note, ...draft }
    const folderIndex = Math.max(0, this.data.folderOptions.findIndex((folder) => String(folder.id) === String(note.folderId || '')))
    const folder = this.data.folderOptions[folderIndex]
    const selectedTagIds = new Set((note.tagList || []).map((tag) => String(tag.id)))
    this.setData({
      note,
      folderIndex,
      folderName: folder ? folder.name : '未分类',
      tags: this.data.tags.map((tag) => ({ ...tag, selected: selectedTagIds.has(String(tag.id)) })),
      contentNodes: renderNoteContent(note.content, this.data.theme),
      saveStatus: '本地草稿'
    })
    this._dirty = true
  },

  updateTitle(event) {
    this.setData({ 'note.title': event.detail.value }, () => this.scheduleSave())
  },

  updateContent(event) {
    this._selectionStart = Number(event.detail.cursor || event.detail.value.length)
    this._selectionEnd = this._selectionStart
    this.setData({ 'note.content': event.detail.value }, () => this.scheduleSave())
  },

  /**
   * 进入沉浸式编辑状态。
   *
   * @returns {void}
   */
  enterEditMode() {
    this.setData({ editing: true, showBackTop: false, historyVisible: false, metadataVisible: false, cursorPosition: 0 })
  },

  /**
   * 根据笔记详情滚动位置显示回到顶部按钮。
   *
   * @param {WechatMiniprogram.Page.IPageScrollOption} event 页面滚动事件。
   * @returns {void}
   */
  onPageScroll(event) {
    const scrollTop = Number(event.scrollTop || 0)
    const showBackTop = Boolean(this.data.note && !this.data.editing && scrollTop > 600)
    if (showBackTop !== this.data.showBackTop) this.setData({ showBackTop })
  },

  /**
   * 平滑滚动回笔记详情顶部。
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
   * 保存当前修改并返回阅读状态。
   *
   * @returns {Promise<void>} 无返回值。
   */
  async finishEditing() {
    const saved = await this.saveNote(false)
    if (!saved) return
    this._openInEditMode = false
    this.setData({
      editing: false,
      showBackTop: false,
      editorFocused: false,
      metadataVisible: false,
      contentNodes: renderNoteContent(this.data.note.content, this.data.theme)
    })
    wx.pageScrollTo({ scrollTop: 0, duration: 220 })
  },

  /**
   * 打开阅读页的次级操作菜单。
   *
   * @returns {void}
   */
  openMoreMenu() {
    this.openDialog({
      mode: 'action',
      title: '更多操作',
      options: [
        { label: '笔记设置' },
        { label: `历史版本（${this.data.histories.length}）` },
        { label: '删除笔记', danger: true, description: '可在回收站找回' }
      ]
    }, ({ index }) => {
      if (index === 0) this.setData({ metadataVisible: true })
      if (index === 1) this.setData({ historyVisible: true })
      if (index === 2) this.confirmDeleteNote()
    })
  },

  confirmDeleteNote() {
    this.openDialog({
      mode: 'confirm',
      title: '删除笔记',
      description: '删除后可在回收站找回，是否继续？',
      confirmText: '删除',
      danger: true
    }, async () => {
      try {
        await removeNote(this.data.noteId)
        this.markNoteListRefresh()
        wx.navigateBack()
      } catch (error) {
        wx.showToast({ title: error.message || '删除失败', icon: 'none' })
      }
    })
  },

  /**
   * 切换笔记设置面板。
   *
   * @returns {void}
   */
  toggleMetadata() {
    this.setData({ metadataVisible: !this.data.metadataVisible })
  },

  /**
   * 关闭所有浮层。
   *
   * @returns {void}
   */
  closePanels() {
    this.setData({ metadataVisible: false, historyVisible: false, historyPreviewVisible: false })
  },

  captureSelection(event) {
    this._selectionStart = Number(event.detail.selectionStart || 0)
    this._selectionEnd = Number(event.detail.selectionEnd || this._selectionStart)
  },

  insertMarkdown(event) {
    const patterns = {
      heading: { prefix: '## ', suffix: '', placeholder: '小标题' },
      bold: { prefix: '**', suffix: '**', placeholder: '加粗文字' },
      italic: { prefix: '*', suffix: '*', placeholder: '斜体文字' },
      checklist: { prefix: '- [ ] ', suffix: '', placeholder: '待办事项' },
      quote: { prefix: '> ', suffix: '', placeholder: '引用内容' },
      code: { prefix: '`', suffix: '`', placeholder: '代码' },
      link: { prefix: '[', suffix: '](https://)', placeholder: '链接文字' }
    }
    const pattern = patterns[event.currentTarget.dataset.action]
    if (!pattern || !this.data.note) return
    const content = String(this.data.note.content || '')
    const rawStart = this._selectionStart === undefined ? content.length : this._selectionStart
    const rawEnd = this._selectionEnd === undefined ? rawStart : this._selectionEnd
    const start = Math.max(0, Math.min(Number(rawStart), content.length))
    const end = Math.max(start, Math.min(Number(rawEnd), content.length))
    const selected = content.slice(start, end) || pattern.placeholder
    const inserted = `${pattern.prefix}${selected}${pattern.suffix}`
    const nextContent = `${content.slice(0, start)}${inserted}${content.slice(end)}`
    const cursorPosition = start + inserted.length
    this._selectionStart = cursorPosition
    this._selectionEnd = cursorPosition
    this.setData({
      'note.content': nextContent,
      cursorPosition,
      editorFocused: true
    }, () => this.scheduleSave())
  },

  updateFolder(event) {
    const folderIndex = Number(event.detail.index)
    const folder = this.data.folderOptions[folderIndex]
    this.setData({
      folderIndex,
      folderName: folder ? folder.name : '未分类',
      'note.folderId': folder && folder.id !== '' ? folder.id : null
    }, () => this.scheduleSave())
  },

  /**
   * 打开自定义文件夹选择弹层。
   *
   * @returns {void}
   */
  openFolderDialog() {
    this.openDialog({
      mode: 'select',
      title: '选择文件夹',
      description: '笔记会保存到选中的文件夹',
      options: this.data.folderOptions.map((folder, index) => ({
        label: folder.name,
        icon: folder.icon,
        depth: folder.depth,
        selected: index === this.data.folderIndex
      }))
    }, (detail) => this.updateFolder({ detail }))
  },

  toggleTag(event) {
    const tagId = event.currentTarget.dataset.id
    const tags = this.data.tags.map((tag) => String(tag.id) === String(tagId) ? { ...tag, selected: !tag.selected } : tag)
    this.setData({
      tags,
      'note.tagList': tags.filter((tag) => tag.selected).map(({ id, name }) => ({ id, name }))
    }, () => this.scheduleSave())
  },

  scheduleSave() {
    const note = this.data.note
    if (!note) return
    this._dirty = true
    this._editVersion = Number(this._editVersion || 0) + 1
    wx.setStorageSync(this.localDraftKey(), {
      title: note.title,
      content: note.content,
      folderId: note.folderId,
      tagList: note.tagList
    })
    this.setData({ saveStatus: '等待保存' })
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => this.saveNote(false), AUTOSAVE_DELAY)
  },

  /**
   * 将当前笔记保存到服务端，并保留保存期间产生的新修改。
   *
   * @param {boolean} showToast 是否展示保存结果提示。
   * @returns {Promise<boolean>} 当前快照是否成功保存且没有待处理的新修改。
   */
  async saveNote(showToast = true) {
    if (!this.data.note || this.data.saving || !this._dirty) {
      if (showToast && !this._dirty) wx.showToast({ title: '内容已同步', icon: 'none' })
      return Boolean(this.data.note && !this.data.saving && !this._dirty)
    }
    if (this._saveTimer) clearTimeout(this._saveTimer)
    const editVersion = Number(this._editVersion || 0)
    const snapshot = { ...this.data.note, tagList: [...(this.data.note.tagList || [])] }
    this.setData({ saving: true, saveStatus: '正在保存' })
    try {
      await updateNote(snapshot.id, snapshot)
      this.markNoteListRefresh()
      const hasNewerChanges = Number(this._editVersion || 0) !== editVersion
      this._dirty = hasNewerChanges
      if (!hasNewerChanges) wx.removeStorageSync(this.localDraftKey())
      this.setData({ saving: false, saveStatus: hasNewerChanges ? '等待保存' : '已同步' })
      if (hasNewerChanges) {
        this._saveTimer = setTimeout(() => this.saveNote(false), AUTOSAVE_DELAY)
      }
      if (showToast) wx.showToast({ title: '已保存', icon: 'success' })
      await this.loadHistories()
      return !hasNewerChanges
    } catch (error) {
      this._dirty = true
      this.setData({ saving: false, saveStatus: '保存失败' })
      if (showToast) wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      return false
    }
  },

  toggleHistory() {
    this.setData({ historyVisible: !this.data.historyVisible })
  },

  async loadHistories() {
    try {
      const result = await getNoteHistories(this.data.noteId)
      this.setData({ histories: this.normalizeHistories(result.records || []) })
    } catch (error) {}
  },

  async showHistoryActions(event) {
    const historyId = event.currentTarget.dataset.id
    try {
      const history = await getNoteHistory(this.data.noteId, historyId)
      this.showHistoryPreview(history)
    } catch (error) {
      wx.showToast({ title: error.message || '历史版本加载失败', icon: 'none' })
    }
  },

  /**
   * 直接打开指定历史版本的预览。
   *
   * @param {Record<string, any>} history 历史版本详情。
   * @returns {void}
   */
  showHistoryPreview(history) {
    this._previewHistory = history
    this.setData({
      historyVisible: false,
      historyPreviewVisible: true,
      historyPreviewTitle: history.title || '无标题笔记',
      historyPreviewTime: history.displayTime || formatDate(history.createTime),
      historyPreviewHasContent: Boolean(String(history.content || '').trim()),
      historyPreviewNodes: renderNoteContent(normalizeNoteContent(history.content), this.data.theme)
    })
  },

  handleHistoryAction(history, actionIndex) {
    if (actionIndex === 0) {
      this.showHistoryPreview(history)
      return
    }
    const deleting = actionIndex === 2
    this.openDialog({
      mode: 'confirm',
      title: deleting ? '删除历史版本' : '恢复历史版本',
      description: deleting ? '删除后无法恢复，但不会影响当前笔记。' : '当前内容会先自动留档，是否继续恢复？',
      confirmText: deleting ? '删除' : '恢复',
      danger: deleting
    }, async () => {
      try {
        if (deleting) await deleteNoteHistory(this.data.noteId, history.id)
        else {
          await restoreNoteHistory(this.data.noteId, history.id)
          this._dirty = false
          wx.removeStorageSync(this.localDraftKey())
        }
        this._previewHistory = null
        this.setData({ historyPreviewVisible: false, historyVisible: false })
        await this.loadEditor()
        wx.showToast({ title: deleting ? '已删除' : '已恢复', icon: 'success' })
      } catch (error) {
        wx.showToast({ title: error.message || '操作失败', icon: 'none' })
      }
    })
  },

  /**
   * 关闭历史版本预览并返回历史列表。
   *
   * @returns {void}
   */
  closeHistoryPreview() {
    this._previewHistory = null
    this.setData({ historyPreviewVisible: false, historyVisible: true, historyPreviewHasContent: false, historyPreviewNodes: {} })
  },

  /**
   * 恢复当前正在预览的历史版本。
   *
   * @returns {void}
   */
  restorePreviewHistory() {
    if (this._previewHistory) this.handleHistoryAction(this._previewHistory, 1)
  },

  /**
   * 删除当前正在预览的历史版本。
   *
   * @returns {void}
   */
  deletePreviewHistory() {
    if (this._previewHistory) this.handleHistoryAction(this._previewHistory, 2)
  },

  /**
   * 打开统一的笔记弹层。
   *
   * @param {Record<string, any>} dialog 弹层配置。
   * @param {(detail: Record<string, any>) => void} onSubmit 提交回调。
   * @param {() => void} onCancel 取消回调。
   * @returns {void}
   */
  openDialog(dialog, onSubmit, onCancel = null) {
    this._dialogSubmit = onSubmit
    this._dialogCancel = onCancel
    const options = dialog.options || []
    this.setData({ dialog: { visible: true, description: '', value: '', options, ...dialog, itemsJson: JSON.stringify(options) } })
  },

  /**
   * 关闭统一弹层并执行取消回调。
   *
   * @returns {void}
   */
  closeDialog() {
    const cancel = this._dialogCancel
    this._dialogSubmit = null
    this._dialogCancel = null
    this.setData({ 'dialog.visible': false })
    if (cancel) cancel()
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
    this._dialogCancel = null
    this.setData({ 'dialog.visible': false })
    if (submit) submit(event.detail || {})
  }
})
