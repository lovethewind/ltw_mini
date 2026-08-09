const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const PROJECT_ROOT = path.resolve(__dirname, "..")
const NOTE_PAGE_PATH = path.join(PROJECT_ROOT, "pages/note/index.js")
const NOTE_EDIT_PAGE_PATH = path.join(PROJECT_ROOT, "pages/note/edit/index.js")
const NOTE_MANAGE_PAGE_PATH = path.join(PROJECT_ROOT, "pages/note/manage/index.js")
const NOTE_UTIL_PATH = path.join(PROJECT_ROOT, "utils/note.js")
const REQUEST_UTIL_PATH = path.join(PROJECT_ROOT, "utils/request.js")
const WECHAT_UTIL_PATH = path.join(PROJECT_ROOT, "utils/wechat.js")
const THEME_UTIL_PATH = path.join(PROJECT_ROOT, "utils/theme.js")
const STATE_VIEW_TEMPLATE_PATH = path.join(PROJECT_ROOT, "components/state-view/state-view.wxml")
const STATE_VIEW_STYLE_PATH = path.join(PROJECT_ROOT, "components/state-view/state-view.wxss")

/**
 * 创建支持小程序 setData 路径语法的页面实例。
 *
 * @param {Record<string, any>} definition 页面定义。
 * @returns {Record<string, any>} 可执行的页面实例。
 */
function createPageInstance(definition) {
  const instance = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      Object.entries(patch).forEach(([key, value]) => {
        const segments = key.split(".")
        let target = this.data
        segments.slice(0, -1).forEach((segment) => {
          target = target[segment]
        })
        target[segments[segments.length - 1]] = value
      })
      if (callback) callback()
    }
  }
  return instance
}

/**
 * 使用指定笔记 API 替身加载页面定义。
 *
 * @param {string} pagePath 页面脚本绝对路径。
 * @param {Record<string, Function>} noteApi 笔记 API 替身。
 * @param {Record<string, any>} storage 本地存储替身。
 * @returns {Record<string, any>} 页面定义。
 */
function loadPage(pagePath, noteApi, storage = {}) {
  delete require.cache[pagePath]
  delete require.cache[THEME_UTIL_PATH]
  require.cache[NOTE_UTIL_PATH] = {
    id: NOTE_UTIL_PATH,
    filename: NOTE_UTIL_PATH,
    loaded: true,
    exports: noteApi
  }
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value },
    removeStorageSync: (key) => { delete storage[key] },
    getSystemInfoSync: () => ({ theme: "light" }),
    showModal: ({ success }) => success({ confirm: true }),
    showToast: () => {},
    pageScrollTo: () => {}
  }
  global.getApp = () => ({ towxml: (content) => ({ rendered: content }) })
  let pageDefinition
  global.Page = (definition) => { pageDefinition = definition }
  require(pagePath)
  return pageDefinition
}

/**
 * 使用请求与微信登录替身加载笔记 API。
 *
 * @param {(options: Record<string, any>) => Promise<any>} request 请求替身。
 * @param {() => Promise<string>} login 微信登录替身。
 * @param {Record<string, any>} storage 本地存储替身。
 * @returns {Record<string, Function>} 笔记 API。
 */
function loadNoteApi(request, login, storage = {}) {
  delete require.cache[NOTE_UTIL_PATH]
  require.cache[REQUEST_UTIL_PATH] = {
    id: REQUEST_UTIL_PATH,
    filename: REQUEST_UTIL_PATH,
    loaded: true,
    exports: { request }
  }
  require.cache[WECHAT_UTIL_PATH] = {
    id: WECHAT_UTIL_PATH,
    filename: WECHAT_UTIL_PATH,
    loaded: true,
    exports: { login }
  }
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value },
    removeStorageSync: (key) => { delete storage[key] }
  }
  return require(NOTE_UTIL_PATH)
}

