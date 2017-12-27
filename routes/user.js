const router = require('koa-router')()
const AV = require('leancloud-storage');
const async = require('async');

const jwt = require('../lib/jwt');
const util = require('../lib/util');
const config = require('../lib/config');
const middle = require('../lib/middle');
const _ = require('lodash');
const log4js = require('koa-log4')
const logger = log4js.getLogger('debug')

router.prefix('/v1')

//通过手机号查询用户信息
router.get(`/user/infoByPhone`,
  async(ctx, next) => {
    try {
      let phoneNumber = ctx.query.phoneNumber
      let query = new AV.Query('_User')
      query.equalTo('mobilePhoneNumber', phoneNumber)
      let userInfo = await query.first()
      if(!_.isUndefined(userInfo)){
        ctx.body = {
          status: 200,
          data: util.getUserInfo(userInfo),
          msg: `success`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get userInfo by phone number err ->${err}`
      }
    }
  }
)

//拉黑用户
router.post(`/user/blockList`,
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);
      let BLUserId = ctx.request.body.userId; //被拉黑的用户
      let query = new AV.Query(`_User`);
      query.equalTo(`objectId`, userId);
      let User = await query.first()
      let blockList = User.get(`blockList`);
      blockList.push(BLUserId);
      let user = AV.Object.createWithoutData(`_User`, userId);
      user.set(`blockList`, blockList);
      let ret = await user.save()
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `add user to blockList err is ${err}`
      }
    }
  })

//删除拉黑
router.delete(`/user/blockList`,
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);
      let BLUserId = ctx.request.body.userId;
      let query = new AV.Query(`_User`);
      query.equalTo(`objectId`, userId);
      let User = await query.first()
      let blockList = User.get(`blockList`);
      blockList.splice(blockList.indexOf(BLUserId), 1);
      let user = AV.Object.createWithoutData(`_User`, userId);
      user.set(`blockList`, blockList);
      let ret = await user.save()
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `delete blockList err is ${err}`
      }
    }
  })


//userId 不让 fansId 关注
router.get('/user/unfollow',
  jwt.verify,
  async(ctx, next) => {
    try {
      const userId = _.get(ctx, 'decode.userId', ctx.query.userId); //当前用户
      const fansId = ctx.query.fansId; //粉丝
      let userQuery = new AV.Query("_User");
      userQuery.equalTo("objectId", fansId);
      let user = await userQuery.first()
      if (!user) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `no user`
        }
      }
      let query = new AV.Query(`_Follower`);
      query.equalTo(`follower`, user);
      query.equalTo(`user`, AV.Object.createWithoutData(`_User`, userId));
      let isFollow = await query.first()
      console.log(`isFollow is ${JSON.stringify(isFollow)}`)
      if (!isFollow) {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `不是粉丝`
        }
      }
      let User = AV.Object.createWithoutData('_User', fansId);
      let result = await User.unfollow(userId)
      console.log(`result is ${JSON.stringify(result)}`)
      ctx.body = {
        status: 200,
        data: result,
        msg: `取消关注成功`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `取消关注失败`
      }
    }
  })


//获取正常开黑的你关注的人
router.get('/user/chattingFriend',
  jwt.verify,
  async(ctx, next) => {
    try {
      let result = [];
      let data = await chattingFriend(ctx.decode.userId)
      data.forEach((item) => {
        if (item) {
          result.push(item)
        }
      })
      ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: ``
      }
    }
  })

//获取正在开黑的好友
const chattingFriend = async(userId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let promise = [];
      let arr = [],
        arr2 = [];
      let list = await getFollowee(userId)
      list.forEach((item, index) => {
        arr = item.users;
        arr2 = arr2.concat(arr);
      })
      arr2.forEach((item, index) => {
        promise.push(userRoom(item))
      })
      let result = await Promise.all(promise);
      resolve(result);
    } catch (err) {
      reject(`chattingFriend err is ${err}`)
    }
  })
}

const userRoom = (user) => {
  return new Promise(async(resolve, reject) => {
    let query1 = new AV.Query('AudioRoom');
    query1.containedIn('member', [user.userId]);
    let query2 = new AV.Query('AudioRoom');
    query2.equalTo('owner', user.userId);
    let query = AV.Query.or(query1, query2);
    let room = await query.first()
    if (room) {
      resolve(user)
    } else {
      resolve()
    }
  })
}

//返回 username
router.get('/userName',
  async(ctx, next) => {
    try {
      let timeStamp = Math.round(new Date().getTime() / 1000);
      let {
        wxUid
      } = ctx.query;
      if (!wxUid) {
        ctx.body = {
          status: -1,
          data: {},
          msg: `no wxUid`
        }
      }
      let query = new AV.Query('_User');
      query.equalTo('wxUid', wxUid);
      let user = await query.first()
      if (!user) {
        ctx.body = {
          status: 201,
          data: String(timeStamp),
          msg: `new one`
        }
      } else {
        ctx.body = {
          status: 200,
          data: user.get('username'),
          msg: `exist`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `userName err is ${err}`
      }
    }
  }
)

//获取用户信息
router.get('/user',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId //获取用户ID
      if (ctx.query.userId) {
        userId = ctx.query.userId
      }
      let query = new AV.Query(`_User`)
      query.equalTo(`objectId`, userId)
      let user = await query.first()
      if (!user) {
        return ctx.body = {
          status: 401,
          data: {},
          msg: 'Invalid user'
        }
      }
      let data = {};
      data = util.userInfo(user);
      return ctx.body = {
        status: 200,
        data: data,
        msg: 'success'
      }
    } catch (err) {
      return ctx.body = {
        status: -1,
        data: {},
        msg: `get user err is${err}`
      }
    }
  })

//修改用户信息
router.put('/user',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId; //获取用户ID
      let avatarId = ctx.request.body.avatarId; //头像图片ID
      let nickName = ctx.request.body.nickName; //昵称
      let gender = ctx.request.body.gender //性别 1男 2女
      let profile = ctx.request.body.profile; //个性签名
      let height = ctx.request.body.height
      let birthday = ctx.request.body.birthday
      if (avatarId) {
        //设置用户头像
        console.log('start avatarId-->');
        middle.authByFileId(userId, avatarId, 'avatarId').then(v => {
          return ctx.body({
            status: 200,
            data: {},
            msg: 'success'
          });
        }).catch(err => {
          return ctx.body({
            status: -1,
            data: {},
            msg: err
          });
        });
      } else {
        console.log('no nothing-->');
        let user = AV.Object.createWithoutData("_User", userId);
        if (nickName) {
          user.set('nickName', nickName);
        }
        if (gender) {
          user.set('gender', gender);
        }
        if (profile) {
          user.set('profile', profile);
        }if(height){
          user.set(`height`, height)
        }if(birthday){
          user.set(`birthday`, Date(birthday))
        }
        await user.save()
        ctx.body = {
          status: 200,
          data: {},
          msg: 'success'
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `put user err is ${err}`
      }
    }
  })

//查询粉丝和我关注的用户数量
router.get('/user/follow/len',
  jwt.verify,
  async(ctx, next) => {
    try {
      let start = new Date();
      let userId = ctx.decode.userId; //获取用户ID 
      console.log(`userId is ${userId}`)
      let user = AV.Object.createWithoutData('_User', userId);
      let promise = [];
      promise.push(new Promise(async(resolve, reject) => {
        try {
          let query = new AV.Query('_Followee')
          query.equalTo('user', user)
          query.include('followee');
          let followees = await query.find();
          if (_.isEmpty(followees)) {
            resolve(0);
          }
          resolve({
            'followeesLen': followees.length //关注的人
          });
        } catch (err) {
          reject(`followee query err is ${err}`)
        }
      }))
      promise.push(new Promise(async(resolve, reject) => {
        try {
          let query = new AV.Query('_Follower')
          query.equalTo('user', user)
          query.include('follower');
          let followers = await query.find();
          if (_.isEmpty(followers)) {
            resolve(0);
          }
          resolve({
            'followersLen': followers.length //粉丝
          });
        } catch (err) {
          reject(`follower query err is ${err}`)
        }
      }))
      let ret = await Promise.all(promise)
      let data = {
        'followeesLen': ret[0].followeesLen,
        'followersLen': ret[1].followersLen
      }
      ctx.body = {
        status: 200,
        data: data,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `len err is ${err}`
      }
    }
  });

//查询我关注的用户列表
router.get('/followee',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId //获取用户ID 
      let limit = ctx.query.limit || 10
      let skip = ctx.query.skip || 0
      let list = await getFollowList(userId, limit, skip, 1)
      ctx.body = {
        status: 200,
        data: list,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `followee err is ${err}`
      }
    }
  })

//查询我的粉丝列表
router.get('/follower',
  jwt.verify,
  async(ctx, next) => {
    try {
      let start = new Date();
      let userId = ctx.decode.userId; //获取用户ID 
      let limit = ctx.query.limit || 10
      let skip = ctx.query.skip || 0
      let list = await getFollowList(userId, limit, skip, 0)
      ctx.body = {
        status: 200,
        data: list,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get follower err--> ${err}`
      }
    }
  })

//查询粉丝和关注的人是否互相关注
//type: 0->follower粉丝; 1->followee关注
//status: 0->单方向; 1->互相关注
const getFollowList = (userId, limit, skip, type) => {
  return new Promise(async(resolve, reject) => {
    try {
      let promise = []
      let user = AV.Object.createWithoutData('_User', userId)
      if (type) { //followee
        let query = new AV.Query('_Followee')
        query.equalTo('user', user)
        query.include('followee')
        query.addDescending('createdAt')
        query.limit(limit)
        query.skip(skip)
        let userList = await query.find() //关注列表
        userList.forEach((user, index) => {
          promise.push(new Promise(async(resolve, reject) => {
            try {
              user = util.getUserInfo(user.get('followee'))
              let userObj = AV.Object.createWithoutData('_User', user.userId)
              let followeeObj = AV.Object.createWithoutData('_User', userId)
              let query = new AV.Query('_Followee')
              query.equalTo('user', userObj)
              query.equalTo('followee', followeeObj)
              let mutual = await query.first()
              user.status = _.isUndefined(mutual) ? 0 : 1
              resolve(user)
            } catch (err) {
              reject(`followeeQuery err --->${err}`)
            }
          }))
        })
      } else {
        let query = new AV.Query('_Follower')
        query.equalTo('user', user)
        query.include('follower')
        query.limit(limit)
        query.skip(skip)
        query.addDescending('createdAt')
        let userList = await query.find() //粉丝列表
        userList.forEach((user, index) => {
          promise.push(new Promise(async(resolve, reject) => {
            try {
              user = util.getUserInfo(user.get('follower'))
              let userObj = AV.Object.createWithoutData('_User', user.userId)
              let followerObj = AV.Object.createWithoutData('_User', userId)
              let query = new AV.Query('_Follower')
              query.equalTo('user', userObj)
              query.equalTo('follower', followerObj)
              let mutual = await query.first()
              user.status = _.isUndefined(mutual) ? 0 : 1
              resolve(user)
            } catch (err) {
              reject(`followerQuery err --->${err}`)
            }
          }))
        })
      }
      let result = await Promise.all(promise)
      resolve(result)
    } catch (err) {
      logger.error(`getFollowList err--->`, err)
      reject(`getFollowList err--->${err}`)
    }
  })
}

router.get('/user/friends',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId
      if (ctx.query.userId) {
        userId = ctx.query.userId
      }
      let ret = await mutualFollow(userId)
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: 1,
        data: {},
        msg: `get friends err is ${err}`
      }
    }
  }
)

