const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const _ = require('lodash');
const moment = require('moment')
const util = require('../lib/util');
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')

router.prefix('/v1')

router.post('/register',
  async(ctx, next) => {
    try {
      let {
        phone,
        wechat,
        corpsName,
        type
      } = ctx.request.body

      if (!phone || !corpsName || !wechat || !type) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `params missing`
        }
      }

      if (!(/^1[345678]\d{9}$/.test(phone))) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `wrong phone number`
        }
      }

      let query = new AV.Query(`_User`)
      query.equalTo(`mobilePhoneNumber`, phone)
      let user = await query.first()
      if (!user) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `未注册用户`
        }
      }

      let register = AV.Object.new(`CompeteRegister`)
      register.set('phone', phone)
      register.set('corpsName', corpsName)
      register.set('type', type)
      register.set('wechat', wechat)
      let ret = await register.save()
      console.log(`ret is ${JSON.stringify(ret)}`)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `post register err ->${err}`
      }
    }
  })

router.get('/register', async(ctx, next) => {
  try {
    // let thisWeek = new Date(moment().add(1, 'day'))
    // let lastWeek = new Date(moment().subtract(Number(moment().day()), 'day'))
    let query = new AV.Query('CompeteRegister')
    // query.lessThanOrEqualTo('createdAt', new Date())
    // query.greaterThanOrEqualTo('createdAt', lastWeek)
    query.addDescending('createAt')
    let ret = await query.find()
    ctx.body = {
      status: 200,
      data: ret,
      msg: `success`
    }
  } catch (err) {
    ctx.body = {
      status: -1,
      data: {},
      msg: `get register err ->${err}`
    }
  }
})

module.exports = router;
