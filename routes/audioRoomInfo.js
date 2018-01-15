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
        title,
        pwd
      } = ctx.request.body
      let owner = ctx.decode.userId
      let room = new Room()
      let ret = await room.createRoom(title, owner, pwd)
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

//获取房间基本信息
router.get('/roomInfo',
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
      ctx.body = {
        status: 200,
        data: room,
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

//获取房间成员信息
router.get('/roomMember',
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
      let room = new Room()
      let roomMember = await room.getMember(roomId, 1)
      ctx.body = {
        status: 200,
        data: roomMember,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get room member err ->${err}`
      }
    }
  }
)

//获取房间的所有成员的信息
router.get('/room/allUsers',
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
      let data = await room.getMember(roomId, 0)
      ctx.body = {
        status: 200,
        data: [room.owner, ...data],
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get allUsers audience err ->${err}`
      }
    }
  }
)

router.get('/roomCount',
  jwt.verify,
  async(ctx, next) => {
    try {
      let roomId = ctx.query.roomId
      let roomObj = AV.Object.createWithoutData('AudioRoomInfo', roomId)
      let query = new AV.Query('AudioRoomMember')
      query.equalTo('room', roomObj)
      let count = await query.count()
      let room = await new Room(roomId)
      if (room.ownerOnline) {
        count++
      }
      ctx.body = {
        status: 200,
        data: count,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get room count err->${err}`
      }
    }
  }
)

//获取所有房间列表
router.get('/roomList',
  jwt.verify,
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
        position,
        pwd
      } = ctx.request.body
      let userId = ctx.decode.userId
      let room = await new Room(roomId)
      if ((room.pwd) !== pwd) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `密码错误`
        }
      }
      let ret = await room.addMember(userId)
      socket.sockets.in(`room${roomId}`).emit('userJoinRoom', roomId)
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
//退出房间的用户是 userId
router.delete('/room/user',
  jwt.verify,
  async(ctx, next) => {
    try {
      let operatorId = ctx.decode.userId
      let {
        userId,
        roomId
      } = ctx.request.body
      let ret = {}
      let room = await new Room(roomId)
      let query = new AV.Query('AudioRoomMember')
      let user = AV.Object.createWithoutData('_User', operatorId)
      query.equalTo('user', user)
      query.equalTo('position', '-1')
      ret = await query.first()
      //执行者不是房主也不是副房主
      //或者执行者自己退出房间
      //这里还要考虑:
      //1.房主自己退出房间的情况
      //2.副房主被房主踢出房间的情况
      //3.副房主不能被其他副房主踢出房间
      //4.副房主自己退出房间
      //5.房间最后一个人走了以后要怎么处理
      if ((room.owner.get('objectId') !== operatorId && _.isEmpty(ret)) || operatorId == userId) {
        ctx.body = {
          status: 1003,
          data: {},
          msg: `没有权利`
        }
      } else {
        //用户直接退房间 或者房主踢人 或者副房主踢人
        let room = await new Room(roomId)
        let ret = await room.deleteUser(userId)
        let result = await room.getRoom()
        socket.sockets.to(`room${roomId}`).emit('userLeaveRoom', roomId)
        ctx.body = {
          status: 200,
          data: result,
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

//设置房间成员的位置
router.post('/position',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        position,
        roomId,
        userId
      } = ctx.request.body
      let room = await new Room(roomId)
      let ret = await room.setUserPosition(userId, position)
      socket.sockets.in(`room${roomId}`).emit('RoomUserChangePosition', roomId)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    }catch(err){
      ctx.body = {
        status: -1,
        data: {},
        msg: `set position err ->${err}`
      }
    }
  }
)

//加锁或者解锁
//type == 1 加锁 type == 0 解锁
router.post('/room/lock',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        roomId,
        position,
        type
      } = ctx.request.body
      let room = await new Room(roomId)
      let ret = await room.setPosition(position, type)
      socket.sockets.in(`room${roomId}`).emit('RoomLock', ret)
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

//设置房间密码
//不传 pwd 即取消密码
router.post('/pwd',
  jwt.verify,
  async(ctx, next) => {
    try {
      let pwd = ctx.request.body.pwd ? ctx.request.body.pwd : ''
      let userId = ctx.decode.userId
      let roomId = ctx.request.body.roomId
      let query = new AV.Query('AudioRoomInfo')
      query.equalTo('objectId', roomId)
      let room = await query.first()
      if (room.get('owner') == userId) {
        let newRoom = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        newRoom.set('pwd', pwd)
        let ret = await newRoom.save()
        return ctx.body = {
          status: 200,
          data: ret,
          msg: `success`
        }
      } else {
        return ctx.body = {
          status: 1003,
          data: {},
          msg: `不是房主无权操作`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `set room pwd err ->${err}`
      }
    }
  }
)

// 查询用户在哪个房间
router.get('/userRoom',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId
      if (ctx.query.userId) {
        userId = ctx.query.userId
      }
      let room = new Room()
      let data = await room.userRoom(userId)
      if (_.isEmpty(data)) {
        return ctx.body = {
          status: 202,
          data: {},
          msg: `not in room`
        }
      }
      ctx.body = {
        status: 200,
        data: data,
        msg: `get user room success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get user room err is ${err}`
      }
    }
  })

// 修改房间 title
router.put('/roomTitle',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        title,
        roomId
      } = ctx.request.body
      let owner = ctx.decode.userId
      let room = await new Room(roomId)
      if (owner !== room.owner.get('objectId')) {
        return ctx.body = {
          status: 1001,
          msg: '只有房主才能修改标题'
        }
      }
      if (!title || !roomId) {
        return ctx.body = {
          status: 1000,
          data: {},
          msg: 'Parameter Missing!'
        }
      }
      let roomObj = AV.Object.createWithoutData('AudioRoomInfo', roomId)
      roomObj.set('title', title)
      let ret = await roomObj.save()
      ctx.body = {
        status: 200,
        data: ret,
        msg: 'success'
      }
    } catch (err) {
      logger.error(`update roomtitle err is ${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `update roomtitle err is ${err}`
      }
    }
  })

module.exports = router
