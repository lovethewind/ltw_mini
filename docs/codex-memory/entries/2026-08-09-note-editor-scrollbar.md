# 笔记编辑页双滚动条修复

## 问题

编辑页在 `page-shell` 上保留 `min-height: 100vh`，同时原生 `textarea` 自己滚动。长正文滑动时页面和编辑框各出现一条滚动条，右侧会显示很长的外层滚动条。

## 修复

- 编辑状态将 `note-edit-shell` 改为扣除顶部导航后的固定高度并隐藏外层溢出。
- 编辑器使用纵向 flex 布局，让 `textarea` 占据剩余空间并承担正文滚动。
- 长正文二次写入后显式恢复 `cursorPosition`，避免原生组件把编辑视图重置到正文末尾。

## 关联文件

- `pages/note/edit/index.wxss`
- `tests/note-page.test.js`
