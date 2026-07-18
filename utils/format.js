function formatDate(value) {
  if (!value) return ''
  const normalized = String(value).replace(/-/g, '/')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)

  const diff = Date.now() - date.getTime()
  if (diff >= 0 && diff < 60 * 1000) return '刚刚'
  if (diff >= 0 && diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff >= 0 && diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 清理 HTML 与 Markdown 标记，生成适合列表展示的纯文本。
 *
 * @param {string} value 原始文章内容。
 * @returns {string} 清理后的纯文本。
 */
function stripHtml(value = '') {
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`\[\]()!-]/g, ' ')
    .replace(/(^|\s)\d+[.)、]\s*(?=[A-Za-z\u4e00-\u9fff])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 将站内媒体地址规范化为 HTTPS。
 *
 * @param {string} value 原始媒体地址。
 * @returns {string} 规范化后的媒体地址。
 */
function normalizeMediaUrl(value = '') {
  return String(value).replace(/^http:\/\/((?:[\w-]+\.)*lovethewind\.cn)/i, 'https://$1')
}

/**
 * 规范化文章正文中的站内媒体地址和图片尺寸。
 *
 * @param {string} value 原始文章正文。
 * @returns {string} 规范化后的文章正文。
 */
function normalizeArticleContent(value = '') {
  return String(value)
    .replace(/http:\/\/((?:[\w-]+\.)*lovethewind\.cn)/gi, 'https://$1')
    .replace(/<img(?![^>]*style=)/gi, '<img style="max-width:100%;height:auto;"')
}

/**
 * 规范化文章列表展示数据。
 *
 * @param {Record<string, any>} article 原始文章数据。
 * @returns {Record<string, any>} 可直接用于文章卡片的数据。
 */
function normalizeArticle(article) {
  const content = stripHtml(article.summary || article.content || '')
  return {
    ...article,
    displayTime: formatDate(article.createTime),
    summary: content.length > 52 ? `${content.slice(0, 52)}…` : content,
    displayCover: normalizeMediaUrl(article.coverThumb || article.cover || '')
  }
}

module.exports = {
  formatDate,
  normalizeArticle,
  normalizeArticleContent,
  normalizeMediaUrl,
  stripHtml
}
