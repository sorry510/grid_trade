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
          quantity,
          buy_price,
          sell_price,
          buy_open, // 买单开启
          stop_loss = 0,
          quick = false, // 是否快速交易，适合无手续费的币
          history_trade = [],
        } = trade
        if (!buy_open) {
          // 没有开启买单
          return trade
        }

        const nowPrice = await Api.getTickerPrice(symbol) // 最新价格

        // 没有填写买卖价格或者当前价格高于卖出价格，自动生成新的价格
        if (buy_price == 0 || sell_price == 0 || nowPrice >= sell_price) {
          const rate = await Api.getNewRate(symbol) // 得到新的止盈比率
          trade.rate = rate // 更新止盈率 x %
          trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
          trade.highest_buy_price = trade.buy_price // 最高买入价格
          trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
          log(trade, flag)
          Api.notifySymbolChange(trade) // 更新变化记录
          return trade
        }

        // 下单金额过小
        if (quantity * buy_price < 10) {
          const msg = `币种${symbol} 的下单金额必须 >= 10 usdt，已关闭买单操作`
          log(msg, flag)
          Api.notifyServiceError(msg)
          trade.buy_open = false
          return trade
        }

        // 当前价格高于最初的买单价
        if (nowPrice > trade.highest_buy_price) {
          log(`${symbol}当前的价格为：${nowPrice}, 不满足买单交易, 等待后继续`, flag)
          return trade
        }

        if (quick) {
          // 快速模式
          const [ma2, ma20] = await Api.getMaCompare(symbol, KlineType['3m'], [2, 20])  // 3min 的 kline 最近 2 条 与 最近 20 条
          if (ma2 <= ma20) {
            // 跌的趋势, 不买
            return trade
          }
          if (nowPrice >= trade.buy_price) {
            // 高于买价，不买
            return trade
          }
        } else {
          // 正常模式
          if (nowPrice <= trade.buy_price) {
            // 设置一个更低的买单价
            trade.buy_price = nowPrice
            trade.low_num = 0
            return trade
          }
          const midPrice = trade.buy_price + (trade.highest_buy_price - trade.buy_price) * 0.4 // 最高买价与当前买价的中间价格

          // 低于中间价，继续等待
          if (nowPrice <= midPrice) {
            trade.low_num = 0
            return trade
          }
          // 添加容错，第3次触发条件，才进行买入操作
          if (trade.low_num <= 2) {
            trade.low_num += 1
            return trade
          }
        }

        // 判定是否下单
        let res
        const rate = await Api.getNewRate(symbol) // 得到新的止盈比率

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

          trade.rate = rate // 更新止盈率 x %
          trade.buy_quantity += quantity // 更新已购买数量
          trade.buy_price = round(tradePrice * (1 - trade.rate / 100), 6) // 更新买入价格
          if (trade.buy_price > nowPrice) {
            trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
          }
          trade.highest_buy_price = trade.buy_price
          trade.low_num = 0

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
            sell_price, // 根据当时的买入价格，设定应该卖出的价格
            lowest_sell_price: sell_price, // 最低卖价
            low_num: 0, // 容错次数
            stop_loss, // 止损率
            isSell: false,
          }) // 头部插入一条，这样容易直接找到最新的记录
          trade.history_trade = history_trade // 更新买卖历史记录
          log(trade, flag)
          // Api.notifySymbolChange(trade) // 更新变化记录
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
      log('wait 30 seconds', true)
      await sleep(30 * 1000) // 有交易成功的时候，暂停交易 30 秒
    } else {
      await sleep((config.sleep_time || 60) * 1000) // 无交易时，暂停 sleep_time 秒
    }
  }
})()
