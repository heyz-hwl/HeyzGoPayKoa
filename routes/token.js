const router = require('koa-router')()
const config = require('../lib/config');
const moment = require('moment');
const AV = require('leancloud-storage');
const jwt = require('../lib/jwt');

router.prefix('/v1')

//生成access token
router.post('/sign', 
 jwt.sign,  
 (ctx, next) => {
  let token = ctx.locals.token;
  ctx.body = {
    status: 200,
    data: token,
    msg: 'Successful!'
  }
})

// //生成access token
// router.post('/refresh', 
//  jwt.sign,  
//  (ctx, next) => {
//   let token = ctx.locals.token;
//   ctx.body = {
//     status: 200,
//     data: token,
//     msg: 'Successful!'
//   }
// })

// refresh token
router.post('/refresh', jwt.refresh, function (req, res) {
  var token = res.locals.token;
  res.json({
    status: 200,
    data: token,
    msg: 'Successful!'
  });
});

module.exports = router;
