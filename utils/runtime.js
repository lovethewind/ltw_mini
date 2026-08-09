const { request } = require('./request')

const CONTENT_RENDER_COMPATIBILITY_KEY = 'render.compatibility'
let articleCompatibilityPromise = null

/**
 * 判断当前小程序是否允许渲染文章正文；未配置或请求异常时默认关闭。
 *
 * @returns {Promise<boolean>} 是否允许展示文章正文。
 */
async function isArticleContentCompatible() {
  if (!articleCompatibilityPromise) {
    articleCompatibilityPromise = request({
      url: `/config/common/detail/${CONTENT_RENDER_COMPATIBILITY_KEY}`
    })
      .then((value) => String(value).trim().toLowerCase() === 'true')
      .catch(() => false)
  }
  return articleCompatibilityPromise
}

module.exports = { isArticleContentCompatible }
