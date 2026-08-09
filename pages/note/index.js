const {
  createFolder,
  createNote,
  clearRecycleBin,
  ensureUserSession,
  getFolders,
  getNotes,
  permanentlyDeleteNote,
  removeNote,
  restoreNote,
  setNotePinned
} = require('../../utils/note')
const { clearToken } = require('../../utils/auth')
const { formatDate } = require('../../utils/format')
const { getThemeState } = require('../../utils/theme')

const SCOPES = {
  all: { label: '全部', params: { isDeleted: false } },
  pinned: { label: '置顶', params: { isDeleted: false, isPinned: true } },
  recycle: { label: '回收站', params: { isDeleted: true } }
}

const PAGE_SIZE = 20
const ROOT_FOLDER_ID = ''
const UNFILED_FOLDER_ID = 'unfiled'

/**
 * 判断两个文件夹 ID 是否指向同一节点。
 *
 * @param {number|string|null|undefined} left 左侧文件夹 ID。
 * @param {number|string|null|undefined} right 右侧文件夹 ID。
 * @returns {boolean} 是否相同。
 */
function isSameFolderId(left, right) {
  return String(left === null || left === undefined ? '' : left) === String(right === null || right === undefined ? '' : right)
}

/**
 * 将列表摘要转换为可直接展示的纯文本，避免把 HTML 或 Markdown 标记露出。
 *
 * @param {unknown} value 接口返回的摘要内容。
 * @returns {string} 清理后的摘要文本。
 */
