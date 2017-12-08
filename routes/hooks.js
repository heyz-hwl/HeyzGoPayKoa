const router = require('koa-router')()
const AV = require('leancloud-storage');
const db = require('../lib/db');
const util = require('../lib/util');
const middle = require('../lib/middle');
const _ = require('lodash')

//ping++ 接收 Webhooks 通知
router.post('/hooks', (ctx, next) => {
  let body = ctx.request.body; //接收信息
  console.log('接收 Webhooks 通知body-->' + JSON.stringify(body));
  let time = moment().format('YYYY-MM-DD HH:mm:ss')
  let resp = (ret, status_code) => {
    ctx.response.writeHead(status_code, {
      "Content-Type": "text/plain; charset=utf-8"
    })
    ctx.response.end(ret)
  }
  try {
    let event = body;
    if (event.type === undefined) {
      return resp('Event 对象中缺少 type 字段', 400);
    }
    switch (event.type) {
      case "charge.succeeded":
        //支付成功，更新充值表对应该订单的状态
        let sql = 'update Recharge set status = 1 where order_no = ' + event.data.object.order_no;
        await db.excute(sql)
        //修改钱包金额
        let rechargeSql = 'select userId,amount,rate from Recharge where order_no = ' + event.data.object.order_no;
        let rs = await db.excute(rechargeSql)
        sql = `select * from Wallet where userId="${rs[0].userId}"`
        let info = await db.excute(sql)
        if (!_.isEmpty(info)) {
          console.log('----存在该用户的记录，更新amount----');
          let amount = util.oprate(Number(info.get('amount')), Number(rs[0].amount), 'add');
          let tmp = util.oprate(Number(rs[0].amount), Number(rs[0].rate), 'mul');
          let yuyi_num = util.oprate(Number(info.get('yuyi_num')), tmp, 'add');
          let sql = `update Wallet set amount="${amount}",yuyi_num="${yuyi_num}",updateTime="${time}" where id="${info.id}"`
          await db.excute(sql)
          //记录钱包黑石
          let obj = {
            'userId': rs[0].userId,
            'type': '1', //充值成功
            'status': '+', //增加
            'heyzNum': heyz_num, //黑石数
            'time': moment().format('YYYY-MM-DD HH:mm:ss'),
            'timeStamp': util.getTimeStamp()
          }
          await middle.walletRecord(obj)
          resp("OK", 200);
        } else {
          console.log('----不存在该用户的记录，新增----');
          // resp("OK", 200);
          //记录钱包黑石
          let yuyi_num = util.oprate(Number(rs[0].amount), Number(rs[0].rate), 'mul')
          let sql = `insert into Wallet values(null, "${rs[0].userId}", "${rs[0].amount}", "${yuyi_num}", "${time}", "${time}")`
          await db.excute(sql)
          let obj = {
            'userId': rs[0].userId,
            'type': '1', //充值成功
            'status': '+', //增加
            'heyzNum': util.oprate(Number(rs[0].amount), Number(rs[0].rate), 'mul'), //黑石数
            'time': moment().format('YYYY-MM-DD HH:mm:ss'),
            'timeStamp': util.getTimeStamp()
          }
          await middle.walletRecord(obj)
          resp("OK", 200);
        }
        break;
      case "refund.succeeded":
        // 开发者在此处加入对退款异步通知的处理代码
        return resp("OK", 200);
        break;
      default:
        return resp("未知 Event 类型", 400);
        break;
    }
  } catch (err) {
    return resp('JSON 解析失败', 400);
  }
})

module.exports = router;
