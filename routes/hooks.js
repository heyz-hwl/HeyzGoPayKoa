const router = require('koa-router')()
const AV = require('leancloud-storage')
const db = require('../lib/db')
const util = require('../lib/util')
const moment = require('moment')
const middle = require('../lib/middle')
const _ = require('lodash')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')

/*
Wallet: values(null, "${userId}", "${amount}", "${yuyi_num}", ${yumao_num},  "${createTime}", "${updateTime}")
Recharge: values(null, "${userId}", "${order_no}", "${order_name}", "${amount}", "${status}", "${channel}", "${createTime}", "${chargeId}", "${time_expire}", "${rate}")
*/

//ping++ 接收 Webhooks 通知
router.post('/hooks', async(ctx, next) => {
  let body = ctx.request.body; //接收信息
  let time = moment().format('YYYY-MM-DD HH:mm:ss')
  let resp = (ret, status_code) => {
    ctx.res.writeHead(status_code, {
      "Content-Type": "text/plain; charset=utf-8"
    })
    ctx.body = (ret)
  }
  try {
    let event = body;
    if (event.type === undefined) {
      return resp('Event 对象中缺少 type 字段', 400);
    }
    switch (event.type) {
      case "charge.succeeded":
        //支付成功，更新充值表对应该订单的状态
        let sql = `update Recharge set status = 1 where order_no="${event.data.object.order_no}"`
        await db.excute(sql)
        //修改钱包金额
        let rechargeSql = `select * from Recharge where order_no="${event.data.object.order_no}"`
        let rechargeData = await db.excute(rechargeSql)
        sql = `select * from Wallet where userId="${rechargeData[0].userId}"`
        let walletData = await db.excute(sql)
        if (!_.isEmpty(walletData)) {
          console.log('----存在该用户的记录，更新amount----');
          let amount = util.oprate(Number(walletData[0].amount), Number(rechargeData[0].amount), 'add');
          let yuyi_num = util.oprate(Number(walletData[0].yuyi_num), Number(rechargeData[0].yuyi_num), 'add');
          let sql = `update Wallet set amount="${amount}",yuyi_num="${yuyi_num}",updateTime="${time}" where id="${walletData[0].id}"`
          await db.excute(sql)
          let obj = {
            'userId': rechargeData[0].userId,
            'type': '1', //充值成功
            'status': '+', //增加
            'yuyi_num': rechargeData[0].yuyi_num,
            'time': moment().format('YYYY-MM-DD HH:mm:ss'),
            'timeStamp': util.getTimeStamp()
          }
          let d = await middle.walletRecord(obj)
          resp("OK", 200);
        } else {
          console.log('----不存在该用户的记录，新增----');
          let sql = `insert into Wallet values(null, "${rechargeData[0].userId}", "${rechargeData[0].amount}", "${rechargeData[0].yuyi_num}", 0,  "${time}", "${time}")`
          let ret = await db.excute(sql)
          let obj = {
            'userId': rechargeData[0].userId,
            'type': '1', //充值成功
            'status': '+', //增加
            'yuyi_num': rechargeData[0].yuyi_num,
            'time': moment().format('YYYY-MM-DD HH:mm:ss'),
            'timeStamp': util.getTimeStamp()
          }
          let d = await middle.walletRecord(obj)
          resp("OK", 200);
        }
        break;
      case "balance.withdrawal.succeeded":
        // 在此处加入对提现的处理代码
        break;
      case "refund.succeeded":
        // 在此处加入对退款的处理代码
        return resp("OK", 200)
        break;
      default:
        return resp("未知 Event 类型", 400)
        break;
    }
  } catch (err) {
    logger.error(`hooks err -->`, err)
    return resp(`JSON 解析失败`, 400)
  }
})

module.exports = router;