function toPlainPreview(value) {
  const decoded = String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
  return decoded
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 将多级文件夹转换为移动端抽屉使用的扁平树。
 *
 * @param {Array<Record<string, any>>} folders 文件夹列表。
 * @param {number|string} selectedId 当前文件夹 ID。
 * @returns {Array<Record<string, any>>} 带层级与选中状态的扁平树。
 */
function flattenFolderTree(folders, selectedId) {
  const result = [
    { id: ROOT_FOLDER_ID, name: '全部笔记', depth: 0, indent: 0, selected: selectedId === ROOT_FOLDER_ID, virtual: true },
    { id: UNFILED_FOLDER_ID, name: '未分类', depth: 0, indent: 0, selected: selectedId === UNFILED_FOLDER_ID, virtual: true }
  ]
  const visited = new Set()
  const appendChildren = (parentId, depth) => {
    folders
      .filter((folder) => isSameFolderId(folder.parentId, parentId))
      .forEach((folder) => {
        const key = String(folder.id)
        if (visited.has(key)) return
        visited.add(key)
        result.push({
          ...folder,
          depth,
          indent: depth * 32,
          selected: isSameFolderId(folder.id, selectedId)
        })
        appendChildren(folder.id, depth + 1)
      })
  }
  appendChildren(null, 0)
  return result
}

/**
 * 计算当前文件夹的面包屑、同级目录、直接子文件夹与抽屉树。
 *
 * @param {Array<Record<string, any>>} folders 文件夹列表。
 * @param {number|string} requestedId 目标文件夹 ID。
 * @returns {Record<string, any>} 文件夹导航状态。
 */
function resolveFolderNavigation(folders, requestedId) {
  if (requestedId === UNFILED_FOLDER_ID) {
    return {
      currentFolderId: UNFILED_FOLDER_ID,
      currentFolderName: '未分类',
      breadcrumbs: [{ id: ROOT_FOLDER_ID, name: '全部笔记' }, { id: UNFILED_FOLDER_ID, name: '未分类' }],
      siblingFolders: folders.filter((folder) => isSameFolderId(folder.parentId, null)),
      childFolders: [],
      folderTree: flattenFolderTree(folders, UNFILED_FOLDER_ID)
    }
  }
  const folderMap = new Map(folders.map((folder) => [String(folder.id), folder]))
  const target = requestedId === ROOT_FOLDER_ID ? null : folderMap.get(String(requestedId))
  const currentFolderId = target ? target.id : ROOT_FOLDER_ID
  const path = []
  const visited = new Set()
  let current = target
  while (current && !visited.has(String(current.id))) {
    visited.add(String(current.id))
    path.unshift({ id: current.id, name: current.name })
    current = current.parentId === null || current.parentId === undefined
      ? null
      : folderMap.get(String(current.parentId))
  }
  return {
    currentFolderId,
    currentFolderName: target ? target.name : '全部笔记',
    breadcrumbs: [{ id: ROOT_FOLDER_ID, name: '全部笔记' }, ...path],
    siblingFolders: target
      ? folders.filter((folder) => isSameFolderId(folder.parentId, target.parentId) && !isSameFolderId(folder.id, target.id))
      : [],
    childFolders: folders.filter((folder) => isSameFolderId(folder.parentId, target ? target.id : null)),
    folderTree: flattenFolderTree(folders, currentFolderId)
  }
}

Page({
  data: {
    ...getThemeState(),
    scopes: Object.keys(SCOPES).map((key) => ({ key, label: SCOPES[key].label, count: 0 })),
    scope: 'all',
    keyword: '',
    notes: [],
    folders: [],
    currentFolderId: ROOT_FOLDER_ID,
    currentFolderName: '全部笔记',
    breadcrumbs: [{ id: ROOT_FOLDER_ID, name: '全部笔记' }],
    siblingFolders: [],
    childFolders: [],
    folderTree: [],
    folderSheetVisible: false,
    dialog: { visible: false, mode: 'action', title: '', description: '', options: [] },
    folderNavigationVisible: true,
    current: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    recycleFolderCount: 0,
    hasMore: true,
    loading: true,
    loadingMore: false,
    refreshing: false,
    error: '',
    noteAccessDenied: false,
    errorActionText: '重新加载',
    errorAction: 'reload'
  },

  onLoad() {
    this.initializePage()
  },

  /**
   * 页面显示时同步主题、底部导航；注册完成后执行一次刷新。
   *
   * @returns {Promise<void>|void} 注册后的刷新 Promise，普通显示不请求。
   */
  onShow() {
    this.setData(getThemeState())
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 1 })
    const app = getApp && getApp()
    if (app && app.globalData && app.globalData.noteRefreshRequested) {
      app.globalData.noteRefreshRequested = false
      if (this._initializing) return
      return this._initialized ? this.refreshPage() : this.initializePage()
    }
  },

  /**
   * 仅通过用户下拉手势刷新笔记列表，避免页面重新显示时重复请求。
   *
   * @returns {Promise<void>} 刷新结束后的 Promise。
   */
  onPullDownRefresh() {
    return this.handleRefresh().finally(() => wx.stopPullDownRefresh())
  },

  /**
   * 处理笔记列表滚动容器的下拉刷新。
   *
   * @returns {Promise<void>} 刷新结束后的 Promise。
   */
  async handleRefresh() {
    this.setData({ refreshing: true })
    try {
      await this.refreshPage()
    } finally {
      this.setData({ refreshing: false })
    }
  },

  /**
   * 刷新文件夹与第一页笔记数据。
   *
   * @returns {Promise<void>} 无返回值。
   */
  async refreshPage() {
    try {
      const folders = await getFolders(this.data.scope === 'recycle')
      this.setData({ recycleFolderCount: this.data.scope === 'recycle' ? (folders || []).length : 0 })
      this.applyFolderNavigation(folders || [])
    } catch (error) {}
    await this.loadNotes(true, true)
  },

  /**
   * 使用普通用户 token 初始化页面数据。
   *
   * @returns {Promise<void>} 无返回值。
   */
  async initializePage() {
    if (this._initializing) return
    this._initializing = true
    this.setData({ loading: true, error: '', errorActionText: '重新加载', errorAction: 'reload' })
    try {
      await ensureUserSession()
      const folders = await getFolders(false)
      this._initialized = true
      this.applyFolderNavigation(folders || [])
      await this.loadNotes(true, true)
    } catch (error) {
      const requiresLogin = [10007, 10010, 11002].includes(Number(error.code))
      if (requiresLogin) clearToken()
      this.setData({
        loading: false,
        noteAccessDenied: true,
        error: error.message || (requiresLogin ? '请先登录后查看笔记' : '笔记加载失败'),
        errorActionText: requiresLogin ? '去登录' : '重新加载',
        errorAction: requiresLogin ? 'openLogin' : 'reload'
      })
    } finally {
      this._initializing = false
    }
  },

  /**
   * 处理笔记页面错误状态的操作按钮。
   *
   * @returns {void}
   */
  handleErrorAction() {
    if (this.data.errorAction === 'openLogin') {
      wx.switchTab({
        url: '/pages/profile/index',
        fail: () => wx.reLaunch({ url: '/pages/profile/index' })
      })
      return
    }
    this.initializePage()
  },

  /**
   * 加载笔记列表，可选择重置或追加分页数据。
   *
   * @param {boolean} reset 是否从第一页重新加载。
   * @param {boolean} refreshCounts 是否同步刷新三个范围的数量。
   * @returns {Promise<void>} 无返回值。
   */
  async loadNotes(reset = true, refreshCounts = false) {
    const scope = SCOPES[this.data.scope] || SCOPES.all
    const current = reset ? 1 : this.data.current + 1
    this.setData(reset ? { loading: true, error: '' } : { loadingMore: true, error: '' })
    try {
      const keyword = this.data.keyword.trim()
      const folderId = this.data.currentFolderId
      const folderParams = this.data.scope === 'recycle' || folderId === ROOT_FOLDER_ID
        ? {}
        : { folderId: folderId === UNFILED_FOLDER_ID ? 0 : folderId }
      const result = await getNotes(current, this.data.pageSize, {
        ...scope.params,
        ...folderParams,
        ...(keyword ? { keyword } : {})
      })
      const folderMap = {}
      this.data.folders.forEach((folder) => { folderMap[String(folder.id)] = folder.name })
      const records = (result.records || []).map((note) => ({
        ...note,
        displayTime: formatDate(note.updateTime),
        folderName: note.folderId ? (folderMap[String(note.folderId)] || '未分类') : '未分类',
        contentPreview: toPlainPreview(note.contentPreview),
        previewTags: (note.tagList || []).slice(0, 2)
      }))
      const notes = reset ? records : [...this.data.notes, ...records]
      const total = Number(result.total || 0)
      this.setData({
        notes,
        current,
        total,
        hasMore: notes.length < total,
        loading: false,
        loadingMore: false,
        noteAccessDenied: false,
        errorActionText: '重新加载',
        errorAction: 'reload'
      })
      if (reset && refreshCounts) await this.loadScopeCounts(total)
    } catch (error) {
      if ([10007, 10010, 11002].includes(Number(error.code))) {
        clearToken()
        this.setData({
          notes: [],
          folders: [],
          siblingFolders: [],
          childFolders: [],
          folderTree: [],
          total: 0,
          recycleFolderCount: 0,
          scopes: this.data.scopes.map((item) => ({ ...item, count: 0 })),
          currentFolderId: ROOT_FOLDER_ID,
          currentFolderName: '全部笔记',
          breadcrumbs: [{ id: ROOT_FOLDER_ID, name: '全部笔记' }],
          current: 1,
          hasMore: false,
          loading: false,
          loadingMore: false,
          noteAccessDenied: true,
          error: error.message || '请先登录后查看笔记',
          errorActionText: '去登录',
          errorAction: 'openLogin'
        })
        return
      }
      if (!reset) {
        this.setData({ loadingMore: false })
        wx.showToast({ title: error.message || '加载更多失败', icon: 'none' })
        return
      }
      this.setData({ loading: false, loadingMore: false, noteAccessDenied: false, error: error.message || '笔记加载失败' })
    }
  },

  /**
   * 刷新全部、置顶和回收站的笔记数量。
   *
   * @param {number} activeTotal 当前筛选范围已返回的总数。
   * @returns {Promise<void>} 无返回值。
   */
  async loadScopeCounts(activeTotal) {
    const activeScope = this.data.scope
    const keyword = this.data.keyword.trim()
    const folderId = this.data.currentFolderId
    const counts = { [activeScope]: Number(activeTotal || 0) }
    const pendingScopes = Object.keys(SCOPES).filter((key) => key !== activeScope)
    await Promise.all(pendingScopes.map(async (key) => {
      const folderParams = key === 'recycle' || folderId === ROOT_FOLDER_ID
        ? {}
        : { folderId: folderId === UNFILED_FOLDER_ID ? 0 : folderId }
      try {
        const result = await getNotes(1, 1, {
          ...SCOPES[key].params,
          ...folderParams,
          ...(keyword ? { keyword } : {})
        })
        counts[key] = Number(result.total || 0)
      } catch (error) {
        const currentScope = this.data.scopes.find((item) => item.key === key)
        counts[key] = currentScope ? currentScope.count : 0
      }
    }))
    this.setData({
      scopes: this.data.scopes.map((item) => ({ ...item, count: counts[item.key] === undefined ? item.count : counts[item.key] }))
    })
  },

  /**
   * 在列表触底时加载下一页笔记。
   *
   * @returns {Promise<void>} 无返回值。
   */
  async loadMoreNotes() {
    if (this.data.noteAccessDenied || this.data.loading || this.data.loadingMore || !this.data.hasMore) return
    await this.loadNotes(false)
  },

  updateKeyword(event) {
    if (this.data.noteAccessDenied) return
    this.setData({ keyword: event.detail.value })
  },

  /**
   * 使用当前关键词重新搜索笔记。
   *
   * @returns {void}
   */
  searchNotes() {
    if (this.data.noteAccessDenied) return
    this.loadNotes(true, true)
  },

  /**
   * 在接口成功后直接同步本地列表与范围数量，避免删除操作触发整页 loading。
   *
   * @param {Record<string, any>} note 被操作的笔记。
   * @param {'remove'|'restore'|'permanent'} action 操作类型。
   * @returns {void}
   */
  removeNoteLocally(note, action) {
    const notes = this.data.notes.filter((item) => String(item.id) !== String(note.id))
    const countDelta = action === 'remove'
      ? { all: -1, pinned: note.isPinned ? -1 : 0, recycle: 1 }
      : action === 'restore'
        ? { all: 1, pinned: note.isPinned ? 1 : 0, recycle: -1 }
        : { all: 0, pinned: 0, recycle: -1 }
    const scopes = this.data.scopes.map((item) => ({
      ...item,
      count: Math.max(0, item.count + (countDelta[item.key] || 0))
    }))
    const total = Math.max(0, this.data.total - 1)
    this.setData({ notes, total, hasMore: notes.length < total, scopes })
  },

  /**
   * 在置顶接口成功后直接更新当前列表和数量。
   *
   * @param {Record<string, any>} note 被更新的笔记。
   * @param {boolean} isPinned 最新置顶状态。
   * @returns {void}
   */
  updatePinnedLocally(note, isPinned) {
    const notes = this.data.notes
      .map((item) => (String(item.id) === String(note.id) ? { ...item, isPinned } : item))
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned))
    const delta = isPinned ? 1 : -1
    const scopes = this.data.scopes.map((item) => ({
      ...item,
      count: item.key === 'pinned' ? Math.max(0, item.count + delta) : item.count
    }))
    this.setData({ notes, scopes })
  },

  /**
   * 切换笔记范围并重新加载第一页。
   *
   * @param {WechatMiniprogram.BaseEvent} event 范围点击事件。
   * @returns {void}
   */
  selectScope(event) {
    if (this.data.noteAccessDenied) return
    const scope = event.currentTarget.dataset.scope
    if (!SCOPES[scope] || scope === this.data.scope) return
    const folderNavigationVisible = scope !== 'recycle'
    const folderState = folderNavigationVisible
      ? resolveFolderNavigation(this.data.folders, this.data.currentFolderId)
      : resolveFolderNavigation(this.data.folders, ROOT_FOLDER_ID)
    this.setData({
      scope,
      folderNavigationVisible,
      folderSheetVisible: false,
      ...folderState
    }, async () => {
      try {
        const folders = await getFolders(scope === 'recycle')
        this.setData({
          folders: folders || [],
          recycleFolderCount: scope === 'recycle' ? (folders || []).length : 0,
          ...resolveFolderNavigation(folders || [], scope === 'recycle' ? ROOT_FOLDER_ID : this.data.currentFolderId)
        })
      } catch (error) {
        this.setData({ error: error.message || '文件夹加载失败' })
      }
      await this.loadNotes(true, true)
    })
  },

  /**
   * 确认并永久清空回收站中的全部笔记、文件夹和历史版本。
   *
   * @returns {void}
   */
  clearRecycleBin() {
    if (this.data.noteAccessDenied) return
    if (this.data.scope !== 'recycle' || (!this.data.total && !this.data.recycleFolderCount)) return
    this.openDialog({
      mode: 'confirm',
      title: '清空回收站',
      description: '回收站中的笔记、文件夹和历史版本都会永久删除，无法恢复，是否继续？',
      confirmText: '清空回收站',
      danger: true
    }, async () => {
      try {
        await clearRecycleBin()
        this.setData({
          notes: [],
          total: 0,
          hasMore: false,
          recycleFolderCount: 0,
          scopes: this.data.scopes.map((item) => item.key === 'recycle' ? { ...item, count: 0 } : item),
          folders: []
        })
        wx.showToast({ title: '回收站已清空', icon: 'success' })
      } catch (error) {
        wx.showToast({ title: error.message || '回收站清空失败', icon: 'none' })
      }
    })
  },

  /**
   * 根据文件夹列表和目标位置同步导航状态。
   *
   * @param {Array<Record<string, any>>} folders 文件夹列表。
   * @param {number|string} folderId 目标文件夹 ID。
   * @returns {void}
   */
  applyFolderNavigation(folders, folderId = this.data.currentFolderId) {
    this.setData({ folders, ...resolveFolderNavigation(folders, folderId) })
  },

  /**
   * 进入指定文件夹并刷新笔记列表。
   *
   * @param {WechatMiniprogram.BaseEvent} event 文件夹点击事件。
   * @returns {Promise<void>} 无返回值。
   */
  async selectFolder(event) {
    if (this.data.noteAccessDenied) return
    const folderId = event.currentTarget.dataset.id
    this.setData({
      ...resolveFolderNavigation(this.data.folders, folderId),
      folderSheetVisible: false
    })
    await this.loadNotes(true, true)
  },

  /**
   * 打开文件夹树抽屉。
   *
   * @returns {void}
   */
  openFolderSheet() {
    if (this.data.noteAccessDenied) return
    this.setData({ folderSheetVisible: true })
  },

  /**
   * 关闭文件夹树抽屉。
   *
   * @returns {void}
   */
  closeFolderSheet() {
    this.setData({ folderSheetVisible: false })
  },

  /**
   * 在当前层级创建子文件夹。
   *
   * @returns {void}
   */
  createChildFolder() {
    if (this.data.noteAccessDenied) return
    const currentFolderId = this.data.currentFolderId
    const parentId = currentFolderId === ROOT_FOLDER_ID || currentFolderId === UNFILED_FOLDER_ID ? null : currentFolderId
    this.openDialog({
      mode: 'prompt',
      title: parentId === null ? '新建文件夹' : `在“${this.data.currentFolderName}”中新建`,
      placeholder: '请输入文件夹名称',
      confirmText: '创建'
    }, async ({ value }) => {
      const name = String(value || '').trim()
      if (!name) return
      try {
        const folder = await createFolder(name, parentId)
        const folders = [...this.data.folders, folder].filter(Boolean)
        this.applyFolderNavigation(folders, currentFolderId)
        wx.showToast({ title: '已创建', icon: 'success' })
      } catch (error) {
        wx.showToast({ title: error.message || '创建失败', icon: 'none' })
      }
    })
  },

  openNote(event) {
    if (this.data.noteAccessDenied) return
    wx.navigateTo({ url: `/pages/note/edit/index?id=${event.currentTarget.dataset.id}` })
  },

  async createNote() {
    if (this.data.noteAccessDenied) return
    try {
      const currentFolderId = this.data.currentFolderId
      const folderId = currentFolderId === ROOT_FOLDER_ID || currentFolderId === UNFILED_FOLDER_ID ? null : currentFolderId
      const noteId = await createNote(folderId)
      const app = getApp && getApp()
      if (app && app.globalData) app.globalData.noteRefreshRequested = true
      wx.navigateTo({ url: `/pages/note/edit/index?id=${noteId}&created=1` })
    } catch (error) {
      wx.showToast({ title: error.message || '新建笔记失败', icon: 'none' })
    }
  },

  openManager() {
    if (this.data.noteAccessDenied) return
    wx.navigateTo({ url: '/pages/note/manage/index' })
  },

  showNoteActions(event) {
    if (this.data.noteAccessDenied) return
    const note = this.data.notes.find((item) => String(item.id) === String(event.currentTarget.dataset.id))
    if (!note) return
    const recycle = this.data.scope === 'recycle'
    const options = recycle
      ? [{ label: '恢复笔记' }, { label: '永久删除', danger: true }]
      : [
          { label: note.isPinned ? '取消置顶' : '置顶' },
          { label: '删除', danger: true, description: '可在回收站找回' }
        ]
    this.openDialog({
      mode: 'action',
      title: note.title || '无标题笔记',
      options
    }, ({ index }) => this.handleNoteAction(note, index))
  },

  /**
   * 执行置顶、回收站或永久删除操作并即时更新本地列表。
   *
   * @param {Record<string, any>} note 当前笔记。
   * @param {number} actionIndex 操作菜单索引。
   * @returns {Promise<void>} 无返回值。
   */
  async handleNoteAction(note, actionIndex) {
    if (this.data.noteAccessDenied) return
    try {
      if (this.data.scope === 'recycle') {
        if (actionIndex === 0) {
          await restoreNote(note.id)
          this.removeNoteLocally(note, 'restore')
          wx.showToast({ title: '已恢复', icon: 'success' })
        }
        else {
          this.confirmPermanentDelete(note)
          return
        }
      } else if (actionIndex === 0) {
        await setNotePinned(note.id, !note.isPinned)
        this.updatePinnedLocally(note, !note.isPinned)
        wx.showToast({ title: note.isPinned ? '已取消置顶' : '已置顶', icon: 'success' })
      } else {
        await removeNote(note.id)
        this.removeNoteLocally(note, 'remove')
      }
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    }
  },

  confirmPermanentDelete(note) {
    this.openDialog({
      mode: 'confirm',
      title: '永久删除笔记',
      description: `“${note.title || '无标题笔记'}”删除后无法恢复，是否继续？`,
      confirmText: '永久删除',
      danger: true
    }, async () => {
      try {
        await permanentlyDeleteNote(note.id)
        this.removeNoteLocally(note, 'permanent')
        wx.showToast({ title: '已彻底删除', icon: 'success' })
      } catch (error) {
        wx.showToast({ title: error.message || '操作失败', icon: 'none' })
      }
    })
  },

  /**
   * 打开统一的笔记弹层。
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
