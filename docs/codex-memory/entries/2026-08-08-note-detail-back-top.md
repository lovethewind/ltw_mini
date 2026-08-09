# 笔记详情回到顶部

## 需求与处理

- 笔记详情阅读内容较长时，参考文章详情页在页面滚动超过 `600px` 后显示浮动“回到顶部”按钮。
- 阅读模式使用 `onPageScroll` 控制按钮，编辑模式自动隐藏；点击后通过 `wx.pageScrollTo` 平滑回到页面顶部。
- 按钮沿用文章页的安全区定位、日夜主题样式和渐入动画。

## 相关文件

- `pages/note/edit/index.js`
- `pages/note/edit/index.wxml`
- `pages/note/edit/index.wxss`
- `tests/note-page.test.js`
