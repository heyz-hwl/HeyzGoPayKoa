const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const async = require('async');
const _ = require('lodash');
const socket = require('../lib/socket');
const util = require('../lib/util');
const moment = require('moment');
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const {
  upgrade
} = require('../lib/func');

router.prefix('/v1')

//抽奖
const draw = (userId, userGrade, user) => {
  return new Promise(async(resolve, reject) => {
    let data = {};
    let prize;
    let drawRecord = AV.Object.new('DrawRecord');
    let newUser = AV.Object.createWithoutData('_User', userId);
    newUser.set('grade', userGrade);
    let exp = user.get('exp');
    let drawNumber = util.randomNumber(0, 10000);
    if (drawNumber < 5) {
      prize = `传说皮肤`;
      drawRecord.set('isDelivery', false);
      drawRecord.set('type', 34);
      data.positionId = 9;
      let skin = await getSkinURL(34)
      data.skinURL = skin;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      })
    } else if (drawNumber < 15) {
      prize = `传说皮肤`;
      drawRecord.set('isDelivery', false);
      drawRecord.set('type', 33);
      data.positionId = 9;
      let skin = await getSkinURL(33)
      data.skinURL = skin;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 65) {
      prize = `史诗皮肤`;
      drawRecord.set('isDelivery', false);
      drawRecord.set('type', 32);
      data.positionId = 8;
      let skin = await getSkinURL(32)
      data.skinURL = skin;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 165) {
      prize = `稀有皮肤`;
      drawRecord.set('isDelivery', false);
      drawRecord.set('type', 31);
      data.positionId = 4;
      let skin = await getSkinURL(31)
      data.skinURL = skin;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 365) {
      prize = `普通皮肤`;
      drawRecord.set('isDelivery', false);
      drawRecord.set('type', 30);
      data.positionId = 2;
      let skin = await getSkinURL(30)
      data.skinURL = skin;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 565) {
      prize = `积分+288`;
      drawRecord.set('isDelivery', true);
      drawRecord.set('isSelected', true);
      drawRecord.set('type', 12)
      newUser.set('grade', userGrade + 288);
      data.positionId = 1;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 1565) {
      prize = `积分+68`;
      drawRecord.set('isDelivery', true);
      drawRecord.set('isSelected', true);
      drawRecord.set('type', 11);
      newUser.set('grade', userGrade + 68);
      data.positionId = 1;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 3565) {
      prize = `积分+28`;
      drawRecord.set('isDelivery', true);
      drawRecord.set('isSelected', true);
      drawRecord.set('type', 10)
      newUser.set('grade', userGrade + 28);
      data.positionId = 6;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 4065) {
      prize = `经验+18`;
      exp += 18;
      drawRecord.set('isDelivery', true);
      drawRecord.set('isSelected', true);
      drawRecord.set('type', 22);
      newUser.set('exp', exp);
      data.positionId = 3;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else if (drawNumber < 5065) {
      prize = `经验+10`;
      exp += 10;
      drawRecord.set('isDelivery', true);
      drawRecord.set('isSelected', true);
      drawRecord.set('type', 21);
      newUser.set('exp', exp);
      data.positionId = 3;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    } else {
      prize = `经验+5`;
      exp += 5;
      drawRecord.set('isDelivery', true);
      drawRecord.set('isSelected', true);
      drawRecord.set('type', 20);
      newUser.set('exp', exp);
      data.positionId = 7;
      resolve({
        drawRecord,
        data,
        prize,
        exp,
        newUser
      });
    }
    reject(`???`)
  })
}

//抽奖
router.get('/draw',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);
      console.log(`userId is ${userId}`)
      if (!userId) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `no userId`
        }
      }
      const gradePay = 100;
      let query = new AV.Query('_User');
      query.equalTo('objectId', userId);
      let user = await query.first()
      let userGrade = user.get('grade') - gradePay;
      if (userGrade < 0) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `积分不足`
        }
      }
      let {
        drawRecord,
        data,
        prize,
        exp,
        newUser
      } =
      await draw(userId, userGrade, user)
      let level = await upgrade(exp, userId)
      console.log(`level`, level)
      newUser.set('exp', exp);
      newUser.set('level', level);
      result = await newUser.save()
      drawRecord.set('userId', userId);
      drawRecord.set('prize', prize);
      let drawData = await drawRecord.save()
      ctx.body = {
        status: 200,
        data: {
          drawData,
          position: data.positionId,
          skinURL: _.get(data, 'skinURL', [])
        },
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `draw err is ${err}`
      }
    }
  })

