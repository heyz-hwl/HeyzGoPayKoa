const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const db = require('../lib/db')
const moment = require('moment')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const Room = require('../lib/audioRoom')
const utile = require('../lib/util')
const Mission = require('../lib/mission')

router.prefix('/v1')

router.get('/mission',
  async (ctx, next) => {
    try {
      let userId = ctx.query.userId
      let onlineTime = ctx.query.onlineTime
      let user = AV.Object.createWithoutData('_User', userId)
      if (onlineTime >= (60 * 30)) {
        let mission = new Mission()
        let query = new AV.Query('Invitation')
        query.include('inviter')
        query.equalTo('user', user)
        let invitation = await query.first()
        if (invitation) {
          await mission.achieveMission(userId, invitation.get('inviter'))
          return ctx.body = {
            status: 200,
            data: {},
            msg: `success`
          }
        }
      }
      ctx.body = {
        status: -200,
        data: {},
        msg: `err`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `err -> ${err}`
      }
    }
  }
)

router.get('/inviteCode',
  async (ctx, next) => {
    let userId = ctx.query.userId
    try {
      let query = new AV.Query('_User')
      query.equalTo('objectId', userId)
      let user = await query.first()
      if (user) {
        let inviteCode = user.get('HeyzId')
        return ctx.body = {
          status: 200,
          data: inviteCode,
          msg: `success`
        }
      } else {
        ctx.body = {
          status: 403,
          data: {},
          msg: `参数错误`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get invite code err->${err}`
      }
    }
  }
)

//用户输入邀请码
router.post('/inviteCode',
  async (ctx, next) => {
    let {
      inviteCode,
      userId
    } = ctx.request.body
    try {
      let query = new AV.Query('_User')
      query.equalTo('HeyzId', inviteCode)
      let User = await query.first()
      if (User) {
        let record = AV.Object.new('Invitation')
        let inviter = AV.Object.createWithoutData('_User', User.get('objectId'))
        record.set('inviter', inviter)
        let user = AV.Object.createWithoutData('_User', userId)
        record.set('user', user)
        await record.save()
        ctx.body = {
          status: 200,
          data: {},
          msg: `success`
        }
      } else {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `邀请码错误`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `invite err -> ${err}`
      }
    }
  }
)

router.get('/inviteTree',
  async (ctx, next) => {
    let inviterId = ctx.query.inviterId
    let array = []
    try {
      let ret = await getInviteTreeOnlineTime(inviterId)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get invite tree err->${err}`
      }
    }
  }
)

router.get('/url',
  async (ctx, next) => {
    try {
      let url = `www.baidu.com`
      ctx.body = {
        status: 200,
        data: url,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `err->${err}`
      }
    }
  }
)

//获取邀请树
const getInviteTree = (inviterId) => {
  return new Promise(async (resolve, reject) => {
    try {
      let array = []
      let inviter = AV.Object.createWithoutData('_User', inviterId)
      let query = new AV.Query('Invitation')
      query.include('user')
      query.equalTo('inviter', inviter)
      let inviteList = await query.find()
      if (!_.isEmpty(inviteList)) {
        array = inviteList.map((item, index) => {
          return utile.getUserInfo(item.get('user'))
        })
        let queryInviter = new AV.Query('_User')
        queryInviter.equalTo('objectId', inviterId)
        let inviterUser = await queryInviter.first()
        let inviterInfo = utile.getUserInfo(inviterUser)
        let ret = {
          inviter: inviterInfo,
          userList: array
        }
        resolve(ret)
      } else {
        reject(`该用户没有邀请记录`)
      }
    } catch (err) {
      reject(`getInviteTree err ->${err}`)
    }
  })
}

//获取用户的在线总时长和在线超过30分钟的天数
const getUserAllOnlineTime = (userId) => {
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

//组织数据结构
const getInviteTreeOnlineTime = (inviterId) => {
  return new Promise(async (resolve, reject) => {
    try {
      let inviteTree = await getInviteTree(inviterId)
      inviteTree.inviter.onlineTimeInfo = await getUserAllOnlineTime(inviteTree.inviter.userId)
      let promise = []
      inviteTree.userList.forEach((item, index) => {
        promise.push(new Promise(async (resolve, reject) => {
          try {
            let timeInfo = await getUserAllOnlineTime(item.userId)
            item.onlineTimeInfo = timeInfo
            resolve()
          } catch (err) {
            reject(`getInviteTreeOnlineTime promise err ->${err}`)
          }
        }))
      })
      await Promise.all(promise)
      resolve(inviteTree)
    } catch (err) {
      reject(`getInviteTreeOnlineTime err ->${err}`)
    }
  })
}

module.exports = router
