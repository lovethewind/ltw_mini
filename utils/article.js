const { request } = require('./request')

let categoriesPromise = null
let tagsPromise = null

function getArticleList(page = 1, size = 10, params = {}) {
  return request({
    url: `/article/common/list/${page}/${size}`,
    data: params
  })
}

function getArticleDetail(articleId) {
  return request({
    url: `/article/common/find/${articleId}`
  })
}

function addArticleViewCount(articleId) {
  return request({
    url: '/article/common/addViewCount',
    method: 'POST',
    data: {
      articleId
    }
  })
}

/**
 * 获取并缓存文章分类列表，请求失败后允许下次重试。
 *
 * @returns {Promise<Array<Record<string, any>>>} 分类列表。
 */
function getCategories() {
  if (!categoriesPromise) {
    categoriesPromise = request({
      url: '/category/common/findAll'
    }).catch((error) => {
      categoriesPromise = null
      throw error
    })
  }
  return categoriesPromise
}

/**
 * 获取文章标签元数据。
 *
 * @returns {Promise<{nodes: Array<Record<string, any>>, records: Array<Record<string, any>>}>} 标签树与标签列表。
 */
function getTags() {
  if (!tagsPromise) {
    tagsPromise = request({
      url: '/tag/common/findAll'
    }).catch((error) => {
      tagsPromise = null
      throw error
    })
  }
  return tagsPromise
}

module.exports = {
  addArticleViewCount,
  getCategories,
  getArticleDetail,
  getArticleList,
  getTags
}
