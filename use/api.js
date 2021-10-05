const Api = require('../binance/api')
const KlineType = require('../binance/const/KlineType')
const BuySide = require('../binance/const/BuySide')
const notify = require('../notify')
const config = require('../config')

/**
 * 检查是否在趋势当中
 * @param {string} symbol
 */
async function inTrending(symbol, type, limit = 6) {
  const lines = await Api.getKlines(symbol, KlineType['3m'], { limit })
  const data = lines.map((line) => Number(line[4])) // 收盘价
  const percents = [] // k线变化率
  for (let i = 1; i < data.length; i++) {
    percents.push((data[i] - data[i - 1]) / data[i - 1])
  }
  const lastPercent = percents[percents.length - 1]
  if (type === BuySide.BUY) {
    // 买入方向
    if (lastPercent <= -config.threshold) {
      // 3min 跌去 1.5%
      return true
    }
    if (percents.filter((item) => item <= -0.005).length >= limit - 3 && lastPercent <= 0) {
      // 最近5次中3次下跌率>=0.5%，且最后一次处于下降状态
      return true
    }
  } else if (type === BuySide.SELL) {
    // 卖出方向
    if (lastPercent >= config.threshold) {
      // 3min 拉升 1.5%
      return true
    }
    if (percents.filter((item) => item >= 0.005).length >= limit - 3 && lastPercent >= 0) {
      // 最近5次中3次拉升率>=0.5%，且最后一次处于上升状态
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
  return Math.round((rateTotal / limit) * 100, 2)
}

/*********************************************************通知相关******************************************************************** */

async function notifyBuyOrderSuccess(symbol, quantity, price) {
  const content = `买入币种为：${symbol}, 买单量为：${quantity}, 买单价格为：${price}`
  await notify(content)
}

async function notifySymbolChange(trade) {
  const { symbol, quantity, buy_price, sell_price, rate } = trade
  const content = `币种价格变更：${symbol}, 买单价格为：${buy_price}, 卖单价格为：${sell_price}, 交易数量为：${quantity}, 止盈率为：${rate} %`
  await notify(content)
}

async function notifyBuyOrderFail(symbol, info) {
  const content = `买入币种为：${symbol}, 买单失败, 详细信息为: ${info}"`
  await notify(content)
}

async function notifySellOrderSuccess(symbol, quantity, price, profit) {
  const content = `卖出币种为：${symbol}, 卖单量为：${quantity}, 卖单价格为：${price}，预计盈利: ${profit} USDT`
  await notify(content)
}

async function notifySellOrderFail(symbol, info) {
  const content = `卖出币种为：${symbol}, 卖单失败, 详细信息为: ${info}`
  await notify(content)
}

async function notifyServiceError(info) {
  const content = `做多网格交易服务异常, 错误原因为: ${info}`
  await notify(content)
}

module.exports = {
  getTickerPrice,
  inTrending,
  order,
  getNewRate,

  notifyBuyOrderSuccess,
  notifySymbolChange,
  notifyBuyOrderFail,
  notifySellOrderSuccess,
  notifySellOrderFail,
  notifyServiceError,
}
