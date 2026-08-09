# 笔记列表局部更新与下拉刷新

## 问题与处理

- 删除、恢复、置顶等操作完成后不再重新请求第一页或显示整页 loading，接口成功后直接更新当前列表和范围数量。
- 笔记页 `onShow` 不再自动刷新；首屏初始化和用户下拉刷新仍会请求，搜索、范围切换及分页按对应操作请求。
- 列表使用内部 `scroll-view`，因此下拉刷新绑定 `refresher-enabled`、`refresher-triggered` 和 `bindrefresherrefresh`，不能只依赖页面级 `onPullDownRefresh`。
- 页面配置开启下拉刷新，并在结束后关闭系统下拉状态。

## 相关文件

- `pages/note/index.js`、`pages/note/index.json`
- `tests/note-page.test.js`
