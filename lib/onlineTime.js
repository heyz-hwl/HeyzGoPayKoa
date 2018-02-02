const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const moment = require('moment')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const util = require('./util')

class OnlineTime {
  constructor() {}

  //查看今天用户有没有登录过
  hasLogin(userId) {
    new Promise(async (resolve, reject) => {
      try {
        let user = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('OnlineTime')
        let today = moment().format(`YYYY-MM-DD`)
        query.equalTo('time', String(today))
        query.equalTo('user', user)
        let ret = await query.first()
        if (ret) {
          console.log(`ret->${JSON.stringify(ret)}`)
          resolve(ret)
        } else {
          console.log(`{}`)
          resolve({})
        }
      } catch (err) {
        reject(`ot isToday err ->${err}`)
      }
    })
  }

  //获取某人某天的在线时长
  getUserSomeDayOnlineTime(userId, date) {
    new Promise(async (resolve, reject) => {
      try {

      } catch (err) {

      }
    })
  }


}

module.exports = OnlineTime
