const AV = require('leancloud-storage')
const moment = require('moment')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const Room = require('../lib/audioRoom')
const utile = require('../lib/util')
const Mission = require('../lib/mission')

class Grade {

  recordGrade(userId, operation, grade, status, gradeRest) {
    return new Promise(async (resolve, reject) => {
      try {
        let record = AV.Object.new('GradeHistory')
        let user = AV.Object.createWithoutData('_User', userId)
        record.set('user', user)
        record.set('operation', operation)
        record.set('grade', grade)
        record.set('status', status)
        record.set('gradeRest', gradeRest)
        await record.save()
        resolve()
      } catch (err) {
        reject(`grade record err->${err}`)
      }
    })
  }
}

module.exports = Grade
