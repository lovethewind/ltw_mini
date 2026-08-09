const { request: rawRequest } = require('./request')
const { clearToken, getToken } = require('./auth')

const AUTH_ERROR_CODES = [10007, 10010, 11002]

/**
 * 获取当前小程序保存的普通用户 token。
 *
 * @returns {string} 站内访问令牌。
 */
function ensureUserSession() {
  const token = getToken()
  if (!token) throw { code: 10010, message: '请先登录后再查看笔记' }
  return token
}

/**
 * 执行需要普通用户登录 token 的笔记请求。
 *
 * @param {Record<string, any>} options 请求参数。
 * @returns {Promise<any>} 接口返回数据。
 */
async function request(options) {
  ensureUserSession()
  try {
    return await rawRequest(options)
  } catch (error) {
    if (AUTH_ERROR_CODES.includes(Number(error.code))) {
      clearToken()
    }
    throw error
  }
}

function getNotes(page = 1, size = 50, params = {}) {
  return request({ url: `/note/list/${page}/${size}`, data: params })
}

function getNote(noteId) {
  return request({ url: `/note/${noteId}` })
}

/**
 * 在指定文件夹中创建空白笔记。
 *
 * @param {number|null} folderId 目标文件夹 ID。
 * @returns {Promise<number>} 新建笔记 ID。
 */
function createNote(folderId = null) {
  return request({ url: '/note', method: 'POST', data: { folderId } })
}

function getFolders(isDeleted = false) {
  return request({ url: '/note-folder/list', data: { isDeleted } })
}

function getTags() {
  return request({ url: '/note-tag/list' })
}

/**
 * 在指定父级下创建文件夹。
 *
 * @param {string} name 文件夹名称。
 * @param {number|null} parentId 父文件夹 ID。
 * @returns {Promise<Record<string, any>>} 新建文件夹。
 */
function createFolder(name, parentId = null) {
  return request({ url: '/note-folder', method: 'POST', data: { name, parentId } })
}

function renameFolder(folderId, name) {
  return request({ url: `/note-folder/${folderId}`, method: 'PUT', data: { name, parentId: null } })
}

function removeFolder(folderId) {
  return request({ url: `/note-folder/${folderId}`, method: 'DELETE' })
}

function createTag(name) {
  return request({ url: '/note-tag', method: 'POST', data: { name } })
}

function renameTag(tagId, name) {
  return request({ url: `/note-tag/${tagId}`, method: 'PUT', data: { name } })
}

function removeTag(tagId) {
  return request({ url: `/note-tag/${tagId}`, method: 'DELETE' })
}

function setNotePinned(noteId, isPinned) {
  return request({ url: `/note/${noteId}/pin`, method: 'PUT', data: { isPinned } })
}

function removeNote(noteId) {
  return request({ url: `/note/${noteId}`, method: 'DELETE' })
}

function restoreNote(noteId) {
  return request({ url: `/note/${noteId}/restore`, method: 'PUT' })
}

function permanentlyDeleteNote(noteId) {
  return request({ url: `/note/${noteId}/permanent`, method: 'DELETE' })
}

/**
 * 永久清空当前账号的笔记回收站。
 *
 * @returns {Promise<any>} 接口响应。
 */
function clearRecycleBin() {
  return request({ url: '/note/recycle-bin', method: 'DELETE' })
}

function getNoteHistories(noteId, page = 1, size = 50) {
  return request({ url: `/note/${noteId}/history/list/${page}/${size}` })
}

function getNoteHistory(noteId, historyId) {
  return request({ url: `/note/${noteId}/history/${historyId}` })
}

function restoreNoteHistory(noteId, historyId) {
  return request({ url: `/note/${noteId}/history/${historyId}/restore`, method: 'PUT' })
}

function deleteNoteHistory(noteId, historyId) {
  return request({ url: `/note/${noteId}/history/${historyId}`, method: 'DELETE' })
}

function updateNote(noteId, note) {
  return request({
    url: `/note/${noteId}`,
    method: 'PUT',
    data: {
      title: note.title || '',
      content: note.content || '',
      folderId: note.folderId || null,
      tagIds: (note.tagList || []).map((tag) => tag.id)
    }
  })
}

module.exports = {
  createFolder,
  createNote,
  createTag,
  clearRecycleBin,
  deleteNoteHistory,
  ensureUserSession,
  ensureNoteSession: ensureUserSession,
  getFolders,
  getNote,
  getNoteHistories,
  getNoteHistory,
  getNotes,
  getTags,
  permanentlyDeleteNote,
  removeFolder,
  removeNote,
  removeTag,
  renameFolder,
  renameTag,
  restoreNote,
  restoreNoteHistory,
  setNotePinned,
  updateNote
}
