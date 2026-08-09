const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

test("小程序打包忽略开发缓存和测试文档目录", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "project.config.json"), "utf8"))
  const ignoredFolders = config.packOptions.ignore
    .filter((item) => item.type === "folder")
    .map((item) => item.value)

  assert.deepEqual(
    ignoredFolders.filter((value) => [".git", ".gitnexus", ".idea", "docs", "tests"].includes(value)),
    [".git", ".gitnexus", ".idea", "docs", "tests"]
  )
})
