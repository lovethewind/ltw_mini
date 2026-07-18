function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) {
          resolve(result.code)
          return
        }
        reject(new Error('未获取到微信登录凭证'))
      },
      fail: reject
    })
  })
}

module.exports = {
  login
}
