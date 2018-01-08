const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const moment = require('moment')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const Room = require('../lib/audioRoom')

router.prefix('/v1')

//创建房间
router.post('/room',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        title
      } = ctx.request.body
      let owner = ctx.decode.userId
      console.log(`owner is ${owner}`)
      let room = new Room()
      let ret = await room.createRoom(title, owner)
      if (ret) {
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
        msg: `make a new room err->${err}`
      }
    }
  }
)

//获取房间信息
router.get('/room',
  // jwt.verify,
  async(ctx, next) => {
    try {
      let roomId = ctx.query.roomId
      if (!roomId) {
        return ctx.body = {
          status: 1003,
          data: {},
          msg: `params missing`
        }
      }
      let room = await new Room(roomId)
      let audioRoomInfo = await room.getRoom()
      ctx.body = {
        status: 200,
        data: audioRoomInfo,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get room err ->${err}`
      }
    }
  }
)

//获取所有房间列表
router.get('/roomList',
  // jwt.verify,
  async(ctx, next) => {
    try {
      let roomId = ctx.query.roomId
      let limit = ctx.query.limit ? ctx.query.limit : 20
      let skip = ctx.query.skip ? ctx.query.skip : 0
      let room = new Room()
      let audioRoomInfo = await room.getAllRooms(limit, skip)
      ctx.body = {
        status: 200,
        data: audioRoomInfo,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get room err ->${err}`
      }
    }
  }
)

//加人
router.post('/room/user',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        roomId,
        userId,
        position
      } = ctx.request.body
      let room = await new Room(roomId)
      let ret = await room.addMember(userId, position)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `add user to room err ->${err}`
      }
    }
  }
)

//用户主动退出房间时,不用传参数
//房主或者副房主踢人时传操作者的 userId
router.delete('/room/user',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.request.body.userId ? ctx.request.body.userId : ctx.decode.userId
      let {
        operatorId,
        roomId
      } = ctx.request.body
      let query = new AV.Query('AudioRoomMember')
      let user = AV.Object.createWithoutData('_User', operatorId)
      query.equalTo('user', user)
      query.equalTo('position', '-1')
      let ret = await query.first()
      //不是房主,并且不是副房主
      if (room.owner.get('objectId') !== operatorId && ret) {
        ctx.body = {
          status: 1003,
          data: {},
          msg: `没有权利`
        }
      } else {
        //用户直接退房间 或者房主踢人 或者副房主踢人
        let room = await new Room(roomId)
        let ret = await room.deleteUser(userId)
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
        msg: `delete user err ->${err}`
      }
    }
  }
)

//加锁或者解锁
//type == 1 加锁 type == 0 解锁
router.get('/room/lock',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        roomId,
        position,
        type
      } = ctx.query
      let room = await new Room(roomId)
      let ret = await room.setPosition(position, type)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `lock err ->${err}`
      }
    }
  }
)

module.exports = router
