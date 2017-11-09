var io = require('socket.io').listen(9998);
const moment = require('moment');
const db = require('./db');
const AV = require('leancloud-storage');
const _ = require('lodash');
const util = require('./util');
const log4js = require('koa-log4')
const logger = log4js.getLogger('debug')

console.log("socket port is 3003")
io.sockets.on('connection', function (socket) {

  socket.on('error', (err) => {
    console.log(`socket err is ${err}`)
  })

  socket.on('login', async(data) => {
    console.log(`${data}login${new Date()}`)
    if (data) {
      let socketId = socket.id;
      let time = moment().format('YYYY-MM-DD HH:mm:ss');
      let sql = `insert into ConnectedUser values(null,"${data}","${socketId}","${time}")`;
      let result = await db.excute(sql)
      socket.emit('LoginSuccess', `LoginSuccess`);
    } else {
      socket.emit('LoginSuccess', `login data is null`);
    }
  })

  socket.on('joinRoom', (data) => {
    console.log(`joinRoom success`)
    socket.join(`room${data.roomId}`);
    // socket.in(`room${data.roomId}`).emit('userJoinRoom', `${data.userId} join in the Room${data.roomId}`);
  })

  socket.on('leaveRoom', (data) => {
    console.log(`leaveRoom success`)
    socket.leave(`room${data.roomId}`);
    // socket.to(`room${data.roomId}`).emit('userLeaveRoom', `${data.userId} leave in the Room${data.roomId}`)
  })

  //socket 断开连接
  socket.on('disconnect', async function () {
    try {
      console.log('A user disconnected');
      console.log(`socket.id is ${socket.id}`);
      let userId;
      let sql = `select * from ConnectedUser where socketId = "${socket.id}"`;
      let result = await db.excute(sql)
      console.log(`result is ${JSON.stringify(result)}`)
      userId = result[0].userId;
      let time = result[0].time;
      let leaveTime = moment().format('YYYY-MM-DD HH:mm:ss');
      let onlineTime = util.date2TimeStamp(leaveTime) - util.date2TimeStamp(time);
      console.log(`onlineTime is ${onlineTime}`)
      let query = new AV.Query(`_User`);
      query.equalTo(`objectId`, userId);
      let User = await query.first()
      let onlineTime2 = User.get(`onlineTime`);
      let user = AV.Object.createWithoutData('_User', userId);
      user.set(`onlineTime`, onlineTime + onlineTime2);
      let ret = await user.save()
      let sql2 = `delete from ConnectedUser where userId = "${userId}"`;
      await db.excute(sql2); // 把断开连接的用户从数据库里删掉
      //115S 后该用户如果还没有连上,就把他从房间里踢出去
      await setTimeout(async() => {
        let result2 = await db.excute(`select * from ConnectedUser where userId = "${userId}"`)
        console.log(`result2 is ${JSON.stringify(result2)}`)
        if (_.isEmpty(result2)) {
          let room = await userRoom(userId)
          if (room !== `no room`) {
            console.log(`userLeava`)
            await userLeave(userId, room)
          }
        }
      }, 115000)
    } catch (err) {
      logger.setLevel(Error)
      logger.error(err)
      console.log(`socket disconnect err is ${err}`)
    }
  })

  //获取用户所在房间
  const userRoom = (userId) => {
    return new Promise(async(resolve, reject) => {
      try {
        let query1 = new AV.Query('AudioRoom');
        query1.containedIn('member', [userId]);
        let query2 = new AV.Query('AudioRoom');
        query2.equalTo('owner', userId);
        let query = AV.Query.or(query1, query2);
        let room = await query.first()
        console.log(`userRoom is ${JSON.stringify(room)}`)
        if (!room) {
          resolve(`no room`)
        }
        resolve(room)
      } catch (err) {
        reject(`userRoom err is ${err}`)
      }
    })
  }

  const userLeave = (userId, result) => {
    return new Promise(async(resolve, reject) => {
      try {
        logger.debug(`userLeave`, `result is ${JSON.stringify(result.get('objectId'))}, userId is ${userId}`)
        let room = AV.Object.createWithoutData('AudioRoom', result.get('objectId'));
        let member = result.get('member');
        if (_.isEmpty(member)) { //没有成员,直接删除房间
          await room.destroy()
          resolve(`房间已经没有用户, 房间被删除`);
        } else { //房内有成员
          let query = new AV.Query('_User');
          query.equalTo('objectId', member[0]);
          let user = await query.first()
          let queryUser = new AV.Query('_User');
          queryUser.equalTo('objectId', result.get('owner'));
          let owner = await queryUser.first()
          let grade = user.get('level') - owner.get('level');
          if (result.get('owner') == userId) {
            //作为房主退出房间,而且房内还有人, 把房主让给 member[0]
            room.set('grade', result.get('grade') + grade);
            room.set('owner', member[0])
            member.shift();
          } else { //在成员列表中,直接删除
            member.splice(member.indexOf(userId), 1);
          }
          room.set('member', member);
          let data = await room.save()
          let query2 = new AV.Query('AudioRoom');
          query2.equalTo('objectId', result.get('objectId'));
          result2 = await query2.first()
          let ret = await getRoomUserInfo(result2)
          socket.to(`room${result2.get(`objectId`)}`).emit('userLeaveRoom', {
            userList: ret
          });
          resolve({
            userList: data
          })
        }
      } catch (err) {
        reject(`userLeave err is ${err}`)
      }
    })
  }

  const getRoomUserInfo = (room) => {
    return new Promise(async(resolve, reject) => {
      try {
        let data = [];
        if (!room) {
          reject(`no room`)
        }
        let arr = Array(room.get('owner')).concat(room.get('member'));
        arr.forEach((item, index) => {
          data.push(new Promise(async(resolve, reject) => {
            let query = new AV.Query('_User');
            query.equalTo('objectId', item);
            let user = await query.first()
            resolve(UserInfo(user));
          }))
        })
        let result = await Promise.all(data)
        resolve(result)
      } catch (err) {
        reject(`getRoomUserInfo err is ${err}`)
      }
    })
  }

  const UserInfo = (user) => {
    let userInfo = {
      userId: user.get('objectId'),
      nickName: _.isUndefined(user.get('nickName')) ? '' : user.get('nickName'),
      avatarThumbnailURL: _.isUndefined(user.get('avatarURL')) ? '' : user.get('avatarURL'),
      gender: _.isUndefined(user.get('gender')) ? '' : user.get('gender'),
      onlineTime: user.get(`onlineTime`)
    }
    return userInfo;
  }
});

module.exports = io;
