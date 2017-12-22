const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const async = require('async')
const _ = require('lodash')
const moment = require('moment')
const db = require('../lib/db')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const func = require('../lib/func')
const util = require('../lib/util')


router.prefix('/v1')

//创建战队
router.post('/corps',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        inviteMemberList, //邀请列表
        corpsName, //战队名
        declare, //宣言
        creater, //创建者 ID
        icon //icon
      } = ctx.request.body
      let promise = []
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      //创建战队,记录信息,但未通过
      let sql = `insert into CorpsInfo values(null, "${corpsName}", 0, 0, "${declare}", 1, "${icon}", 0);`
      let ret1 = await db.excute(sql)
      //记录队长
      if (!ret1) {
        throw new Error(`insert info err`)
      } else {
        sql = `insert into CorpsMember values(null,"${ret1.insertId}", "${creater}", "1", "${time}")`
        let ret2 = await db.excute(sql)
        //发起邀请
        inviteMemberList.forEach((memberId, index) => {
          promise.push(new Promise(async(resolve, reject) => {
            try {
              let user = await func.getUserInfoByUserId(memberId)
              let sql = `insert into CorpsInvite values(null, "${ret1.insertId}", "${creater}", "${memberId}", ${false}, "${time}", null)`
              let ret = await db.excute(sql)
              resolve(user)
            } catch (err) {
              reject(`insert invite err ->${err}`)
            }
          }))
        })
        let ret = await Promise.all(promise)
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
        msg: `create err ->${err}`
      }
    }
  }
)

//获取战队邀请列表
router.get('/inviteList',
  jwt.verify,
  async(ctx, next) => {
    try {
      let corpsId = ctx.query.corpsId
      let isPass = ctx.query.isPass
      console.log(`isPass ->${isPass}`)
      let promise = []
      if (!corpsId) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `params missing`
        }
      }
      let sql = `select * from CorpsInvite where corpsId="${corpsId}" and isPass="${isPass}"`
      let result = await db.excute(sql)
      if (_.isEmpty(result)) {
        return ctx.body = {
          status: 200,
          data: {},
          msg: `invite list is empty`
        }
      }
      result.forEach((info) => {
        promise.push(new Promise(async(resolve, reject) => {
          let member = await func.getUserInfoByUserId(info.userId)
          let ret = _.extend(info, member)
          resolve(ret)
        }))
      })
      let ret = await Promise.all(promise)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get inviteList err => ${err}`
      }
    }
  }
)

//邀请加入战队
router.post('/invite',
  jwt.verify,
  async(ctx, next) => {
    try {
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      let userIdList = ctx.request.body.userIdList
      let corpsId = ctx.request.body.corpsId
      let inviterId = ctx.decode.userId
      let promise = []
      userIdList.forEach(async(userId, index) => {
        promise.push(new Promise(async(resolve, reject) => {
          try {
            let sql = `insert into CorpsInvite values(null, "${corpsId}", "${inviterId}", "${userId}", ${false}, "${time}", null)`
            let ret = await db.excute(sql)
            resolve(ret)
          } catch (err) {
            reject(err)
          }
        }))
      })
      let retArr = await Promise.all(promise)
      if (!retArr) {
        throw new Error(`insert err`)
      } else {
        ctx.body = {
          status: 200,
          data: retArr,
          msg: `success`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `add inviteList err ->${err}`
      }
    }
  }
)

//获取战队信息
router.get('/corps',
  jwt.verify,
  async(ctx, next) => {
    try {
      let corpsId = ctx.query.corpsId
      let userType = ctx.query.userType
      let ret = await getCorpsInfo(corpsId, userType)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get corps err ->${err}`
      }
    }
  }
)

//用户接受邀请
router.get('/acceptInvite',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.query.userId
      let inviteId = ctx.query.inviteId
      let corpsId = ctx.query.corpsId
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      let sql = `update CorpsInvite set isPass = 1 where id="${inviteId}"`
      let ret = await db.excute(sql)
      if (ret) {
        sql = `insert CorpsMember values(null, "${corpsId}", "${userId}", 0, "${time}")`
        ret = await db.excute(sql)
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
        msg: `acceptInvite err ->${err}`
      }
    }
  }
)

router.get('/allCorps',
  jwt.verify,
  async(ctx, next) => {
    try {
      let limit = ctx.query.limit ? ctx.query.limit : 10
      let skip = ctx.query.skip ? ctx.query.skip : 0
      let sql = `select * from CorpsInfo where isPass=${true} limit ${skip}, ${limit}`
      let cinfo = await db.excute(sql)
      let promise1 = []
      cinfo.forEach((corps, index) => {
        promise1.push(new Promise(async(resolve, reject) => {
          let ret = await getCorpsInfo(corps.id, undefined)
          resolve(ret)
        }))
      })
      let r = await Promise.all(promise1)
      ctx.body = {
        status: 200,
        data: r,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get all corps err ->${err}`
      }
    }
  }
)

const getCorpsInfo = (corpsId, userType) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `select * from CorpsInfo where id="${corpsId}"`
      let corpsInfo = await db.excute(sql)
      sql = `select * from CorpsMember where corpsId="${corpsId}"`
      if (!_.isUndefined(userType)) {
        sql += `and position="${userType}"`
      }
      let corpsMemberList = await db.excute(sql)
      let promise = []
      corpsMemberList.forEach((member, indexe) => {
        promise.push(new Promise(async(resolve, reject) => {
          try {
            let sql = `select * from CorpsMember where memberId="${member.memberId}" and corpsId="${corpsId}"`
            let dbret = await db.excute(sql)
            let info = await func.getUserInfoByUserId(dbret[0].memberId)
            let ret = await _.extend(member, info)
            resolve(ret)
          } catch (err) {
            reject(err)
          }
        }))
      })
      let result = await Promise.all(promise)
      let ret = {
        corpsInfo: corpsInfo[0],
        memberInfo: result
      }
      resolve(ret)
    } catch (err) {
      reject(`getCorpsInfo err ->${err}`)
    }
  })
}

//用户申请加入战队
router.post('/corps/apply',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId
      let corpsId = ctx.request.body.corpsId
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      let sql = `select * from CorpsMember where corpsId="${corpsId}" and memberId="${userId}";`
      let inCorps = await db.excute(sql)
      if (!_.isEmpty(inCorps)) {
        return ctx.body = {
          status: 1002,
          data: {},
          msg: `已在战队中`
        }
      }
      sql = `insert into CorpsInvite values(null, "${corpsId}", "${userId}", "${userId}", 0, "${time}", null)`
      let ret = await db.excute(sql)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `apply err ->${err}`
      }
    }
  }
)

module.exports = router
