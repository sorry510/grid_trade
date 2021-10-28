const fs = require('fs')
const process = require('process')
const tradeFile = './data/trade.json'
const Api = require('./use/api')
const config = require('./config')
const { sleep, log, dateFormat, canTradePrice } = require('./use/utils')
const BuySide = require('./binance/const/BuySide')
const OrderType = require('./binance/const/OrderType')
const TimeInForce = require('./binance/const/TimeInForce')
const { round } = require('mathjs')

async function init() {
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

  try {
    // 并发请求，限制交易对数量
    const newTradeList = await Promise.all(
      tradeList.map(async (trade) => {
        const {
          symbol,
          buy_quantity, // 当前账户拥有数量
          sell_open, // 卖单开启
          history_trade = [],
        } = trade

        if (!sell_open) {
          // 没有开启卖单
          return trade
        }
        const rate = await Api.getNewRate(symbol) // 得到新的止盈比率
        const nowPrice = await Api.getTickerPrice(symbol) // 最新价格
        const sell_history_trade = [] // 要进行的卖单操作记录

        // 遍历买单记录
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
            // 低于最低的卖出价格
            if (nowPrice < item.lowest_sell_price) {
              return item
            }
            // 当前价格>预定卖出价格，继续等待，同时更新最新的买卖单价格
            // 最初最低卖价=卖价，随着价格上涨，卖价不断上涨，最低卖价不变
            if (nowPrice >= item.sell_price) {
              trade.rate = rate
              trade.buy_price = round(nowPrice * (1 - trade.rate / 100), 6) // 更新买入价格
              trade.highest_buy_price = trade.buy_price // 最高买入价格
              trade.sell_price = round(nowPrice * (1 + trade.rate / 100), 6) // 更新的卖出价格
              trade.low_num = 0

              item.sell_price = nowPrice // 将最新价格定为卖出价格，提高卖价
              item.low_num = 0
              return item
            }
            const midPrice =
              (item.sell_price - item.lowest_sell_price) * 0.5 + item.lowest_sell_price // 最低卖价与当前卖价的中间价格
            // 大于中间价，继续等待
            if (nowPrice >= midPrice) {
              item.low_num = 0
              return item
            }
            // 如果前面的条件都通过，那说明当前价格小于中间价格
            // 添加容错，第4次触发条件，才进行卖出操作
            if (item.low_num <= 3) {
              item.low_num += 1
              return item
            }

            // 价格回落到 (最高价格-最初卖价格) / 50% + 最初卖价格，通过容错机制，准备进行卖出操作
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
                }) // 像头部插入一条，这样容易直接找到最新的记录
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
        return trade
      })
    )
    fs.writeFileSync(tradeFile, JSON.stringify(newTradeList, null, 2)) // 更新交易配置
  } catch (e) {
    log(e)
    Api.notifyServiceError(e)
    await sleep(30 * 1000) // 发生币安接口的错误暂停 30 秒
  }
}

;(async () => {
  while (true) {
    await init()
    await sleep((config.sleep_time || 60) * 1000) // 无交易时，暂停 sleep_time 秒
  }
})()
