## 币安网格现货交易

## 使用

### 下载项目
```
git clone https://github.com/sorry510/grid_trade.git
```

### 安装依赖

```
npm install 或 yarn
```

### 配置数据

```
cp config.js.example config.js
cp data/trade.json.example data/trade.json
```


#### data/trade.json 配置
- json文件不能有注释，请删除注释

```
[
  {
      "symbol": "BTCUSDT", // 交易对
      "quantity": 0.001, // 交易量
      "buy_price": 0, // 买入价格(设置为0,自动生成)
      "sell_price": 0, // 卖出价格(设置为0,自动生成)
      "rate": 0, // 网格收益比率(设置为0,自动生成)
      "buy_quantity": 0, // 当前账户的买入数量(设置为0)
      "history_trade": [] // 历史交易记录(设置为[],自动记录历史记录)
  }
]
```

#### config.js 配置
- 申请api_key地址: [币安API管理页面](https://www.binance.com/cn/usercenter/settings/api-management)

```
module.exports = {
  api_key: '', // 币安 key
  api_secret: '', // 币安 secret
  recv_window: 4000, // 时间空窗值单位毫秒，用于客户端与服务器端时间差异,建议5秒以下
  threshold: 0.015, // 判定是否属于急速变化的，3min k线的变化率阈值
  dingding_token: '', // 钉钉推送token
  dingding_word: '报警',  // 钉钉推送关键词
}
```

### 运行程序

```
node index.js
```

### 注意事项
- 由于币安交易所的api在大陆无法访问，请使用国外的服务器, 需要 nodejs 环境
- 如果您使用的交易所为币安，那么请保证账户里有足够的bnb用于交易手续费
- 现货账户保证有足够的U

### 免责申明
！！！本项目不构成投资建议，投资者应独立决策并自行承担风险！！！
！！！币圈有风险，入圈须谨慎。！！！


