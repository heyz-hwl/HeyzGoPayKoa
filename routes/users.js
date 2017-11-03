const router = require('koa-router')()
const AV = require('leancloud-storage');

router.prefix('/users')

router.get('/', async (ctx, next) => {
  try{
    let query = new AV.Query(`_User`)
    query.equalTo(`objectId`, `59929e68a22b9d0057108c6f`)
    let user = await query.first()
    ctx.body = `user is ${JSON.stringify(user)}`
  }
  catch (err){
    ctx.body =`err is ${err}`
  }
})

router.get('/bar', async (ctx, next) => {
  ctx.body = 'this is a users/bar response'
})

module.exports = router