test("底部导航始终包含笔记，并保留受配置控制的文章入口", () => {
  const appConfig = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "app.json"), "utf8"))
  assert.deepEqual(
    appConfig.tabBar.list.map((item) => item.pagePath),
    ["pages/index/index", "pages/note/index", "pages/article/list/index", "pages/profile/index"]
  )
  const tabBarSource = fs.readFileSync(path.join(PROJECT_ROOT, "custom-tab-bar/index.js"), "utf8")
  assert.match(tabBarSource, /text:\s*['"]笔记['"]/)
  assert.match(tabBarSource, /text:\s*['"]文章['"][\s\S]*requiresArticle:\s*true/)
})

test("笔记列表像首页一样通过内容内边距预留底部空间", () => {
  const appStyle = fs.readFileSync(path.join(PROJECT_ROOT, "app.wxss"), "utf8")
  const noteStyle = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxss"), "utf8")
  assert.match(appStyle, /\.page-shell[\s\S]*padding:[^;]*calc\(156rpx \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(noteStyle, /\.note-list[^}]*padding:[^;]*calc\(156rpx \+ env\(safe-area-inset-bottom\)\)/)
  assert.doesNotMatch(noteStyle, /var\(--tab-content-bottom\)/)
})

test("加载状态使用居中且更大的 CSS 圆环动画", () => {
  const template = fs.readFileSync(STATE_VIEW_TEMPLATE_PATH, "utf8")
  const style = fs.readFileSync(STATE_VIEW_STYLE_PATH, "utf8")

  assert.match(template, /class="state-view__spinner"[^>]*src="\/images\/loading-spinner\.svg"/)
  assert.match(template, /loading \|\| type === 'loading'/)
  assert.doesNotMatch(template, /wx:if="\{\{type === 'loading'\}\}">◌/)
  assert.match(style, /\.state-view__spinner\s*\{[\s\S]*width:\s*44rpx;[\s\S]*height:\s*44rpx;[\s\S]*animation:\s*spin/)
  assert.match(fs.readFileSync(path.join(PROJECT_ROOT, "images/loading-spinner.svg"), "utf8"), /<circle[^>]*r="18"/)
})

test("保存失败时完成操作保持编辑状态", async () => {
  const page = loadPage(NOTE_EDIT_PAGE_PATH, {
    updateNote: async () => { throw new Error("保存失败") }
  })
  const instance = createPageInstance(page)
  instance.data.note = { id: 1, title: "标题", content: "正文", tagList: [] }
  instance.data.editing = true
  instance._dirty = true

  await instance.finishEditing()

  assert.equal(instance.data.editing, true)
  assert.equal(instance.data.saveStatus, "保存失败")
})

test("阅读页编辑按钮位于更多按钮之前", () => {
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxml"), "utf8")
  assert.ok(template.indexOf("bindtap=\"enterEditMode\"") < template.indexOf("bindtap=\"openMoreMenu\""))
})

test("空笔记正文不渲染占位文字", () => {
  const page = loadPage(NOTE_EDIT_PAGE_PATH, {})
  const instance = createPageInstance(page)
  instance.data.note = { id: 1, title: "无标题笔记", content: "", tagList: [] }

  instance.onShow()

  assert.deepEqual(instance.data.contentNodes, {})
})

test("笔记详情滚动后显示回到顶部并支持平滑返回", () => {
  const page = loadPage(NOTE_EDIT_PAGE_PATH, {})
  const instance = createPageInstance(page)
  instance.data.note = { id: 1, title: "测试笔记", content: "正文", tagList: [] }

  instance.onPageScroll({ scrollTop: 601 })
  assert.equal(instance.data.showBackTop, true)

  const scrollCalls = []
  global.wx.pageScrollTo = (options) => scrollCalls.push(options)
  instance.backToTop()
  assert.deepEqual(scrollCalls.at(-1), { scrollTop: 0, duration: 280 })

  instance.onPageScroll({ scrollTop: 0 })
  assert.equal(instance.data.showBackTop, false)

  instance.data.editing = true
  instance.onPageScroll({ scrollTop: 900 })
  assert.equal(instance.data.showBackTop, false)

  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxml"), "utf8")
  const style = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxss"), "utf8")
  assert.match(template, /showBackTop && note && !editing/)
  assert.match(template, /bindtap="backToTop"/)
  assert.match(style, /\.note-back-top\s*\{[^}]*position:fixed[^}]*bottom:calc\(34rpx \+ env\(safe-area-inset-bottom\)\)/)
})

test("恢复本地草稿时同步正文、文件夹和标签状态", () => {
  const storage = {
    ltw_note_draft_1: {
      title: "草稿标题",
      content: "草稿正文",
      folderId: 2,
      tagList: [{ id: 8, name: "草稿标签" }]
    }
  }
  const page = loadPage(NOTE_EDIT_PAGE_PATH, {}, storage)
  const instance = createPageInstance(page)
  instance.data.noteId = "1"
  instance.data.note = { id: 1, title: "服务端标题", content: "服务端正文", folderId: null, tagList: [] }
  instance.data.folderOptions = [{ id: "", name: "未分类" }, { id: 2, name: "工作" }]
  instance.data.tags = [{ id: 8, name: "草稿标签", selected: false }]

  instance.restoreLocalDraft()
  instance.submitDialog({ detail: {} })

  assert.equal(instance.data.folderIndex, 1)
  assert.equal(instance.data.folderName, "工作")
  assert.equal(instance.data.tags[0].selected, true)
  assert.deepEqual(instance.data.contentNodes, { rendered: "草稿正文" })
})

test("笔记列表支持分页追加并正确更新是否还有更多", async () => {
  const calls = []
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async (current, size) => {
      calls.push([current, size])
      return current === 1
        ? { total: 3, records: [{ id: 1, title: "一" }, { id: 2, title: "二" }] }
        : { total: 3, records: [{ id: 3, title: "三" }] }
    }
  })
  const instance = createPageInstance(page)
  instance.data.folders = []

  await instance.loadNotes(true)
  await instance.loadMoreNotes()

  assert.deepEqual(calls, [[1, 20], [2, 20]])
  assert.deepEqual(instance.data.notes.map((note) => note.id), [1, 2, 3])
  assert.equal(instance.data.hasMore, false)
})

test("笔记列表摘要去除 HTML 和 Markdown 标记", async () => {
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async () => ({
      total: 1,
      records: [{
        id: 1,
        title: "摘要测试",
        contentPreview: "第一行<br>第二行 <strong>重点</strong> [链接](https://example.com)"
      }]
    })
  })
  const instance = createPageInstance(page)

  await instance.loadNotes(true)

  assert.equal(instance.data.notes[0].contentPreview, "第一行 第二行 重点 链接")
})

