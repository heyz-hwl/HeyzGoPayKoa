const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const _ = require('lodash');
const moment = require('moment');
const socket = require('../lib/socket');
const {
  upgrade
} = require('../lib/func');

router.prefix('/v1')

//获取用户签到纪录和积分
router.get('/sign/status',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);
      let isSign;
      if (!userId) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `no userId`
        }
      }
      let query = new AV.Query('Sign');
      let usr = AV.Object.createWithoutData('Sign', userId);
      query.equalTo('user', usr);
      let record = await query.first()
      if (!record) {
        record = {};
      } else {
        let today = new Date(moment.now()).getDate();
        if (record.get('signTable')[today - 1] == 1) {
          isSign = true;
        } else {
          isSign = false;
        }
      }
      let query2 = new AV.Query('_User');
      query2.equalTo('objectId', userId);
      let user = await query2.first()
      ctx.body = {
        status: 200,
        data: {
          record,
          isSign: isSign,
          grade: user.get('grade')
        },
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `signStatus err is ${err}`
      }
    }
  })

//累计签到到特殊天数,增长积分
const gradeAdd = {
  1: 100,
  3: 300,
  7: 400,
  14: 500,
  21: 800
}

//签到
router.get('/sign',
  jwt.verify,
  async(ctx, next) => {
    try {
      let today = new Date(moment.now()).getDate();
      let signGain = {};
      let newSign, signTable;
      signGain.grade = 20; //默认签到获得20积分
      signGain.exp = 5; //默认签到获得5经验
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);
      if (!userId) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `no userId`
        }
      }
      let query = new AV.Query('_User');
      query.equalTo('objectId', userId);
      let user = await query.first()
      let exp = user.get('exp')
      let grade = user.get('grade');
      let query2 = new AV.Query('Sign');
      let usr = AV.Object.createWithoutData('_User', userId);
      query2.equalTo('user', usr);
      let Sign = await query2.first()
      if (!_.isUndefined(Sign)) {
        newSign = AV.Object.createWithoutData('Sign', Sign.get('objectId'));
        signTable = Sign.get('signTable');
      } else {
        newSign = AV.Object.new('Sign');
        newSign.set('user', usr);
        signTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
      if (signTable[today - 1] !== 1) { //今天没签到的
        signTable[today - 1] = 1;
        console.log(`signTable is ${JSON.stringify(signTable)}`)
        newSign.set('signTable', signTable);
        let signCount = signTable.filter((item, index) => {
          return item == 1;
        }).length;
        newSign.set('signCount', signCount);
        newSign.set('name', '每日登陆')
        if (signCount == 1 || signCount == 3 || signCount == 7 || signCount == 14 || signCount == 21) {
          console.log(`special day`)
          signGain.grade += gradeAdd[signCount];
          grade += signGain.grade;
        } else {
          grade += signGain.grade;
        }
        exp += 5;
        let level = await upgrade(exp, userId)
        usr.set('grade', grade);
        usr.set('exp', exp);
        usr.set('level', level);
        let user = await usr.save()
        let sign = await newSign.save()
        return ctx.body = {
          status: 200,
          data: {
            signGain,
            user,
            sign
          },
          msg: `success`
        }
      } else {
        return ctx.body ={
          status: -1,
          data: {},
          msg: `不允许重复签到`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `err is ${err}`
      }
    }
  })

module.exports = router;
