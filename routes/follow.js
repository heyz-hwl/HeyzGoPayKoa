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

router.post('/follow',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId //请求者
      let toUserId = ctx.request.body.toUserId //被关注的人
      let sessionToken = ctx.request.sessionToken
      let data = {}
      if (!userId || !toUserId) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `params missing`
        }
      }
      let isFollow = await isfollow(userId, toUserId)
      if (!isFollow) {
        let user = AV.Object.createWithoutData('_User', userId)
        await user.follow(toUserId)
        await existStatus(userId, toUserId)
        let query = new AV.Query(`_User`)
        query.equalTo(`objectId`, userId)
        let userInfo = await query.first()
        await letter(userInfo, toUserId, sessionToken)
        await push()
        ctx.body = {
          status: 200,
          data: {
            detail: '关注成功'
          },
          message: `success`
        }
      } else {
        return ctx.body = {
          status: 403,
          data: {},
          msg: `已经关注`
        }
      }
    } catch (err) {
      ctx.body = {
        status: 200,
        data: {},
        msg: `follow err ->${err}`
      }
    }
  })

//判断是否已经关注，已关注reject，未关注resolve
const isfollow = (userId, toUserId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let query = new AV.Query('_Followee');
      let user = AV.Object.createWithoutData('_User', userId);
      let toUser = AV.Object.createWithoutData('_User', toUserId);
      query.equalTo('user', user);
      query.equalTo('followee', toUser);
      let follow = await query.first()
      if (follow) {
        resolve(true);
      } else {
        resolve(false);
      }
    } catch (err) {
      reject(`isfollow err ->${err}`);
    }
  })
}

//成功关注后，判断是否需要发送私信
const existStatus = (userId, toUserId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let query = new AV.Query('_Status');
      let user = AV.Object.createWithoutData('_User', userId);
      let toUser = AV.Object.createWithoutData('_User', toUserId);
      query.equalTo('inboxType', 'private');
      query.equalTo('source', user);
      query.equalTo('toUser', toUser);
      let info = await query.first()
      console.log('existStatus info-->' + info);
      if (info) {
        //已存在记录，不需要发送私信
        console.log('已存在记录，不需要发送私信');
        reject('noletter');
      } else {
        //不存在记录，需要发送私信和推送
        console.log('不存在记录，需要发送私信');
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  })
}

//发私信
const letter = (userInfo, toUserId, sessionToken) => {
  return new Promise(async(resolve, reject) => {
    try {
      let tmp = userInfo.get('nickName') || '有用户';
      let msg = tmp + '关注了你';
      console.log('msg -->' + msg);

      let status = new AV.Status(null, msg);
      let toUser = AV.Object.createWithoutData('_User', toUserId);

      let query = new AV.Query('_User');
      query.equalTo("objectId", toUserId);

      status.set('type', 15);
      status.inboxType = 'private';
      status.set('toUser', toUser);
      status.query = query;
      await status.send({
        'sessionToken': sessionToken
      })
      //发送成功
      console.log('私信发送成功-->');
      resolve();
    } catch (err) {
      console.log('私信发送失败-->');
      reject(`letter err ->${err}`);
    }
  })
}

//推送
const push = (userInfo, toUserId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let tmp = userInfo.get('nickName') || '有用户';
      let msg = tmp + '关注了你';
      let params = {
        alert: msg,
        sound: "default",
        type: 20,
        badge: "Increment"
      }; //发送推送
      await AV.Push.send({
        channels: toUserId,
        prod: PROFILE,
        data: params
      })
      resolve();
    } catch (err) {
      reject(`push err ->${err}`);
    }
  })
}

//取消关注
router.delete(`/unfollow`,
  jwt.verify,
  async(ctx, next) => {
    try {
      const userId = ctx.request.body.userId; //请求者
      const toUserId = ctx.request.body.toUserId; //被取消关注的人
      let data = {}; //返回数据
      let userQuery = new AV.Query("_User")
      userQuery.equalTo("objectId", userId)
      let info = await userQuery.first()
      //如果没有该用户
      if (!info) {
        return AV.Promise.error({
          status: 6,
          data: {
            detail: 'No this user'
          },
          message: "No this user"
        })
      }
      console.log('info -->' + JSON.stringify(info));
      //开始取消关注
      let user = AV.Object.createWithoutData('_User', userId);
      await user.unfollow(toUserId)
      //取消关注成功
      console.log('取消关注成功-->');
      ctx.body = {
        status: 1,
        data: {
          detail: '成功取消关注'
        },
        message: "Success"
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `delete unfollow`
      }
    }
  }
)

module.exports = router