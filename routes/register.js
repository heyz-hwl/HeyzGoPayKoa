const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const _ = require('lodash');
const moment = require('moment')
const util = require('../lib/util');
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')

router.prefix('/v1')

router.post('/register', async(ctx, next) => {
  let {
    phone,
    nickName,
    gender,
    type,
    isWechat,
    level,
    wechat
  } = ctx.request.body

  if (!phone || !nickName || !gender || !type || !isWechat || !level || !wechat) {
    return ctx.body = {
      status: 403,
      data: {},
      msg: `params missing`
    }
  }

  if (!(/^1[34578]\d{9}$/.test(phone))) {
    return ctx.body = {
      status: 403,
      data: {},
      msg: `wrong phone number`
    }
  }

  let register = AV.Object.new(`CompeteRegister`)
  register.set('gender', gender)
  register.set('phone', phone)
  register.set('nickName', nickName)
  register.set('type', type)
  register.set('isWechat', isWechat)
  register.set('level', level)
  register.set('wechat', wechat)
  let ret = await register.save()
  console.log(`ret is ${JSON.stringify(ret)}`)
  if (ret) {
    ctx.body = {
      status: 200,
      data: ret,
      msg: `success`
    }
  }
})

router.get('/register', async(ctx, next) => {
  let {
    time
  } = ctx.request.body
  let thisWeek = moment().format('YYYY-MM-DD')
  let lastWeek = moment().subtract(7, 'day')
  let query = new AV.Query('CompeteRegister')
  query.lessThanOrEqualTo('createAt', new Date(thisWeek))
  query.greaterThanOrEqualTo('createAt', new Date(lastWeek))
  query.addDescending('createAt')
  let ret = await query.find()
  if (ret) {
    ctx.body = {
      status: 200,
      data: ret,
      msg: `success`
    }
  }
})

module.exports = router;