test("普通用户 token 过期时清理 token，不通过微信重建专用会话", async () => {
  const storage = { ltw_token: "expired-token" }
  let listAttempts = 0
  let loginAttempts = 0
  const noteApi = loadNoteApi(async (options) => {
    listAttempts += 1
    throw { code: 10007, message: "登录已过期" }
  }, async () => {
    loginAttempts += 1
    return "wechat-code"
  }, storage)

  await assert.rejects(() => noteApi.getNotes(), (error) => error.code === 10007)
  assert.equal(listAttempts, 1)
  assert.equal(loginAttempts, 0)
  assert.equal(storage.ltw_token, undefined)
})

test("加载更多失败时保留已有笔记并只显示轻提示", async () => {
  let attempts = 0
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async () => {
      attempts += 1
      if (attempts === 1) return { total: 3, records: [{ id: 1, title: "已有笔记" }] }
      throw new Error("加载更多失败")
    }
  })
  const instance = createPageInstance(page)
  const toasts = []
  global.wx.showToast = (options) => toasts.push(options)

  await instance.loadNotes(true)
  await instance.loadMoreNotes()

  assert.deepEqual(instance.data.notes.map((note) => note.id), [1])
  assert.equal(instance.data.error, "")
  assert.equal(instance.data.loadingMore, false)
  assert.equal(toasts.at(-1).title, "加载更多失败")
})

