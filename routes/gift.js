const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const db = require('../lib/db')
const config = require('../lib/config')
const socket = require('../lib/socket')
const util = require('../lib/util')
const moment = require('moment')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')

router.prefix('/v1')

router.post('/sendGift',
  jwt.verify,
  async(ctx, next) => {
    try {
      let senderId = ctx.decode.userId
      let receiverId = ctx.req.body.receiverId
      let giftId = ctx.req.body.giftId
      let ret = await send(senderId, receiverId, giftId, )
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `send gift err -> ${err}`
      }
    }
  }
)

router.post('/sendMoney',
  jwt.verify,
  async(ctx, next) => {
    try {
      let senderId = ctx.decode.userId
      let receiverId = ctx.request.body.receiverId
      let giftId = ctx.request.body.giftId
      let ret = await send(senderId, receiverId, 0, 10)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `send gift err -> ${err}`
      }
    }
  }
)

//发钱或者送礼物
const send = (senderId, receiverId, giftId, amount) => {
  return new Promise(async(resolve, reject) => {
    try {
      if (giftId == 0) {
        let time = moment().format(`YYYY-MM-DD HH:MM:SS`)
        let timeStamp = util.getTimeStamp()
        let orderNo = moment().format('YYYYMMDDHHmmss') + util.randomNum(4); //时分秒+4位随机数，组成订单号
        let yuyiNum = util.oprate(amount, config.rate, 'mul'); //羽翼数：人民币 10：1
        let sql = `insert into YuyiConsume values(null, "${senderId}", "${orderNo}", "发红包", "${amount}", "${yuyiNum}", "${time}", "${config.rate}")`
        console.log(`sql -> ${sql}`)
        let ret = await db.excute(sql)
        sql = `insert into YuyiTradeRecord values(null, "${senderId}", "1", "1", "${yuyiNum}", "${time}", "${timeStamp}")`
        let ret2 = await db.excute(sql)
        resolve(ret)
      } else {
        let giftData = giftMap.giftId
        resolve(giftData)
      }
    } catch (err) {
      reject(`send err -->${err}`)
    }
  })
}

const giftMap = [{
  0: {
    name: '红包'
  }
}, {
  1: {
    name: '爱心',
    costNum: 123
  }
}, {
  2: {
    name: '爱心',
    costNum: 123
  }
}, {
  3: {
    name: '爱心',
    costNum: 123
  }
}]

module.exports = router;
