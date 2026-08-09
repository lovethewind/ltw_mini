# 全局加载图标统一

## 问题与处理

- 部分 Skyline/真机环境下页面没有稳定命中状态组件的 `type="loading"` 分支，显示成方形默认图标；笔记详情页正常是因为当时命中了正确分支。
- 状态组件增加显式 `loading` 布尔属性，所有页面统一传入 `loading="{{true}}"`，强制使用同一个 CSS 圆环；其他空态仍保留原有图标。

## 相关文件

- `components/state-view/state-view.js`
- `components/state-view/state-view.wxml`
- `pages/*/index.wxml`
- `tests/profile-page.test.js`
