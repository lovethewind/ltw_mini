# 移除主动剪切板能力

## 需求背景

小程序审核可能将主动读写剪切板识别为高风险行为，因此项目不再提供一键复制能力，改由用户长按选择页面文字后使用系统菜单复制。

## 本次处理

- 删除文章代码块复制按钮、剪切板授权引导及 `wx.setClipboardData` 调用。
- Towxml 不再生成代码复制按钮，文章和笔记渲染配置不再开启 `copyCode`。
- Towxml 普通文本节点和 `text` 节点开启 `user-select`，文章标题、笔记标题同步支持长按选择。
- 保留正文图片点击预览，不影响已有阅读功能。
- 增加 `tests/clipboard-policy.test.js`，防止后续重新引入剪切板 API 或复制按钮。

## 相关文件

- `pages/article/detail/index.js`
- `pages/article/detail/index.wxml`
- `pages/note/edit/index.js`
- `pages/note/edit/index.wxml`
- `towxml/index.js`
- `towxml/decode.wxml`
- `tests/clipboard-policy.test.js`
