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
const middle = require('../lib/middle')
const giftMap = require('../lib/func').giftMap

router.prefix('/v1')

//type === 0 提现
//type === 1 兑换羽翼
router.post('/exchange',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId
      userId = _.isUndefined(ctx.request.body.userId) ? userId : ctx.request.body.userId
      let type = ctx.request.body.type
      let amount = ctx.request.body.amount
      if (!type || !amount) {
        return ctx.body = {
          status: 1002,
          data: {},
          msg: 'Invalid parameter!'
        }
      }
      let ret = await exchange(userId, type, amount)
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

const exchange = (userId, type, amount) => {
  return new Promise(async(resolve, reject) => {
    try {
      let orderNo = moment().format('YYYYMMDDHHmmss') + util.randomNum(4);
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      let sql = `select * from Wallet where userId="${userId}"`
      let ret = await db.excute(sql)
      if (await isEnoughYumao(userId, amount)) {
        if (type == 0) { //提现
          if (_.isEmpty(ret) || ret[0].yumao_num < 1667) {
            reject(`余额不足1667羽毛,不允许提现`)
          } else {
            let nub = util.oprate(amount, 0.6, 'mul')
            nub = util.oprate(nub, 10, 'div')
            sql = `update Wallet set yumao_num="${ret[0].yumao_num-amount}" where userId="${userId}"`
            let result = await db.excute(sql)
            if (!_.isUndefined(result)) {
              sql = `insert into YumaoConsume values(null, "${userId}", "${orderNo}", "提现", "${amount}", "${ret[0].yumao_num-amount}", "${nub}", "${time}", "${config.rate}")`
              result = await db.excute(sql)
              resolve(result)
            }
          }
        } else { //兑换羽翼
          let nub = util.oprate(amount, 0.8, 'mul')
          sql = `update Wallet set yumao_num="${ret[0].yumao_num - amount}" where userId="${userId}"`
          let result = await db.excute(sql)
          if (!_.isUndefined(result)) {
            sql = `insert into YumaoConsume values(null, "${userId}", "${orderNo}", "兑换羽翼", "${amount}", "${ret[0].yumao_num-amount}", "${nub}", "${time}", "${config.rate}")`
            console.log(`sql ->${sql}`)
            result = await db.excute(sql)
            resolve(result)
          }
        }
      } else {
        reject(`羽毛不够`)
      }
    } catch (err) {
      reject(`exchange err -> ${err}`)
    }
  })
}

//是否够钱
const isEnoughYumao = (userId, amount) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `select * from Wallet where userId="${userId}"`
      let ret = await db.excute(sql)
      console.log(`ret2 -> ${JSON.stringify(ret[0].yumao_num >= amount)}`)
      if (!_.isEmpty(ret) && ret[0].yumao_num >= amount) {
        sql = `update Wallet set yuyi_num="${ret[0].yumao_num - amount}" where userId="${userId}"`
        let result = await db.excute(sql)
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (err) {
      reject(new Error(`isEnoughYumao err -> ${err}`))
    }
  })
}

//获取兑换或提现订单记录
router.get('/exchange',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId
      userId = ctx.query.userId ? ctx.query.userId : userId
      let limit = ctx.query.limit ? ctx.query.limit : 10
      let skip = ctx.query.skip ? ctx.query.skip : 0
      let order_name = ctx.query.order_name
      let option = ctx.query.option
      let ret = []
      if(order_name){
        if(order_name == 0){
          ret = await db.select(`YumaoConsume`, `userId="${userId}" and order_name="提现"`, limit, skip, option)
        } else if (order_name == 1){
          ret = await db.select(`YumaoConsume`, `userId="${userId}" and order_name="兑换羽翼"`, limit, skip, option)          
        }
      }else {
      ret = await await db.select(`YumaoConsume`, `userId="${userId}"`, limit, skip, option)
      }
      if(!_.isEmpty(ret)){
        ctx.body = {
          status: 200,
          data: ret,
          msg: `success`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `exchange err -->${err}`
      }
    }
  }
)

module.exports = router
