const express = require('express')
const cors = require('cors-express')
const jwt = require('express-jwt')
const jwtToken = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const { exit } = require('process')


const { web } = require('../../config.js')
const { resJson } = require('./utils')
const currentDir = path.dirname(__filename)

const app = express()
const port = web.port || 2222
const secret = web.secret || 'admin'
const user = {
  name: web.username || 'admin',
  password: web.password || 'admin',
}

const options = {
  allow: {
    origin: '*',
    methods: 'GET,PATCH,PUT,POST,DELETE,HEAD,OPTIONS',
    headers:
      'Content-Type, Authorization, Content-Length, X-Requested-With, X-HTTP-Method-Override',
  },
  options: function (req, res, next) {
    if (req.method == 'OPTIONS') {
      res.status(204).end()
    } else {
      next()
    }
  },
}

// 静态资源
app.use(express.static(path.join(currentDir, 'front')));

// 跨域配置
app.use(cors(options))
// jwt token 设置
app.use(
  jwt({
    secret, // 签名的密钥 或 PublicKey
    algorithms: ['HS256'],
  }).unless({
    path: ['/login', '/zmkm'], // 指定路径不经过 Token 解析
  })
)
app.use(function (err, req, res, next) {
  if (req.path.includes('static')) {
    next()
  }
  else if (err.name === 'UnauthorizedError') {
    res.status(401).send('invalid token...')
  }
})
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded


// 查看币种明细
app.post('/login', (req, res) => {
  const { body } = req
  const { username, password } = body
  if (username === user.name && password === user.password) {
    const token =
      'Bearer ' +
      jwtToken.sign(
        {
          name: username, // 自定义区域
        },
        secret,
        {
          expiresIn: 3600 * 24 * 1, // 过期时间
        }
      )
    res.json(
      resJson(200, {
        token,
      })
    )
  } else {
    res.status(401).end()
  }
})

// 查看币种明细
app.get('/trades', (req, res) => {
  const tradeList = fs.readFileSync(path.resolve(currentDir, '../../data/trade.json'), {
    encoding: 'utf8',
  })
  res.json(
    resJson(200, {
      list: JSON.parse(tradeList),
    })
  )
})

// 读取配置文件
app.get('/config', (req, res) => {
  const configText = fs.readFileSync(path.resolve(currentDir, '../../config.js'), {
    encoding: 'utf8',
  })
  res.json(
    resJson(200, {
      content: configText,
    })
  )
})

// 修改配置文件
app.put('/config', (req, res) => {
  const {
    body: { config },
  } = res
  fs.writeFileSync(path.resolve(currentDir, '../../config.js'), config) // 修改 config.js 文件
  res.json(resJson(200))
})

// 修改币种的配置
app.put('/trades', (req, res) => {
  const {
    body: { trades },
  } = req
  fs.writeFileSync(
    path.resolve(currentDir, '../../data/trade.json'),
    JSON.stringify(trades, null, 2)
  ) // 修改 trade.json 文件
  res.json(resJson(200))
})

// 退出后台
app.get('/die', (req, res) => {
  const token = req.query._token
  if (token === 'sorry510') {
    res.send('die success')
    exit()
  }
  res.status(404).end()
})

// 查看币种明细
app.get('/zmkm', (req, res) => {
  res.sendFile(path.resolve(currentDir, './front/index.html'), {maxAge: 0})
})

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})
