const AV = require('leancloud-storage');
const express = require('express');
const router = express.Router();
const jwt = require('../lib/jwt');
const db = require('../lib/db');
const moment = require('moment');
const middle = require('../lib/middle');
const async = require('async');
const socket = require('../lib/socket');
const _ = require('lodash');

router.prefix('v1')

//用户登录记录
router.get('/audio/userChannel', (req, res) => {
  let userId = req.query.userId;
  let channelId = req.query.channelId;
  connectChannel(userId, channelId).then((result) => {
    res.json({
      status: 200,
      data: result,
      msg: `success`
    })
  }).catch((err) => {
    res.json({
      status: -1,
      data: err,
      msg: `err`
    })
  })
})

const connectChannel = (userId, channelId) => {
  return new Promise((resolve, reject) => {
    if (!userId || !channelId) {
      reject(`params missing`)
    }
    let time = moment().format('YYYY-MM-DD HH:mm:ss');
    let sql = `select * from ChannelUser where userId="${userId}" and channelId="${channelId}"`
    db.excute(sql).then((result) => {
      console.log(`result is ${JSON.stringify(result)}`)
      if (_.isEmpty(result)) {
        sql = `insert into ChannelUser values(null, "${userId}", "${time}", "${channelId}", "0")`
      } else {
        sql = `update ChannelUser set time="${time}" where userId="${userId}" and channelId="${channelId}"`
      }
      db.excute(sql).then((result) => {
        resolve(result)
      })
    })
  })
}

//用户查询自己麦序是第几
router.get('/audio/userSequence',
  jwt.verify,
  (req, res) => {
    let userId = req.decode.userId;
    let sql = `select * from Sequence where userId="${userId}"`
    db.excute(sql).then((result) => {
      res.json({
        status: 200,
        data: result,
        msg: `你排在第${result[0].order_nub}位`
      })
    }).catch((err) => {
      res.json({
        status: -1,
        data: {},
        msg: err
      })
    })
  }
)

//获取当前麦序前三的人
router.get('/audio/Sequence',
  jwt.verify,
  (req, res) => {
    getTop3Seq().then((result) => {
      res.json({
        status: 200,
        data: {
          userList: result
        },
        msg: `get Sequence success`
      })
    }).catch((err) => {
      res.json({
        status: -1,
        data: {},
        msg: err
      })
    })
  }
)

//申请麦序
router.post('/audio/applySequence',
  jwt.verify,
  (req, res) => {
    let channelId = req.body.channelId || '1';
    let time = moment().format('YYYY-MM-DD HH:mm:ss');
    let userId = req.decode.userId;
    let order_nub;
    let sql = 'select * from Sequence where 1=1 order by order_nub desc';
    db.excute(sql).then((user) => {
      if (_.isEmpty(user)) {
        order_nub = 1;
        sql = `insert into Sequence values(null, "${userId}", "${order_nub}", "${channelId}", "${time}")`
        db.excute(sql).then((v) => {
          console.log(`v is ${JSON.stringify(v)}`)
          let query = new AV.Query('_User');
          query.equalTo('objectId', userId);
          query.first().then((user) => {
            let userList = [{
              userId: user.get('objectId'),
              nickName: _.isUndefined(user.get('nickName')) ? '' : user.get('nickName'),
              avatarThumbnailURL: _.isUndefined(user.get('avatarURL')) ? '' : user.get('avatarURL'),
              gender: _.isUndefined(user.get('gender')) ? '' : user.get('gender')
            }];
            let ret = {
              userList: userList,
              applicant: {
                userId: userId,
                order_nub: order_nub
              }
            }
            socket.sockets.emit('applySequence', {
              data: ret
            });
            changeSequence(channelId);
            return res.json({
              status: 200,
              data: ret,
              msg: '申请成功'
            })
          })
        })
      } else {
        order_nub = Number(user[0].order_nub) + 1; //_.get(user[0], 'order_nub', 1)
        async.each(user, (item, callback) => {
          if (item.userId == userId) {
            return res.json({
              status: -1,
              data: {},
              msg: `您已在队伍中`
            })
          }
          callback()
        }, (err) => {
          sql = `insert into Sequence values(null, "${userId}", "${order_nub}", "${channelId}", "${time}")`
          db.excute(sql).then((v) => {
            sql = 'select * from Sequence where 1=1 order by order_nub asc limit 0, 10';
            return db.excute(sql);
          }).then((arr) => {
            return getUserInfoList(arr);
          }).then((userList) => {
            let ret = {
              userList: userList,
              applicant: {
                userId: userId,
                order_nub: order_nub
              }
            }
            socket.sockets.emit('applySequence', {
              data: ret
            });
            res.json({
              status: 200,
              data: ret,
              msg: '申请成功'
            })
          }).catch((err) => {
            console.log(`add Sequence err is ${err}`)
            res.json({
              status: -1,
              data: {},
              msg: err
            })
          })
        })
      }
    })
  })

