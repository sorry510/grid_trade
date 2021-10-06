const fs = require('fs')
const process = require('process')
const tradeFile = './data/trade.json'
const Api = require('./use/api')
const { sleep, log, dateFormat } = require('./use/utils')
const BuySide = require('./binance/const/BuySide')
const OrderType = require('./binance/const/OrderType')
const TimeInForce = require('./binance/const/TimeInForce')
const { round } = require('mathjs')

async function init() {
  let result = false // 执行结果

  let tradeList = fs.readFileSync('./data/trade.json', {
    encoding: 'utf8',
  })
  try {
    tradeList = JSON.parse(tradeList)
  } catch (e) {
    log('./data/trade.json 文件已损坏，请修复后再使用')
    Api.notifyServiceError('./data/trade.json 文件已损坏，请修复后再使用')
    await sleep(3600 * 1000) // 避免使用守护进程时导致的无限重启
    process.exit()
  }

  if (tradeList.filter((item) => !item.stop).length > 10) {
    log('正在运行的交易对数量不能超过10个,否则可能会造成请求过多被封ip')
    Api.notifyServiceError('正在运行的交易对数量不能超过10个,否则可能会造成请求过多被封ip')
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
          buy_quantity,
          stop,
          history_trade = [],
        } = trade

        // 暂停交易
        if (stop) {
          return trade
        }

        // 没有填写买卖价格，自动生成
        if (buy_price == 0 || sell_price == 0) {
          const rate = await Api.getNewRate(symbol) // 得到新的止盈比率
          const nowPrice = await Api.getTickerPrice(symbol) // 最新价格
          trade.rate = rate // 更新止盈率 x %
          trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
          trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
          Api.notifySymbolChange(trade) // 更新变化记录
          log(trade)
          return trade
        }

        // 下单金额过小
        if (quantity * buy_price < 9) {
          const msg = `币种${symbol} 的下单金额必须 >= 10 usdt`
          log(msg)
          Api.notifyServiceError(msg)
          return trade
        }

        const nowPrice = await Api.getTickerPrice(symbol) // 最新价格
        // 判定是否下单
        if (buy_price >= nowPrice && !(await Api.inTrending(symbol, BuySide.BUY))) {
          // 是否买入进行判定,设定价格 >= 当前价格,没有处于下降趋势中
          let res
          const rate = await Api.getNewRate(symbol) // 得到新的止盈比率
          try {
            res = await Api.order(symbol, BuySide.BUY, OrderType.LIMIT, {
              timeInForce: TimeInForce.GTC, // 成交为止，订单会一直有效
              quantity, // 交易数量
              price: buy_price, // marker 模式一直报错，只能使用这个,虽然是当前价格比现价高，但是会以现价买入
            }) // 以当前市价下单
            // test
            // res = {
            //   orderId: 1,
            //   fills: [{ price: 423 }],
            // }
          } catch (e) {
            Api.notifyBuyOrderFail(symbol, e)
            log(e)
          }
          if (res && res.orderId) {
            // 交易成功
            result = true
            let tradePrice = nowPrice // 首先默认交易价格为当前价格
            if (res['fills'] && res['fills'].length > 0 && res['fills'][0]['price']) {
              // tradePrice = round(
              //   res['fills'].reduce((carry, item) => carry + Number(item), 0) / res['fills'].length,
              //   6
              // )
              tradePrice = res['fills'][0]['price'] // 更新为交易记录中的第一个价格
            }
            Api.notifyBuyOrderSuccess(symbol, quantity, tradePrice) // 发送通知
            log(`买入币种为：${symbol}, 买单量为：${quantity}, 买单价格为：${tradePrice}`)

            history_trade.unshift({
              symbol,
              quantity,
              price: tradePrice,
              side: BuySide.BUY,
              time: dateFormat(),
              isSell: false,
            }) // 像头部插入一条，这样容易直接找到最新的记录
            trade.history_trade = history_trade // 更新买卖历史记录
            trade.rate = rate // 更新止盈率 x %
            trade.buy_quantity += quantity // 更新已购买数量
            trade.buy_price = round(tradePrice * (1 - trade.rate / 100), 6) // 更新买入价格
            if (trade.buy_price > nowPrice) {
              trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
            }
            trade.sell_price = round(tradePrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
            if (trade.sell_price < nowPrice) {
              trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
            }
            Api.notifySymbolChange(trade) // 更新变化记录
            log(trade)
          }
        } else if (sell_price < nowPrice && !(await Api.inTrending(symbol, BuySide.SELL))) {
          // 是否卖出进行判定,设定卖出价格 < 当前价格,没有处于上涨趋势中
          let res
          const rate = await Api.getNewRate(symbol)
          const quantityTrue = buy_quantity >= quantity ? quantity : buy_quantity // 真实的交易量
          if (quantityTrue > 0) {
            // 账号有交易数量
            try {
              res = await Api.order(symbol, BuySide.SELL, OrderType.LIMIT, {
                timeInForce: TimeInForce.GTC, // 成交为止，订单会一直有效
                quantity: quantityTrue, // 交易数量
                price: sell_price, // marker 模式一直报错，只能使用这个
              }) // 以当前市价下单
            } catch (e) {
              Api.notifySellOrderFail(symbol, e)
              log(e)
            }
            if (res && res.orderId) {
              result = true
              let tradePrice = nowPrice
              if (res['fills'] && res['fills'][0] && res['fills'][0]['price']) {
                tradePrice = res['fills'][0]['price'] // 交易价格
              }
              const lastBuyTrade = history_trade.find(
                (item) => item.side === BuySide.BUY && item.isSell === false
              ) // 最后一次买入记录
              let profit = '未知' // 盈利多少
              if (lastBuyTrade) {
                profit = (tradePrice - lastBuyTrade.price) * quantityTrue
                lastBuyTrade.isSell = true // 更新此记录为已卖出
              }
              Api.notifySellOrderSuccess(symbol, quantityTrue, tradePrice, profit) // 发送通知
              log(
                `币种为：${symbol}, 卖单量为：${quantityTrue}, 卖单价格为：${tradePrice}。预计盈利: ${profit} USDT`
              )
              history_trade.unshift({
                symbol,
                quantity: quantityTrue,
                price: tradePrice,
                side: BuySide.SELL,
                time: dateFormat(),
              }) // 像头部插入一条，这样容易直接找到最新的记录
              trade.history_trade = history_trade // 更新买卖历史记录
              trade.buy_quantity -= quantityTrue // 更新已购买数量
              trade.buy_price = round(tradePrice * (1 - trade.rate / 100), 6) // 更新买入价格
              trade.sell_price = round(tradePrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
            }
          }
          // 只要满足卖出条件，即使没有买入过币种，也要更新买卖的价格，可以防止踏空
          trade.rate = rate // 更新止盈率 x %
          if (trade.buy_price > nowPrice) {
            trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
          }
          if (trade.sell_price < nowPrice) {
            trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
          }
          Api.notifySymbolChange(trade) // 更新变化记录
          log(trade)
        } else {
          log(`${symbol}当前的价格为：${nowPrice}, 未能满足交易`)
        }
        return trade
      })
    )
    fs.writeFileSync(tradeFile, JSON.stringify(newTradeList, null, 2)) // 更新交易配置
  } catch (e) {
    log(e)
    Api.notifyServiceError(e)
    await sleep(5 * 1000) // 发生币安接口的网络错误暂停 5 秒
  }
  return result
}

;(async () => {
  while (true) {
    const result = await init()
    if (result) {
      log('wait 120 seconds')
      await sleep(120 * 1000) // 有交易成功的时候，暂停交易 2 min
    } else {
      log('wait 2 seconds')
      await sleep(2 * 1000) // 无交易时，暂停 2 秒
    }
  }
})()
