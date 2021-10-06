// console.log(result.data);
const config = require('./config')
const axios = require('axios')

async function dingding(text) {
  data = {
    msgtype: 'markdown',
    markdown: {
      title: `${config.dingding_word}`, // 首屏会话透出的展示内容
      text: text,
    },
    at: {
      atMobiles: ['1'],
    },
  }

  if (config.dingding_token == '') {
    return '尚未开启钉钉推送'
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

async function notify(text, type = 'dinding') {
  let data
  switch (type) {
    case 'dinding':
      data = await dingding(text)
      break
    default:
      data = await dingding(text)
  }
  return data
}

module.exports = notify

// const text = `## 交易通知
// #### **币种**：ETHUSDT
// #### **类型**：<font color="#ff0000">买单</font>
// #### **买入价格**：<font color="#008000">45000.23</font>
// #### **买入量**：<font color="#008000">0.23</font>
// #### **时间**：2020-12-12 23:21:92

// > author <sorry510sf@gmail.com>`

// const text = `## 交易通知
// #### **币种**：ETHUSDT
// #### **类型**：<font color="#ff0000">买单失败</font>
// >账户余额不足

// #### **时间**：2020-12-12 23:21:92

// > author <sorry510sf@gmail.com>`
// notify(text)