//麦主主动下麦
router.get('/changeSequence',
  jwt.verify,
  (req, res) => {
    let userId = req.decode.userId;
    let sql = `select * from Sequence where 1=1 order by order_nub limit 0,1`;
    db.excute(sql).then((orderOneUser) => {
      if (orderOneUser[0].userId == userId) {
        let sql = `delete from Sequence where order_nub = 1`
        db.excute(sql).then((v) => {
          console.log(`user${JSON.stringify(orderOneUser[0].userId)} out `)
          let sql = `select * from Sequence where 1=1 order by order_nub`;
          return db.excute(sql);
        }).then((userList) => {
          if (!userList) {
            return socket.sockets.emit('changeSequence', {
              data: {
                userList: []
              }
            })
          }
          async.each(userList, (user, callback) => {
            let order_nub = user.order_nub - 1;
            sql = `update Sequence set order_nub ="${order_nub}" where id="${user.id}"`;
            db.excute(sql).then(v => {
              callback()
            })
          }, (err) => {
            getTop3Seq().then((data) => {
              socket.sockets.emit('changeSequence', {
                data: {
                  userList: data
                }
              });
              return res.json({
                status: 200,
                data: userList,
                msg: `xiamai`
              })
            })
          })
        }) 
      }
      res.json({
        status: -1,
        data: {},
        msg: `err`
      })
    })
  }
)

//麦序换人
const changeSequence = (channelId) => {
  return new Promise((resolve, reject) => {
    channelId = channelId || '1';
    let data = [];
    let sql = `select * from Sequence where 1=1 order by order_nub limit 0,1`;
    db.excute(sql).then((orderOneUser) => {
      if (_.isEmpty(orderOneUser)) {
        console.log(`return`)
        return socket.sockets.emit('changeSequence', {
          data: {
            userList: []
          }
        })
      } else {
        setTimeout((channelId) => {
          let sql = `select * from Sequence where 1=1 order by order_nub limit 0,1`;
          db.excute(sql).then((orderOneUser2) => {
            console.log(`orderOneUser is ${JSON.stringify(orderOneUser)} orderOneUser2 is ${JSON.stringify(orderOneUser2)}`)
            if (orderOneUser.userId == orderOneUser2.userId) {
              //changeSequence
              let sql = `delete from Sequence where order_nub = 1`
              db.excute(sql).then((v) => {
                console.log(`user${JSON.stringify(orderOneUser[0].userId)} out `)
                let sql = `select * from Sequence where 1=1 order by order_nub`;
                return db.excute(sql);
              }).then((userList) => {
                if (!userList) {
                  return socket.sockets.emit('changeSequence', {
                    data: {
                      userList: []
                    }
                  })
                }
                async.each(userList, (user, callback) => {
                  let order_nub = user.order_nub - 1;
                  sql = `update Sequence set order_nub ="${order_nub}" where id="${user.id}"`;
                  db.excute(sql).then(v => {
                    callback()
                  })
                }, (err) => {
                  getTop3Seq().then((data) => {
                    console.log(`socket is ${JSON.stringify({
                  userList: data,
                })}`)
                    socket.sockets.emit('changeSequence', {
                      data: {
                        userList: data
                      }
                    });
                    changeSequence(channelId);
                    resolve({
                      data: {
                        userList: data
                      }
                    })
                  })
                })
              })
            } else {
              changeSequence(channelId);
            }
          })
        }, 31000)
      }
    })
  })
}

//获取 Sequence 前三的用户
const getTop3Seq = () => {
  return new Promise((resolve, reject) => {
    let sql = `select * from Sequence where 1=1 order by order_nub limit 0, 10`;
    db.excute(sql).then((result) => {
        if (!result) {
          reject('no user')
        }
        return getUserInfoList(result)
      })
      .then((data) => {
        resolve(data);
      })
  })
}