test("笔记与文件夹创建接口支持当前父级", async () => {
  const requests = []
  const noteApi = loadNoteApi(async (options) => {
    requests.push(options)
    return options.url === "/note" ? 99 : { id: 8, name: "子文件夹", parentId: 3 }
  }, async () => "wechat-code", { ltw_token: "valid-token" })

  await noteApi.createNote(3)
  await noteApi.createFolder("子文件夹", 3)

  assert.deepEqual(requests[0].data, { folderId: 3 })
  assert.deepEqual(requests[1].data, { name: "子文件夹", parentId: 3 })
})

test("进入多级文件夹后生成面包屑、子文件夹并按当前文件夹筛选", async () => {
  const queries = []
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async (current, size, params) => {
      queries.push(params)
      return { total: 0, records: [] }
    }
  })
  const instance = createPageInstance(page)
  instance.data.folders = [
    { id: 1, parentId: null, name: "工作" },
    { id: 2, parentId: 1, name: "2026项目" },
    { id: 4, parentId: 1, name: "复习资料" },
    { id: 3, parentId: 2, name: "会议记录" }
  ]

  await instance.selectFolder({ currentTarget: { dataset: { id: 2 } } })

  assert.deepEqual(instance.data.breadcrumbs.map((item) => item.name), ["全部笔记", "工作", "2026项目"])
  assert.deepEqual(instance.data.childFolders.map((item) => item.name), ["会议记录"])
  assert.deepEqual(instance.data.siblingFolders.map((item) => item.name), ["复习资料"])
  assert.equal(instance.data.currentFolderName, "2026项目")
  assert.ok(queries.some((params) => params.folderId === 2 && params.isDeleted === false && params.isPinned === undefined))

  await instance.selectFolder({ currentTarget: { dataset: { id: 4 } } })
  assert.deepEqual(instance.data.childFolders, [])
  assert.deepEqual(instance.data.siblingFolders.map((item) => item.name), ["2026项目"])
})

test("未分类作为根目录虚拟文件夹时保留顶层同级文件夹", () => {
  const page = loadPage(NOTE_PAGE_PATH, {})
  const instance = createPageInstance(page)
  instance.data.folders = [
    { id: 1, parentId: null, name: "工作" },
    { id: 2, parentId: null, name: "学习" },
    { id: 3, parentId: 1, name: "会议记录" }
  ]

  instance.selectFolder({ currentTarget: { dataset: { id: "unfiled" } } })

  assert.deepEqual(instance.data.siblingFolders.map((item) => item.name), ["工作", "学习"])
  assert.deepEqual(instance.data.childFolders, [])
})

test("在当前文件夹新建笔记，并在回收站隐藏文件夹导航", async () => {
  const createdInFolders = []
  const page = loadPage(NOTE_PAGE_PATH, {
    createNote: async (folderId) => {
      createdInFolders.push(folderId)
      return 88
    },
    getNotes: async () => ({ total: 0, records: [] })
  })
  const instance = createPageInstance(page)
  instance.data.currentFolderId = 6
  global.wx.navigateTo = () => {}

  await instance.createNote()
  instance.selectScope({ currentTarget: { dataset: { scope: "recycle" } } })

  assert.deepEqual(createdInFolders, [6])
  assert.equal(instance.data.folderNavigationVisible, false)
  assert.equal(instance.data.currentFolderId, "")
})

