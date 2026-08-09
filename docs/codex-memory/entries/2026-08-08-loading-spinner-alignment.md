# 加载动画居中与放大

## 问题与处理

- 状态组件原先使用字体字符 `◌` 作为 loading 图标，真机字体基线和字形留白会造成圆环视觉偏移，尺寸也不一致。
- 改为本地 SVG 圆环，使用状态图标容器的 Flex 居中并由外层控制旋转；圆环尺寸调整为 `44rpx`，避免 Skyline 对 CSS border 圆角的渲染差异。

## 相关文件

- `components/state-view/state-view.wxml`
- `components/state-view/state-view.wxss`
- `images/loading-spinner.svg`
- `tests/note-page.test.js`