//麦序排队用户退出了麦序
router.delete('/audio/Sequence',
  jwt.verify,
  (req, res) => {
    let userId = req.decode.userId;
    let sql = `select order_nub from Sequence where userId = "${userId}"`;
    db.excute(sql).then((order) => {
      if (_.isEmpty(order)) {
        return res.json({
          status: -1,
          data: {},
          msg: `该用户不在麦序中`
        })
      }
      sql = `select * from Sequence where order_nub > "${order[0].order_nub}"`
      return db.excute(sql);
    }).then((userList) => {
      async.each(userList, (user, callback) => {
        let order_nub = user.order_nub - 1;
        sql = `update Sequence set order_nub ="${order_nub}" where id="${user.id}"`;
        db.excute(sql);
        callback()
      }, (err) => {
        if (err) {
          res.json({
            status: -1,
            data: {},
            msg: `Sequence async err is ${err}`
          })
        }
      })
    }).then((v) => {
      sql = `delete from Sequence where userId="${userId}"`;
      return db.excute(sql);
    }).then((v) => {
      return getTop3Seq();
    }).then((data) => {
      socket.sockets.emit('deleteSequence', {
        data: {
          userList: data
        }
      })
      if (_.isEmpty(data)) {
        getQueueId().then((queueId) => {
          insertQueueIdToApQ(queueId + 1, null, null, '1').then((result) => {
            socket.sockets.emit('changeSequence', {
              data: {
                userList: [],
                queueId: queueId + 1
              }
            });
          })
        })
      }
      res.json({
        status: 200,
        data: data,
        msg: 'success'
      })
    }).catch((err) => {
      res.json({
        status: -1,
        data: {},
        msg: `Sequence err is ${err}`
      })
    })
  })

//从有 userId 的数组里获取 user 数据
//按序排列输出
const getUserInfoList = (userList) => {
  return new Promise((resolve, reject) => {
    let promise = [];
    userList.forEach((item, index) => {
      if (item.userId == 'null') {
        return;
      } else {
        promise.push(new Promise((resolve, reject) => {
          let query = new AV.Query('_User');
          query.equalTo('objectId', item.userId)
          query.first().then((user) => {
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
          })
        }))
      }
    })
    Promise.all(promise).then((ret) => {
      if (ret) {
        resolve(ret)
      } else {
        reject(`no userInfo`)
      }
    })
  })
}

//获取当前 queueId
const getQueueId = () => {
  return new Promise((resolve, reject) => {
    let sql = `select queueId from ApplyQueue where 1=1 order by queueId DESC limit 0, 1`;
    db.excute(sql).then((queueId) => {
      if (_.isEmpty(queueId)) {
        resolve(0)
      }
      resolve(queueId[0].queueId);
    }).catch((err) => {
      reject(err)
    })
  })
}

const insertQueueIdToApQ = (queueId, userId, ownerId, channelId) => {
  return new Promise((resolve, reject) => {
    let time = moment().format('YYYY-MM-DD HH:mm:ss');
    let sql = `insert into ApplyQueue values(null, "${userId}", "${queueId}", "${ownerId}", "${channelId}", "${time}")`;
    db.excute(sql).then((result) => {
      resolve(result);
    }).catch((err) => {
      reject(err)
    })
  })
}

//获取某频道,某用户的申请组队队列
const getApplyQueue = (queueId) => {
  return new Promise((resolve, reject) => {
    let sql = `select * from ApplyQueue where queueId=${queueId} order by time`;
    db.excute(sql).then((userList) => {
      if (userList.length == 0 || _.isUndefined(userList) || _.isUndefined(userList)) {
        return resolve(`ApplyQueue is empty`)
      }
      getUserInfoList(userList).then((userInfo) => {
        resolve(userInfo)
      }).catch((err) => {
        console.log(`err is ${err}`)
        reject(err)
      })
    })
  })
}

router.get('/audio/queueId',
  jwt.verify,
  (req, res) => {
    getQueueId().then((queueId) => {
      if (!queueId) {
        return res.json({
          status: -1,
          data: {},
          msg: `no queueId`
        })
      }
      res.json({
        status: 200,
        data: queueId,
        msg: `queueId is ${queueId}`
      })
    })
  }
)

