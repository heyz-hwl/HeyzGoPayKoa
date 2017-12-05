const Koa = require('koa')
const cors = require('koa2-cors');
const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
// const logger = require('koa-logger')
const log4js = require('koa-log4')
const logger = log4js.getLogger('app')

const index = require('./routes/index')
const users = require('./routes/users')
const hok = require('./routes/hok').router
const draw = require('./routes/draw')
const room = require('./routes/audioRoom')
const channel = require('./routes/audioChannel')
const sign = require('./routes/sign')
const user = require('./routes/user')
const token = require('./routes/token')
const register = require('./routes/register')
const charges = require('./routes/charges')
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
app.use(cors({
  origin: function(ctx) {
    if (ctx.url === '/test') {
      return false;
    }
    return '*';
  },
  exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
  maxAge: 5,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));
// middlewares
app.use(bodyparser({
  enableTypes:['json', 'form', 'text']
}))

app.use(json())
// app.use(logger())
require('./log')
app.use(log4js.koaLogger(log4js.getLogger('http'), { level: 'auto' }))
app.use(require('koa-static')(__dirname + '/public'))

app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// logger
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  logger.info(`${ctx.method} ${ctx.url} - ${ms}ms`)
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
app.use(register.routes(), register.allowedMethods())
app.use(charges.routes(), charges.allowedMethods())

app.on('error', function (err, ctx) {
  console.log(err)
  logger.error('server error', err, ctx)
})

let server = app.listen(9999, () => {
  console.log('[demo] request post is starting at port 9999')
})

module.exports = server
