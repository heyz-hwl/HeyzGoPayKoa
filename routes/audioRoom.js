const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const async = require('async');
const _ = require('lodash');
const socket = require('../lib/socket');
const util = require('../lib/util');
const heroMsg = require('./hok').heroMap;
const log4js = require('koa-log4')
const logger = log4js.getLogger('debug')

router.prefix('/v1')

//查询用户在哪个房间
router.get('/audio/userRoom',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId;
      if (ctx.query.userId) {
        userId = ctx.query.userId;
      }
      let data = await userRoom(userId)
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

//获取用户所在房间
const userRoom = (userId) => {
  return new Promise(async(resolve, reject) => {
    let query1 = new AV.Query('AudioRoom');
    query1.containedIn('member', [userId]);
    let query2 = new AV.Query('AudioRoom');
    query2.equalTo('owner', userId);
    let query = AV.Query.or(query1, query2);
    let room = await query.first()
    if (!room) {
      resolve({})
    }
    let isHost = room.get('owner') == userId ? true : false;
    let background = room.get('background');
    let nub = String(background).slice(24);
    let icon = room.get('icon');
    let data = {
      roomId: room.get('objectId'),
      title: room.get('title'),
      roomNub: room.get('roomNub'),
      isHost: isHost,
      icon: icon
    }
    resolve(data)
  })
}

//获取当前房间内的用户信息
router.get('/audio/userInfo',
  jwt.verify,
  async(ctx, next) => {
    try {
      let roomId = ctx.query.roomId;
      let query = new AV.Query('AudioRoom')
      query.equalTo('objectId', roomId);
      let room = await query.first()
      let data = await getRoomUserInfo(room)
      ctx.body = {
        status: 200,
        data: data,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `userInfo err is ${err}`
      }
    }
  })

//获取房间内用户信息
//这里的 room 是 leanCloud 的 Room
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
      reject(err)
    }
  })
}

//排序
//数组第一个是房主,剩下的按 room.get('member')的顺序排
const order = async(data, room) => {
  return new Promise((resolve, reject) => {
    let result = [];
    let ret = [];
    async.each(data, (item, callback) => {
      if (item.userId == room.get('owner')) {
        result.unshift(item);
      } else {
        result.push(item)
      }
      callback()
    }, (err) => {
      for (let i = 0; i < room.get('member').length; i++) {
        for (let j = 1; j < result.length; j++) {
          if (room.get('member')[i] == result[j].userId) {
            ret.push(result[j])
          }
        }
      }
      ret.unshift(result[0]);
      resolve(ret)
    })
  })
}

//数据结构化
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

//生成房间 ID
//暂时没加特殊号码保留
const makeRoomNumber = async() => {
  return new Promise((resolve, reject) => {
    try {
      let query = new AV.Query('AudioRoom');
      query.addDescending('roomNub');
      query.first().then((room) => {
        if (!room) {
          resolve('10001');
        } else {
          resolve(Number(room.get('roomNub')) + 1);
        }
      })
    } catch (err) {
      reject(`makeRoomNumber err is ${err}`)
    }
  })
}

//创建房间
router.post('/audio/room',
  jwt.verify,
  async(ctx, next) => {
    try {
      let url = `http://www.lzj.party/wz`;
      let audioRoom = AV.Object.new('AudioRoom');
      let title = ctx.request.body.title;
      let owner = ctx.decode.userId;
      let result = await userRoom(owner)
      if (typeof (result) !== String && !_.isEmpty(result)) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `该用户已在${result.roomNub}聊天室内`
        }
      }
      let query = new AV.Query('HOK');
      query.equalTo('userId', owner);
      query.equalTo('default', true);
      let hok = await query.first()
      if (!hok) { //没有默认 HOK
        let query = new AV.Query('HOK');
        query.equalTo('userId', owner);
        let hokResult = await query.first()
        if (!hohokResultk) { //连 HOK 都没有
          let number = util.randomNumber(105, 121);
          audioRoom.set('background', `${url}/${number}.jpg`);
          audioRoom.set('icon', `${url}s/${number}.jpg`)
        } else {
          audioRoom.set('background', `${url}/${heroMsg[hok.get('hero')[0]]}`);
          audioRoom.set('icon', `${url}s/${heroMsg[hok.get('hero')[0]]}`)
        }
      } else {
        audioRoom.set('background', `${url}/${heroMsg[hok.get('hero')[0]]}`);
        audioRoom.set('icon', `${url}s/${heroMsg[hok.get('hero')[0]]}`);
      }
      let roomNub = await makeRoomNumber()
      audioRoom.set('owner', owner);
      audioRoom.set('title', title);
      audioRoom.set('roomNub', String(roomNub));
      audioRoom.set('member', []);
      audioRoom.set('lastMember', []);
      let query1 = new AV.Query('_User');
      query1.equalTo('objectId', owner);
      let user = await query1.first()
      if(usr.get('level') <6){
        return ctx.body = {
          status: 403,
          data: room,
          msg: `需要6级才能创建房间`
        }
      }
      let levelGrade = user.get('level') * 1;
      audioRoom.set('grade', levelGrade);
      let room = await audioRoom.save()
      ctx.body = {
        status: 200,
        data: room,
        msg: `create room ${room.get('objectId')} success`
      }
    } catch (err) {
      ctx.body = {
        status: 500,
        data: {},
        msg: `create room err is ${err}`
      }
    }
  })


