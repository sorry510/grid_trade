const { round } = require('mathjs')
const Api = require('../binance/api')
const KlineType = require('../binance/const/KlineType')
const BuySide = require('../binance/const/BuySide')
const notify = require('../notify')
const config = require('../config')
const { dateFormat } = require('./utils')
const author = '<sorry510sf@gmail.com>'

/**
 * 检查是否在趋势当中
 * @param {string} symbol
 */
async function inTrending(symbol, type, limit = 8) {
  const lines = await Api.getKlines(symbol, KlineType['5m'], { limit }) // 时间正序
  const data = lines.slice(0, limit - 1).map((line) => Number(line[4])) // line[4] 收盘价， 最新的 k 线小于5min，没有可用性
  const percents = [] // k线变化率，长度=limit - 2
  for (let i = 1; i < data.length; i++) {
    percents.push((data[i] - data[i - 1]) / data[i - 1])
  }
  const lastPercent = percents[percents.length - 1]
  if (type === BuySide.BUY) {
    // 买入方向
    if (lastPercent <= -config.threshold) {
      // 5min 跌去 config.threshold %
      return true
    }
    if (percents.filter((item) => item <= -0.005).length >= 3) {
      // 最近6次中3次下跌率>=config.threshold%
      return true
    }
  } else if (type === BuySide.SELL) {
    // 卖出方向
    if (lastPercent >= config.threshold) {
      // 5min 拉升 config.threshold %
      return true
    }
    if (percents.filter((item) => item >= 0.005).length >= 3) {
      // 最近6次中3次拉升率>=config.threshold%
      return true
    }
  }
  return false
}

/**
 * 获取某个交易对的最新价格
 * @param {string} symbol
 * @returns string
 */
async function getTickerPrice(symbol) {
  const data = await Api.getTickerPrice(symbol)
  return data.price
}

/**
 * 获取账户信息
 * @returns [
 *       { asset: 'BTC', free: '0.00400144', locked: '0.00000000' },
 *       { asset: 'LTC', free: '0.00000000', locked: '0.00000000' },
 *       { asset: 'ETH', free: '0.05423804', locked: '0.00000000' },
 *       { asset: 'NEO', free: '0.00000000', locked: '0.00000000' },
 *       { asset: 'BNB', free: '0.56369471', locked: '0.00000000' },
 *     ]
 */
async function getAccount() {
  const data = await Api.getAccount()
  return data.balances
}

/**
 * 获取账户的usdt可用数量
 * @returns number
 */
async function getWalletUsdt() {
  const data = await getAccount()
  const usdtInfo = data.find((item) => item.asset === 'USDT')
  return usdtInfo ? usdtInfo.free : 0
}

/**
 * 现货下订单(最小下单 price* quantity >=10 usdt)
 *
 * POST /api/v3/order
 *
 * {@link https://binance-docs.github.io/apidocs/spot/cn/#new-order-trade}
 *
 * @param {string} symbol
 * @param {string} side - BuySide.js
 * @param {string} type - OrderType.js
 * @param {object} [options]
 * @param {string} [options.timeInForce] - TimeInForce.js
 * @param {number} [options.quantity] - 交易量
 * @param {number} [options.quoteOrderQty]
 * @param {number} [options.price] - 单价
 * @param {string} [options.newClientOrderId]
 * @param {number} [options.stopPrice]
 * @param {number} [options.icebergQty]
 * @param {string} [options.newOrderRespType] -设置响应JSON。 ACK，RESULT或FULL； "MARKET"和" LIMIT"订单类型默认为"FULL"，所有其他订单默认为"ACK"。
 * @param {number} [options.recvWindow] - 窗口活动期，建议小于5000
 *
 */
async function order(symbol, side, type, options = {}) {
  const data = await Api.order(symbol, side, type, {
    recvWindow: config.recv_window,
    ...options,
  })
  return data
}

/**
 * 更新收益比率
 * @param {*} symbol
 * @param {*} interval
 * @param {*} limit
 */
async function getNewRate(symbol, interval = '4h', limit = 40) {
  const lines = await Api.getKlines(symbol, interval, { limit })
  let rateTotal = 0
  for (let i = 0; i < lines.length; i++) {
    rateTotal += Math.abs(Number(lines[i][3]) - Number(lines[i][2])) / Number(lines[i][4]) // (最高价 - 最低价) / 收盘价
  }
  return round((rateTotal / limit) * 100, 2)
}

/*********************************************************通知相关******************************************************************** */

async function notifySymbolChange(trade) {
  const { symbol, quantity, buy_price, sell_price, rate } = trade
  const text = `## 交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">价格变更</font>
  #### **买单价格**：<font color="#008000">${round(buy_price, 6)}</font>
  #### **卖单价格**：<font color="#008000">${round(sell_price, 6)}</font>
  #### **交易数量**：<font color="#008000">${round(quantity, 6)}</font>
  #### **止盈率**：<font color="#008000">${round(rate, 2)}%</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyBuyOrderSuccess(symbol, quantity, price) {
  const text = `## 交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#008000">买单</font>
  #### **买单价格**：<font color="#008000">${round(price, 6)}</font>
  #### **买单数量**：<font color="#008000">${round(quantity, 6)}</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyBuyOrderFail(symbol, info) {
  const text = `## 交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">买单失败</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifySellOrderSuccess(symbol, quantity, price, profit) {
  const text = `## 交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">卖单</font>
  #### **卖单价格**：<font color="#008000">${round(price, 6)}</font>
  #### **卖单数量**：<font color="#008000">${round(quantity, 6)}</font>
  #### **预计盈利**：<font color="#008000">${round(profit, 6)} USDT</font>
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifySellOrderFail(symbol, info) {
  const text = `## 交易通知
  #### **币种**：${symbol}
  #### **类型**：<font color="#ff0000">卖单失败</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

async function notifyServiceError(info) {
  const text = `## 交易通知
  #### **类型**：<font color="#ff0000">交易服务异常</font>
  >${info}
  
  #### **时间**：${dateFormat()}

  > author ${author}`
  await notify(text)
}

module.exports = {
  getTickerPrice,
  inTrending,
  order,
  getNewRate,
  getAccount,
  getWalletUsdt,

  notifyBuyOrderSuccess,
  notifySymbolChange,
  notifyBuyOrderFail,
  notifySellOrderSuccess,
  notifySellOrderFail,
  notifyServiceError,
}
;(async () => {
  console.log(JSON.stringify(await getWalletUsdt()))
})()
