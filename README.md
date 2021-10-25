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
- 此文件为交易对的配置文件，json文件不能有注释，请删除注释

```
[
  {
      "symbol": "BTCUSDT", // 交易对
      "quantity": 0.001, // 交易量
      "buy_price": 0, // 买入价格(设置为0,自动生成)
      "sell_price": 0, // 卖出价格(设置为0,自动生成)
      "rate": 0, // 网格收益比率(设置为0,自动生成)
      "buy_quantity": 0, // 当前账户的买入数量(设置为0)
      "buy_open": true, // 是否启用当前买单交易
      "sell_open": true, // 是否启用当前卖单交易
      "stop_loss": 0, // 止损率，>=0 , 0 为不设置止损
      "history_trade": [] // 历史交易记录(设置为[],自动记录历史记录)
  }
]
```

#### config.js 配置
- 服务基础配置文件
- 申请api_key地址: [币安API管理页面](https://www.binance.com/cn/usercenter/settings/api-management)

```
module.exports = {
  api_key: '', // 币安 key
  api_secret: '', // 币安 secret
  recv_window: 4000, // 时间空窗值单位毫秒，用于客户端与服务器端时间差异,建议5秒以下
  threshold: 0.015, // 判定是否属于急速变化的，3min k线的变化率阈值
  dingding_token: '', // 钉钉推送token
  dingding_word: '报警',  // 钉钉推送关键词
  web: { // web 服务配置(非必须，推荐)
    secret: 'asd', // jwt token 使用随便填写
    port: 2222, // web 服务端口
    username: 'admin',  // web 服务登录账号
    password: 'lbx6e7rCmHQXWDOV',  // web 服务登录密码
  },
}
```

### 运行程序

```
node ./index.js  # 网格交易买单服务
node ./sell.js  # 网格交易卖单服务
node web/back/app.js # 开启web服务，可以在线修改交易配置文件，实时生效
```

#### web 服务说明
>访问地址: http://ip:port/zmkm # ip 为部署服务器ip，port 为 config.js 中 web.port
登录的账号密码为 config.js 文件中的  web.username 和 web.password

### 注意事项
- 由于币安交易所的 api 在大陆无法访问，请使用国外的服务器, 需要 nodejs12 以上环境
- 请保证账户里有足够的 bnb 用于交易手续费
- 请保证现货账户有足够的 USDT
- 钉钉推送 1min 中内不要超过 20 条，否则会被封 ip

### 免责申明
>！！！本项目不构成任何投资建议，投资者应独立决策并自行承担风险！！！
！！！币圈有风险，入圈须谨慎。！！！


