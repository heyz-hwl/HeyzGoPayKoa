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
      logger.error(`make a new room err->${err}`)
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
      let roomObj = AV.Object.createWithoutData('AudioRoomInfo', roomId)
      let query = new AV.Query('AudioRoomMember')
      query.equalTo('room', roomObj)
      let count = await query.count()
      let room = await new Room(roomId)
      if (room.ownerOnline) {
        count++
      }
      room.count = count
      ctx.body = {
        status: 200,
        data: room,
        msg: `success`
      }
    } catch (err) {
      logger.error(`get room err ->${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `get room err ->${err}`
      }
    }
  }
)

router.get('/ownerRoom',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.query.userId
      let room = new Room()
      let data = await room.getOwneRoom(userId)
      if (_.isEmpty(data)) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `have not room`
        }
      }
      ctx.body = {
        status: 200,
        data: data,
        msg: `success`
      }
    } catch (err) {
      logger.error(`get owner Room err ->${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `get owner Room err ->${err}`
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
      logger.error(`get room member err ->${err}`)
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
      let ret = []
      if (room.ownerOnline) {
        ret = [room.owner, ...data]
      } else {
        ret = data
      }
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      logger.error(`get allUsers audience err ->${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `get allUsers audience err ->${err}`
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
      logger.error(`get room err ->${err}`)
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
        pwd
      } = ctx.request.body
      let userId = ctx.decode.userId
      let room = await new Room(roomId)
      let queryMember = new AV.Query('AudioRoomMember')
      queryMember.equalTo('user', user)
      queryMember.include('room')
      let ret2 = await queryMember.first()
      if (ret2) {
        return ctx.body = {
          status: 1005,
          data: {},
          msg: `你已在${ret2.get('room').get('roomNumber')}房间内`
        }
      }
      if (pwd !== room.pwd) {
        return ctx.body = {
          status: 403,
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
      logger.error(`add user to room err ->${err}`)
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
      //这里还要考虑:
      //1.房主自己退出房间的情况 ->ok
      //2.副房主被房主踢出房间的情况 ->一样
      //3.副房主能不能被其他副房主踢出房间? ->暂时只有一个副房主,没有这个问题
      //4.副房主自己退出房间 ->一样
      //5.房间最后一个人走了以后要怎么处理->不展示

      //执行者不是房主也不是副房主
      //也不是执行者自己退出房间
      if (operatorId !== room.owner.userId && !_.isUndefined(ret)) { //执行者不是房主也不是副房主
        if (operatorId !== userId) { //不是执行者自己退出房间
          return ctx.body = {
            status: 1003,
            data: {},
            msg: `没有权利`
          }
        }
      }
      if (operatorId == room.owner.userId && userId == room.owner.userId) { //房主自己退出房间
        await room.ownerOffline()
        socket.sockets.in(`room${roomId}`).emit('ownerLeaveRoom', roomId)
        return ctx.body = {
          status: 200,
          data: {},
          msg: `owner leave successfully`
        }
      }
      //用户直接退房间 或者房主踢人 或者副房主踢人
      await room.deleteUser(userId)
      let result = await room.getRoomInfoById(roomId)
      socket.sockets.to(`room${roomId}`).emit('userLeaveRoom', {
        roomId: roomId,
        userId: userId
      })
      ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      logger.error(`delete user err ->${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `delete user err ->${err}`
      }
    }
  }
)

router.get('/invitePosition',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.query.userId
      let position = ctx.query.position
      let roomId = ctx.query.roomId
      let sql = `select * from ConnectedUser where userId="${userId}"`
      let socketId = await db.excute(sql)
      let query = new AV.Query('AudioRoomMember')
      let user = AV.Object.createWithoutData('_User', userId)
      let room = AV.Object.createWithoutData('AudioRoomInfo', roomId)
      query.equalTo('room', room)
      query.equalTo('user', user)
      let ret = await query.first()
      if (ret && !_.isEmpty(socket)) {
        socket.sockets.connected[socketId[0].socketId].emit('invitePosition', position)
      }
      ctx.body = {
        status: 200,
        data: {},
        msg: `success`
      }
    } catch (err) {
      logger.error(`invite position err ->${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `invite position err ->${err}`
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
    } catch (err) {
      logg.error(`set position err ->${err}`)
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
      logger.error(`lock err ->${err}`)
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
      let room = await new Room(roomId)
      if (room.owner.userId == userId) {
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
      logger.error(`set room pwd err ->${err}`)
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
      let ret = await room.userRoom(userId)
      ctx.body = ret
    } catch (err) {
      logger.error(`get user room err is ${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `get user room err is ${err}`
      }
    }
  })

// 修改房间信息
router.put('/roomInfo',
  jwt.verify,
  async(ctx, next) => {
    try {
      let {
        title,
        background,
        icon,
        roomId
      } = ctx.request.body
      let owner = ctx.decode.userId
      let room = await new Room(roomId)
      console.log(`owner ->${JSON.stringify(room.owner)}`)
      if (owner !== room.owner.userId) {
        return ctx.body = {
          status: 1001,
          msg: '只有房主才能修改标题'
        }
      }
      if (!roomId) {
        return ctx.body = {
          status: 1000,
          data: {},
          msg: 'Parameter Missing!'
        }
      }
      let roomObj = AV.Object.createWithoutData('AudioRoomInfo', roomId)
      if (title) {
        roomObj.set('title', title)
      }
      if (background) {
        let bgo = AV.Object.createWithoutData('_File', background)
        roomObj.set('background', bgo)
      }
      if (icon) {
        let ico = AV.Object.createWithoutData('_File', icon)
        roomObj.set('icon', ico)
      }
      let ret = await roomObj.save()
      ctx.body = {
        status: 200,
        data: ret,
        msg: 'success'
      }
    } catch (err) {
      logger.error(`update roomInfo err is ${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `update roomInfo err is ${err}`
      }
    }
  })

module.exports = router
