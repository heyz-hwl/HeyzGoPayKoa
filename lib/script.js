const schedule = require('node-schedule');
const rule = new schedule.RecurrenceRule();

const AV = require('leancloud-storage')
const config = require('./config')
AV.init({
  appId: config.heyzgo.ID,
  appKey: config.heyzgo.Key,
  masterKey: config.heyzgo.MasterKey
});
AV.Cloud.useMasterKey();
// changeSequence(1).then((ret) => {
//   logger.debug(`changeSequence --->`, ret)
// }).catch((err) => {
//   logger.error(`changeSequence err --->`, err)
// })

const updateSignTable = () => {
  return new Promise(async(resolve, reject) => {
    try {
      console.log(`updateSignTable`)      
      // let j = schedule.scheduleJob(`0 0 1 * *`, async() => {
        let promise = []
        let query = new AV.Query('Sign')
        let count = await query.count()
        query.limit(count)
        let result = await query.find()
        result.forEach((item, index) => {
          item.set('signCount', 0)
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
        console.log(`ret is ${JSON.stringify(ret)}`)
        resolve(ret)
      // });
    } catch (err) {
      reject(`updateSignTable err is ${err}`)
    }
  })
}

updateSignTable()