const mutualFollow = (userId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let promise = []
      let user = AV.Object.createWithoutData('_User', userId)
      let query = new AV.Query('_Followee')
      query.equalTo('user', user)
      query.include('followee')
      let followees = await query.find()
      followees.forEach((followee, index) => {
        promise.push(new Promise(async(resolve, reject) => {
          try {
            followee = util.getUserInfo(followee.get('followee'))
            let followeeObj = AV.Object.createWithoutData('_User', followee.userId)
            let userObj = AV.Object.createWithoutData('_User', userId)
            let query = new AV.Query('_Followee')
            query.equalTo('user', followeeObj)
            query.equalTo('followee', userObj)
            query.include('user')
            let mutual = await query.first()
            if (mutual) {
              resolve(util.getUserInfo(mutual.get('user')))
            }
            resolve(null)
          } catch (err) {
            reject(`followeeQuery err --->${err}`)
          }
        }))
      })
      let result = await Promise.all(promise)
      let ret = result.filter((item) => {
        return item !== null
      })
      resolve(ret)
    } catch (err) {
      reject(`mutualFollow err --->${err}`)
    }
  })
}

//注册用户钱包
router.post('/user/wallet',
  jwt.verify,
  async(ctx, next) => {
    let userId = ctx.decode.userId; //获取用户ID 
    let query = new AV.Query('Wallet');
    query.equalTo('userId', userId);
    query.first().then(info => {
      return new Promise((resolve, reject) => {
        if (info) {
          //如果存在该用户的钱包，直接下一步
          resolve();
        } else {
          //没有钱包，创建该用户的钱包
          let wallet = AV.Object.new('Wallet');
          wallet.set('userId', userId);
          wallet.set('amount', 0);
          wallet.set('heyz_num', 0);
          wallet.set('virtual_cny', 0);

          wallet.save().then(v => {
            resolve();
          }).catch(e => {
            reject(e);
          });
        }
      });
    }).then(v => {
      ctx.body = {
        status: 200,
        data: {},
        msg: 'success'
      }
    }).catch(err => {
      console.log(`user/wallet err is ${err.stack ? err.stack : err}`);
      ctx.body = {
        status: -1,
        data: {},
        msg: err.stack ? err.stack : err
      }
    })
  })

