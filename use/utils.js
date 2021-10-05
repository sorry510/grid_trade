async function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

function dateFormat(format = 'Y-m-d H:i:s') {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDay()
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

function log(text) {
  if (typeof text === 'object') {
    console.log(`${dateFormat()}: ${JSON.stringify(text)}`)
  } else {
    console.log(`${dateFormat()}: ${text}`)
  }
}

module.exports = {
  sleep,
  dateFormat,
  log,
}
