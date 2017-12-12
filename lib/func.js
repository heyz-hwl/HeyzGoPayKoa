const AV = require('leancloud-storage');
const _ = require('lodash');
const config = require('./config');
const pingpp = require('pingpp')(config.pingpp.secretKey);

//检查增加经验以后是否升级
const upgrade = (exp, userId) => {
  return new Promise((resolve, reject) => {
    let query = new AV.Query('_User');
    query.equalTo('objectId', userId);
    query.first().then((user) => {
      let level = user.get('level');
      if (expMap[level] <= exp - count(level)) {
        console.log(`升级`);
        userRoom(userId).then((result) => {
          console.log(`result is ${JSON.stringify(result)}`)
          if (!_.isEmpty(result)) {
            if (result.isHost) {
              let room = AV.Object.createWithoutData('AudioRoom', result.roomId);
              room.set('grade', result.grade);
              room.save().then((result) => {
                resolve(level + 1);
              })
            }
          }
          resolve(level + 1);
        })
      } else {
        console.log(`不升级`);
        resolve(level);
      }
    }).catch((err) => {
      reject(err)
    })
  })
}

//根据等级计算累计升级所需经验
const count = (index) => {
  let out = 0;
  for (let i = 1; i < index; i++) {
    out += expMap[i]
  }
  return out;
}

const expMap = {
  1: 0,
  2: 10,
  3: 20,
  4: 30,
  5: 50,
  6: 70,
  7: 100,
  8: 130,
  9: 160,
  10: 190,
  11: 230,
  12: 270,
  13: 310,
  14: 350,
  15: 400,
  16: 450,
  17: 500,
  18: 550,
  19: 600,
  20: 660,
  21: 730,
  22: 790,
  23: 850,
  24: 910,
  25: 970,
  26: 1030,
  27: 1100,
  28: 1170,
  29: 1240,
  30: 1310,
  31: 1380,
  32: 1450,
  33: 1520,
  34: 1590,
  35: 1660,
  36: 1730,
  37: 1800,
  38: 1870,
  39: 1940,
  40: 2040
}

//获取用户所在房间
const userRoom = (userId) => {
  return new Promise((resolve, reject) => {
    let query1 = new AV.Query('AudioRoom');
    query1.containedIn('member', [userId]);
    let query2 = new AV.Query('AudioRoom');
    query2.equalTo('owner', userId);
    let query = AV.Query.or(query1, query2);
    query.first().then((room) => {
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
        grade: room.get('grade'),
        isHost: isHost,
        icon: icon
      }
      resolve(data)
    }).catch((err) => {
      reject(err)
    })
  })
}

const giftMap = [{
  name: '红包'
}, {
  name: '爱心',
  costNum: 100
}, {
  name: '爱心',
  costNum: 100
}, {
  name: '爱心',
  costNum: 100
}]

module.exports = {
  upgrade: upgrade,
  giftMap: giftMap
};