//客服资料
router.get(`/draw/kefu`,
  jwt.verify,
  async(ctx, next) => {
    try {
      const result = {
        url: `https://dn-msjbwutc.qbox.me/41277da3b1515c49c14c.png`,
        title: `请添加客服微信确认信息`,
        wx: `Heyz_Yuyi`,
        msg: `添加好友,获取礼品`
      };
      ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `getKefu err is ${err}`
      }
    }
  })

//获取皮肤 URL
router.get('/draw/skinURL',
  jwt.verify,
  async(ctx, next) => {
    try {
      let type = ctx.query.type;
      if (!type) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `Parameter missing!`
        }
      }
      let result = await getSkinURL(type)
      ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `getSkinURL err is ${err}`
      }
    }
  }
)

//皮肤 URL 列表
const getSkinURL = async(type) => {
  return new Promise(async(resolve, reject) => {
    let data = [];
    let query = new AV.Query(`_File`);
    query.equalTo(`mime_type`, type.toString())
    let ret = await query.find()
    ret.forEach((item) => {
      let skinName = item.get('name');
      let arr = skinName.split(`-`);
      let name1 = arr[0];
      let name2 = arr[1];
      data.push({
        skinURL: item.get('url'),
        skinName: skinName,
        skinId: item.get('objectId'),
        name1: name1,
        name2: name2
      })
    })
    resolve(data)
  })
}

//用户选定皮肤奖品
router.put('/draw/selectSkin',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = ctx.request.body;
      const result = {
        url: `https://dn-msjbwutc.qbox.me/41277da3b1515c49c14c.png`,
        title: `请添加客服微信确认信息`,
        wx: `Heyz_Yuyi`,
        msg: `添加好友,获取礼品`
      }
      let drawRecordId = data.drawRecordId
      let skinName = data.skinName
      let skinId = data.skinId
      let prizeWinnerID = data.prizeWinnerID
      let isWechat = data.isWechat ? data.isWechat : true
      let isIOS = data.isIOS ? data.isIOS : true
      if (!prizeWinnerID || !drawRecordId || !skinName || !skinId || !isIOS) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `Parameter missing!`
        }
      }
      let query = new AV.Query('DrawRecord')
      query.equalTo('objectId', drawRecordId)
      let Record = await query.first()
      if (Record.get('isSelected')) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `已经选择了皮肤,如需修改请联系客服`
        }
      }
      let prize = Record.get('prize')
      let drawRecord = AV.Object.createWithoutData('DrawRecord', drawRecordId)
      let skin = AV.Object.createWithoutData('_File', skinId)
      drawRecord.set('skin', skin)
      drawRecord.set('prize', skinName)
      drawRecord.set('prizeWinnerID', prizeWinnerID)
      drawRecord.set('isWechat', isWechat)
      drawRecord.set('isSelected', true)
      drawRecord.set('isIOS', isIOS)
      await drawRecord.save()
      ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `err is ${err}`
      }
    }
  })

