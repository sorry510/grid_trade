const config = require('../config')
const { Spot } = require('@binance/connector')
const client = new Spot(config.api_key, config.api_secret)
const process = require('process')

/**
 * 获取现货账号信息
 * @returns {}
 * @example
 * {
 *     makerCommission: 10,
 *     takerCommission: 10,
 *     buyerCommission: 0,
 *     sellerCommission: 0,
 *     canTrade: true,
 *     canWithdraw: true,
 *     canDeposit: true,
 *     updateTime: 1633319935472,
 *     accountType: 'SPOT',
 *     balances: [
 *       { asset: 'BTC', free: '0.00400144', locked: '0.00000000' },
 *       { asset: 'LTC', free: '0.00000000', locked: '0.00000000' },
 *       { asset: 'ETH', free: '0.05423804', locked: '0.00000000' },
 *       { asset: 'NEO', free: '0.00000000', locked: '0.00000000' },
 *       { asset: 'BNB', free: '0.56369471', locked: '0.00000000' },
 *     ],
 *     permissions: [ 'SPOT' ]
 * }
 */
async function getAccount() {
  const res = await client.account()
  return res.data
}

/**
 * 钱包数据(不知道是那个钱包)
 * POST /sapi/v1/asset/get-funding-asset<br>
 *
 * {@link https://binance-docs.github.io/apidocs/spot/en/#funding-wallet-user_data}
 *
 * @param {object} [options]
 * @param {string} [options.asset]
 * @param {string} [options.needBtcValuation] - true or false
 * @param {number} [options.recvWindow] - The value cannot be greater than 60000
 */
async function fundingWallet(options) {
  const res = await client.fundingWallet(options)
  return res
}

async function ping() {
  await client.ping()
}

/**
 * 获取服务器时间 毫秒
 * @returns number
 */
async function getServerTime() {
  const res = await client.time()
  return res.data.serverTime
}

/**
 * 获取 k 线图
 * @param {string} symbol
 * @param {string} interval - KlineType.js
 * @param {object} [options]
 * @param {number} [options.startTime] - 毫秒
 * @param {number} [options.endTime] - 毫秒
 * @param {number} [options.limit] - Default 500; max 1000.
 * @returns [[]]
 * @example
 * [
 *   [
 *     1499040000000,      // 开盘时间
 *     "0.01634790",       // 开盘价
 *     "0.80000000",       // 最高价
 *     "0.01575800",       // 最低价
 *     "0.01577100",       // 收盘价(当前K线未结束的即为最新价)
 *     "148976.11427815",  // 成交量
 *     1499644799999,      // 收盘时间
 *     "2434.19055334",    // 成交额
 *     308,                // 成交笔数
 *     "1756.87402397",    // 主动买入成交量
 *     "28.46694368",      // 主动买入成交额
 *     "17928899.62484339" // 请忽略该参数
 *   ]
 * ]
 */
async function getKlines(symbol, interval, options = { limit: 100 }) {
  const res = await client.klines(symbol, interval, options)
  return res.data
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
 * @return @example
 * {
 *    "symbol": "BTCUSDT", // 交易对
 *    "orderId": 28, // 系统的订单ID
 *    "orderListId": -1, // OCO订单ID，否则为 -1
 *    "clientOrderId": "6gCrw2kRUAF9CvJDGP16IP", // 客户自己设置的ID
 *    "transactTime": 1507725176595, // 交易的时间戳
 *    "price": "0.00000000", // 订单价格
 *    "origQty": "10.00000000", // 用户设置的原始订单数量
 *    "executedQty": "10.00000000", // 交易的订单数量
 *    "cummulativeQuoteQty": "10.00000000", // 累计交易的金额
 *    "status": "FILLED", // 订单状态
 *    "timeInForce": "GTC", // 订单的时效方式
 *    "type": "MARKET", // 订单类型， 比如市价单，现价单等
 *    "side": "SELL", // 订单方向，买还是卖
 *    "fills": [ // 订单中交易的信息
 *      {
 *        "price": "4000.00000000", // 交易的价格
 *        "qty": "1.00000000", // 交易的数量
 *        "commission": "4.00000000", // 手续费金额
 *        "commissionAsset": "USDT" // 手续费的币种
 *      },
 *      {
 *        "price": "3999.00000000",
 *        "qty": "5.00000000",
 *        "commission": "19.99500000",
 *        "commissionAsset": "USDT"
 *      },
 *      {
 *        "price": "3998.00000000",
 *        "qty": "2.00000000",
 *        "commission": "7.99600000",
 *        "commissionAsset": "USDT"
 *      },
 *      {
 *        "price": "3997.00000000",
 *        "qty": "1.00000000",
 *        "commission": "3.99700000",
 *        "commissionAsset": "USDT"
 *      },
 *      {
 *        "price": "3995.00000000",
 *        "qty": "1.00000000",
 *        "commission": "3.99500000",
 *        "commissionAsset": "USDT"
 *      }
 *    ]
 *  }
 */
async function order(symbol, side, type, options) {
  const res = await client.newOrder(symbol, side, type, options)
  return res.data
}

/**
 * 现货测试下订单(最小下单 price* quantity >=10 usdt)
 *
 * POST /api/v3/order/test
 *
 * {@link https://binance-docs.github.io/apidocs/spot/cn/#test-new-order-trade}
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
 * @param {string} [options.newOrderRespType]
 * @param {number} [options.recvWindow] - 窗口活动期，建议小于5000
 */
async function orderTest(symbol, side, type, options) {
  // console.log(symbol, side, type, options)
  // process.exit()
  const res = await client.newOrderTest(symbol, side, type, options)
  return res.data
}

/**
 * 获取最新价格
 * GET /api/v3/ticker/price
 * @param {*} symbol
 * @returns
 * {
 *  "symbol": "LTCBTC",
 *  "price": "4.00000200"
 * }
 */
async function getTickerPrice(symbol) {
  const res = await client.tickerPrice(symbol)
  return res.data
}

/**
 * 获取所有的交易对信息
 * @returns example [
 *   {
 *     "symbol": "LTCBTC",
 *     "price": "4.00000200"
 *   },
 *   {
 *     "symbol": "ETHBTC",
 *     "price": "0.07946600"
 *   }
 * ]
 */
async function getTickets() {
  const res = await client.publicRequest('GET', '/api/v3/ticker/price')
  return res.data
}

module.exports = {
  client,
  ping,
  getAccount,
  fundingWallet,
  getServerTime,
  getKlines,
  getTickerPrice,
  getTickets,
  order,
  orderTest,
}

// if (__filename === process.mainModule.filename) {
//   ;(async () => {
//     // MARKET 模式一直报 400 错误
//     // const { price } = await getTickerPrice('SHIBUSDT')
//     // console.log(price)
//     const res = await order('BTCUSDT', 'BUY', 'LIMIT', {
//       // price,
//       price: 45666.22,
//       recvWindow: 4000,
//       timeInForce: 'GTC',
//       quantity: 1,
//     })
//     console.log(res)
//   })()
// }
// ;(async () => {
//   console.log(await getKlines('BTCUSDT', '3m', { limit: 6 }))
// })()
