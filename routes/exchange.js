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
const rp = require('request-promise');

router.prefix('/v1')

router.post('/wxgzh',
  async(ctx, next) => {
    try {
      let str = `https://api.weixin.qq.com/`
      let data = ctx.request.body
      if (ctx.request.body.url) {
        str += ctx.request.body.url
      }
      let options = {
        method: 'POST',
        uri: str,
        body: data,
        json: true
      }
      let res = await rp(options)
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `post wxgzh err ->${err}`
      }
    }
  }
)

router.get('/wxgzh',
  async(ctx, next) => {
    try {
      let str = `https://api.weixin.qq.com/`
      if (ctx.query.url) {
        str += ctx.query.url
      }
      let token = await getToken()
      let options = {
        uri: str,
        qs: {
          access_token: token
        },
        headers: {
          'User-Agent': 'Request-Promise'
        },
        json: true
      }
      let res = await rp(options)
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get wxgzh err ->${err}`
      }
    }
  }
)

const getToken = () => {
  return new Promise(async(resolve, reject) => {
    try {
      let options = {
        url: `https://api.weixin.qq.com/cgi-bin/token`,
        qs: {
          grant_type: 'client_credential',
          appid: 'wxfa28b8b58582d1a7',
          secret: '367fae699db82e69782715588c57a885'
        },
        headers: {
          'User-Agent': 'Request-Promise'
        },
        json: true
      }
      let res = await rp(options)
      console.log(`res -> ${JSON.stringify(res)}`)
      resolve(res)
    } catch (err) {
      reject(`getToken err -> ${err}`)
    }
  })
}

