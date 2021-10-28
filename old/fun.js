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