test("笔记页面将文件夹操作放在筛选栏且不重复展示当前文件夹标题", () => {
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxml"), "utf8")
  const style = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxss"), "utf8")
  const scopesStart = template.indexOf('class="note-scopes')
  const listStart = template.indexOf('class="note-list-scroll"')
  assert.ok(scopesStart >= 0)
  assert.ok(template.indexOf("folder-browser__actions", scopesStart) < listStart)
  assert.doesNotMatch(template, /class="note-breadcrumb"/)
  assert.doesNotMatch(template, /class="folder-browser__identity"/)
  assert.match(style, /\.note-scope\s*\{[^}]*flex:none[^}]*white-space:nowrap/)
  assert.match(style, /\.folder-browser\s*\{[^}]*padding:0[^}]*background:transparent/)
  assert.match(style, /\.folder-strip\s*\{[^}]*height:86rpx/)
  assert.match(template, /class="folder-panel/)
  assert.match(template, /item\.contentPreview/)
  assert.match(template, /当前文件夹 · 没有子文件夹/)
  assert.match(template, /wx:for="\{\{siblingFolders\}\}"/)
  assert.match(template, /wx:elif="\{\{childFolders\.length\}\}"/)
  assert.match(template, /<block wx:else>/)
  assert.match(style, /\.folder-card--current\s*\{[^}]*border-color/)
  assert.match(template, /scope === 'pinned' \? '置顶' : scope === 'recycle' \? '回收站' : currentFolderName/)
})

test("笔记模块使用统一自绘弹层替代原生选择器和弹窗", () => {
  const sources = [
    NOTE_PAGE_PATH,
    NOTE_EDIT_PAGE_PATH,
    NOTE_MANAGE_PAGE_PATH,
    path.join(PROJECT_ROOT, "pages/note/index.wxml"),
    path.join(PROJECT_ROOT, "pages/note/edit/index.wxml"),
    path.join(PROJECT_ROOT, "pages/note/manage/index.wxml")
  ].map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n")
  const dialogTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.wxml"), "utf8")
  const dialogStyle = fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.wxss"), "utf8")

  assert.doesNotMatch(sources, /wx\.showModal|wx\.showActionSheet|<picker/)
  assert.match(sources, /<note-dialog/)
  assert.match(dialogTemplate, /dialog-option--selected/)
  assert.match(dialogTemplate, /mode === 'action'[^\n]*dialog-backdrop--center/)
  assert.match(dialogStyle, /\.dialog-backdrop--center\s*\{[^}]*align-items:center[^}]*justify-content:center/)
  assert.match(dialogStyle, /\.dialog-panel--center\s*\{[^}]*max-width:640rpx/)
  assert.match(dialogStyle, /env\(safe-area-inset-bottom\)/)
})

test("更多操作、笔记设置和历史版本使用大字号居中卡片", () => {
  const dialogStyle = fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.wxss"), "utf8")
  const editStyle = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxss"), "utf8")

  assert.match(dialogStyle, /\.dialog-option\s*\{[^}]*min-height:96rpx/)
  assert.match(dialogStyle, /\.dialog-option__label\s*\{[^}]*font-size:28rpx[^}]*line-height:1\.5/)
  assert.match(dialogStyle, /\.dialog-button,\.dialog-cancel\s*\{[^}]*display:flex[^}]*align-items:center[^}]*justify-content:center[^}]*padding:0[^}]*line-height:1/)
  assert.match(dialogStyle, /\.dialog-button::after,\.dialog-cancel::after\s*\{[^}]*border:0/)
  assert.match(editStyle, /\.bottom-panel\s*\{[^}]*top:50%[^}]*left:50%[^}]*max-width:640rpx[^}]*border-radius:30rpx/)
  assert.match(editStyle, /\.history-scroll\s*\{[^}]*max-height:52vh/)
})

test("历史版本使用 Markdown 独立预览并可返回历史列表", () => {
  const script = fs.readFileSync(NOTE_EDIT_PAGE_PATH, "utf8")
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxml"), "utf8")
  const style = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxss"), "utf8")

  assert.match(script, /historyPreviewNodes:\s*renderNoteContent\(normalizeNoteContent\(history\.content\), this\.data\.theme\)/)
  assert.match(script, /historyVisible:\s*false[\s\S]*historyPreviewVisible:\s*true/)
  assert.doesNotMatch(script, /options:\s*\[\{ label: '预览版本'/)
  assert.match(template, /class="bottom-panel bottom-panel--preview"/)
  assert.match(template, /<towxml nodes="\{\{historyPreviewNodes\}\}"><\/towxml>/)
  assert.match(template, /bindtap="restorePreviewHistory">恢复/)
  assert.match(template, /bindtap="deletePreviewHistory">删除/)
  assert.match(template, /bindtap="closeHistoryPreview">返回/)
  assert.match(style, /\.bottom-panel--preview\s*\{[^}]*width:calc\(100% - 28rpx\)[^}]*max-width:700rpx[^}]*max-height:90vh/)
  assert.match(style, /\.history-preview-scroll\s*\{[^}]*height:64vh/)
})

