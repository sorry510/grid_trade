function resJson(code = 200, msg, data) {
  if (typeof msg === 'object') {
    data = msg
    msg = 'success'
  }
  return {
    code,
    msg,
    data,
  }
}

module.exports = {
  resJson,
}
