const fs = require('fs')
const process = require('process')
const tradeFile = './data/trade.json'
const Api = require('./use/api')
const config = require('./config')
const { sleep, log, dateFormat, canTradePrice } = require('./use/utils')
const BuySide = require('./binance/const/BuySide')
const OrderType = require('./binance/const/OrderType')
const KlineType = require('./binance/const/KlineType')
const TimeInForce = require('./binance/const/TimeInForce')
const { round } = require('mathjs')

const flag = config.log || false // 是否输出日志

async function init() {
  let result = false // 执行结果

  let tradeList = fs.readFileSync('./data/trade.json', {
    encoding: 'utf8',
  })
  try {
    tradeList = JSON.parse(tradeList)
  } catch (e) {
    log('./data/trade.json 文件已损坏，请修复后再使用', flag)
    Api.notifyServiceError('./data/trade.json 文件已损坏，请修复后再使用')
    await sleep(3600 * 1000) // 避免使用守护进程时导致的无限重启
    process.exit()
  }

  if (tradeList.filter((item) => item.buy_open).length > 50) {
    log('正在运行的交易对数量不能超过50个,否则可能会造成请求过多被封ip', flag)
    Api.notifyServiceError('正在运行的交易对数量不能超过50个,否则可能会造成请求过多被封ip')
    await sleep(3600 * 1000)
    process.exit()
  }
  try {
    // 并发请求，限制交易对数量
    const newTradeList = await Promise.all(
      tradeList.map(async (trade) => {
        const {
          symbol,
          quantity, // 一次交易数量
          buy_quantity, // 当前账户拥有的数量
          buy_open, // 买单开启
          sell_open, // 卖单开启
          stop_loss = 0,
          history_trade = [],
        } = trade
        if (!buy_open && !sell_open) {
          // 没有开启买卖
          return trade
        }

        const nowPrice = await Api.getTickerPrice(symbol) // 最新价格
        const [k1, k2] = await Api.getMaCompare(symbol, KlineType['1m'], [3, 30])  // 1min 的 kline 最近 3 条 与 最近 30 条
        if (k1 > k2) {
          // 涨的趋势，买
          if (buy_quantity > 0) {
            // 已有买单，不再买了
            return trade
          } else {
            // 下单金额过小
            if (quantity * nowPrice < 10) {
              const msg = `币种${symbol} 的下单金额必须 >= 10 usdt，已关闭买单操作`
              log(msg, flag)
              Api.notifyServiceError(msg)
              trade.buy_open = false
              return trade
            }
            // 判定是否下单
            let res
            try {
              res = await Api.order(symbol, BuySide.BUY, OrderType.LIMIT, {
                timeInForce: TimeInForce.GTC, // 成交为止，订单会一直有效
                quantity, // 交易数量
                price: canTradePrice(nowPrice),
              }) // 以当前价格下单
              // test
              // res = {
              //   orderId: 1,
              //   fills: [{ price: 423 }],
              // }
            } catch (e) {
              // 当前撮合交易失败
              let myUsdt = 0
              try {
                myUsdt = await Api.getWalletUsdt() // 账户中的 usdt 数量
              } catch (e) {}
              if (nowPrice * quantity > myUsdt) {
                Api.notifyBuyOrderFail(symbol, '当前账户余额已不足,已关闭买单操作')
                trade.buy_open = false
                return trade
              } else {
                if (!trade.error_num) {
                  trade.error_num = 1
                } else {
                  trade.error_num++
                  if (trade.error_num > 3) {
                    // 错误次数大于3，停止当前币种交易
                    trade.buy_open = false
                  }
                }
                Api.notifyBuyOrderFail(symbol, e)
              }
              return trade
            }
            if (res && res.orderId) {
              // 交易成功
              result = true
              let tradePrice = nowPrice // 首先默认交易价格为当前价格
              if (res['fills'] && res['fills'].length > 0 && res['fills'][0]['price']) {
                tradePrice = res['fills'][0]['price'] // 更新为交易记录中的第一个价格
              }
              log(`买入币种为：${symbol}, 买单量为：${quantity}, 买单价格为：${tradePrice}`, flag)
              Api.notifyBuyOrderSuccess(symbol, quantity, tradePrice) // 发送通知

              trade.buy_price = tradePrice // 最后一次买入价格
              trade.sell_price = round(tradePrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
              if (trade.sell_price < nowPrice) {
                trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
              }

              // 买单记录
              history_trade.unshift({
                symbol,
                quantity,
                price: tradePrice,
                side: BuySide.BUY,
                time: dateFormat(),
                sell_price: trade.sell_price, // 根据当时的买入价格，设定应该卖出的价格
                lowest_sell_price: trade.sell_price, // 最低卖价
                low_num: 0, // 容错次数
                stop_loss: stop_loss, // 止损率
                isSell: false,
              }) // 头部插入一条，这样容易直接找到最新的记录
              trade.history_trade = history_trade // 更新买卖历史记录
              log(trade, flag)
            }
          }
        } else {
          // 跌的趋势, 卖
          if (buy_quantity <= 0) {
            return trade
          }
          const sell_history_trade = [] // 要进行的卖单操作记录
          const new_history_trade = await Promise.all(
            history_trade.map(async (item) => {
              // 卖单记录
              if (item.side === BuySide.SELL) {
                return item
              }
              // 已经卖出的买单记录
              if (item.side === BuySide.BUY && item.isSell === true) {
                return item
              }
              if (nowPrice < item.sell_price) {
                // 小于卖出价格
                return item
              }
              let quantityTrue = item.quantity // 交易单的买入数量
              if (buy_quantity < quantityTrue) {
                quantityTrue = buy_quantity // 当前拥有的数量为最大可交易数量
              }
              let res
              if (quantityTrue > 0) {
                try {
                  res = await Api.order(symbol, BuySide.SELL, OrderType.LIMIT, {
                    timeInForce: TimeInForce.GTC, // 成交为止，订单会一直有效
                    quantity: quantityTrue, // 交易数量
                    price: canTradePrice(nowPrice), // marker 模式一直报错，只能使用limit,每个币的小数位数不同，需要截取不同位数
                  }) // 以当前市价下单
                } catch (e) {
                  // 当前撮合交易失败
                  log(e)
                  Api.notifySellOrderFail(symbol, e)
                  return item
                }
                if (res && res.orderId) {
                  item.isSell = true // 更新此记录为已卖出
  
                  let tradePrice = nowPrice
                  if (res['fills'] && res['fills'][0] && res['fills'][0]['price']) {
                    tradePrice = res['fills'][0]['price'] // 交易价格
                  }
                  const profit = (tradePrice - item.price) * quantityTrue
                  log(
                    `币种为：${symbol}, 卖单量为：${quantityTrue}, 卖单价格为：${tradePrice}。预计盈利: ${profit} USDT`
                  )
                  Api.notifySellOrderSuccess(symbol, quantityTrue, tradePrice, profit) // 发送通知
                  // 卖单记录
                  sell_history_trade.unshift({
                    symbol, // 币种
                    quantity: quantityTrue, // 交易数量
                    price: tradePrice, // 卖单价格
                    side: BuySide.SELL, // 方向 卖
                    buy_price: item.price, // 对应的买入价格
                    profit, // 盈利多少
                    time: dateFormat(), // 时间
                  }) // 在头部插入一条，这样容易直接找到最新的记录
                }
              }
              return item
            })
          )
          trade.buy_quantity -= sell_history_trade.reduce(
            (carry, item) => carry + Number(item.quantity),
            0
          ) // 更新当前购买数量
          trade.history_trade = [...sell_history_trade, ...new_history_trade] // 记录历史记录
        }
        return trade
      })
    )
    fs.writeFileSync(tradeFile, JSON.stringify(newTradeList, null, 2)) // 更新交易配置
  } catch (e) {
    log(e, true)
    Api.notifyServiceError(e)
    await sleep(5 * 1000) // 发生币安接口的错误暂停 5 秒
  }
  return result
}

;(async () => {
  while (true) {
    const result = await init()
    if (result) {
      log('wait 5 seconds', true)
      await sleep(5 * 1000) // 有交易成功的时候，暂停交易 5 秒
    } else {
      await sleep((config.sleep_time || 1) * 1000) // 无交易时，暂停 sleep_time 秒
    }
  }
})()