//用户申请加入组队
router.post('/audio/applyQueue',
  jwt.verify,
  (req, res) => {
    let data = req.body;
    let channelId = '1'
    let userId = req.decode.userId;
    let ownerId = data.ownerId;
    let numberLimit = 9;
    let time = moment().format('YYYY-MM-DD HH:mm:ss');
    getQueueId().then((queueId) => {
      let sql = `select * from ApplyQueue where queueId=${queueId}`;
      db.excute(sql).then((result) => {
        if (ownerId !== result[0].ownerId) {
          return res.json({
            status: -1,
            data: {},
            msg: '数据错误'
          })
        }
        if (_.get(result, 'length', 0) >= numberLimit) {
          return res.json({
            status: -1,
            data: result.length,
            msg: '人数已达上限'
          })
        }
        async.each(result, (item, callback) => {
          if (item.userId == userId) {
            return res.json({
              status: -1,
              msg: `你已在队伍中`
            })
          }
          callback()
        }, (err) => {
          sql = `insert into ApplyQueue values(null, "${userId}", "${queueId}", "${ownerId}", "${channelId}", "${time}")`;
          db.excute(sql).then((v) => {
            getApplyQueue(queueId).then((data) => {
              socket.sockets.emit('addUserToApplyQueue', {
                data: {
                  userList: data,
                  peopleNumber: _.isString(data) ? 1 : data.length
                }
              });
              res.json({
                status: 200,
                data: {
                  userList: data,
                  queueId: queueId,
                  peopleNumber: _.isString(data) ? 1 : data.length
                },
                msg: 'success'
              })
            })
          })
        })
      }).catch((err) => {
        console.log(`apply room err is ${err}`)
        return res.json({
          status: -1,
          data: {},
          msg: `${err}`
        })
      })
    })
  })

//用户申请退出组队
router.delete('/audio/applyQueue',
  jwt.verify,
  (req, res) => {
    let userId = req.decode.userId;
    getQueueId().then((queueId) => {
      let sql = `delete from ApplyQueue where userId="${userId}" and queueId="${queueId}"`
      db.excute(sql).then((result) => {
        if (!result.affectedRows) {
          return res.json({
            status: -1,
            data: {},
            msg: `the user doesn't in applyQueue`
          })
        }
        getApplyQueue(queueId).then((data) => {
          socket.sockets.emit('deleteApplyQueue', {
            data: {
              userList: data,
              peopleNumber: typeof (data) === 'string' ? 1 : data.length
            }
          });
          res.json({
            status: 200,
            data: {
              userList: data,
              peopleNumber: _.isString(data) ? 1 : data.length
            },
            msg: '成功退出组队'
          })
        })
      })
    }).catch((err) => {
      console.log(`err is ${err}`)
      res.json({
        status: -1,
        data: {},
        msg: err
      })
    })
  })

//get applyQueue by QueueId
router.get('/audio/applyQueue',
  jwt.verify,
  (req, res) => {
    let channelId = '1'; //开黑大厅
    getQueueId().then((queueId) => {
      if (req.body.queueId) {
        queueId = req.body.queueId;
      }
      getApplyQueue(queueId).then((data) => {
        getTop3Seq().then((result) => {
          if (_.isEmpty(result)) {
            return res.json({
              status: 202,
              data: {
                host: '',
                userList: [],
                queueId: '',
                queueLength: 0
              },
              msg: 'sequence is null'
            })
          }
          res.json({
            status: 200,
            data: {
              host: result[0],
              userList: data,
              queueId: queueId,
              queueLength: _.isString(data) ? 1 : data.length
            },
            msg: 'success'
          })
        })
      })
    }).catch((err) => {
      res.json({
        status: -1,
        data: {},
        msg: err
      })
    })
  })

//获取最近活跃的用户
router.get('/audio/recentUser',
  jwt.verify,
  (req, res) => {
    let data = [];
    let skip = _.get(req, 'query.skip', 0);
    let limit = _.get(req, 'query.limit', 20);
    let query = new AV.Query('_User');
    query.addDescending('updateAt');
    query.limit(limit);
    query.skip(skip);
    query.find().then((userList) => {
      if (_.isEmpty(userList)) {
        res.json({
          status: 202,
          data: {},
          msg: 'no user'
        })
      } else {
        async.each(userList, (user, callback) => {
          let userInfo = {
            userId: user.get('objectId'),
            nickName: _.isUndefined(user.get('nickName')) ? '' : user.get('nickName'),
            avatarThumbnailURL: _.isUndefined(user.get('avatarURL')) ? '' : user.get('avatarURL'),
            gender: _.isUndefined(user.get('gender')) ? 1 : Number(user.get('gender'))
          }
          data.push(userInfo);
          callback()
        }, (err) => {
          if (err) {
            res.json({
              status: -1,
              data: {},
              msg: `recentUser fail err is ${err}`
            })
          }
        })
        res.json({
          status: 200,
          data: {
            userList: data
          },
          msg: 'success'
        })
      }
    })
  })

module.exports = router;
