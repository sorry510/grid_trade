// console.log(result.data);
const config = require('./config')
const axios = require('axios')
const { dateFormat } = require('./use/utils')

async function dingding(content) {
  const data = {
    msgtype: 'text',
    text: {
      content: `[${config.dingding_word || '报警'}: ${dateFormat()}] ${content}`,
    },
    at: {
      atMobiles: ['111'],
    },
  }
  try {
    const result = await axios.post(
      `https://oapi.dingtalk.com/robot/send?access_token=${config.dingding_token}`,
      data
    )
    return result.data
  } catch (e) {
    console.log(e)
  }
}

async function notify(content, type = 'dinding') {
  let data
  switch (type) {
    case 'dinding':
      data = await dingding(content)
      break
    default:
      data = await dingding(content)
  }
  return data
}

module.exports = notify
