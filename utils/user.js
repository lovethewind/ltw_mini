const { request } = require('./request')

function getWechatUserInfo(code) {
  return request({
    url: '/user/common/wechat/userInfo',
    method: 'POST',
    data: {
      code
    }
  })
}

function getUserInfo() {
  return request({
    url: '/user/info'
  })
}

function loginUser(username, password) {
  return request({
    url: '/user/common/login',
    method: 'POST',
    data: { username, password }
  })
}

function loginWechatUser(code) {
  return request({
    url: '/user/common/wechat/login',
    method: 'POST',
    data: { code }
  })
}

function registerWechatUser(username, password, nickname, code) {
  const data = { username, password, nickname: nickname || username, code }
  return request({
    url: '/user/common/wechat/appletRegister',
    method: 'POST',
    data
  })
}

function checkUsernameExists(username) {
  return request({
    url: '/common/common/validAccountExists',
    method: 'POST',
    data: { username }
  })
}

function confirmWechatScan(code, state) {
  return request({
    url: '/user/common/wechat/scanCallback',
    method: 'POST',
    data: {
      code,
      state
    }
  })
}

/**
 * 取消尚未确认的网站二维码扫码操作。
 *
 * @param {string} code 服务器生成的二维码随机码。
 * @param {string} state 微信临时登录凭证。
 * @returns {Promise<void>} 取消完成。
 */
function cancelWechatScan(code, state) {
  return request({
    url: '/user/common/wechat/scanCancel',
    method: 'POST',
    data: {
      code,
      state
    }
  })
}

/**
 * 通知网站二维码已被有效微信扫描，等待用户确认。
 *
 * @param {string} code 服务器生成的二维码随机码。
 * @param {string} state 微信临时登录凭证。
 * @returns {Promise<void>} 通知完成。
 */
function notifyWechatScan(code, state) {
  return request({
    url: '/user/common/wechat/scanNotify',
    method: 'POST',
    data: {
      code,
      state
    }
  })
}

module.exports = {
  cancelWechatScan,
  checkUsernameExists,
  confirmWechatScan,
  getUserInfo,
  getWechatUserInfo,
  loginUser,
  loginWechatUser,
  registerWechatUser,
  notifyWechatScan
}
