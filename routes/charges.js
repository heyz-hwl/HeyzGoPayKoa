const router = require('koa-router')()
const config = require('../lib/config');
const pingpp = require('pingpp')(config.pingpp.secretKey);
const moment = require('moment');
const AV = require('leancloud-storage');
const jwt = require('../lib/jwt');
const db = require('../lib/db');
const util = require('../lib/util');
const middle = require('../lib/middle');
const func = require('../lib/func')
const _ = require('lodash')

router.prefix('/v1')

//充值
router.post('/charges',
  jwt.verify,
  async(ctx, next) => {
    try {
      let amount = ctx.request.body.amount;
      let userId = ctx.decode.userId
      userId = ctx.request.body.userId ? ctx.request.body.userId : userId
      let amountPing = 0; //转换金额，为ping++ amount服务
      //检查必传参数是否存在
      if (!userId || !amount) {
        return ctx.body = {
          status: 1000,
          data: {},
          msg: 'Parameter missing!'
        }
      }
      //检查金额是否合法（为数字且大于或等于0.01元且小于等于1亿）
      if (util.isNumber(amount) && amount >= 0.01 && amount <= 100000000) {
        amountPing = amount * 100;
      } else {
        return ctx.body = {
          status: 1002,
          data: {},
          msg: 'Invalid parameter!'
        }
      }
      let orderNo = moment().format('YYYYMMDDHHmmss') + util.randomNum(4); //时分秒+4位随机数，组成订单号
      let channel = 'wx';
      let charge = await pingCharges(amountPing, orderNo, channel)
      //charge对象创建成功，往充值表插入数据
      let yuyi_num = util.oprate(amount, config.rate, 'mul') //语易数：人民币 10：1
      let time = moment().format('YYYY-MM-DD HH:mm:ss');
      let sql = `select * from Wallet where userId="${userId}"`
      let result = await db.excute(sql)
      if (_.isEmpty(result)) {
        sql = `insert into Recharge values(null, "${userId}", "${orderNo}", "充值", "${amount}", "${yuyi_num}", "${yuyi_num}", 3, "${channel}", "${time}", "${charge.id}", "${charge.time_expire}", "${config.rate}");`
      } else {
        sql = `insert into Recharge values(null, "${userId}", "${orderNo}", "充值", "${amount}", "${yuyi_num}", "${result[0].yuyi_num}", 3, "${channel}", "${time}", "${charge.id}", "${charge.time_expire}", "${config.rate}");`
      }
      let ret = await db.excute(sql)
      if (!_.isEmpty(ret)) {
        return ctx.body = {
          status: 200,
          data: charge,
          msg: 'Successful!'
        }
      } else {
        ctx.body = {
          status: -1,
          data: {},
          msg: `未完成`
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `charges err -> ${err}`
      }
    }
  })


//获取充值记录
router.get('/charges',
  jwt.verify,
  async(ctx, next) => {
    let userId = ctx.decode.userId; //获取用户ID
    let size = ctx.query.size ? ctx.query.size : 10; //每页大小
    let page = ctx.query.page ? ctx.query.page : 1; //页码
    userId = ctx.query.userId ? ctx.query.userId : userId
    let result = await middle.getPageInfoByMySql('Recharge', userId, page, size)
    console.log('result-->' + JSON.stringify(result))
    ctx.body = {
      status: 200,
      data: result,
      msg: 'Successful!'
    }
  });

//订单处于待支付状态时，查询订单charge对象
router.get('/retrieve',
  jwt.verify,
  async(ctx, next) => {
    try {
      let chargeId = ctx.query.chargeId; //获取charge对象的id
      //检查必传参数是否存在
      if (!chargeId) {
        return ctx.body = {
          status: 1000,
          data: {},
          msg: 'Parameter missing!'
        }
      }
      //查询订单charge对象
      let charge = await func.pingRetrieve(chargeId)
      if (charge) {
        //charge对象存在
        let curTime = Math.round(new Date().getTime() / 1000); //当前时间戳
        let time_expire = charge.time_expire; //charge对象过期时间
        if (curTime > time_expire) {
          //订单已过期，更改订单状态为4-订单过期
          let orderNo = charge.order_no //订单号
          let sql = 'update Recharge set status = 4 where order_no = "' + orderNo + '" ';
          let result = await db.excute(sql)
          ctx.body = {
            status: 1003,
            data: {},
            msg: 'Invalid order!'
          }
        } else {
          //返回charge对象，由客户端调支付控件继续支付
          ctx.body = {
            status: 200,
            data: charge,
            msg: 'Successful!'
          }
        }
      } else {
        ctx.body = {
          status: 1002,
          data: {},
          msg: 'Invalid parameter!'
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `retrieve err -> ${err}`
      }
    }
  })

//查询userId的钱包
router.get('/wallet',
  jwt.verify,
  async(ctx, next) => {
    try {
      let userId = ctx.decode.userId; //用户ID
      let time = moment().format('YYYY-MM-DD HH:MM:SS')
      userId = ctx.query.userId ? ctx.query.userId : userId
      let sql = `select * from Wallet where userId="${userId}"`
      console.log(`sql ->${sql}`)
      let info = await db.excute(sql)
      if (!_.isEmpty(info)) {
        ctx.body = {
          status: 200,
          data: info,
          msg: 'Successful'
        }
      } else {
        let sql = `insert into Wallet values(null, "${userId}", 0, 0, 0, "${time}", "${time}")`
        await db.excute(sql)
        sql = `select * from Wallet where userId="${userId}"`
        let ret = await db.excute(sql)
        ctx.body = {
          status: 200,
          data: ret,
          msg: 'success'
        }
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get wallet err -> ${err}`
      }
    }
  })

const pingCharges = (amountPing, orderNo, channel) => {
  return new Promise((resolve, reject) => {
    pingpp.charges.create({
      subject: "充值",
      body: "黑石传媒科技",
      amount: amountPing, //订单总金额, 人民币单位：分（如订单总金额为 1 元，此处请填 100）
      order_no: orderNo,
      channel: channel,
      currency: "cny",
      client_ip: "127.0.0.1",
      app: {
        id: config.pingpp.appId
      }
    }, (err, charge) => {
      if (err) {
        reject(`pay pingCharges err--> ${err}`)
      } else {
        resolve(charge)
      }
    })
  })
}

const pingRetrieve = (chargeId) => {
  return new Promise(async(resolve, reject) => {
    pingpp.charges.retrieve(chargeId, (err, charge) => {
      if (err) {
        reject(`pingRetrieve err -> ${err}`)
      }
      resolve(charge)
    })
  })
}

module.exports = router;
