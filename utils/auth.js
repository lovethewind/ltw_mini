const TOKEN_KEY = 'ltw_token'
const LEGACY_NOTE_TOKEN_KEY = 'ltw_note_token'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY)
}

function saveToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.removeStorageSync(LEGACY_NOTE_TOKEN_KEY)
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(LEGACY_NOTE_TOKEN_KEY)
}

module.exports = {
  clearToken,
  getToken,
  saveToken,
  TOKEN_KEY
}
