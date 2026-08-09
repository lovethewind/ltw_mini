const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const PROJECT_ROOT = path.resolve(__dirname, "..")

test("用户页显式传入 loading 状态并使用统一圆环", () => {
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.wxml"), "utf8")
  const stateTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "components/state-view/state-view.wxml"), "utf8")
  const stateScript = fs.readFileSync(path.join(PROJECT_ROOT, "components/state-view/state-view.js"), "utf8")

  assert.match(template, /type="loading"\s+loading="\{\{true\}\}"/)
  assert.match(stateScript, /loading:\s*\{\s*type:\s*Boolean/)
  assert.match(stateTemplate, /loading \|\| type === 'loading'/)
  assert.match(stateTemplate, /class="state-view__spinner"/)
})

test("用户未绑定时保留绑定引导而不是显示加载失败", () => {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.js"), "utf8")
  assert.match(source, /\[11002,\s*11013\]\.includes\(Number\(error\.code\)\)/)
})

test("用户页按普通 token 或微信登录态获取资料，并提供登录退出入口", () => {
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.wxml"), "utf8")
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.js"), "utf8")
  const userUtil = fs.readFileSync(path.join(PROJECT_ROOT, "utils/user.js"), "utf8")

  assert.match(source, /const token = getToken\(\)/)
  assert.match(source, /token\s*\?\s*await getUserInfo\(\)\s*:\s*await getWechatUserInfo\(await login\(\)\)/)
  assert.match(source, /saveToken\(result\.token\)/)
  assert.match(source, /async submitLogin\(\)/)
  assert.match(source, /clearToken\(\)/)
  assert.match(template, /bindtap="openLogin"/)
  assert.match(template, /bindtap="logout"/)
  assert.match(userUtil, /function loginUser\(username, password\)/)
  assert.match(userUtil, /function loginWechatUser\(code\)/)
  assert.match(source, /async wechatLogin\(\)/)
  const loginMethod = source.match(/async submitLogin\(\) \{[\s\S]*?\n  \},\n\n  async wechatLogin/)?.[0] || ''
  assert.doesNotMatch(loginMethod, /密码需为6-30个字符|password\.length\s*[<>=]/)
  assert.match(template, /value="\{\{loginForm\.password\}\}" password placeholder="密码"/)
})

test("未绑定用户可在微信内填写用户名、密码和选填昵称注册", () => {
  const template = fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.wxml"), "utf8")
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.js"), "utf8")
  const userUtil = fs.readFileSync(path.join(PROJECT_ROOT, "utils/user.js"), "utf8")
  assert.match(template, /bindtap="openRegister"/)
  assert.match(template, /placeholder="用户名（3-20个字符）"/)
  assert.match(template, /bindblur="checkRegisterUsername"/)
  assert.match(template, /该用户名已存在，请更换/)
  assert.match(template, /placeholder="密码（6-30个字符）"/)
  assert.match(template, /placeholder="昵称（选填，默认使用用户名）"/)
  assert.doesNotMatch(template, /再次输入密码/)
  assert.doesNotMatch(source, /confirmPassword/)
  assert.match(template, /class="bind-route__path bind-route__path--login">点击填写用户名和密码，登录后查看笔记<\/text>/)
  assert.match(fs.readFileSync(path.join(PROJECT_ROOT, "pages/profile/index.wxss"), "utf8"), /\.bind-route__path--login\s*\{[^}]*color:\s*#d9363e/)
  assert.match(template, /class="bind-route__path bind-route__path--new">点击填写用户名和密码，完成注册<\/text>/)
  assert.match(template, /填写用户名和密码，完成注册/)
  assert.match(template, /bindtap="submitRegister"/)
  assert.match(source, /registerWechatUser\(username, password, nickname, code\)/)
  assert.match(source, /checkUsernameExists\(username\)/)
  assert.match(userUtil, /nickname: nickname \|\| username/)
  assert.match(source, /saveToken\(result\.token\)/)
  assert.match(source, /noteRefreshRequested = true/)
  assert.match(source, /profileRefreshRequested = true/)
  assert.match(source, /profileRefreshRequested\)\s*\{[\s\S]*loadProfile\(\)/)
})

test("所有页面的 loading 状态统一显式使用 CSS 圆环", () => {
  const pageFiles = [
    "pages/article/list/index.wxml",
    "pages/article/detail/index.wxml",
    "pages/index/index.wxml",
    "pages/note/edit/index.wxml",
    "pages/note/index.wxml",
    "pages/note/manage/index.wxml",
    "pages/profile/index.wxml",
    "pages/scan/confirm/index.wxml"
  ]

  pageFiles.forEach((relativePath) => {
    const template = fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8")
    let cursor = template.indexOf('type="loading"')
    while (cursor >= 0) {
      const usage = template.slice(cursor, cursor + 140)
      assert.match(usage, /loading="\{\{true\}\}"/, relativePath)
      cursor = template.indexOf('type="loading"', cursor + 1)
    }
  })
})