//查看未发货的获奖记录
router.get('/draw/willDelivery',
  async(ctx, next) => {
    try {
      let isIOS = util.isBoolean(ctx.query.isIOS)
      let addFriend = util.isBoolean(ctx.query.addFriend)
      let timeType = ctx.query.timeType
      let promise = [],
        result = []
      let query = new AV.Query('DrawRecord')
      query.equalTo('isDelivery', false)
      query.addDescending('createdAt')
      query.lessThan('createdAt', new Date())
      if (!_.isUndefined(isIOS)) {
        query.equalTo('isIOS', isIOS)
      }
      if (!_.isUndefined(addFriend)) {
        query.equalTo('addFriend', addFriend)
      }
      if (timeType) {
        let queryTime = new AV.Query('DrawRecord')
        switch (timeType) {
          case '1':
            queryTime.greaterThanOrEqualTo('createdAt', new Date(moment().subtract(1, 'day')));
            break
          case '2':
            queryTime.greaterThanOrEqualTo('createdAt', new Date(moment().subtract(Number(moment().day()), 'day')));
            break
          case '3':
            queryTime.greaterThanOrEqualTo('createdAt', new Date(moment().subtract(Number(moment().date()), 'day')));
            break
          default:
            return ctx.body = {
              status: -1,
              data: {},
              msg: `timeType err`
            }
        }
        let queryAnd = AV.Query.and(query, queryTime)
        queryAnd.addDescending('createdAt')
        result = await queryAnd.find()
      } else {
        result = await query.find()
      }
      result.forEach(async(item, index) => {
        promise.push(new Promise(async(resolve, reject) => {
          try {
            let query = new AV.Query('_User')
            query.equalTo('objectId', item.get('userId'))
            let user = await query.first()
            if (_.isUndefined(user)) {
              logger.error(item.get('userId'))
            }
            item.set('nickName', user.get('nickName'))
            let time = moment(new Date(item.get('createdAt'))).format('YYYY-MM-DD HH:mm:ss')
            item.set('time', time)
            resolve(item)
          } catch (err) {
            reject(`result.forEach err-> ${err}`)
          }
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
        msg: `get willDelivery err is ${err}`
      }
    }
  })

//切换奖品发货状态
router.post('/draw/delivery', async(ctx, next) => {
  try {
    let drawRecordId = ctx.request.body.drawRecordId
    let status = ctx.request.body.status
    let wechat = ctx.query.wechat
    if (!drawRecordId) {
      return ctx.body = {
        status: -1,
        data: {},
        msg: `no drawRecordId`
      }
    }
    let query = new AV.Query('DrawRecord');
    query.equalTo('objectId', drawRecordId);
    let DrawRecord = await query.first()
    if (!DrawRecord) {
      return ctx.body = {
        status: -1,
        data: {},
        msg: `no DrawRecord`
      }
    }
    let drawRecord = AV.Object.createWithoutData('DrawRecord', drawRecordId);
    switch (status) {
      case '1':
        drawRecord.set('addFriend', true);
        break
      case '2':
        drawRecord.set('isDelivery', true);
        break
      default:
        return ctx.body = {
          status: -1,
          data: {},
          msg: `status err`
        }
    }
    let result = await drawRecord.save()
    ctx.body = {
      status: 200,
      data: result,
      msg: `success`
    }
  } catch (err) {
    ctx.body = {
      status: -1,
      data: {},
      msg: `err is ${err}`
    }
  }
})

router.post('/draw/wechat', async(ctx, next) => {
  let drawRecordId = ctx.request.body.drawRecordId
  let wechat = ctx.request.body.wechat
  let drawRecord = AV.Object.createWithoutData('DrawRecord', drawRecordId)
  drawRecord.set('weChat', wechat)
  let result = await drawRecord.save()
  ctx.body = {
    status: 200,
    data: result,
    msg: `success`
  }
})

//获取用户获奖记录
router.get('/draw/record',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);
      if (!userId) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `no userId`
        }
      }
      let query = new AV.Query('DrawRecord');
      query.equalTo('userId', userId);
      query.include('skin');
      query.descending('updatedAt');
      let records = await query.find()
      if (_.isEmpty(records)) {
        records = [];
      }
      records.forEach((item) => {
        item.set('iconURL', prizeMap[item.get('type')].url);
        item.set(`skinType`, prizeMap[item.get('type')].title);
        item.set(`timeStamp`, util.date2TimeStamp(item.get('updatedAt')));
      })
      ctx.body = {
        status: 200,
        data: records,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: err
      }
    }
  }
)

//获取抽奖信息
router.get('/drawInfo',
  jwt.verify,
  async(ctx, next) => {
    let data = [
      prize1, prize2, prize3, prize4, prize6, prize7, prize8, prize9
    ];
    ctx.body = {
      status: 200,
      data: data,
      msg: `success`
    }
  }
)

//九宫格信息
const prize1 = {
  position: 1,
  title: `积分`,
  url: `https://dn-msjbwutc.qbox.me/8273462c30212a122c57.png`
}
const prize2 = {
  position: 2,
  title: `普通皮肤`,
  url: `https://dn-msjbwutc.qbox.me/a2c0047873d6532fe81a.png`
}
const prize3 = {
  position: 3,
  title: `经验值`,
  url: `https://dn-msjbwutc.qbox.me/0789c2b28cfc7961fe68.png`
}
const prize4 = {
  position: 4,
  title: `稀有皮肤`,
  url: `https://dn-msjbwutc.qbox.me/5a895a02779a2274e4a7.png`
}
const prize6 = {
  position: 6,
  title: `积分`,
  url: `https://dn-msjbwutc.qbox.me/8273462c30212a122c57.png`
}
const prize7 = {
  position: 7,
  title: `经验值`,
  url: `https://dn-msjbwutc.qbox.me/0789c2b28cfc7961fe68.png`
}
const prize8 = {
  position: 8,
  title: `史诗皮肤`,
  url: `https://dn-msjbwutc.qbox.me/88ffc2efe8e5a82ec4d6.png`
}
const prize9 = {
  position: 9,
  title: `传说皮肤`,
  url: `https://dn-msjbwutc.qbox.me/b72dfe7a6180d6ebc60d.png`
}

const prizeMap = {
  10: prize1,
  11: prize6,
  12: prize6,
  20: prize3,
  21: prize7,
  22: prize7,
  30: prize2,
  31: prize4,
  32: prize8,
  33: prize9,
  34: prize9,
}

module.exports = router;
