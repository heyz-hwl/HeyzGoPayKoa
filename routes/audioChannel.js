const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const db = require('../lib/db');
const moment = require('moment');
const middle = require('../lib/middle');
const async = require('async');
const socket = require('../lib/socket');
const _ = require('lodash');
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')

router.prefix('/v1')

//用户查询自己麦序是第几
router.get('/audio/userSequence',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId;
      let sql = `select * from Sequence where userId="${userId}"`
      let result = await db.excute(sql)
      logger.debug(`result`, result)
      if (_.isEmpty(result)) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `不在麦序中`
        }
      }
      ctx.body = {
        status: 200,
        data: result,
        msg: `你排在第${result[0].order_nub}位`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `userSequence err is ${err}`
      }
    }
  })

//获取当前麦序前三的人
router.get('/audio/Sequence',
  jwt.verify,
  async(ctx, next) => {
    try {
      let result = await getTop3Seq()
      ctx.body = {
        status: 200,
        data: {
          userList: result
        },
        msg: `get Sequence success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get sequence err is ${err}`
      }
    }
  })

//申请麦序
router.post('/audio/applySequence',
  jwt.verify,
  async(ctx, next) => {
    try {
      let channelId = ctx.request.body.channelId || '1';
      let time = moment().format('YYYY-MM-DD HH:mm:ss');
      let userId = ctx.decode.userId;
      let order_nub;
      let sql = 'select * from Sequence where 1=1 order by order_nub desc';
      let user = await db.excute(sql)
      if (_.isEmpty(user)) {
        order_nub = 1;
        sql = `insert into Sequence values(null, "${userId}", "${order_nub}", "${channelId}", "${time}")`
        await db.excute(sql)
        let query = new AV.Query('_User');
        query.equalTo('objectId', userId);
        let user2 = await query.first()
        let userList = [{
          userId: user2.get('objectId'),
          nickName: _.isUndefined(user2.get('nickName')) ? '' : user2.get('nickName'),
          avatarThumbnailURL: _.isUndefined(user2.get('avatarURL')) ? '' : user2.get('avatarURL'),
          gender: _.isUndefined(user2.get('gender')) ? '' : user2.get('gender')
        }];
        let ret = {
          userList: userList,
          applicant: {
            userId: userId,
            order_nub: order_nub
          }
        }
        logger.debug(`applySequence ret1`, ret)
        socket.sockets.emit('applySequence', {
          data: ret
        });
        ctx.body = {
          status: 200,
          data: ret,
          msg: '申请成功'
        }
        changeSequence(channelId);
      } else {
        order_nub = Number(user[0].order_nub) + 1; //_.get(user[0], 'order_nub', 1)
        logger.debug(`user`, user)
        let inArray = user.some((item) => {
          return item.userId === userId
        })
        if (inArray) {
          return ctx.body = {
            status: -1,
            data: {},
            msg: `您已在队伍中`
          }
        }
        sql = `insert into Sequence values(null, "${userId}", "${order_nub}", "${channelId}", "${time}")`
        await db.excute(sql)
        sql = 'select * from Sequence where 1=1 order by order_nub asc limit 0, 10';
        let arr = await db.excute(sql);
        let userList = await getUserInfoList(arr);
        let ret = {
          userList: userList,
          applicant: {
            userId: userId,
            order_nub: order_nub
          }
        }
        logger.debug(`applySequence ret2`, ret)
        socket.sockets.emit('applySequence', {
          data: ret
        });
        ctx.body = {
          status: 200,
          data: ret,
          msg: '申请成功'
        }
      }
    } catch (err) {
      console.log(`add Sequence err is ${err}`)
      ctx.body = {
        status: -1,
        data: {},
        msg: `applySequence err is ${err}`
      }
    }
  })

