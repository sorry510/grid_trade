const logger = function (req, res, next) {
  console.log('LOGGED')
  next()
}

module.exports = logger