router.get('/rate',
  jwt.verify,
  async(ctx, next) => {
    try {
      let rate = {
        yuyi: 0.8,
        rmb: 0.6
      }
      ctx.body = {
        status: 200,
        data: rate,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `rate err ->${err}`
      }
    }
  }
)

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
        msg: `${err}`
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
        if (type == '0') { //提现
          if (_.isEmpty(ret) || ret[0].yumao_num < 1667) {
            reject(`余额不足1667羽毛,不允许提现`)
          } else {
            sql = `select * from WxUser where userId="${userId}"`
            let wxUserInfo = await db.excute(sql)
            if (_.isEmpty) {
              reject(`请先授权`)
            } else {
              let nub = util.oprate(amount, 0.6, 'mul')
              nub = util.oprate(nub, 10, 'div')
              sql = `update Wallet set yumao_num="${ret[0].yumao_num-amount}" where userId="${userId}"`
              let result = await db.excute(sql)
              if (!_.isUndefined(result)) {
                sql = `insert into YumaoConsume values(null, "${userId}", "${orderNo}", "提现", "${amount}", "${ret[0].yumao_num-amount}", "${nub}", "${time}", "${config.rate}")`
                result = await db.excute(sql)
                // result = await pay(wxUserInfo[0].openid, nub)
                resolve(result)
              }
            }
          }
        } else { //兑换羽翼
          let nub = util.oprate(amount, 0.8, 'mul')
          sql = `update Wallet set yumao_num="${ret[0].yumao_num - amount}" where userId="${userId}"`
          let result = await db.excute(sql)
          if (!_.isUndefined(result)) {
            sql = `insert into YumaoConsume values(null, "${userId}", "${orderNo}", "兑换羽翼", "${amount}", "${ret[0].yumao_num-amount}", "${nub}", "${time}", "${config.rate}")`
            result = await db.excute(sql)
            if (!_.isUndefined(result)) {
              let yuyi_num = Number(ret[0].yuyi_num) + Number(nub)
              sql = `update Wallet set yuyi_num="${yuyi_num}" where userId="${userId}"`
              result = await db.excute(sql)
            } 
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

//wx 付钱模块
const pay = (openid, amount) => {
  return new Promise(async(resolve, reject) => {
    try {
      let data = {
        mch_appid: config.wxpt.appid,
        mchid: config.wxpt.mchid,
        nonce_str: ``,
        sign: ``,
        partner_trade_no: ``,
        openid: openid,
        check_name: `NO_CHECK`,
        amount: amount*100,
        desc: `提现`,
        spbill_create_ip: `120.24.14.130`
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

//是否够钱
const isEnoughYumao = (userId, amount) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `select * from Wallet where userId="${userId}"`
      let ret = await db.excute(sql)
      if (!_.isEmpty(ret) && ret[0].yumao_num >= amount) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (err) {
      reject(new Error(`isEnoughYumao err -> ${err}`))
    }
  })
}

// 微信授权回调接口
router.get('/wxAuthorization',
  async(ctx, next) => {
    try {
      let code = ctx.query.code
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      let options = {
        url: `https://api.weixin.qq.com/sns/oauth2/access\_token`,
        qs: {
          appid: config.wxpt.appid,
          secret: config.wxpt.secret,
          code: code,
          grant_type: authorization_code
        },
        headers: {
          'User-Agent': 'Request-Promise'
        },
        json: true
      }
      let result = await rp(options)
      console.log(`access-token ->${result}`)
      options = {
        url: `https://api.weixin.qq.com/sns/userinfo`,
        qs: {
          access_token: result.access_token,
          openid: result.openid,
          lang: zh_CN
        },
        headers: {
          'User-Agent': 'Request-Promise'
        },
        json: true
      }
      /* ret form
      {   "openid":" OPENID",
          "nickname": NICKNAME,
          "sex":"1",
          "province":"PROVINCE"
          "city":"CITY",
          "country":"COUNTRY",
          "headimgurl":    "http://wx.qlogo.cn/mmopen/g3MonUZtNHkdmzicIlibx6iaFqAc56vxLSUfpb6n5WKSYVY0ChQKkiaJSgQ1dZuTOgvLLrhJbERQQ4eMsv84eavHiaiceqxibJxCfHe/46",
          "privilege":[ "PRIVILEGE1" "PRIVILEGE2"     ],
          "unionid": "o6\_bmasdasdsad6\_2sgVt7hMZOPfL"
      }
      */
      let ret = await rp(options)
      console.log(`ret ->${ret}`)
      let query = new AV.Query('_User')
      query.equalTo('wxUid', ret.unionid)
      let uesr = await query.first()
      if (_.isUndefined(user)) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `请先在App内绑定微信`
        }
      } else {
        let sql = `insert into WxUser values(null, ${user.get('objectId')}, ${ret.unionid}, ${result.openid}, ${user.get('mobilePhoneNumber')}, ${time}, ${time})`
        let dbret = await db.excute(sql)
        console.log(`dbret => ${JSON.stringify(dbret)}`)
        if (_.isEmpty(dbret)) {
          return ctx.body = {
            status: -1,
            data: {},
            msg: `data err ->${err}`
          }
        } else {
          ctx.body = {
            status: 200,
            data: ret,
            msg: `success`
          }
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `wxAuthorization err => ${err}`
      }
    }
  }
)

//验证手机号
router.post('/verifyPhoneNub',
  async(ctx, next) => {
    try {
      let phoneNub = ctx.request.body.phoneNub
      if (!phoneNub) {
        return ctx.body = {
          status: 1001,
          data: {},
          msg: `params missing`
        }
      }
      let query = new AV.Query('_User')
      query.equalTo('mobilePhoneNumber', phoneNub)
      let user = await query.first()
      if (_.isUndefined(user)) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `未注册`
        }
      } else {
        ctx.body = {
          status: 200,
          data: util.getUserInfo(user),
          msg: `success`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `verify phone number err -> ${err}`
      }
    }
  }
)

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
      if (order_name) {
        if (order_name == 0) {
          ret = await db.select(`YumaoConsume`, `userId="${userId}" and order_name="提现"`, limit, skip, option)
        } else if (order_name == 1) {
          ret = await db.select(`YumaoConsume`, `userId="${userId}" and order_name="兑换羽翼"`, limit, skip, option)
        }
      } else {
        ret = await await db.select(`YumaoConsume`, `userId="${userId}"`, limit, skip, option)
      }
      if (!_.isEmpty(ret)) {
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
