const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const moment = require('moment')
const db = require('../lib/db')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const Room = require('../lib/audioRoom')

router.prefix('/v1')

//创建房间
router.post('/room',
  // jwt.verify,
  async(ctx, next) => {
    try {
      let {
        title,
        userId
      } = ctx.request.body
      let owner = ctx.request.body.userId
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
  jwt.verify,
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
      let room = await new Room()
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
