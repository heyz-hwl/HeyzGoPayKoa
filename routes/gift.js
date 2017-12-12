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
const giftMap = require('../lib/func').giftMap

router.prefix('/v1')

//送礼物
router.post('/sendGift',
  jwt.verify,
  async(ctx, next) => {
    try {
      let senderId = ctx.decode.userId
      senderId = _.isUndefined(ctx.request.body.userId) ? senderId : ctx.request.body.userId
      let receiverId = ctx.request.body.receiverId
      let giftId = ctx.request.body.giftId
      let ret = await send(senderId, receiverId, giftId)
      if(!receiverId || !giftId){
        return ctx.body = {
          status: 1002,
          data: {},
          msg: 'Invalid parameter!'
        }
      }
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

//发红包
router.post('/sendMoney',
  jwt.verify,
  async(ctx, next) => {
    try {
      let senderId = ctx.decode.userId
      senderId = _.isUndefined(ctx.request.body.userId) ? senderId : ctx.request.body.userId      
      let receiverId = ctx.request.body.receiverId
      let giftId = ctx.request.body.giftId
      let cost = ctx.request.body.cost
      let ret = await send(senderId, receiverId, giftId, cost)
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
const send = (senderId, receiverId, giftId, cost) => {
  return new Promise(async(resolve, reject) => {
    try {
      let time = moment().format(`YYYY-MM-DD HH:MM:SS`)
      let timeStamp = util.getTimeStamp()
      let orderNo = moment().format('YYYYMMDDHHmmss') + util.randomNum(4); //时分秒+4位随机数，组成订单号
      let giftData = giftMap[giftId]
      console.log(`giftData ->${JSON.stringify(giftData)}`)
      cost = !_.isUndefined(cost) ? cost : giftData.costNum
      if (await ableToSend(senderId, cost)) {
        let sql = `select * from Wallet where userId="${senderId}"`
        let result = await db.excute(sql)
        console.log(`result -> ${JSON.stringify(result)}`)
        if (giftId === '0') {
          let sql = `insert into YuyiConsume values(null, "${senderId}", "${receiverId}", "${orderNo}", "发红包", "${cost}", "${result[0].yuyi_num - cost}", "${time}", "${config.rate}")`
          let ret = await db.excute(sql)
        } else {
          let yuyiNum = util.oprate(giftData.costNum, config.rate, 'mul')
          let sql = `insert into YuyiConsume values(null, "${senderId}", "${receiverId}", "${orderNo}", "送${giftData.name}礼物", "${cost}", "${result[0].yuyi_num - giftData.costNum}", "${time}", "${config.rate}")`
          console.log(`sql -> ${sql}`)
          let ret = await db.excute(sql)
        }
      } else {
        reject(new Error(`not enough money`))
      }
      resolve(`success`)
    } catch (err) {
      reject(new Error(`send err -> ${err}`))
    }
  })
}

//是否够钱
const ableToSend = (senderId, cost) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `select * from Wallet where userId="${senderId}"`
      let ret = await db.excute(sql)
      if (!_.isEmpty(ret) && ret[0].yuyi_num >= cost) {
        sql = `update Wallet set yuyi_num="${ret[0].yuyi_num - cost}" where userId="${senderId}"`
        let result = await db.excute(sql)
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (err) {
      reject(new Error(`ableToSend err -> ${err}`))
    }
  })
}

module.exports = router;