//用户消费记录查询
router.get('/user/consume',
  jwt.verify,
  async(ctx, next) => {
    let userId = ctx.decode.userId; //获取用户ID 
    var page = ctx.query.page; //页码
    var size = ctx.query.size; //每页大小

    middle.getPageInfoByMySql('TradeRecord', userId, page, size, function (err, result) {
      if (err) {
        console.log('get chest err-->' + (err.stack ? err.stack : err));
        return ctx.body({
          status: -1,
          data: {},
          msg: err.stack ? err.stack : err
        });
      }
      result.forEach((el) => {
        el.type = Number(el.type);
        el.timeStamp = Number(el.timeStamp);
      });
      console.log('result-->' + JSON.stringify(result));
      console.log('result-->' + result.length);
      ctx.body({
        status: 200,
        data: result,
        msg: 'Successful!'
      });
    });
  });

//查询我关注的用户列表
router.get('/user/followee',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId; //获取用户ID 
      let list = await getFollowee(userId)
      ctx.body = {
        status: 200,
        data: list,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `followee err is ${err}`
      }
    }
  })

const getFollowee = (userId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let user = AV.Object.createWithoutData('_User', userId);
      let query = user.followeeQuery();
      query.include('followee');
      let followees = await query.find()
      //关注的用户列表 followees
      let list = middle.followList(followees);
      resolve(list)
    } catch (err) {
      reject('getFollowee err--> ' + err)
    }
  })
}

//查询我的粉丝列表
router.get('/user/follower',
  jwt.verify,
  async(ctx, next) => {
    try {
      let start = new Date();
      let userId = ctx.decode.userId; //获取用户ID 
      let list = await getFollower(userId)
      ctx.body = {
        status: 200,
        data: list,
        msg: 'success'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get follower err--> ${err}`
      }
    }
  })

const getFollower = (userId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let start = new Date();
      let user = AV.Object.createWithoutData('_User', userId);
      let data = {}; //返回数据
      let query = user.followerQuery()
      // query.equalTo('user', user)
      query.include('follower');
      let followers = await query.find()
      // let followers = f1
      //关注的用户列表 followees
      let list = middle.followList(followers);
      resolve(list)
    } catch (err) {
      reject('getFollowee err--> ' + err)
    }
  })
}

module.exports = router;
