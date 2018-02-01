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

router.prefix('/v1')

//创建房间
router.post('/room',
  jwt.verify,
  async (ctx, next) => {
    let title = ctx.request.body.title
    let pwd = ctx.request.body.pwd ? ctx.request.body.pwd : ''
    let owner = ctx.decode.userId
    try {
      let room = new Room()
      let userInRoom = await room.userRoom(owner)
      if (userInRoom.status !== 203) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `你已经在${userInRoom.data.roomNumber}房间里`
        }
      }
      let ret = await room.createRoom(title, owner, pwd)
      if (ret) {
        socket.sockets.in(`room${ret.get('objectId')}`).emit('userJoinRoom', {
          roomId: ret.get('objectId')
        })
        ctx.body = {
          status: 200,
          data: ret,
          msg: `success`
        }
      }
    } catch (err) {
      logger.error(`make a new room err->${err}params ->title=${title},pwd=${pwd},owner=${owner}`)
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
  async (ctx, next) => {
    let roomId = ctx.query.roomId
    try {
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
      logger.error(`get room err ->${err} params ->roomId=${roomId}`)
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
  async (ctx, next) => {
    let userId = ctx.query.userId
    try {
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
      logger.error(`get owner Room err ->${err} params ->userId=${userId}`)
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
  async (ctx, next) => {
    let roomId = ctx.query.roomId
    try {
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
      logger.error(`get room member err ->${err} params ->roomId=${roomId}`)
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
  async (ctx, next) => {
    let roomId = ctx.query.roomId
    try {
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
      logger.error(`get allUsers audience err ->${err} params ->roomId=${roomId}`)
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
  async (ctx, next) => {
    try {
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
  async (ctx, next) => {
    let roomId = ctx.request.body.roomId
    let pwd = ctx.request.body.pwd ? ctx.request.body.pwd : ''
    let userId = ctx.decode.userId
    try {
      let room = await new Room(roomId)
      let user = AV.Object.createWithoutData('_User', userId)
      let queryMember = new AV.Query('AudioRoomMember')
      queryMember.equalTo('user', user)
      queryMember.include('room')
      let ret2 = await queryMember.first()
      if (ret2) {
        if (ret2.get('room').get('objectId') == roomId) {

          return ctx.body = {
            status: 200,
            data: roomId,
            msg: `直接加入房间`
          }
        }
        return ctx.body = {
          status: 1005,
          data: {},
          msg: `你已在${ret2.get('room').get('roomNumber')}房间内`
        }
      }
      if (userId == room.owner.userId) {
        let roomInfo = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        roomInfo.set('ownerOnline', true)
        await roomInfo.save()
        let query = new AV.Query('AudioRoomDisplay')
        let Room = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        query.equalTo('room', Room)
        let roomDisplay = await query.first()
        if (!roomDisplay) { // 没有的话->display
          let RoomDisplay = AV.Object.new('AudioRoomDisplay')
          RoomDisplay.set('room', Room)
          await RoomDisplay.save()
        } //有的话直接返回
        socket.sockets.in(`room${roomId}`).emit('userJoinRoom', {
          roomId: roomId
        })
        return ctx.body = {
          status: 200,
          data: roomId,
          msg: `直接加入房间`
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
      logger.error(`add user to room err ->${err} params ->roomId=${roomId},pwd=${pwd}`)
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
  async (ctx, next) => {
    let operatorId = ctx.decode.userId
    let {
      userId,
      roomId
    } = ctx.request.body
    try {
      let ret = {}
      let room = await new Room(roomId)
      //这里还要考虑:
      //1.房主自己退出房间的情况 ->ok
      //2.副房主被房主踢出房间的情况 ->一样
      //3.副房主能不能被其他副房主踢出房间? ->暂时只有一个副房主,没有这个问题
      //4.副房主自己退出房间 ->一样
      //5.房间最后一个人走了以后要怎么处理->不展示

      if (await room.hasRight(operatorId)) { //执行者不是房主也不是副房主
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
      logger.error(`delete user err ->${err} params ->userId=${userId},roomId=${roomId}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `delete user err ->${err}`
      }
    }
  }
)

//邀请上麦
router.get('/invitePosition',
  jwt.verify,
  async (ctx, next) => {
    let userId = ctx.query.userId
    let position = ctx.query.position
    let roomId = ctx.query.roomId
    let operatorId = ctx.decode.userId
    try {
      let sql = `select * from ConnectedUser where userId="${userId}"`
      let socketId = await db.excute(sql)
      let room = await new Room(roomId)
      if (await room.hasRight(operatorId)) {
        let userQuery = new AV.Query('_User')
        userQuery.equalTo('objectId', operatorId)
        let s = await userQuery.first()
        let sender = utile.getUserInfo(s)
        let query = new AV.Query('AudioRoomMember')
        let user = AV.Object.createWithoutData('_User', userId)
        let room = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        query.equalTo('room', room)
        query.equalTo('user', user)
        let ret = await query.first()
        if (ret && !_.isEmpty(socket)) {
          socket.sockets.connected[socketId[0].socketId].emit('invitePosition', {
            roomId: roomId,
            position: position,
            owner: sender
          })
        }
        return ctx.body = {
          status: 200,
          data: {},
          msg: `success`
        }
      }
      return ctx.body = {
        status: 403,
        data: {},
        msg: `只有房主和副房主有权利邀请`
      }
    } catch (err) {
      logger.error(`invite position err ->${err} params ->userId=${userId},position=${position} roomId=${roomId}`)
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
  async (ctx, next) => {
    let {
      position,
      roomId,
      userId
    } = ctx.request.body
    let operatorId = ctx.decode.userId
    try {
      let room = await new Room(roomId)
      if (position === '0' && operatorId !== userId) {
        if (await room.hasRight(operatorId)) { //请离需要权限
          ret = await room.setUserPosition(userId, position)
          let roomMember = await room.getMember(roomId, 1)
          socket.sockets.in(`room${roomId}`).emit('RoomUserChangePosition', {
            data: roomMember,
            info: room
          })
          return ctx.body = {
            status: 200,
            data: ret,
            msg: `success`
          }
        } else {
          return ctx.body = {
            status: 1006,
            data: {},
            msg: `没有权限`
          }
        }
      } else {
        ret = await room.setUserPosition(userId, position)
        let roomMember = await room.getMember(roomId, 1)
        socket.sockets.in(`room${roomId}`).emit('RoomUserChangePosition', {
          data: roomMember,
          info: room
        })
        ctx.body = {
          status: 200,
          data: ret,
          msg: `success`
        }
      }
    } catch (err) {
      logger.error(`set position err ->${err} params ->position=${position},roomId=${roomId} userId=${userId}`)
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
  async (ctx, next) => {
    let {
      roomId,
      position,
      type
    } = ctx.request.body
    let operatorId = ctx.decode.userId
    try {
      let room = await new Room(roomId)
      if (await room.hasRight(operatorId)) {
        let ret = await room.setPosition(position, type)
        socket.sockets.in(`room${roomId}`).emit('RoomLock', ret)
        ctx.body = {
          status: 200,
          data: ret,
          msg: `success`
        }
      }
    } catch (err) {
      logger.error(`lock err ->${err} params ->roomId=${roomId},position=${position},type=${type}`)
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
  async (ctx, next) => {
    let pwd = ctx.request.body.pwd ? ctx.request.body.pwd : ''
    let userId = ctx.decode.userId
    let roomId = ctx.request.body.roomId
    try {
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
      logger.error(`set room pwd err ->${err} pwd=${pwd},userId=${userId},roomId=${roomId}`)
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
  async (ctx, next) => {
    let userId = ctx.decode.userId
    if (ctx.query.userId) {
      userId = ctx.query.userId
    }
    try {
      let room = new Room()
      let ret = await room.userRoom(userId)
      ctx.body = ret
    } catch (err) {
      logger.error(`get user room err is ${err} params ->userId=${userId}`)
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
  async (ctx, next) => {
    let {
      title,
      background,
      icon,
      roomId
    } = ctx.request.body
    let owner = ctx.decode.userId
    try {
      let room = await new Room(roomId)
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
      logger.error(`update roomInfo err is ${err}params ->title=${title},background=${background},icon=${ico},roomId=${roomId},owner=${owner}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `update roomInfo err is ${err}`
      }
    }
  })

module.exports = router
