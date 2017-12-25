const jwt = require('jsonwebtoken');

/**
 * Will refresh the given token.  The token is expected to be decoded and valid. No checks will be
 * performed on the token.  The function will copy the values of the token, give it a new
 * expiry time based on the given 'expiresIn' time and will return a new signed token.
 *
 * @param token
 * @param expiresIn
 * @param secretOrPrivateKey
 * @param verifyOptions - Options to verify the token
 * @param callback
 * @return New signed JWT token
 */
//TODO: check if token is not good, if so return error ie: no payload, not required fields, etc.
module.exports = function (token, expiresIn, secretOrPrivateKey) {
  return new Promise(async(resolve, reject) => {
    let header;
    let payload;
    let decoded = jwt.decode(token, {
      complete: true
    });
    if (decoded.header) {
      header = decoded['header'];
      payload = decoded['payload'];
    } else {
      payload = token;
    }
    let optionMapping = {
      exp: 'expiresIn',
      aud: 'audience',
      nbf: 'notBefore',
      iss: 'issuer',
      sub: 'subject',
      jti: 'jwtid',
      alg: 'algorithm'
    };
    let newToken;
    let obj = {};
    let options = {};
    for (let key in payload) {
      if (Object.keys(optionMapping).indexOf(key) === -1) {
        obj[key] = payload[key];
      } else {
        options[optionMapping[key]] = payload[key];
      }
    }
    if (header) {
      options.header = {};
      for (let key in header) {
        if (key !== 'typ') { //don't care about typ -> always JWT
          if (Object.keys(optionMapping).indexOf(key) === -1) {
            options.header[key] = header[key];
          } else {
            options[optionMapping[key]] = header[key];
          }
        }
      }
    } else {
      console.log('No algorithm was defined for token refresh - using default');
    }
    if (!token.iat) {
      options['noTimestamp'] = true;
    }
    options['expiresIn'] = expiresIn;
    newToken = jwt.sign(obj, secretOrPrivateKey, options);
    resolve(newToken);
  })
};
