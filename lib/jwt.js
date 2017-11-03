const jwt = require('jsonwebtoken');
const AV = require('leancloud-storage');
const config = require('./config');
const refreshToken = require('./refresh-token');

//生成token
const sign = async(ctx, next) => {
  try {
    let userId = (ctx.request.body && ctx.body.request.userId) || (ctx.query && ctx.query.userId) || ctx.headers['x-user-id'];
    console.log('userId-->' + userId);
    if (userId) { //判断用户是否存在
      let ret = await getUserInfo(userId)
      if (ret) { //如果存在该用户
        let token = await jwt.sign({
          userId: userId
        }, config.jwt.secret, {
          expiresIn: config.jwt.expiresIn //token过期时间
        })
        ctx.locals.token = token;
        next();
      } else { //不存在该用户
        ctx.body = {
          status: 401,
          data: {},
          msg: 'Invalid user!'
        }
      }
    } else {
      ctx.body = {
        status: 1000,
        data: {},
        msg: 'Parameter missing!'
      }
    }
  }
  catch(err) {
    ctx.body = {
      status: -1,
      data: {},
      msg: `sign err is ${err}`
    }
  }
}

//refresh token
/**
规则：过期时间不能超过半个小时
*/
const refresh = async(ctx, next) => {
  try {
    let token = (ctx.request.body && ctx.request.body.access_token) || (ctx.query && ctx.query.access_token) || ctx.headers['x-access-token'];
    if (token) {
      let decoded = jwt.decode(token, {
        complete: true
      });
      console.log('decoded-->' + JSON.stringify(decoded)); //如果token在允许过期的时间范围内，允许refresh token
      if (Math.floor(Date.now() / 1000) <= decoded.payload.exp + config.jwt.allowExpiresIn) {
        let userId = decoded.payload.userId; //判断用户是否存在
        let ret = await getUserInfo(userId)
        if (ret) {
          refreshToken(token, config.jwt.expiresIn, config.jwt.secret, {}, function (err, newToken) {
            if (err) {
              console.log('Fun refresh err-->' + err);
              return ctx.body = {
                status: -1,
                data: {},
                msg: err
              }
            }
            console.log('newToken-->' + newToken);
            res.locals.token = newToken;
            next();
          });
        } else { //不存在该用户
          ctx.body = {
            status: 401,
            data: {},
            msg: 'Invalid user!'
          }
        }
      } else {
        ctx.body = {
          status: 1001,
          data: {},
          msg: 'Invalid token! Please login again!'
        }
      }
    } else {
      ctx.body = {
        status: 1000,
        data: {},
        msg: 'Parameter missing!'
      }
    }
  } catch (err) {
    ctx.body = {
      status: -1,
      data: {},
      msg: `refresh err is ${err}`
    }
  }
}


//验证token
const verify = async(ctx, next) => {
  try {
    let token = (ctx.request.body && ctx.request.body.access_token) || (ctx.query && ctx.query.access_token) || ctx.headers['x-access-token'];
    if (token) { //开始验证
      let decode = await jwt.verify(token, config.jwt.secret)
      ctx.decode = decode;
      console.log('ctx.decode-->' + JSON.stringify(ctx.decode));
      return next();
    } else {
      ctx.body = {
        status: 1000,
        data: {},
        msg: 'Parameter missing!'
      }
    }
  } catch (err) {
    ctx.body = {
      status: 1000,
      data: {},
      msg: `jwt.verify err is ${err}`
    }
  }
}

//根据userId获取用户信息
const getUserInfo = async(userId) => {
  return new Promise(async(resolve, reject) => {
    try {
      let query = new AV.Query('_User');
      query.equalTo('objectId', userId);
      let ret = await query.first()
      resolve(ret)
    } catch (err) {
      rejcet(`getUserInfo err is ${err}`)
    }
  })
}

module.exports = {
  sign: sign,
  refresh: refresh,
  verify: verify
}