test("笔记文件夹选择按父子层级生成树形选项", () => {
  const script = fs.readFileSync(NOTE_EDIT_PAGE_PATH, "utf8")
  const dialogTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.wxml"), "utf8")

  assert.match(script, /function buildFolderOptions\(folders\)/)
  assert.match(script, /folderOptions = buildFolderOptions\(folders \|\| \[\]\)/)
  assert.match(script, /options\.push\(\{ \.\.\.folder, depth, icon: '▰' \}\)/)
  assert.match(script, /icon:\s*'▰'/)
  assert.match(dialogTemplate, /\(item\.depth \|\| 0\) \* 32/)
  assert.match(dialogTemplate, /dialog-option__icon/)
})

test("笔记详情页主题背景与正文颜色同步", () => {
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxml"), "utf8")
  const pageStyle = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxss"), "utf8")
  const appStyle = fs.readFileSync(path.join(PROJECT_ROOT, "app.wxss"), "utf8")

  assert.match(template, /class="note-edit-page theme-\{\{theme\}\}"/)
  assert.match(pageStyle, /\.note-edit-page\s*\{[^}]*background:var\(--page-bg\)/)
  assert.match(pageStyle, /\.note-reader__title\s*\{[^}]*color:var\(--text-primary\)/)
  assert.match(appStyle, /--page-bg:\s*radial-gradient\(circle at 104% 8%/)
  assert.match(appStyle, /\.theme-dark\s*\{[^}]*--page-bg:\s*radial-gradient\(circle at 104% 8%/)
})

test("笔记快捷菜单稳定传递操作项并使用 CSS 三圆点图标", () => {
  const pageTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxml"), "utf8")
  const dialogScript = fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.js"), "utf8")
  const dialogTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.wxml"), "utf8")
  const pageStyle = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxss"), "utf8")

  assert.match(dialogScript, /itemsJson:\s*\{ type: String, value: "\[\]" \}/)
  assert.match(dialogScript, /renderItems:\s*JSON\.parse\(itemsJson \|\| "\[\]"\)/)
  assert.match(dialogTemplate, /wx:for="\{\{renderItems\}\}"/)
  assert.match(dialogTemplate, /<view wx:if="\{\{mode === 'action'\}\}" class="dialog-options dialog-options--action">/)
  assert.match(dialogTemplate, /<scroll-view wx:if="\{\{mode === 'select'\}\}" class="dialog-options dialog-options--select"/)
  assert.match(pageTemplate, /items-json="\{\{dialog\.itemsJson\}\}"/)
  assert.doesNotMatch(pageTemplate, />•••<\/button>/)
  assert.match(pageTemplate, /class="note-card__more-dot"/)
  assert.match(pageStyle, /\.note-card__more-dot\s*\{[^}]*border-radius:50%/)
  assert.match(fs.readFileSync(path.join(PROJECT_ROOT, "components/note-dialog/index.wxss"), "utf8"), /\.dialog-options--select\s*\{[^}]*height:52vh/)
})

test("普通笔记与回收站快捷菜单生成对应操作项", () => {
  const page = loadPage(NOTE_PAGE_PATH, {})
  const instance = createPageInstance(page)
  instance.data.notes = [{ id: 7, title: "测试笔记", isPinned: false }]

  instance.showNoteActions({ currentTarget: { dataset: { id: 7 } } })
  assert.deepEqual(instance.data.dialog.options.map((item) => item.label), ["置顶", "删除"])
  assert.equal(instance.data.dialog.options[1].danger, true)
  assert.equal(instance.data.dialog.options[1].description, "可在回收站找回")

  instance.data.scope = "recycle"
  instance.showNoteActions({ currentTarget: { dataset: { id: 7 } } })
  assert.deepEqual(instance.data.dialog.options.map((item) => item.label), ["恢复笔记", "永久删除"])
})

test("笔记详情更多菜单提供删除并在成功后返回列表", () => {
  const source = fs.readFileSync(NOTE_EDIT_PAGE_PATH, "utf8")
  const listSource = fs.readFileSync(NOTE_PAGE_PATH, "utf8")
  assert.match(source, /label: '删除笔记', danger: true, description: '可在回收站找回'/)
  assert.match(source, /await removeNote\(this\.data\.noteId\)/)
  assert.match(source, /await removeNote\(this\.data\.noteId\)[\s\S]*wx\.navigateBack\(\)/)
  assert.doesNotMatch(source, /wx\.showToast\(\{ title: '已删除/)
  assert.doesNotMatch(listSource, /wx\.showToast\(\{ title: '已删除/)
})

test("笔记页面显示时不重复请求，仅下拉刷新请求数据", async () => {
  let requests = 0
  let pullDownStops = 0
  const page = loadPage(NOTE_PAGE_PATH, {
    getFolders: async () => [],
    getNotes: async () => {
      requests += 1
      return { total: 0, records: [] }
    }
  })
  const instance = createPageInstance(page)
  instance._initialized = true
  global.wx.stopPullDownRefresh = () => { pullDownStops += 1 }

  instance.onShow()
  assert.equal(requests, 0)

  await instance.handleRefresh()
  assert.equal(requests, 3)
  assert.equal(instance.data.refreshing, false)

  await instance.onPullDownRefresh()
  assert.equal(requests, 6)
  assert.equal(pullDownStops, 1)

  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxml"), "utf8")
  assert.match(template, /refresher-enabled="\{\{true\}\}"/)
  assert.match(template, /refresher-triggered="\{\{refreshing\}\}"/)
  assert.match(template, /bindrefresherrefresh="handleRefresh"/)
})

test("注册完成后笔记页按标记刷新一次", () => {
  const source = fs.readFileSync(NOTE_PAGE_PATH, "utf8")
  assert.match(source, /noteRefreshRequested/)
  assert.match(source, /if \(this\._initializing\) return/)
  assert.match(source, /return this\._initialized \? this\.refreshPage\(\) : this\.initializePage\(\)/)
  assert.match(source, /const noteId = await createNote\(folderId\)[\s\S]*noteRefreshRequested = true/)
})

test("笔记编辑保存或返回时通知列表刷新", () => {
  const source = fs.readFileSync(NOTE_EDIT_PAGE_PATH, "utf8")
  assert.match(source, /markNoteListRefresh\(\)/)
  assert.match(source, /await updateNote\(snapshot\.id, snapshot\)[\s\S]*this\.markNoteListRefresh\(\)/)
})

test("删除笔记成功后只更新本地列表，不重新请求第一页", async () => {
  let removeCalls = 0
  let listCalls = 0
  const page = loadPage(NOTE_PAGE_PATH, {
    removeNote: async () => { removeCalls += 1 },
    getNotes: async () => {
      listCalls += 1
      return { total: 0, records: [] }
    }
  })
  const instance = createPageInstance(page)
  const note = { id: 7, title: "待删除", isPinned: true }
  instance.data.notes = [note, { id: 8, title: "保留", isPinned: false }]
  instance.data.total = 2
  instance.data.scopes = [
    { key: "all", count: 2 },
    { key: "pinned", count: 1 },
    { key: "recycle", count: 0 }
  ]

  await instance.handleNoteAction(note, 1)

  assert.equal(removeCalls, 1)
  assert.equal(listCalls, 0)
  assert.deepEqual(instance.data.notes.map((item) => item.id), [8])
  assert.equal(instance.data.total, 1)
  assert.deepEqual(instance.data.scopes.map((item) => [item.key, item.count]), [["all", 1], ["pinned", 0], ["recycle", 1]])
})

test("普通用户 token 失效时清理页面内存中的旧笔记", async () => {
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async () => { throw { code: 10007, message: "登录已过期" } }
  }, { ltw_token: "stale-token" })
  const instance = createPageInstance(page)
  instance.data.notes = [{ id: 1, title: "旧笔记" }]
  instance.data.folders = [{ id: 2, name: "旧文件夹" }]
  instance.data.total = 1

  await instance.loadNotes(true)

  assert.deepEqual(instance.data.notes, [])
  assert.deepEqual(instance.data.folders, [])
  assert.equal(instance.data.total, 0)
  assert.equal(instance.data.error, "登录已过期")
})

test("没有普通用户 token 时提供个人中心登录入口", async () => {
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async () => { throw { code: 10010, message: "请先登录后再尝试" } }
  })
  const instance = createPageInstance(page)
  const switchCalls = []
  global.wx.switchTab = (options) => switchCalls.push(options)

  await instance.loadNotes(true)
  instance.handleErrorAction()

  assert.equal(instance.data.errorActionText, "去登录")
  assert.equal(switchCalls.length, 1)
  assert.equal(switchCalls[0].url, "/pages/profile/index")
})

test("笔记未登录时禁止新建、整理和筛选操作", async () => {
  let createCalls = 0
  const page = loadPage(NOTE_PAGE_PATH, {
    createNote: async () => { createCalls += 1 },
    getNotes: async () => { throw { code: 10010, message: "未登录" } }
  })
  const instance = createPageInstance(page)
  await instance.loadNotes(true)

  instance.createNote()
  instance.openManager()
  instance.selectScope({ currentTarget: { dataset: { scope: "pinned" } } })
  instance.openFolderSheet()

  assert.equal(createCalls, 0)
  assert.equal(instance.data.folderSheetVisible, false)
})

test("回收站提供清空入口并调用批量清理接口", async () => {
  let clearCalls = 0
  const page = loadPage(NOTE_PAGE_PATH, {
    clearRecycleBin: async () => { clearCalls += 1 }
  })
  const instance = createPageInstance(page)
  instance.data.scope = "recycle"
  instance.data.total = 2

  instance.clearRecycleBin()

  assert.equal(instance.data.dialog.title, "清空回收站")
  assert.equal(instance.data.dialog.danger, true)
  await instance._dialogSubmit()
  assert.equal(clearCalls, 1)

  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxml"), "utf8")
  const style = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxss"), "utf8")
  assert.match(template, /scope === 'recycle' && \(total \|\| recycleFolderCount\)/)
  assert.match(template, /bindtap="clearRecycleBin"/)
  assert.match(style, /\.folder-browser__button--danger/)
})

test("笔记 API 使用清空回收站专用接口", async () => {
  const requests = []
  const api = loadNoteApi(
    async (options) => {
      requests.push(options)
      return {}
    },
    async () => "wechat-code",
    { ltw_token: "user-token" }
  )

  await api.clearRecycleBin()

  assert.deepEqual(requests, [{ url: "/note/recycle-bin", method: "DELETE" }])
})

test("全部、置顶和回收站显示对应笔记数量", async () => {
  const queries = []
  const page = loadPage(NOTE_PAGE_PATH, {
    getNotes: async (current, size, params) => {
      queries.push([current, size, params])
      return { total: params.isDeleted ? 2 : 3, records: [] }
    }
  })
  const instance = createPageInstance(page)
  instance.data.scope = "all"
  instance.data.currentFolderId = 8

  await instance.loadScopeCounts(5)

  assert.deepEqual(instance.data.scopes.map((item) => [item.key, item.count]), [["all", 5], ["pinned", 3], ["recycle", 2]])
  assert.equal(queries.length, 2)
  assert.deepEqual(queries[0], [1, 1, { isDeleted: false, isPinned: true, folderId: 8 }])
  assert.deepEqual(queries[1], [1, 1, { isDeleted: true }])

  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/index.wxml"), "utf8")
  assert.match(template, /class="note-scope__count">\{\{item\.count\}\}/)
})
