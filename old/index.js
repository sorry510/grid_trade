const fs = require('fs')
const process = require('process')
const tradeFile = './data/trade.json'
const Api = require('../use/api')
const config = require('../config')
const { sleep, log, dateFormat, canTradePrice } = require('../use/utils')
const BuySide = require('../binance/const/BuySide')
const OrderType = require('../binance/const/OrderType')
const TimeInForce = require('../binance/const/TimeInForce')
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

  if (tradeList.filter((item) => item.buy_open).length > 50) {
    log('正在运行的交易对数量不能超过50个,否则可能会造成请求过多被封ip')
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
          buy_quantity,
          buy_open, // 买单开启
          sell_open, // 卖单开启
          stop_loss = 0,
          history_trade = [],
        } = trade

        // 没有填写买卖价格，自动生成
        if (buy_price == 0 || sell_price == 0) {
          const rate = await Api.getNewRate(symbol) // 得到新的止盈比率
          const nowPrice = await Api.getTickerPrice(symbol) // 最新价格
          trade.rate = rate // 更新止盈率 x %
          trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
          trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
          log(trade)
          Api.notifySymbolChange(trade) // 更新变化记录
          return trade
        }

        // 下单金额过小
        if (quantity * buy_price < 9) {
          const msg = `币种${symbol} 的下单金额必须 >= 10 usdt`
          log(msg)
          Api.notifyServiceError(msg)
          await sleep(10 * 1000)
          return trade
        }

        const nowPrice = await Api.getTickerPrice(symbol) // 最新价格
        let expect_sell_price = sell_price // 预期的卖单价

        const noSellTrade = history_trade.filter(
          (item) => item.side === BuySide.BUY && item.isSell === false
        ) // 没有卖出的买单记录
        let minBuyTrade // 价格最低的卖出交易
        if (noSellTrade.length > 0) {
          expect_sell_price = Math.min(...noSellTrade.map((item) => Number(item.sell_price))) // 取一个最低的卖单价
          minBuyTrade = noSellTrade.find((item) => Number(item.sell_price) === expect_sell_price) // 可能要进行的卖单
        }

        // 判定是否下单
        if (buy_open && buy_price >= nowPrice && !(await Api.inTrending(symbol, BuySide.BUY))) {
          // 是否买入进行判定,设定价格 >= 当前价格,没有处于下降趋势中
          let res
          const rate = await Api.getNewRate(symbol) // 得到新的止盈比率

          try {
            res = await Api.order(symbol, BuySide.BUY, OrderType.LIMIT, {
              timeInForce: TimeInForce.GTC, // 成交为止，订单会一直有效
              quantity, // 交易数量
              price: canTradePrice(buy_price), // marker 模式一直报错，只能使用这个,虽然是当前价格比现价高，但是会以现价买入
            }) // 以当前市价下单
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
            if (buy_price * quantity > myUsdt) {
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
            log(`买入币种为：${symbol}, 买单量为：${quantity}, 买单价格为：${tradePrice}`)
            Api.notifyBuyOrderSuccess(symbol, quantity, tradePrice) // 发送通知

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
            log(trade)
            // Api.notifySymbolChange(trade) // 更新变化记录
          }
        } else if (
          sell_open &&
          expect_sell_price <= nowPrice &&
          !(await Api.inTrending(symbol, BuySide.SELL))
        ) {
          // 是否卖出进行判定,设定卖出价格 <= 当前价格,没有处于上涨趋势中
          let res
          const rate = await Api.getNewRate(symbol)
          let quantityTrue = quantity // 配置的交易数量
          if (minBuyTrade) {
            quantityTrue = minBuyTrade.quantity // 当时交易单的数量
          }
          if (buy_quantity < quantityTrue) {
            quantityTrue = buy_quantity // 当前拥有的数量为最大可交易数量
          }
          if (quantityTrue > 0) {
            // 账号有货币数量
            try {
              res = await Api.order(symbol, BuySide.SELL, OrderType.LIMIT, {
                timeInForce: TimeInForce.GTC, // 成交为止，订单会一直有效
                quantity: quantityTrue, // 交易数量
                price: canTradePrice(expect_sell_price), // marker 模式一直报错，只能使用limit,每个币的小数位数不同，需要截取不同位数
              }) // 以当前市价下单
            } catch (e) {
              // 当前撮合交易失败
              log(e)
              Api.notifySellOrderFail(symbol, e)
              return trade
            }
            if (res && res.orderId) {
              result = true
              let tradePrice = nowPrice
              if (res['fills'] && res['fills'][0] && res['fills'][0]['price']) {
                tradePrice = res['fills'][0]['price'] // 交易价格
              }
              let profit = 0 // 盈利多少
              if (minBuyTrade) {
                profit = (tradePrice - minBuyTrade.price) * quantityTrue
                minBuyTrade.isSell = true // 更新此记录为已卖出
              }
              log(
                `币种为：${symbol}, 卖单量为：${quantityTrue}, 卖单价格为：${tradePrice}。预计盈利: ${profit} USDT`
              )
              Api.notifySellOrderSuccess(symbol, quantityTrue, tradePrice, profit) // 发送通知
              // 卖单记录
              history_trade.unshift({
                symbol, // 币种
                quantity: quantityTrue, // 交易数量
                price: tradePrice, // 卖单价格
                side: BuySide.SELL, // 方向 卖
                buy_price: minBuyTrade.price || '未知', // 对应的买入价格
                profit, // 收益
                time: dateFormat(), // 时间
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
          log(trade)
          // Api.notifySymbolChange(trade) // 更新变化记录
        } else {
          log(`${symbol}当前的价格为：${nowPrice}, 未能买单交易, 等待后继续`)
        }
        return trade
      })
    )
    fs.writeFileSync(tradeFile, JSON.stringify(newTradeList, null, 2)) // 更新交易配置
  } catch (e) {
    log(e)
    Api.notifyServiceError(e)
    await sleep(5 * 1000) // 发生币安接口的错误暂停 5 秒
  }
  return result
}

/**
 * 更新json 结构
 */
function updateJsonData() {
  let tradeList = fs.readFileSync('./data/trade.json', {
    encoding: 'utf8',
  })
  tradeList = JSON.parse(tradeList)
  const newTradeList = tradeList.map((trade) => {
    const { history_trade = [] } = trade
    const new_history_trade = history_trade.map((item) => {
      if (item.side === BuySide.BUY) {
        if (item.sell_price) {
          item.lowest_sell_price = item.sell_price // 最初卖价
          item.low_num = 0
        }
        return item
      }
      return item
    })
    trade.history_trade = new_history_trade // 记录历史记录
    return trade
  })
  fs.writeFileSync(tradeFile, JSON.stringify(newTradeList, null, 2)) // 更新交易配置
}

;(async () => {
  while (true) {
    const result = await init()
    if (result) {
      log('wait 120 seconds')
      await sleep(120 * 1000) // 有交易成功的时候，暂停交易 2 min
    } else {
      await sleep((config.sleep_time || 60) * 1000) // 无交易时，暂停 sleep_time 秒
    }
  }
})()
