const router = require('koa-router')()
const config = require('../lib/config');
const pingpp = require('pingpp')(config.pingpp.secretKey);
const moment = require('moment');
const AV = require('leancloud-storage');
const jwt = require('../lib/jwt');
const db = require('../lib/db');
const util = require('../lib/util');
const middle = require('../lib/middle');
const func = require('../lib/func')
const _ = require('lodash')

router.prefix('/v1')

//提现
router.post('/withdrawal',
  async(ctx, next) => {
    try {
      let userId = ctx.request.body.userId
      let orderId = ctx.request.body.orderNo
      //检查必传参数是否存在
      if (!userId || !orderId) {
        return ctx.body = {
          status: 1000,
          data: {},
          msg: 'Parameter missing!'
        }
      }
      let sql = `select * from WxUser where userId="${userId}"`
      let ret = await db.excute(sql)
      if(_.isEmpty(ret)){
        return ctx.body = {
          status: 403,
          data:{},
          msg: `请检查数据`
        }
      }
      sql = `select * from Withdrawal where order_no="${orderId}" and status=3`
      let ret2 = await db.excute(sql)
      if(_.isEmpty(ret2)){
        return ctx.body = {
          status: 1001,
          data: {},
          msg: ` 订单号错误`
        }
      }
      // let result = await pay(ret[0].openid, ret2[0].amount)
      let time = moment().format('YYYY-MM-DD HH:mm:ss');
      sql = `update withdrawal set status=1, updateTime="${time}" where order_no="${orderNo}"`;
      ret = await db.excute(sql)
      console.log(`ret -> ${JSON.stringify(ret)}`)
      return ctx.body = {
        status: 200,
        data: withdrawal,
        msg: 'Successful!'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `withdrawal err -> ${err}`
      }
    }
  })

router.get('/withdrawal',
  async(ctx, next) => {
    let sql = `select * from Withdrawal where status = 3 `
    let ret = await db.excute(sql)
    if(!_.isEmpty(ret)){
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    }
  }
)


//wx 付钱模块
const pay = (openid, amount) => {
  return new Promise(async(resolve, reject) => {
    try {
      let orderNo = moment().format('YYYYMMDDHHmmss') + util.randomNum(4);
      let data = {
        mch_appid: config.wxpt.appid,
        mchid: config.wxpt.mchid,
        nonce_str: ``,
        sign: ``,
        partner_trade_no: orderNo,
        openid: openid,
        check_name: `NO_CHECK`,
        amount: amount * 100,
        desc: `提现`,
        spbill_create_ip: `112.74.40.136`
      }
      let options = {
        method: 'POST',
        url: `https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers`,
        body: data,
        json: true
      }
      let ret = await rp(options)
      if (ret) {
        resolve(ret)
      }
      reject(`err`)
    } catch (err) {
      reject(`pay err => ${err}`)
    }
  })
}

module.exports = router;
