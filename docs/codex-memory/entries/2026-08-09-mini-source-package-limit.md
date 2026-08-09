# 小程序源码包超限

微信开发者工具统计源码包时会包含未忽略的 `.gitnexus` 缓存、`.idea`、文档和测试目录，导致 5.5MB 超过 2MB 限制。通过 `project.config.json` 的 `packOptions.ignore` 排除开发目录，不删除本地文件。
