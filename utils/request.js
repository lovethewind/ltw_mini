const SUCCESS_CODE = 200
const { getToken } = require('./auth')

function request(options) {
  const app = getApp()
  const baseUrl = app.globalData.apiBaseUrl
  const token = getToken()

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 15000,
      header: {
        'content-type': 'application/json',
        ...(token ? { web_token: token } : {}),
        ...(options.header || {})
      },
      success(response) {
        const result = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300 && result.code === SUCCESS_CODE) {
          resolve(result.data)
          return
        }
        reject({
          code: result.code || response.statusCode,
          message: result.message || '请求失败，请稍后重试',
          data: result.data
        })
      },
      fail(error) {
        reject({
          code: -1,
          message: error.errMsg && error.errMsg.includes('timeout') ? '请求超时，请稍后重试' : '网络连接失败，请检查网络',
          data: error
        })
      }
    })
  })
}

module.exports = {
  request
}