//修改房间 title
router.put('/audio/roomTitle',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = ctx.request.body;
      let title = data.title;
      let roomId = data.roomId;
      let owner = ctx.decode.userId;
      let query = new AV.Query('AudioRoom');
      query.equalTo('objectId', roomId)
      let room = await query.first()
      if (!room) {
        ctx.body = {
          status: -1,
          data: {},
          msg: 'no room'
        }
      }
      let creator = room.get('owner');
      if (owner !== creator) {
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
      let roomObj = AV.Object.createWithoutData('AudioRoom', roomId);
      roomObj.set('title', title);
      let ret = await roomObj.save()
      socket.sockets.in(`room${roomId}`).emit('updateRoomTitle', title);
      ctx.body = {
        status: 200,
        data: ret,
        msg: 'succuss'
      }
    } catch (err) {
      console.log(`update roomtitle err is ${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: err
      }
    }
  })

//获取所有房间列表
//需要分页
//需要房主信息
//如传一个 roomId 则返回该房间的信息
router.get('/audio/rooms',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = [];
      let promise = [];
      let limit = ctx.query.limit ? Number(ctx.query.limit) : 5;
      let skip = ctx.query.skip ? Number(ctx.query.skip) : 0;
      let query = new AV.Query('AudioRoom');
      if (!_.isUndefined(ctx.query.roomId)) {
        query.equalTo('objectId', ctx.query.roomId)
      }
      query.addDescending('grade');
      query.limit(limit);
      query.skip(skip);
      let roomList = await query.find()
      roomList.forEach((room, index) => {
        promise.push(new Promise(async(resolve, reject) => {
          let userInfo = await getRoomUserInfo(room)
          logger.debug(`userInfo`, userInfo)
          resolve({
            roomId: room.get('objectId'),
            title: room.get('title'),
            roomNub: room.get('roomNub'),
            number: room.get('member').length + 1,
            imageUrl: room.get('background'),
            user: userInfo
          })
        }))
      })
      let ret = await Promise.all(promise)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `rooms err is ${err}`
      }
    }
  })

//房间新加入用户
router.post('/audio/user',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId;
      let roomId = ctx.request.body.roomId;
      let numberLimit = 9;
      let data = await userRoom(userId)
      let query = new AV.Query('AudioRoom');
      query.equalTo('objectId', roomId);
      let result = await query.first()
      if (!result) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: 'no room'
        }
      }
      let member = result.get('member');
      if (member.indexOf(userId) > -1 || userId == result.get('owner')) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: '你已在房间内'
        }
      }
      if (member.length == numberLimit) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: '人数已满'
        }
      }
      member.push(userId);
      let room = AV.Object.createWithoutData('AudioRoom', result.get('objectId'));
      room.set('member', member);
      let roomRet = await room.save()
      let ret = await getRoomUserInfo(result)
      socket.sockets.in(`room${roomId}`).emit('userJoinRoom', {
        userList: ret
      })
      ctx.body = {
        status: 200,
        data: roomRet,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: 500,
        data: {},
        mag: `post user err is ${err}`
      }
    }
  })

//用户离开房间
router.post('/audio/userLeave',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.request.body.deleteUserId || ctx.decode.userId
      userId = _.isUndefined(ctx.request.body.deleteUserId) ? userId : ctx.request.body.deleteUserId;
      let roomId = ctx.request.body.roomId;
      let query = new AV.Query('AudioRoom');
      query.equalTo('objectId', roomId);
      let result = await query.first()
      if (!result) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: 'no room'
        }
      }
      let room = AV.Object.createWithoutData('AudioRoom', result.get('objectId'));
      let member = result.get('member');
      let query2 = new AV.Query('_User');
      if (member.length > 1) {
        query2.equalTo('objectId', member[0]);
      }
      let user = await query2.first()
      let query3 = new AV.Query('_User');
      query3.equalTo('objectId', result.get('owner'));
      let owner = await query3.first()
      if (member.indexOf(userId) < 0) { //不在成员列表中
        if (result.get('owner') == userId) {
          //作为房主退出房间
          if (_.get(member, 'length', 0) == 0) { //并且房内已经没有成员
            let v = await room.destroy()
            return ctx.body = {
              status: 201,
              data: v,
              msg: `房间已经没有用户, 房间被删除`
            }
          } else { //房内还有人, 把房主让给 member[0]
            let grade = user.get('level') - owner.get('level');
            room.set('grade', result.get('grade') + grade);
            console.log(`user.get('level') is ${user.get('level')}  owner.get('level') is ${owner.get('level')}}`)
            room.set('owner', member[0]);
            member.shift();
          }
        } else { //不在成员列表中,又不是房主=不在房间内
          return ctx.body = {
            status: -1,
            data: {},
            msg: `该用户不在该房间中`
          }
        }
      } else { //在成员列表中,直接删除
        member.splice(member.indexOf(userId), 1);
      }
      room.set('member', member);
      let data = await room.save()
      let query4 = new AV.Query('AudioRoom');
      query4.equalTo('objectId', result.get('objectId'));
      let ret = await query4.first()
      let rest = await getRoomUserInfo(ret)
      socket.sockets.to(`room${roomId}`).emit('userLeaveRoom', {
        userList: rest
      });
      ctx.body = {
        status: 200,
        data: {
          userList: data
        },
        msg: 'user leave success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        mag: `delete user err ia ${err}`
      }
    }
  })

module.exports = router;