//麦主主动下麦或者离开麦序
router.get('/audio/leaveSequence',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId;
      let sql = `select order_nub from Sequence where userId = "${userId}"`;
      let order = await db.excute(sql)
      if (_.isEmpty(order)) {
        return ctx.body = {
          status: 204,
          data: {},
          msg: `该用户不在麦序中`
        }
      }
      logger.debug(`order[0].order_nub`, order[0].order_nub)
      if (order[0].order_nub == 1) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `请等待`
        }
      }
      sql = `select * from Sequence where order_nub > "${order[0].order_nub}"`
      let userList = await db.excute(sql);
      if (_.isEmpty(userList)) {} else {
        let promise = [];
        userList.forEach((user) => {
          promise.push(new Promise(async(resolve, reject) => {
            let order_nub = user.order_nub - 1;
            sql = `update Sequence set order_nub ="${order_nub}" where id="${user.id}"`;
            await db.excute(sql)
          }))
        })
        await Promise.all(promise)
      }
      sql = `delete from Sequence where userId="${userId}"`;
      await db.excute(sql);
      let data = await getTop3Seq();
      socket.sockets.emit('deleteSequence', {
        data: {
          userList: data
        }
      })
      ctx.body = {
        status: 200,
        data: data,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get changeSequence err is ${err}`
      }
    }
  })

//麦序换人
const changeSequence = (channelId) => {
  return new Promise(async(resolve, reject) => {
    try {
      channelId = channelId || '1';
      let data = [];
      logger.debug(`changeSequence start`)
      let sql = `select * from Sequence where 1=1 order by order_nub limit 0,1`;
      let orderOneUser = await db.excute(sql)
      if (_.isEmpty(orderOneUser)) {
        return socket.sockets.emit('changeSequence', {
          data: {
            userList: []
          }
        })
      } else {
        await setTimeout(async(channelId) => {
          let sql = `select * from Sequence where 1=1 order by order_nub limit 0,1`;
          let orderOneUser2 = await db.excute(sql)
          console.log(`orderOneUser is ${JSON.stringify(orderOneUser)} orderOneUser2 is ${JSON.stringify(orderOneUser2)}`)
          if (orderOneUser.userId == orderOneUser2.userId) {
            //changeSequence
            let sql = `delete from Sequence where order_nub = 1`
            await db.excute(sql)
            console.log(`user${JSON.stringify(orderOneUser[0].userId)} out `)
            sql = `select * from Sequence where 1=1 order by order_nub`;
            let userList = await db.excute(sql)
            if (_.isEmpty(userList)) {
              return socket.sockets.emit('changeSequence', {
                data: {
                  userList: []
                }
              })
            }
            let promise = [];
            userList.forEach((user) => {
              promise.push(new Promise(async(resolve, reject) => {
                try {
                  let order_nub = user.order_nub - 1;
                  sql = `update Sequence set order_nub ="${order_nub}" where id="${user.id}"`;
                  let ret = await db.excute(sql)
                  resolve(ret)
                }catch(err){
                  reject(err)
                }
              }))
            })
            let r = await Promise.all(promise)
            let data = await getTop3Seq()
            logger.debug(`changeSequence socket`, data)
            socket.sockets.emit('changeSequence', {
              data: {
                userList: data
              }
            });
            changeSequence(channelId);
            console.log(`changeSequence finish`)
            resolve({
              data: {
                userList: data
              }
            })
          } else {
            changeSequence(channelId);
          }
        }, 31000)
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `changeSequence err is ${err}`
      }
    }
  })
}

//获取 Sequence 前三的用户
const getTop3Seq = () => {
  return new Promise(async(resolve, reject) => {
    let sql = `select * from Sequence where 1=1 order by order_nub limit 0, 10`;
    let result = await db.excute(sql)
    if (!result) {
      reject('no user')
    }
    let data = await getUserInfoList(result)
    resolve(data);
  })
}

//从有 userId 的数组里获取 user 数据
//按序排列输出
const getUserInfoList = (userList) => {
  return new Promise(async(resolve, reject) => {
    try {
      let promise = [];
      userList.forEach((item, index) => {
        if (item.userId == 'null') {
          return;
        } else {
          promise.push(new Promise(async(resolve, reject) => {
            let query = new AV.Query('_User');
            query.equalTo('objectId', item.userId)
            let user = await query.first()
            if (!user) {
              reject(`no user`)
            }
            let userInfo = {
              userId: user.get('objectId'),
              nickName: _.isUndefined(user.get('nickName')) ? '' : user.get('nickName'),
              avatarThumbnailURL: _.isUndefined(user.get('avatarURL')) ? '' : user.get('avatarURL'),
              gender: _.isUndefined(user.get('gender')) ? '' : user.get('gender'),
              onlineTime: user.get(`onlineTime`)
            }
            resolve(userInfo);
          }))
        }
      })
      let ret = await Promise.all(promise)
      if (ret) {
        resolve(ret)
      } else {
        reject(`no userInfo`)
      }
    } catch (err) {
      reject(`getUserInfoList err is ${err}`)
    }
  })
}

module.exports = router;
