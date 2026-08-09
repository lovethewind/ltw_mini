const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const PROJECT_ROOT = path.resolve(__dirname, "..")
const HOME_PAGE_PATH = path.join(PROJECT_ROOT, "pages/index/index.js")
const HOME_TEMPLATE_PATH = path.join(PROJECT_ROOT, "pages/index/index.wxml")
const HOME_STYLE_PATH = path.join(PROJECT_ROOT, "pages/index/index.wxss")
const NOTE_UTIL_PATH = path.join(PROJECT_ROOT, "utils/note.js")
const THEME_UTIL_PATH = path.join(PROJECT_ROOT, "utils/theme.js")

function loadHomePage(createNote) {
  delete require.cache[HOME_PAGE_PATH]
  delete require.cache[THEME_UTIL_PATH]
  require.cache[NOTE_UTIL_PATH] = {
    id: NOTE_UTIL_PATH,
    filename: NOTE_UTIL_PATH,
    loaded: true,
    exports: { createNote }
  }
  const navigations = []
  global.wx = {
    getStorageSync: () => '',
    getSystemInfoSync: () => ({ theme: 'light' }),
    navigateTo: (options) => navigations.push(options),
    showToast: () => {}
  }
  let definition
  global.Page = (pageDefinition) => { definition = pageDefinition }
  require(HOME_PAGE_PATH)
  return { definition, navigations }
}

function createPageInstance(definition) {
  return {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      Object.assign(this.data, patch)
      if (callback) callback()
    }
  }
}

test("首页提供快速笔记入口并直接打开编辑页", async () => {
  const createdFolders = []
  const { definition, navigations } = loadHomePage(async (folderId) => {
    createdFolders.push(folderId)
    return 42
  })
  const instance = createPageInstance(definition)

  await instance.createQuickNote()

  assert.deepEqual(createdFolders, [undefined])
  assert.deepEqual(navigations, [{ url: "/pages/note/edit/index?id=42&created=1" }])
  assert.equal(instance.data.quickNoteCreating, false)

  const template = fs.readFileSync(HOME_TEMPLATE_PATH, "utf8")
  const style = fs.readFileSync(HOME_STYLE_PATH, "utf8")
  assert.match(template, /class="quick-note-card/)
  assert.match(template, /bindtap="createQuickNote"/)
  assert.match(template, /快速笔记/)
  assert.match(template, /NOTE · 我的笔记/)
  assert.match(template, /记下每一个/)
  assert.match(template, /随时记录灵感、想法与生活片段/)
  assert.match(style, /\.quick-note-card\s*\{[\s\S]*display:\s*flex[\s\S]*align-items:\s*center/)
})
