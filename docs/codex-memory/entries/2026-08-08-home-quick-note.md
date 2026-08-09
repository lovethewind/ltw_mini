# 首页快速笔记入口

## 需求与处理

- 首页新增横向“快速笔记”卡片，位于扫码验证与我的笔记快捷卡片下方，保持首页原有两列布局不变。
- 点击后直接创建未分类空白笔记并进入编辑页，使用 `created=1` 让用户立即记录；创建期间防重复点击，失败显示轻提示。
- 首页顶部 Hero 固定使用“NOTE · 我的笔记”及灵感记录文案，不再根据文章开关展示文章/心情随笔文案。

## 相关文件

- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/index/index.wxss`
- `tests/home-page.test.js`
