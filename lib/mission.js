const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const moment = require('moment')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const util = require('./util')
const OT = require('./onlineTime')

class Mission {

  achieveMission(userId, inviter) {
    return new Promise(async (resolve, reject) => {
      try {
        let grade = 0
        let ot = new OT()
        let userOnlineTimeInfo = ot.getUserAllOnlineTime(userId)
        let misstionNumber = userOnlineTimeInfo.over30MinsDay
        switch (misstionNumber) {
          case 1:
            await this.hongbaoMission(userId, inviter)
            return resolve()
            break;
          case 3:
            grade = 100
            break;
          case 7:
            grade = 250
            break;
          case 10:
            grade = 450
            break;
          case 15:
            grade = 700
            break;
          case 20:
            grade = 850
            break;
          case 25:
            grade = 1000
            break;
          case 30:
            grade = 1200
            break;
          default:
            return resolve()
            break;
        }
        await this.addUserGrade(userId, grade)
        await this.addInvitrerGrade(inviter, grade * 0.3)
        resolve()
      } catch (err) {
        reject(`achieveMission err ->${err}`)
      }
    })
  }

  hongbaoMission(userId, inviter) {
    return new Promise(async (resolve, reject) => {
      try {
        let user = AV.Object.createWithoutData('_User', userId)
        let Inviter = AV.Object.createWithoutData('_User', inviter.get('objectId'))
        let query = new AV.Query('Invitation')
        query.equalTo('inviter', Inviter)
        let count = await query.count
        if (count >= 4) {
          let promise = []
          let c = 0
          let userList = await query.find()
          userList.forEach((item, index) => {
            promise.push(new Promise(async (resolve, reject) => {
              let queryTime = new AV.Query('OnlineTime')
              let user = AV.Object.createWithoutData('_User', item.get('user').get('objectId'))
              queryTime.greaterThanOrEqualTo('onlineTime', 30)
              queryTime.equalTo('user', user)
              let ret = await queryTime.first()
              if (ret) {
                c++
                resolve()
              }
              resolve()
            }))
          })
          await Promise.all(promise)
          if (c >= 2) {
            let obj = AV.Object.new('Hongbao30')
            obj.set('user', user)
            await obj.save()
            await this.addUserGrade(userId, 100)
            await this.addInvitrerGrade(inviter, 100)
          }
        }
      } catch (err) {
        reject(`hongbaoMission err ->${err}`)
      }
    })
  }

  addUserGrade(userId, number) {
    return new Promise(async (resolve, reject) => {
      try {
        let query = new AV.Query('_User')
        query.equalTo('objectId', userId)
        let User = await query.first()
        let user = AV.Object.createWithoutData('_User', userId)
        user.set('grade', User.get('grade') + number)
        let ret = await user.save()
        resolve(ret)
      } catch (err) {
        reject(`mission add grade err->${err}`)
      }
    })
  }

  addInvitrerGrade(user, number) {
    return new Promise(async (resolve, reject) => {
      try {
        let u = AV.Object.createWithoutData('_User', user.get('objectId'))
        u.set('grade', user.get('grade') + number)
        await u.save()
      } catch (err) {
        reject(`addUserGrade err ->${err}`)
      }
    })
  }

}
