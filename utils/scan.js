const SCAN_TYPE_MAP = {
  1: {
    title: '确认登录网站',
    description: '确认后网页端将获得该账号的登录状态。',
    unboundDescription: '当前微信尚未关联站内账号，确认后网页端将进入注册流程。'
  },
  2: {
    title: '验证原微信',
    description: '用于换绑前确认当前微信属于账号本人。',
    unboundDescription: '当前微信未绑定站内账号，无法用于原微信验证。'
  },
  3: {
    title: '绑定新微信',
    description: '确认后网页端将继续完成新微信绑定。',
    unboundDescription: '当前微信可以作为新的绑定账号。'
  },
  4: {
    title: '确认修改密码',
    description: '用于修改密码前的身份验证，小程序不会读取或修改密码。',
    unboundDescription: '当前微信未绑定站内账号，无法用于修改密码验证。'
  }
}

function normalizeScene(scene = '') {
  try {
    return decodeURIComponent(String(scene)).trim()
  } catch (error) {
    return String(scene).trim()
  }
}

function getScanType(scene) {
  const normalized = normalizeScene(scene)
  const type = Number(normalized.slice(-1))
  return SCAN_TYPE_MAP[type] ? type : 0
}

function getScanCopy(scene) {
  const type = getScanType(scene)
  return {
    type,
    ...(SCAN_TYPE_MAP[type] || {
      title: '无效二维码',
      description: '二维码内容无法识别，请返回网页重新获取。',
      unboundDescription: ''
    })
  }
}

function canConfirmUnbound(type) {
  return type === 1 || type === 3
}

function extractScene(value = '') {
  const source = String(value)
  const match = source.match(/[?&]scene=([^&#]+)/)
  if (match) return normalizeScene(match[1])
  if (/^\d{2,}$/.test(source)) return source
  return ''
}

module.exports = {
  canConfirmUnbound,
  extractScene,
  getScanCopy,
  getScanType,
  normalizeScene
}
