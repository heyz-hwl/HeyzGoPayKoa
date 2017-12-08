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

//提现
router.post('/withdrawal',
  jwt.verify,
  async(ctx, next) => {
    try {
			let userId = ctx.decode.userId
			userId = ctx.query.userId ? ctx.query.userId : userId      			
      let amount = ctx.request.body.amount; //接收数据
      let amountPing = 0; //转换金额，为ping++ amount服务
      //检查必传参数是否存在
      if (!userId || !amount) {
        return ctx.body = {
          status: 1000,
          data: {},
          msg: 'Parameter missing!'
        }
      }
      //检查金额是否合法（为数字且大于或等于0.1元且小于等于1亿）
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
      let channel = 'wx_pub';
      let withdrawal = await pingWithdrawal(amountPing, orderNo, channel)
      //withdrawal对象创建成功，往充值表插入数据
      let yumao_num = util.oprate(amount, config.rate, 'mul'); //羽毛数：人民币 10：1
      let time = moment().format('YYYY-MM-DD HH:mm:ss');
      let sql = `insert into Recharge values(null, "${userId}", "${orderNo}", "提现", "${amount}", "${yumao_num}", 3, "${channel}", "${time}", "${charge.id}", "${charge.time_expire}", "${config.rate}");`;
      let ret = await db.excute(sql)
      console.log(`ret -> ${JSON.stringify(ret)}`)
      return ctx.body = {
        status: 200,
        data: withdrawal,
        msg: 'Successful!'
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `withdrawal err -> ${err}`
      }
    }
  })

	const pingWithdrawal = (amountPing, orderNo, channel) => {
    return new Promise((resolve, reject) => {
      pingpp.withdrawal.create({
        subject: "提现",
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
          reject(`pay pingCharges err--> ${err}`);
        }
        resolve(charge)
      })
    })
  }

module.exports = router;
