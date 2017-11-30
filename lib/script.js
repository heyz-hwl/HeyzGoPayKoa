const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const changeSequence = require('../routes/audioChannel').changeSequence

const schedule = require('node-schedule');
const rule = new schedule.RecurrenceRule();

changeSequence(1).then((ret) => {
  logger.debug(`changeSequence --->`, ret)
}).catch((err) => {
  logger.error(`changeSequence err --->`, err)
})

const updateSignTable = () => {
  return new Promise((resolve, reject) => {
    try {
      let j = schedule.scheduleJob(`0 0 1 * *`, async() => {
        let promise = []
        let query = new AV.Query('Sign')
        let result = await query.find()
        result.forEach((item, index) => {
          item.set('signTable', [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
          ])
        })
        let ret = await AV.Object.saveAll(result)
        resolve(ret)
      });
    } catch (err) {
      reject(`updateSignTable err is ${err}`)
    }
  })
}()
