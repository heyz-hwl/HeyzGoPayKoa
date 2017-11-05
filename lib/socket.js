var io = require('socket.io').listen(4000);
const moment = require('moment');
const db = require('./db');
const AV = require('leancloud-storage');
const _ = require('lodash');
const util = require('./util');

console.log("socket port is 3003")
io.sockets.on('connection', function (socket) {
  
  socket.on('error', (err) => {
    console.log(`socket err is ${err}`)
  })

  socket.on('login', (data) => {
    console.log(`${data}login${new Date()}`)
    let socketId = socket.id;
    let time = moment().format('YYYY-MM-DD HH:mm:ss');
    let sql = `insert into ConnectedUser values(null,"${data}","${socketId}","${time}")`;
    db.excute(sql).then((result) => {
      socket.emit('LoginSuccess', `LoginSuccess`);
    })
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
  socket.on('disconnect', function () {
    console.log('A user disconnected');
    console.log(`socket.id is ${socket.id}`);
    let userId;
    let sql = `select * from ConnectedUser where socketId = "${socket.id}"`;
    db.excute(sql)
      .then((result) => {
        console.log(`result is ${JSON.stringify(result)}`)
        userId = result[0].userId;
        let time = result[0].time;
        let leaveTime = moment().format('YYYY-MM-DD HH:mm:ss');
        let onlineTime = util.date2TimeStamp(leaveTime) - util.date2TimeStamp(time);
        console.log(`onlineTime is ${onlineTime}`)
        let query = new AV.Query(`_User`);
        query.equalTo(`objectId`, userId);
        query.first().then((User) => {
          let onlineTime2 = User.get(`onlineTime`);
          let user = AV.Object.createWithoutData('_User', userId);
          user.set(`onlineTime`, onlineTime+onlineTime2);
          user.save().then((ret) => {
            let sql2 = `delete from ConnectedUser where userId = "${userId}"`;
            return db.excute(sql2);  // 把断开连接的用户从数据库里删掉
          })
        })
      .then((v) => {  //115S 后该用户如果还没有连上,就把他从房间里踢出去
        setTimeout(() => {
          db.excute(`select * from ConnectedUser where userId = "${userId}"`).then((result) => {
            console.log(`result2 is ${JSON.stringify(result)}`)
            if (_.isEmpty(result)) {
              userRoom(userId).then((room) => {
                if(!room == `no room`){
                  userLeave(userId, room).then((ret) => {
                    console.log(`ret is ${JSON.stringify(ret)}`);
                  })
                }
              }).catch((err) => {
                console.log(`err is ${err}`)
              })
            }
          })
        }, 115000)
      })
    })
  });

  //获取用户所在房间
  const userRoom = (userId) => {
    return new Promise((resolve, reject) => {
      let query1 = new AV.Query('AudioRoom');
      query1.containedIn('member', [userId]);
      let query2 = new AV.Query('AudioRoom');
      query2.equalTo('owner', userId);
      let query = AV.Query.or(query1, query2);
      query.first().then((room) => {
        console.log(`room is ${JSON.stringify(room)}`)
        if (!room) {
          resolve(`no room`)
        }
        resolve(room)
      })
    })
  }

  const userLeave = (userId, result) => {
    return new Promise((resolve, reject) => {
      let room = AV.Object.createWithoutData('AudioRoom', result.get('objectId'));
      let member = result.get('member');
      if (_.isEmpty(member)) { //没有成员,直接删除房间
        room.destroy().then((v) => {
          resolve(`房间已经没有用户, 房间被删除`);
        })
      } else { //房内有成员
        let queryUser = new AV.Query('_User');
        queryUser.equalTo('objectId', member[0]);
        queryUser.first().then((user) => {
          let queryUser = new AV.Query('_User');
          queryUser.equalTo('objectId', result.get('owner'));
          queryUser.first().then((owner) => {
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
            room.save().then((data) => {
              let query = new AV.Query('AudioRoom');
              query.equalTo('objectId', result.get('objectId'));
              query.first().then((result) => {
                getRoomUserInfo(result).then((ret) => {
                  socket.to(`room${result.get(`objectId`)}`).emit('userLeaveRoom', {
                    userList: ret
                  });
                })
                resolve({
                  userList: data
                })
              })
            })
          }).catch((err) => {
            reject(err)
          })
        })
      }
    })
  }

  const getRoomUserInfo = (room) => {
    return new Promise((resolve, reject) => {
      let data = [];
      if (!room) {
        reject(`no room`)
      }
      let arr = Array(room.get('owner')).concat(room.get('member'));
      arr.forEach((item, index) => {
        data.push(new Promise((resolve, reject) => {
          let query = new AV.Query('_User');
          query.equalTo('objectId', item);
          query.first().then((user) => {
            resolve(UserInfo(user));
          }).catch((err) => {
            reject(err)
          })
        }))
      })
      Promise.all(data).then((result) => {
        resolve(result)
      }).catch((err) => {
        reject(err)
      })
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
