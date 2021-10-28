const { round } = require('mathjs')

async function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

function dateFormat(format = 'Y-m-d H:i:s') {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return format
    .replace('Y', year)
    .replace('m', month.toString().padStart(2, 0))
    .replace('d', day.toString().padStart(2, 0))
    .replace('H', hour.toString().padStart(2, 0))
    .replace('i', minute.toString().padStart(2, 0))
    .replace('s', second.toString().padStart(2, 0))
}

function log(text, flag = true) {
  if (!flag) {
    return
  }
  if (typeof text === 'object') {
    console.log(`${dateFormat()}: ${JSON.stringify(text)}`)
  } else {
    console.log(`${dateFormat()}: ${text}`)
  }
}

/**
 * 可以正确交易的价格，否则就会返回 400 错误
 * @param {*} price
 * @returns Number
 */
function canTradePrice(price) {
  if (price > 1000) {
    return round(price, 1)
  } else if (price > 10) {
    return round(price, 2)
  } else if (price > 1) {
    return round(price, 3)
  } else if (price > 0.1) {
    return round(price, 4)
  } else {
    return round(price, 5)
  }
}

module.exports = {
  sleep,
  dateFormat,
  log,
  canTradePrice,
}
