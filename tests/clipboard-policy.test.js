const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const PROJECT_ROOT = path.resolve(__dirname, "..")

/**
 * 递归读取指定目录中的业务源码。
 *
 * @param {string} directory 目标目录。
 * @returns {string} 合并后的源码。
 */
function readSourceTree(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return readSourceTree(filePath)
    if (!/\.(js|wxml)$/.test(entry.name)) return ""
    return fs.readFileSync(filePath, "utf8")
  }).join("\n")
}

test("项目不调用剪切板 API 且 Towxml 不生成复制按钮", () => {
  const businessSource = ["pages", "components", "utils", "towxml"].map((directory) => readSourceTree(path.join(PROJECT_ROOT, directory))).join("\n")
  const towxmlSource = fs.readFileSync(path.join(PROJECT_ROOT, "towxml/index.js"), "utf8")

  assert.doesNotMatch(businessSource, /wx\.(?:get|set)ClipboardData/)
  assert.doesNotMatch(towxmlSource, /appendCodeCopyButtons|h2w__copyButton|copyCode/)
})

test("文章、笔记和富文本正文支持长按选择文字", () => {
  const decodeTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "towxml/decode.wxml"), "utf8")
  const articleTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "pages/article/detail/index.wxml"), "utf8")
  const noteTemplate = fs.readFileSync(path.join(PROJECT_ROOT, "pages/note/edit/index.wxml"), "utf8")

  assert.match(decodeTemplate, /user-select="\{\{true\}\}"/)
  assert.match(articleTemplate, /article-hero__title" user-select="\{\{true\}\}"/)
  assert.match(noteTemplate, /note-reader__title" user-select="\{\{true\}\}"/)
})
