const io = require('socket.io').listen(9998)
const moment = require('moment')
const db = require('./db')
const AV = require('leancloud-storage')
const _ = require('lodash')
const util = require('./util')
const log4js = require('koa-log4')
const logger = log4js.getLogger('socket')
const Room = require('./audioRoom')
const OT = require('./onlineTime')

console.log("socket port is 9998")
io.sockets.on('connection', function (socket) {

  socket.on('error', (err) => {
    logger.error(`socket err is ${err}`)
  })

  socket.on('login', async (userId) => {
    if (userId) {
      let socketId = socket.id
      let time = moment().format('YYYY-MM-DD HH:mm:ss')
      let sql = `delete from ConnectedUser where userId = "${userId}"`
      let ret = await db.excute(sql)
      sql = `insert into ConnectedUser values(null,"${userId}","${socketId}","${time}")`
      let result = await db.excute(sql)
      if (result) {
        socket.emit('LoginSuccess', `LoginSuccess`)
      }
    } else {
      socket.emit('LoginSuccess', `login data is null`)
    }
  })

  socket.on('joinRoom', (data) => {
    socket.join(`room${data.roomId}`)
    // socket.in(`room${data.roomId}`).emit('userJoinRoom', `${data.userId} join in the Room${data.roomId}`)
  })

  socket.on('leaveRoom', (data) => {
    socket.leave(`room${data.roomId}`)
    // socket.to(`room${data.roomId}`).emit('userLeaveRoom', `${data.userId} leave in the Room${data.roomId}`)
  })

  //socket 断开连接
  socket.on('disconnect', async function () {
    try {
      console.log('user disconnected')
      let userId = ''
      let sql = `select * from ConnectedUser where socketId = "${socket.id}"`
      let result = await db.excute(sql)
      userId = result[0].userId
      let time = result[0].time
      let leaveTime = moment().format('YYYY-MM-DD HH:mm:ss')
      let onlineTime = util.date2TimeStamp(leaveTime) - util.date2TimeStamp(time)
      await addGrade(onlineTime, userId)
      console.log(`onlineTime is ${onlineTime}`)
      let query = new AV.Query(`_User`)
      query.equalTo(`objectId`, userId)
      let User = await query.first()
      let onlineTime2 = User.get(`onlineTime`)
      let user = AV.Object.createWithoutData('_User', userId)
      user.set(`onlineTime`, onlineTime + onlineTime2)
      let ret = await user.save() //加上在线时间
      let sql2 = `delete from ConnectedUser where userId = "${userId}"`
      await db.excute(sql2) // 把断开连接的用户从数据库里删掉
      //115S 后该用户如果还没有连上,就把他从房间里踢出去
      await setTimeout(async () => {
        let result2 = await db.excute(`select * from ConnectedUser where userId = "${userId}"`)
        if (_.isEmpty(result2)) {
          console.log(`没有连上,退出房间}`)
          let roomObj = new Room()
          let userRoom = await roomObj.userRoom(userId)
          if (userRoom.status !== 203) { //该用户在某房间内
            let room = await new Room(userRoom.data.roomId)
            if (userId === room.owner.userId) { //并且该用户是房主
              await room.ownerOffline()
              console.log(`owner leave successfully`)
              socket.in(`room${userRoom.data.roomId}`).emit('ownerLeaveRoom', {
                roomId: userRoom.data.roomId,
                userId: userId
              })
            } else { //退出的不是房主
              await room.deleteUser(userId)
              socket.to(`room${userRoom.data.roomId}`).emit('userLeaveRoom', {
                roomId: userRoom.data.roomId,
                userId: userId
              })
            }
          }
        }
      }, 1000)
    } catch (err) {
      logger.setLevel(Error)
      logger.error(err)
      logger.error(`socket disconnect err is ${err}`)
    }
  })

  //根据在线时长加积分
  const addGrade = (onlineTime, userId) => {
    return new Promise(async (resolve, reject) => {
      const GRADETIMES = 5
      try {
        let ot = new OT()
        let ret = await ot.hasLogin(userId)
        if (_.isEmpty(ret)) {
          let record = AV.Object.new('OnlineTime')
          let user = AV.Object.createWithoutData('_User', userId)
          record.set('user', user)
          record.set('onlineTime', onlineTime)
          record.set('time', moment().format(`YYYY-MM-DD`))
          if (onlineTime >== (60 * 6 * 50) / GRADETIMES) { //加分上限
            record.set('addGrade', 50)
          } else {
            let count = onlineTime % (60 * 6)
            let addGrade = count * GRADETIMES
            record.set('addGrade', addGrade)
          }
          await record.save()
        } else {
          let record = AV.Object.createWithoutData('OnlineTime', ret.get('objectId'))
          onlineTime += record.get('onlineTime')
          if (onlineTime >== (60 * 6 * 50) / GRADETIMES) { //加分上限
            record.set('addGrade', 50)
          } else {
            let count = onlineTime % (60 * 6) //有多少个6分钟
            let addGrade = count * GRADETIMES
            record.set('onlineTime', onlineTime)
            record.set('addGrade', addGrade)
          }
          await record.save()
        }
        resolve({})
      } catch (err) {
        reject(`addGrade err ->${addGrade}`)
      }
    })
  }

})
module.exports = io
