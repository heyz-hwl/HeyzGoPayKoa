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
    return new Promise(async (resolve, reject) => {
      try {
        let user = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('OnlineTime')
        let today = moment().format(`YYYY-MM-DD`)
        query.equalTo('time', String(today))
        query.equalTo('user', user)
        let ret = await query.first()
        if (ret) {
          resolve(ret)
        } else {
          resolve({})
        }
      } catch (err) {
        reject(`ot isToday err ->${err}`)
      }
    })
  }

  //获取某人某天的在线时长
  getUserSomeDayOnlineTime(userId, date) {
    return new Promise(async (resolve, reject) => {
      try {
        let query = new AV.Query('OnlineTime')
        let user = AV.Object.createWithoutData('_User', userId)
        query.equalTo('user', user)
        query.equalTo('time', date)
        let ret = await query.first()
        if (ret) {
          resolve(ret)
        } else {
          reject(`no record`)
        }
      } catch (err) {
        reject(`getUserSomeDayOnlineTime err ->${err}`)
      }
    })
  }

  //获取用户的在线总时长和在线超过30分钟的天数
  getUserAllOnlineTime(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        let user = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('OnlineTime')
        query.equalTo('user', user)
        let userOnlineTime = await query.find()
        let onlineTimeCount = 0
        userOnlineTime.forEach((item) => {
          onlineTimeCount += item.get('onlineTime')
        })
        query.greaterThanOrEqualTo('onlineTime', 30)
        let over30MinsDay = await query.count()
        let ret = {
          userOnlineTimeCount: onlineTimeCount,
          over30MinsDay: over30MinsDay
        }
        resolve(ret)
      } catch (err) {
        reject(`getUserAllOnlineTime ->${err}`)
      }
    })
  }

}

module.exports = OnlineTime
