const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const changeSequence = require('../routes/audioChannel').changeSequence

changeSequence(1).then((ret) => {
  logger.debug(`changeSequence --->`, ret)
}).catch((err) => {
  logger.error(`changeSequence err --->`, err)
})
