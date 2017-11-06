const Koa = require('koa')
const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger')

const index = require('./routes/index')
const users = require('./routes/users')
const hok = require('./routes/hok').router
const draw = require('./routes/draw')
const room = require('./routes/audioRoom')
const channel = require('./routes/audioChannel')
const sign = require('./routes/sign')
const user = require('./routes/user')
const token = require('./routes/token')
const config = require('./lib/config')
const AV = require('leancloud-storage')

AV.init({
  appId: config.heyzgo.ID,
  appKey: config.heyzgo.Key,
  masterKey: config.heyzgo.MasterKey
});
AV.Cloud.useMasterKey();

// error handler
onerror(app)

// middlewares
app.use(bodyparser({
  enableTypes:['json', 'form', 'text']
}))

app.use(json())
app.use(logger())
app.use(require('koa-static')(__dirname + '/public'))

app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// logger
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

// routes
app.use(index.routes(), index.allowedMethods())
app.use(users.routes(), users.allowedMethods())
app.use(user.routes(), user.allowedMethods())
app.use(hok.routes(), hok.allowedMethods())
app.use(draw.routes(), draw.allowedMethods())
app.use(room.routes(), room.allowedMethods())
app.use(channel.routes(), channel.allowedMethods())
app.use(sign.routes(), sign.allowedMethods())
app.use(token.routes(), token.allowedMethods())

app.listen(9999, () => {
  console.log('[demo] request post is starting at port 3000')
})

module.exports = app
