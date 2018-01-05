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
  jwt.verify,
  async(ctx, next) => {
    try {
      let roomId = ctx.query.roomId
      let room = new Room(roomId)
      let audioRoomInfo = await room.getRoomById(roomId)
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
      let room = new Room()
      let ret = await room.addMember(roomId, userId, position)
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

router.get('/room/lock',
  jwt.verify,
  async(ctx, next) => {
    try{
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
    }catch(err){
      ctx.body = {
        status: -1,
        data: {},
        msg: `lock err ->${err}`
      }
    }
  }
)

module.exports = router
